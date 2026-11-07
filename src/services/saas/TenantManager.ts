import { Organization, OrganizationMember, TenantContext } from '../../types/saas';
import { HomeProfile } from '../../types/residential';

export class TenantManager {
  private organizations: Map<string, Organization> = new Map();
  private homes: Map<string, HomeProfile> = new Map();
  private members: Map<string, OrganizationMember> = new Map();

  constructor() {
    this.seedDefaultTenantData();
  }

  public getOrganization(tenantId: string): Organization | null {
    return this.organizations.get(tenantId) || null;
  }

  public createOrganization(name: string, contactEmail: string, slug?: string): Organization {
    const id = `tenant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
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

    this.organizations.set(id, org);
    return org;
  }

  public createHome(context: TenantContext, profile: Omit<HomeProfile, 'id' | 'createdAt'>): HomeProfile {
    this.validateTenantAccess(context, profile.tenantId);

    const id = `home-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const home: HomeProfile = {
      ...profile,
      id,
      createdAt: new Date().toISOString(),
    };

    this.homes.set(id, home);
    return home;
  }

  public getHome(context: TenantContext, homeId: string): HomeProfile | null {
    const home = this.homes.get(homeId);
    if (!home) return null;

    // Strict Server-Side Tenant Isolation
    this.validateTenantAccess(context, home.tenantId, homeId);
    return home;
  }

  public listHomes(context: TenantContext): HomeProfile[] {
    const result: HomeProfile[] = [];
    for (const home of this.homes.values()) {
      if (home.tenantId === context.tenantId) {
        if (
          context.role === 'OWNER' || 
          context.role === 'ENERGY_MANAGER' || 
          context.accessibleHomeIds.length === 0 || 
          context.accessibleHomeIds.includes(home.id)
        ) {
          result.push(home);
        }
      }
    }
    return result;
  }

  public addMember(context: TenantContext, member: Omit<OrganizationMember, 'id' | 'invitedAt'>): OrganizationMember {
    this.validateTenantAccess(context, member.tenantId);
    if (context.role !== 'OWNER' && context.role !== 'ENERGY_MANAGER') {
      throw new Error('Permission Denied: Only OWNER or ENERGY_MANAGER can invite members');
    }

    const id = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newMember: OrganizationMember = {
      ...member,
      id,
      invitedAt: new Date().toISOString(),
    };

    this.members.set(id, newMember);
    return newMember;
  }

  public listMembers(context: TenantContext): OrganizationMember[] {
    this.validateTenantAccess(context, context.tenantId);
    const list: OrganizationMember[] = [];
    for (const m of this.members.values()) {
      if (m.tenantId === context.tenantId) {
        list.push(m);
      }
    }
    return list;
  }

  /**
   * Enforces strict server-side tenant isolation boundary
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

  private seedDefaultTenantData(): void {
    const tenantId = 'tenant-karargah-etkim';
    const org: Organization = {
      id: tenantId,
      name: 'Antalya ETKİM Enerji & İnovasyon Kampüsü',
      slug: 'etkim-antalya',
      contactEmail: 'etkim@aether-energy.io',
      plan: {
        tier: 'ESTATE_ENTERPRISE',
        status: 'ACTIVE',
        currentPeriodEnd: '2027-11-07T00:00:00Z',
        maxHomes: 999,
        maxDevicesPerHome: 999,
        telemetryIntervalSeconds: 1,
        allowRealtimeWebSocket: true,
        allowAutonomousControl: true,
        geminiCallsPerDay: 5000,
        usedGeminiCallsToday: 42,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.organizations.set(tenantId, org);

    const primaryHome: HomeProfile = {
      id: 'home-etkim-antalya',
      tenantId,
      name: 'Ana İnovasyon ve Laboratuvar Blokları',
      address: 'Konyaaltı Kampüsü, Akdeniz Blv. No:14',
      city: 'Antalya',
      housingType: 'COMMERCIAL_UNIT',
      squareMeters: 14500,
      residentCount: 450,
      meterInfrastructure: 'ELECTRONIC_SMART_METER',
      primaryHeating: 'HEAT_PUMP',
      hasSolarPv: true,
      hasEvCharger: true,
      tariffPlan: 'TURKISH_EPDK_3_TIME',
      createdAt: new Date().toISOString(),
      isPrimary: true,
    };

    const residentialVilla: HomeProfile = {
      id: 'home-villa-duden',
      tenantId,
      name: 'Düden Akıllı Konut Pilotu (Villa 4B)',
      address: 'Lara Cad. No:82/4, Muratpaşa',
      city: 'Antalya',
      housingType: 'DETACHED_VILLA',
      squareMeters: 280,
      residentCount: 4,
      meterInfrastructure: 'IN_UNIT_BREAKER_PANEL',
      primaryHeating: 'HEAT_PUMP',
      hasSolarPv: true,
      hasEvCharger: true,
      tariffPlan: 'TURKISH_EPDK_3_TIME',
      createdAt: new Date().toISOString(),
      isPrimary: false,
    };

    this.homes.set(primaryHome.id, primaryHome);
    this.homes.set(residentialVilla.id, residentialVilla);

    const ownerMember: OrganizationMember = {
      id: 'mem-aras-01',
      tenantId,
      userId: 'user-aras-demirtas',
      name: 'Aras Demirtaş',
      email: 'aras@aether-energy.io',
      role: 'OWNER',
      assignedHomeIds: [],
      invitedAt: new Date().toISOString(),
      joinedAt: new Date().toISOString(),
    };

    const energyManagerMember: OrganizationMember = {
      id: 'mem-berkan-02',
      tenantId,
      userId: 'user-berkan-meral',
      name: 'Berkan Meral',
      email: 'berkan@aether-energy.io',
      role: 'ENERGY_MANAGER',
      assignedHomeIds: [],
      invitedAt: new Date().toISOString(),
      joinedAt: new Date().toISOString(),
    };

    this.members.set(ownerMember.id, ownerMember);
    this.members.set(energyManagerMember.id, energyManagerMember);
  }
}

export const tenantManagerInstance = new TenantManager();
