import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../services/persistence/DatabaseService';
import { SubscriptionRepository } from '../services/persistence/SubscriptionRepository';
import { ProductionBillingProvider } from '../services/saas/billing/ProductionBillingProvider';

describe('Billing & Webhooks Production Challenge', () => {
  let dbService: DatabaseService;
  let subRepo: SubscriptionRepository;
  let billingProvider: ProductionBillingProvider;
  const webhookSecret = 'whsec_prod_challenge_secret_7766';
  const tenantAlpha = 'tenant-alpha-billing';
  const tenantBeta = 'tenant-beta-billing';

  beforeEach(() => {
    dbService = DatabaseService.createIsolatedInstance(':memory:');
    const db = dbService.getDb();
    
    // Seed Tenant Alpha and Beta
    db.prepare(`
      INSERT INTO organizations (id, name, slug, contact_email, created_at, updated_at)
      VALUES (?, 'Alpha Org', 'alpha-org', 'alpha@test.io', datetime('now'), datetime('now')),
             (?, 'Beta Org', 'beta-org', 'beta@test.io', datetime('now'), datetime('now'))
    `).run(tenantAlpha, tenantBeta);

    db.prepare(`
      INSERT INTO subscriptions (
        tenant_id, tier, status, current_period_end, max_homes, max_devices_per_home,
        telemetry_interval_seconds, allow_realtime_websocket, allow_autonomous_control,
        gemini_calls_per_day, used_gemini_calls_today, last_quota_reset_date, created_at, updated_at
      ) VALUES 
      (?, 'STARTER_HOME', 'ACTIVE', datetime('now', '+30 days'), 1, 3, 60, 0, 0, 10, 0, '2026-11-07', datetime('now'), datetime('now')),
      (?, 'STARTER_HOME', 'ACTIVE', datetime('now', '+30 days'), 1, 3, 60, 0, 0, 10, 0, '2026-11-07', datetime('now'), datetime('now'))
    `).run(tenantAlpha, tenantBeta);

    subRepo = new SubscriptionRepository(db);
    billingProvider = new ProductionBillingProvider(subRepo);
  });

  it('rejects invalid signatures and forged secrets', () => {
    const rawPayload = JSON.stringify({ id: 'evt_sig_01', type: 'invoice.paid' });
    const fakeSecret = 'whsec_fake_attacker_key';
    const now = Math.floor(Date.now() / 1000);
    const fakeSig = crypto.createHmac('sha256', fakeSecret).update(`${now}.${rawPayload}`).digest('hex');
    const header = `t=${now},v1=${fakeSig}`;

    const res = billingProvider.verifyWebhookDetailed(rawPayload, header, webhookSecret);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Invalid HMAC signature/i);
  });

  it('rejects replayed valid event IDs', () => {
    const rawPayload = JSON.stringify({ id: 'evt_replay_01', type: 'invoice.paid' });
    const now = Math.floor(Date.now() / 1000);
    const validSig = crypto.createHmac('sha256', webhookSecret).update(`${now}.${rawPayload}`).digest('hex');
    const header = `t=${now},v1=${validSig}`;

    const first = billingProvider.verifyWebhookDetailed(rawPayload, header, webhookSecret);
    expect(first.valid).toBe(true);

    const replay = billingProvider.verifyWebhookDetailed(rawPayload, header, webhookSecret);
    expect(replay.valid).toBe(false);
    expect(replay.isReplay).toBe(true);
  });

  it('rejects missing event IDs', () => {
    const rawPayload = JSON.stringify({ type: 'invoice.paid', data: { tenantId: tenantAlpha } });
    const now = Math.floor(Date.now() / 1000);
    const validSig = crypto.createHmac('sha256', webhookSecret).update(`${now}.${rawPayload}`).digest('hex');
    const header = `t=${now},v1=${validSig}`;

    const res = billingProvider.verifyWebhookDetailed(rawPayload, header, webhookSecret);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Missing required event id/i);
  });

  it('VULNERABILITY: Out-of-order webhook delivery overwrites newer state due to lack of sequence / timestamp reconciliation', () => {
    // Event 1 (Newer event: Customer downgrades to STARTER_HOME on Nov 7)
    subRepo.updateTier(tenantAlpha, {
      tier: 'STARTER_HOME',
      status: 'ACTIVE',
      currentPeriodEnd: '2026-12-07T00:00:00Z',
      maxHomes: 1,
      maxDevicesPerHome: 3,
      telemetryIntervalSeconds: 60,
      allowRealtimeWebSocket: false,
      allowAutonomousControl: false,
      geminiCallsPerDay: 10,
      usedGeminiCallsToday: 0,
    });

    // Event 2 arrives late (Old event from Nov 1: Customer had upgraded to SMART_RESIDENCE)
    // The webhook handler receives Event 2 with its own unique event ID
    const oldDelayedPayload = JSON.stringify({
      id: 'evt_delayed_upgrade_from_past',
      type: 'customer.subscription.updated',
      data: { tenantId: tenantAlpha, plan: 'SMART_RESIDENCE' }
    });
    const now = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', webhookSecret).update(`${now}.${oldDelayedPayload}`).digest('hex');
    const header = `t=${now},v1=${sig}`;

    const res = billingProvider.verifyWebhookDetailed(oldDelayedPayload, header, webhookSecret);
    expect(res.valid).toBe(true); // Accepted because event ID is distinct!

    // If application updates state from delayed webhook, it regresses to older state
    subRepo.updateTier(tenantAlpha, {
      tier: 'SMART_RESIDENCE',
      status: 'ACTIVE',
      currentPeriodEnd: '2026-12-01T00:00:00Z',
      maxHomes: 5,
      maxDevicesPerHome: 10,
      telemetryIntervalSeconds: 30,
      allowRealtimeWebSocket: true,
      allowAutonomousControl: true,
      geminiCallsPerDay: 50,
      usedGeminiCallsToday: 0,
    });

    const activeSub = subRepo.getSubscription(tenantAlpha);
    expect(activeSub?.tier).toBe('SMART_RESIDENCE'); // Reverted to outdated tier without timestamp check!
  });

  it('VULNERABILITY: Cross-tenant event injection — Webhook accepts arbitrary tenantId from payload without verifying against provider customer ID mapping', () => {
    // Malicious or misrouted webhook claiming to update Tenant Alpha, but payload injected with Tenant Beta ID
    const spoofedPayload = JSON.stringify({
      id: 'evt_spoofed_tenant_01',
      type: 'customer.subscription.updated',
      data: { tenantId: tenantBeta, amount: 9999 } // Injected Tenant Beta
    });
    const now = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', webhookSecret).update(`${now}.${spoofedPayload}`).digest('hex');
    const header = `t=${now},v1=${sig}`;

    const res = billingProvider.verifyWebhookDetailed(spoofedPayload, header, webhookSecret);
    expect(res.valid).toBe(true);
    // Notice: res.tenantId is accepted directly from untrusted payload JSON without mapping check!
    expect(res.tenantId).toBe(tenantBeta);
  });
});
