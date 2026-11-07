import { IBillingProvider } from '../billing/IBillingProvider';
import { SubscriptionTier } from '../../../types/saas';

/**
 * RESTRICTED TO DEVELOPMENT AND UNIT TESTING ONLY.
 * NEVER USE IN PRODUCTION PATHS.
 */
export class MockBillingProvider implements IBillingProvider {
  public async createCheckoutSession(tenantId: string, targetTier: SubscriptionTier): Promise<{ sessionUrl: string; sessionId: string }> {
    return {
      sessionUrl: `https://billing-test.local/mock-checkout?tenant=${tenantId}&tier=${targetTier}`,
      sessionId: `cs_mock_${Date.now()}`,
    };
  }

  public verifyWebhook(rawPayload: string, signature: string, secret: string): boolean {
    if (!signature || !secret || !rawPayload) return false;
    return signature === 'valid_mock_signature';
  }

  public async cancelSubscription(_tenantId: string): Promise<boolean> {
    return true;
  }
}
