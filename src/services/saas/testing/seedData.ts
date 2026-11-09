import { TenantRepository } from '../../persistence/TenantRepository';
import { Organization, OrganizationMember } from '../../../types/saas';
import { HomeProfile } from '../../../types/residential';

export function seedDevelopmentTenantData(tenantRepo: TenantRepository): {
  tenantId: string;
  primaryHomeId: string;
  villaHomeId: string;
  ownerUserId: string;
} {
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

  tenantRepo.createOrganization(org, org.plan);

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

  tenantRepo.createHome(primaryHome);
  tenantRepo.createHome(residentialVilla);

  const ownerMember: OrganizationMember = {
    id: 'mem-pilot-owner',
    tenantId,
    userId: 'user-pilot-owner',
    name: 'Pilot Sistem Yöneticisi',
    email: 'admin@aether-energy.io',
    role: 'OWNER',
    assignedHomeIds: [],
    invitedAt: new Date().toISOString(),
    joinedAt: new Date().toISOString(),
  };

  tenantRepo.addMember(ownerMember);

  return {
    tenantId,
    primaryHomeId: primaryHome.id,
    villaHomeId: residentialVilla.id,
    ownerUserId: ownerMember.userId,
  };
}
