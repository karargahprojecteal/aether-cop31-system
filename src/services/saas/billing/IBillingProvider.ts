import { SubscriptionTier } from '../../../types/saas';

export interface WebhookVerificationResult {
  valid: boolean;
  isReplay: boolean;
  eventId?: string;
  eventType?: string;
  tenantId?: string;
  payload?: any;
  error?: string;
}

export interface IBillingProvider {
  createCheckoutSession(tenantId: string, targetTier: SubscriptionTier): Promise<{ sessionUrl: string; sessionId: string }>;
  verifyWebhook(rawPayload: string, signature: string, secret: string): boolean;
  verifyWebhookDetailed?(rawPayload: string, signatureHeader: string, secret: string): WebhookVerificationResult;
  cancelSubscription(tenantId: string): Promise<boolean>;
}
