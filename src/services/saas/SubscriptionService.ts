import { SubscriptionPlan, SubscriptionTier } from '../../types/saas';
import { IBillingProvider } from './billing/IBillingProvider';
import { ProductionBillingProvider } from './billing/ProductionBillingProvider';
import { SubscriptionRepository } from '../persistence/SubscriptionRepository';
import { TenantRepository } from '../persistence/TenantRepository';

export class SubscriptionService {
  private billingProvider: IBillingProvider;
  private subscriptionRepo: SubscriptionRepository;
  private tenantRepo: TenantRepository;

  constructor(
    billingProvider?: IBillingProvider,
    subscriptionRepo?: SubscriptionRepository,
    tenantRepo?: TenantRepository
  ) {
    this.subscriptionRepo = subscriptionRepo || new SubscriptionRepository();
    this.tenantRepo = tenantRepo || new TenantRepository();
    this.billingProvider = billingProvider || new ProductionBillingProvider(this.subscriptionRepo);
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
    const sub = this.subscriptionRepo.getSubscription(tenantId);
    const limit = sub ? sub.maxHomes : 1;
    return {
      allowed: currentHomesCount < limit,
      limit,
      current: currentHomesCount,
    };
  }

  public canAddDevice(tenantId: string, homeId: string): { allowed: boolean; limit: number; current: number } {
    const sub = this.subscriptionRepo.getSubscription(tenantId);
    const limit = sub ? sub.maxDevicesPerHome : 3;
    const current = this.tenantRepo.countDevices(tenantId, homeId);
    return {
      allowed: current < limit,
      limit,
      current,
    };
  }

  public upgradeTier(tenantId: string, newTier: SubscriptionTier): SubscriptionPlan {
    const template = this.getPlanTiers()[newTier];
    const newPlan: SubscriptionPlan = {
      ...template,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    this.subscriptionRepo.updateTier(tenantId, newPlan);
    return newPlan;
  }

  public consumeGeminiQuota(tenantId: string): boolean {
    return this.subscriptionRepo.consumeGeminiQuota(tenantId);
  }

  public getBillingProvider(): IBillingProvider {
    return this.billingProvider;
  }
}

export const subscriptionServiceInstance = new SubscriptionService();
