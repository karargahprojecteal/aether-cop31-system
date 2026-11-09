import { describe, it, expect } from 'vitest';
import { subscriptionServiceInstance } from '../services/saas/SubscriptionService';
import { tenantManagerInstance } from '../services/saas/TenantManager';
import crypto from 'crypto';

describe('AETHER Subscription Quotas & Signed Webhook Security', () => {
  it('enforces Starter Home quota of maximum 1 home and 3 devices', () => {
    const org = tenantManagerInstance.createOrganization('Starter Org', 'test@starter.io', 'starter-org');
    
    // Check home quota
    const homeQuotaZero = subscriptionServiceInstance.canAddHome(org.id, 0);
    expect(homeQuotaZero.allowed).toBe(true);
    expect(homeQuotaZero.limit).toBe(1);

    const homeQuotaOne = subscriptionServiceInstance.canAddHome(org.id, 1);
    expect(homeQuotaOne.allowed).toBe(false); // Quota exceeded
  });

  it('unlocks multi-home capacity upon upgrading to Smart Residence tier', () => {
    const org = tenantManagerInstance.createOrganization('Upgrade Org', 'test@upgrade.io', 'upgrade-org');
    
    const upgradedPlan = subscriptionServiceInstance.upgradeTier(org.id, 'SMART_RESIDENCE');
    expect(upgradedPlan.tier).toBe('SMART_RESIDENCE');
    expect(upgradedPlan.maxHomes).toBe(5);
    expect(upgradedPlan.maxDevicesPerHome).toBe(25);

    const homeQuotaAfterUpgrade = subscriptionServiceInstance.canAddHome(org.id, 1);
    expect(homeQuotaAfterUpgrade.allowed).toBe(true);
  });

  it('validates signed webhooks with HMAC-SHA256 and rejects forged payloads', () => {
    const billingProvider = subscriptionServiceInstance.getBillingProvider();
    const webhookSecret = 'whsec_aether_cryptographic_test_key_99';
    const validPayload = JSON.stringify({ event: 'subscription.updated', tenantId: 'tenant-123', status: 'ACTIVE' });
    
    // Legitimate signature computed with secret
    const legitimateSignature = crypto.createHmac('sha256', webhookSecret).update(validPayload).digest('hex');

    // 1. Valid signature passes
    const isValid = billingProvider.verifyWebhook(validPayload, legitimateSignature, webhookSecret);
    expect(isValid).toBe(true);

    // 2. Tampered payload fails
    const tamperedPayload = JSON.stringify({ event: 'subscription.updated', tenantId: 'tenant-123', status: 'CANCELED' });
    const isTamperedValid = billingProvider.verifyWebhook(tamperedPayload, legitimateSignature, webhookSecret);
    expect(isTamperedValid).toBe(false);

    // 3. Forged signature fails
    const forgedSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const isForgedValid = billingProvider.verifyWebhook(validPayload, forgedSignature, webhookSecret);
    expect(isForgedValid).toBe(false);
  });
});
