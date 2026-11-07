import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../services/persistence/DatabaseService';
import { SubscriptionRepository } from '../services/persistence/SubscriptionRepository';
import { ProductionBillingProvider } from '../services/saas/billing/ProductionBillingProvider';

describe('Billing & Webhooks Production Remediation Challenge', () => {
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
      (?, 'STARTER_HOME', 'ACTIVE', datetime('now', '+30 days'), 1, 3, 60, 0, 0, 10, 0, '2026-11-07', datetime('now'), '2026-11-07T12:00:00Z'),
      (?, 'STARTER_HOME', 'ACTIVE', datetime('now', '+30 days'), 1, 3, 60, 0, 0, 10, 0, '2026-11-07', datetime('now'), '2026-11-07T12:00:00Z')
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

  it('REMEDIATED: Out-of-order webhook delivery is detected and rejected without state regression', () => {
    // Current state on Nov 7: Customer is on STARTER_HOME with updated_at = 2026-11-07T12:00:00Z
    expect(subRepo.getSubscription(tenantAlpha)?.tier).toBe('STARTER_HOME');

    // Delayed webhook from Nov 1 arrives (older than current subscription state)
    const oldDelayedPayload = JSON.stringify({
      id: 'evt_delayed_upgrade_from_past',
      type: 'customer.subscription.updated',
      data: { tenantId: tenantAlpha, plan: 'SMART_RESIDENCE' }
    });
    const now = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', webhookSecret).update(`${now}.${oldDelayedPayload}`).digest('hex');
    const header = `t=${now},v1=${sig}`;

    // Process atomically with timestamp check
    const res = billingProvider.processWebhookAndApply({
      rawPayload: oldDelayedPayload,
      signatureHeader: header,
      secret: webhookSecret,
      eventTimestamp: '2026-11-01T00:00:00Z', // 6 days in the past!
      newPlan: {
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
      },
    });

    // Verification safely rejects the stale event!
    expect(res.valid).toBe(false);
    expect(res.isStale).toBe(true);
    expect(res.applied).toBe(false);
    expect(res.error).toMatch(/Out-of-order event rejected/i);

    // Verify subscription state DID NOT regress
    const activeSub = subRepo.getSubscription(tenantAlpha);
    expect(activeSub?.tier).toBe('STARTER_HOME');
  });

  it('REMEDIATED: Cross-tenant event injection is blocked by customerId to tenantId mapping validation', () => {
    // Registered customer mapping in database / Stripe service
    const customerTenantMapping: Record<string, string> = {
      'cus_stripe_alpha_123': tenantAlpha,
      'cus_stripe_beta_456': tenantBeta,
    };

    // Malicious or misrouted webhook claiming customer Alpha, but trying to inject Tenant Beta ID
    const spoofedPayload = JSON.stringify({
      id: 'evt_spoofed_tenant_01',
      type: 'customer.subscription.updated',
      data: { customerId: 'cus_stripe_alpha_123', tenantId: tenantBeta, amount: 9999 } // Injected Tenant Beta
    });
    const now = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', webhookSecret).update(`${now}.${spoofedPayload}`).digest('hex');
    const header = `t=${now},v1=${sig}`;

    const res = billingProvider.verifyWebhookDetailed(
      spoofedPayload,
      header,
      webhookSecret,
      customerTenantMapping
    );

    // Safely blocked cross-tenant injection!
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Cross-tenant injection blocked/i);
  });
});
