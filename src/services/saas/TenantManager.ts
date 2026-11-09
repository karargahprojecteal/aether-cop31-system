import * as crypto from 'node:crypto';
import { Organization, OrganizationMember, TenantContext } from '../../types/saas';
import { HomeProfile } from '../../types/residential';
import { TenantRepository } from '../persistence/TenantRepository';

export class TenantManager {
  private repository: TenantRepository;

  constructor(repository?: TenantRepository) {
    this.repository = repository || new TenantRepository();
  }

  public getOrganization(tenantId: string): Organization | null {
    return this.repository.getOrganization(tenantId);
  }

  public createOrganization(name: string, contactEmail: string, slug?: string, customId?: string): Organization {
    const id = customId || `tenant-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const org: Organization = {
      id,
      name,
      slug: finalSlug,
      contactEmail,
      plan: {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.repository.createOrganization(org, org.plan);
  }

  public createHome(context: TenantContext, profile: Omit<HomeProfile, 'id' | 'createdAt'>): HomeProfile {
    this.validateTenantAccess(context, profile.tenantId);

    const id = (profile as any).id || `home-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const home: HomeProfile = {
      ...profile,
      id,
      createdAt: new Date().toISOString(),
    };

    return this.repository.createHome(home);
  }

  public getHome(context: TenantContext, homeId: string): HomeProfile | null {
    // 1. Fetch from database using the authenticated tenant's ID constraint
    const home = this.repository.getHome(context.tenantId, homeId);
    if (!home) return null;

    // 2. Validate user home permissions (RBAC)
    this.validateTenantAccess(context, home.tenantId, homeId);
    return home;
  }

  public listHomes(context: TenantContext): HomeProfile[] {
    const allowedHomeIds =
      context.role === 'RESIDENT_VIEWER' && context.accessibleHomeIds.length > 0
        ? context.accessibleHomeIds
        : undefined;

    return this.repository.listHomes(context.tenantId, allowedHomeIds);
  }

  public addMember(context: TenantContext, member: Omit<OrganizationMember, 'id' | 'invitedAt'>): OrganizationMember {
    this.validateTenantAccess(context, member.tenantId);
    if (context.role !== 'OWNER' && context.role !== 'ENERGY_MANAGER') {
      throw new Error('Permission Denied: Only OWNER or ENERGY_MANAGER can invite members');
    }

    const id = `mem-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const newMember: OrganizationMember = {
      ...member,
      id,
      invitedAt: new Date().toISOString(),
    };

    return this.repository.addMember(newMember);
  }

  public listMembers(context: TenantContext): OrganizationMember[] {
    this.validateTenantAccess(context, context.tenantId);
    return this.repository.listMembers(context.tenantId);
  }

  /**
   * Resolves trusted server-side identity and tenant membership from database.
   * Rejects client-supplied claims if no valid membership record exists.
   */
  public resolveAuthenticatedContext(userId: string, targetTenantId: string): TenantContext {
    const member = this.repository.getMember(targetTenantId, userId);
    if (!member) {
      throw new Error(`Authentication/Authorization Failure: User '${userId}' has no valid membership in tenant '${targetTenantId}'`);
    }

    return {
      tenantId: member.tenantId,
      userId: member.userId,
      userEmail: member.email,
      role: member.role,
      accessibleHomeIds: member.assignedHomeIds || [],
    };
  }

  /**
   * Enforces server-side tenant isolation boundary
   */
  public validateTenantAccess(context: TenantContext, targetTenantId: string, targetHomeId?: string): boolean {
    if (context.tenantId !== targetTenantId) {
      throw new Error(`Security Isolation Violation: Tenant '${context.tenantId}' cannot access data of '${targetTenantId}'`);
    }

    if (targetHomeId && context.role === 'RESIDENT_VIEWER') {
      if (context.accessibleHomeIds.length > 0 && !context.accessibleHomeIds.includes(targetHomeId)) {
        throw new Error(`Security Isolation Violation: User '${context.userId}' does not have access to Home '${targetHomeId}'`);
      }
    }

    return true;
  }
}

export const tenantManagerInstance = new TenantManager();
