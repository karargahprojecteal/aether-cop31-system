import { describe, it, expect } from 'vitest';
import { tenantManagerInstance } from '../services/saas/TenantManager';
import { TenantContext } from '../types/saas';

describe('AETHER Multi-Tenant Isolation & Security', () => {
  const tenantAContext: TenantContext = {
    tenantId: 'tenant-alpha',
    userId: 'user-alice',
    userEmail: 'alice@alpha.io',
    role: 'OWNER',
    accessibleHomeIds: [],
  };

  const tenantBContext: TenantContext = {
    tenantId: 'tenant-beta',
    userId: 'user-bob',
    userEmail: 'bob@beta.io',
    role: 'OWNER',
    accessibleHomeIds: [],
  };

  it('creates an isolated home under Tenant Alpha', () => {
    tenantManagerInstance.createOrganization('Alpha Corp', 'admin@alpha.io', 'alpha-corp');
    const home = tenantManagerInstance.createHome(tenantAContext, {
      tenantId: 'tenant-alpha',
      name: 'Alpha Eco Villa',
      address: 'Bodrum No:1',
      city: 'Muğla',
      housingType: 'DETACHED_VILLA',
      squareMeters: 220,
      residentCount: 3,
      meterInfrastructure: 'ELECTRONIC_SMART_METER',
      primaryHeating: 'HEAT_PUMP',
      hasSolarPv: true,
      hasEvCharger: true,
      tariffPlan: 'TURKISH_EPDK_3_TIME',
      isPrimary: true,
    });

    expect(home.id).toBeDefined();
    expect(home.tenantId).toBe('tenant-alpha');

    // Tenant Alpha can view their home
    const retrieved = tenantManagerInstance.getHome(tenantAContext, home.id);
    expect(retrieved?.name).toBe('Alpha Eco Villa');
  });

  it('strictly blocks Tenant Beta from accessing Tenant Alpha home', () => {
    // Attempting to create a home for Tenant Alpha with Tenant Beta credentials must fail
    expect(() => {
      tenantManagerInstance.createHome(tenantBContext, {
        tenantId: 'tenant-alpha', // Cross-tenant attempt
        name: 'Hacked Villa',
        address: 'Hacked',
        city: 'Istanbul',
        housingType: 'APARTMENT_IN_BUILDING',
        squareMeters: 100,
        residentCount: 2,
        meterInfrastructure: 'UNKNOWN',
        primaryHeating: 'NATURAL_GAS_COMBI',
        hasSolarPv: false,
        hasEvCharger: false,
        tariffPlan: 'SINGLE_TARIFF_FLAT',
        isPrimary: false,
      });
    }).toThrow(/Security Isolation Violation/);
  });

  it('restricts resident viewer to assigned homes only', () => {
    const residentViewerContext: TenantContext = {
      tenantId: 'tenant-alpha',
      userId: 'user-resident',
      userEmail: 'resident@alpha.io',
      role: 'RESIDENT_VIEWER',
      accessibleHomeIds: ['home-permitted-01'],
    };

    expect(() => {
      tenantManagerInstance.validateTenantAccess(residentViewerContext, 'tenant-alpha', 'home-forbidden-02');
    }).toThrow(/Security Isolation Violation: User/);

    expect(
      tenantManagerInstance.validateTenantAccess(residentViewerContext, 'tenant-alpha', 'home-permitted-01')
    ).toBe(true);
  });
});
