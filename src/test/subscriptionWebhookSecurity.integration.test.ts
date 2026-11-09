import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../services/persistence/DatabaseService';
import { SubscriptionRepository } from '../services/persistence/SubscriptionRepository';
import { ProductionBillingProvider } from '../services/saas/billing/ProductionBillingProvider';

describe('Integration: Subscription Webhook Security & Idempotency', () => {
  let dbService: DatabaseService;
  let subRepo: SubscriptionRepository;
  let billingProvider: ProductionBillingProvider;
  const webhookSecret = 'whsec_prod_verification_test_secret_9988';

  beforeEach(() => {
    dbService = DatabaseService.createIsolatedInstance(':memory:');
    subRepo = new SubscriptionRepository(dbService.getDb());
    billingProvider = new ProductionBillingProvider(subRepo);
  });

  it('verifies valid timestamped webhook signatures with HMAC-SHA256', () => {
    const rawPayload = JSON.stringify({
      id: 'evt_test_001',
      type: 'invoice.payment_succeeded',
      data: { tenantId: 'tenant-123', amount: 4900 },
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    const signedPayload = `${nowSeconds}.${rawPayload}`;
    const hmacSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
    const header = `t=${nowSeconds},v1=${hmacSig}`;

    const result = billingProvider.verifyWebhookDetailed(rawPayload, header, webhookSecret);
    expect(result.valid).toBe(true);
    expect(result.isReplay).toBe(false);
    expect(result.eventId).toBe('evt_test_001');
  });

  it('rejects webhooks with expired timestamp drift (>300 seconds)', () => {
    const rawPayload = JSON.stringify({ id: 'evt_old_002', type: 'invoice.payment_succeeded' });
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
    const signedPayload = `${expiredTimestamp}.${rawPayload}`;
    const hmacSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
    const header = `t=${expiredTimestamp},v1=${hmacSig}`;

    const result = billingProvider.verifyWebhookDetailed(rawPayload, header, webhookSecret);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired|timestamp/i);
  });

  it('strictly rejects duplicate / replay webhook events using database unique constraints', () => {
    const rawPayload = JSON.stringify({
      id: 'evt_unique_101',
      type: 'customer.subscription.updated',
      data: { tenantId: 'tenant-999', plan: 'SMART_RESIDENCE' },
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    const signedPayload = `${nowSeconds}.${rawPayload}`;
    const hmacSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
    const header = `t=${nowSeconds},v1=${hmacSig}`;

    // 1. First delivery succeeds
    const firstDelivery = billingProvider.verifyWebhookDetailed(rawPayload, header, webhookSecret);
    expect(firstDelivery.valid).toBe(true);
    expect(firstDelivery.isReplay).toBe(false);

    // 2. Replay attempt with same event ID is blocked
    const replayDelivery = billingProvider.verifyWebhookDetailed(rawPayload, header, webhookSecret);
    expect(replayDelivery.valid).toBe(false);
    expect(replayDelivery.isReplay).toBe(true);
    expect(replayDelivery.error).toMatch(/replay rejected/i);
  });

  it('rejects webhooks missing an event id to prevent replay protection bypass', () => {
    const rawPayload = JSON.stringify({
      type: 'invoice.payment_succeeded',
      data: { tenantId: 'tenant-123', amount: 4900 },
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    const signedPayload = `${nowSeconds}.${rawPayload}`;
    const hmacSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
    const header = `t=${nowSeconds},v1=${hmacSig}`;

    const result = billingProvider.verifyWebhookDetailed(rawPayload, header, webhookSecret);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/missing required event id/i);
  });
});
