import { SubscriptionPlan, SubscriptionTier } from '../../types/saas';
import { tenantManagerInstance } from './TenantManager';
import { deviceRegistryInstance } from '../integration/DeviceRegistry';
export interface IBillingProvider {
  createCheckoutSession(tenantId: string, targetTier: SubscriptionTier): Promise<{ sessionUrl: string; sessionId: string }>;
  verifyWebhook(rawPayload: string, signature: string, secret: string): boolean;
  cancelSubscription(tenantId: string): Promise<boolean>;
}

export class MockBillingProvider implements IBillingProvider {
  public async createCheckoutSession(tenantId: string, targetTier: SubscriptionTier): Promise<{ sessionUrl: string; sessionId: string }> {
    return {
      sessionUrl: `https://billing.aether-energy.io/sandbox/checkout?tenant=${tenantId}&tier=${targetTier}`,
      sessionId: `cs_mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
  }

  public verifyWebhook(rawPayload: string, signature: string, secret: string): boolean {
    if (!signature || !secret || !rawPayload) return false;
    try {
      // In Node.js test/server environment:
      if (typeof process !== 'undefined' && process.versions?.node) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nodeCrypto = require('crypto');
        const computedHmac = nodeCrypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
        return nodeCrypto.timingSafeEqual(Buffer.from(computedHmac), Buffer.from(signature));
      }
    } catch {
      // Fallback in browser
    }
    return false;
  }

  public async cancelSubscription(_tenantId: string): Promise<boolean> {
    return true;
  }
}

export class SubscriptionService {
  private billingProvider: IBillingProvider;

  constructor(billingProvider?: IBillingProvider) {
    this.billingProvider = billingProvider || new MockBillingProvider();
  }

  public getPlanTiers(): Record<SubscriptionTier, SubscriptionPlan> {
    return {
      STARTER_HOME: {
        tier: 'STARTER_HOME',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        maxHomes: 1,
        maxDevicesPerHome: 3,
        telemetryIntervalSeconds: 60,
        allowRealtimeWebSocket: false,
        allowAutonomousControl: false,
        geminiCallsPerDay: 10,
        usedGeminiCallsToday: 0,
      },
      SMART_RESIDENCE: {
        tier: 'SMART_RESIDENCE',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        maxHomes: 5,
        maxDevicesPerHome: 25,
        telemetryIntervalSeconds: 1,
        allowRealtimeWebSocket: true,
        allowAutonomousControl: false,
        geminiCallsPerDay: 500,
        usedGeminiCallsToday: 0,
      },
      ESTATE_ENTERPRISE: {
        tier: 'ESTATE_ENTERPRISE',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        maxHomes: 9999,
        maxDevicesPerHome: 9999,
        telemetryIntervalSeconds: 1,
        allowRealtimeWebSocket: true,
        allowAutonomousControl: true,
        geminiCallsPerDay: 10000,
        usedGeminiCallsToday: 0,
      },
    };
  }

  public canAddHome(tenantId: string, currentHomesCount: number): { allowed: boolean; limit: number; current: number } {
    const org = tenantManagerInstance.getOrganization(tenantId);
    const limit = org ? org.plan.maxHomes : 1;
    return {
      allowed: currentHomesCount < limit,
      limit,
      current: currentHomesCount,
    };
  }

  public canAddDevice(tenantId: string, homeId: string): { allowed: boolean; limit: number; current: number } {
    const org = tenantManagerInstance.getOrganization(tenantId);
    const limit = org ? org.plan.maxDevicesPerHome : 3;
    const current = deviceRegistryInstance.countDevices(tenantId, homeId);
    return {
      allowed: current < limit,
      limit,
      current,
    };
  }

  public upgradeTier(tenantId: string, newTier: SubscriptionTier): SubscriptionPlan {
    const org = tenantManagerInstance.getOrganization(tenantId);
    if (!org) {
      throw new Error(`Organization '${tenantId}' not found`);
    }

    const template = this.getPlanTiers()[newTier];
    org.plan = {
      ...template,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    return org.plan;
  }

  public getBillingProvider(): IBillingProvider {
    return this.billingProvider;
  }
}

export const subscriptionServiceInstance = new SubscriptionService();
