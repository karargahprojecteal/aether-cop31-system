import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService } from '../services/persistence/DatabaseService';
import { TenantRepository } from '../services/persistence/TenantRepository';
import { TenantManager } from '../services/saas/TenantManager';
import { TenantContext } from '../types/saas';

describe('Integration: Database-Backed Tenant Isolation & SQL Authorization', () => {
  let dbService: DatabaseService;
  let tenantRepo: TenantRepository;
  let tenantManager: TenantManager;

  const tenantAlphaId = 'tenant-corp-alpha';
  const tenantBetaId = 'tenant-corp-beta';

  const aliceContext: TenantContext = {
    tenantId: tenantAlphaId,
    userId: 'user-alice',
    userEmail: 'alice@alpha.io',
    role: 'OWNER',
    accessibleHomeIds: [],
  };

  const bobContext: TenantContext = {
    tenantId: tenantBetaId,
    userId: 'user-bob',
    userEmail: 'bob@beta.io',
    role: 'OWNER',
    accessibleHomeIds: [],
  };

  beforeEach(() => {
    // Isolated in-memory SQL database instance for clean test execution
    dbService = DatabaseService.createIsolatedInstance(':memory:');
    tenantRepo = new TenantRepository(dbService.getDb());
    tenantManager = new TenantManager(tenantRepo);

    // Seed Tenant Alpha and Tenant Beta
    tenantManager.createOrganization('Alpha Energy Corp', 'admin@alpha.io', 'alpha-corp', tenantAlphaId);
    tenantManager.createOrganization('Beta Energy Corp', 'admin@beta.io', 'beta-corp', tenantBetaId);

    // Add members
    tenantRepo.addMember({
      id: 'mem-alice',
      tenantId: tenantAlphaId,
      userId: 'user-alice',
      email: 'alice@alpha.io',
      name: 'Alice Owner',
      role: 'OWNER',
      assignedHomeIds: [],
      invitedAt: new Date().toISOString(),
    });

    tenantRepo.addMember({
      id: 'mem-bob',
      tenantId: tenantBetaId,
      userId: 'user-bob',
      email: 'bob@beta.io',
      name: 'Bob Owner',
      role: 'OWNER',
      assignedHomeIds: [],
      invitedAt: new Date().toISOString(),
    });
  });

  it('persists homes to SQL and strictly isolates queries between tenants', () => {
    // Alice creates home in Alpha
    const homeAlpha = tenantManager.createHome(aliceContext, {
      id: 'home-alpha-villa',
      tenantId: tenantAlphaId,
      name: 'Alpha Sunset Residence',
      address: 'Lara Cad. No:1',
      city: 'Antalya',
      housingType: 'DETACHED_VILLA',
      squareMeters: 300,
      residentCount: 4,
      meterInfrastructure: 'ELECTRONIC_SMART_METER',
      primaryHeating: 'HEAT_PUMP',
      hasSolarPv: true,
      hasEvCharger: true,
      tariffPlan: 'TURKISH_EPDK_3_TIME',
      isPrimary: true,
    } as any);

    expect(homeAlpha.id).toBe('home-alpha-villa');

    // Alice can retrieve her home
    const retrievedAlpha = tenantManager.getHome(aliceContext, 'home-alpha-villa');
    expect(retrievedAlpha).not.toBeNull();
    expect(retrievedAlpha?.name).toBe('Alpha Sunset Residence');

    // Bob (Tenant Beta) attempting to retrieve Alpha's home returns null (isolated by WHERE tenant_id = ?)
    const bobRetrieval = tenantManager.getHome(bobContext, 'home-alpha-villa');
    expect(bobRetrieval).toBeNull();

    // Bob attempting to validate access to Alpha's tenant throws Security Isolation Violation
    expect(() => {
      tenantManager.validateTenantAccess(bobContext, tenantAlphaId, 'home-alpha-villa');
    }).toThrow(/Security Isolation Violation/);

    // Direct database query by Bob's tenant ID returns null (isolated by WHERE tenant_id = ?)
    const directDbAttempt = tenantRepo.getHome(tenantBetaId, 'home-alpha-villa');
    expect(directDbAttempt).toBeNull();
  });

  it('derives tenant membership from trusted database records, rejecting spoofed contexts', () => {
    // Attempting to resolve context for an uninvited user must fail
    expect(() => {
      tenantManager.resolveAuthenticatedContext('unregistered-intruder', tenantAlphaId);
    }).toThrow(/Authentication\/Authorization Failure/);

    // Resolving context for Alice derives actual DB record
    const derivedContext = tenantManager.resolveAuthenticatedContext('user-alice', tenantAlphaId);
    expect(derivedContext.tenantId).toBe(tenantAlphaId);
    expect(derivedContext.userId).toBe('user-alice');
    expect(derivedContext.role).toBe('OWNER');
  });

  it('enforces RBAC home-level restrictions for RESIDENT_VIEWER in database queries', () => {
    // Add two homes to Tenant Alpha
    tenantManager.createHome(aliceContext, {
      id: 'home-alpha-01',
      tenantId: tenantAlphaId,
      name: 'Alpha Home 1',
      address: 'Address 1',
      city: 'Izmir',
      housingType: 'APARTMENT_FLAT',
      squareMeters: 100,
      residentCount: 2,
      meterInfrastructure: 'IN_UNIT_BREAKER_PANEL',
      primaryHeating: 'HEAT_PUMP',
      hasSolarPv: false,
      hasEvCharger: false,
      tariffPlan: 'TURKISH_EPDK_3_TIME',
      isPrimary: true,
    } as any);

    tenantManager.createHome(aliceContext, {
      id: 'home-alpha-02',
      tenantId: tenantAlphaId,
      name: 'Alpha Home 2',
      address: 'Address 2',
      city: 'Izmir',
      housingType: 'APARTMENT_FLAT',
      squareMeters: 120,
      residentCount: 3,
      meterInfrastructure: 'IN_UNIT_BREAKER_PANEL',
      primaryHeating: 'HEAT_PUMP',
      hasSolarPv: false,
      hasEvCharger: false,
      tariffPlan: 'TURKISH_EPDK_3_TIME',
      isPrimary: false,
    } as any);

    // Resident viewer assigned ONLY to home-alpha-01
    const residentContext: TenantContext = {
      tenantId: tenantAlphaId,
      userId: 'user-resident-carol',
      userEmail: 'carol@alpha.io',
      role: 'RESIDENT_VIEWER',
      accessibleHomeIds: ['home-alpha-01'],
    };

    const permittedHome = tenantManager.getHome(residentContext, 'home-alpha-01');
    expect(permittedHome?.name).toBe('Alpha Home 1');

    // Attempting to read home-alpha-02 throws authorization isolation error
    expect(() => {
      tenantManager.getHome(residentContext, 'home-alpha-02');
    }).toThrow(/does not have access to Home/);

    // Listing homes returns only the permitted home
    const listed = tenantManager.listHomes(residentContext);
    expect(listed.length).toBe(1);
    expect(listed[0].id).toBe('home-alpha-01');
  });
});
