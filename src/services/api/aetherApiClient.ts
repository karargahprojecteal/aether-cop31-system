// ==============================================================================
// AETHER — Client-Side API & State Service
// Decoupled from backend database engines and Node.js built-ins.
// Safe for all browser runtimes (Vite / Edge / Mobile).
// ==============================================================================

import { Organization, OrganizationMember, SubscriptionPlan, SubscriptionTier, TenantContext, AuditLogEntry } from '../../types/saas';
import { HomeProfile, DeviceRecord } from '../../types/residential';

export class AetherApiClient {
  private static instance: AetherApiClient | null = null;

  // In-memory client cache / local store for standalone UI preview
  private organizations: Map<string, Organization> = new Map();
  private members: Map<string, OrganizationMember[]> = new Map();
  private homes: Map<string, HomeProfile[]> = new Map();
  private devices: Map<string, DeviceRecord[]> = new Map();
  private auditLogs: Map<string, AuditLogEntry[]> = new Map();

  private constructor() {
    this.seedDefaultState();
  }

  public static getInstance(): AetherApiClient {
    if (!AetherApiClient.instance) {
      AetherApiClient.instance = new AetherApiClient();
    }
    return AetherApiClient.instance;
  }

  private safeRandomId(prefix: string): string {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
      return `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private seedDefaultState(): void {
    const tenantId = 'tenant-karargah-etkim';

    const defaultPlan: SubscriptionPlan = {
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
    };

    const defaultOrg: Organization = {
      id: tenantId,
      name: 'ETKİM Konut Pilot Grubu',
      slug: 'etkim-konut-pilot',
      contactEmail: 'pilot@aether-energy.io',
      plan: defaultPlan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.organizations.set(tenantId, defaultOrg);

    const defaultMember: OrganizationMember = {
      id: 'mem-pilot-01',
      tenantId,
      userId: 'user-aras-demirtas',
      email: 'aras@aether-energy.io',
      name: 'Aras Demirtaş',
      role: 'OWNER',
      assignedHomeIds: ['home-levent-loft'],
      invitedAt: new Date().toISOString(),
      joinedAt: new Date().toISOString(),
    };
    this.members.set(tenantId, [defaultMember]);

    const defaultHome: HomeProfile = {
      id: 'home-levent-loft',
      tenantId,
      name: 'Levent Loft Rezidans',
      address: 'Büyükdere Cad. No: 195/A',
      city: 'İstanbul',
      housingType: 'APARTMENT_FLAT',
      squareMeters: 145,
      residentCount: 3,
      meterInfrastructure: 'ELECTRONIC_SMART_METER',
      meterClockOffsetHours: 0,
      primaryHeating: 'HEAT_PUMP',
      hasSolarPv: false,
      hasEvCharger: true,
      tariffPlan: 'TURKISH_EPDK_3_TIME',
      tariffVersion: '2024-Q3-MESKEN-01',
      isPrimary: true,
      createdAt: new Date().toISOString(),
    };
    this.homes.set(tenantId, [defaultHome]);

    const defaultDevice: DeviceRecord = {
      id: 'dev-main-meter-01',
      tenantId,
      homeId: 'home-levent-loft',
      name: 'Luna LUN31 Ana Akıllı Sayaç',
      deviceType: 'MAIN_METER',
      adapterType: 'SMART_METER',
      manufacturer: 'Luna Elektrik',
      model: 'LUN31-Optical',
      serialNumber: 'LUN-2023-88910',
      measurementQuality: 'PHYSICAL_METERED',
      isSubMeteredOnly: false,
      nominalPowerW: 11000,
      status: 'ONLINE',
      createdAt: new Date().toISOString(),
    };
    this.devices.set(tenantId, [defaultDevice]);

    const defaultAudit: AuditLogEntry = {
      id: 'aud-seed-01',
      tenantId,
      userId: 'user-aras-demirtas',
      userEmail: 'aras@aether-energy.io',
      action: 'SYSTEM_INITIALIZED',
      category: 'AUTH',
      details: { clientRuntime: 'Browser SPA' },
      severity: 'INFO',
      timestamp: new Date().toISOString(),
      prevRecordHash: 'GENESIS_BLOCK_0000000000000000000000000000000000000000000000000000000000000000',
      recordHash: 'aether_initial_audit_hash_0000000000000000000000000000000000000000',
    };
    this.auditLogs.set(tenantId, [defaultAudit]);
  }

  // --- ORGANIZATIONS & MEMBERS ---
  public getOrganization(tenantId: string): Organization | null {
    return this.organizations.get(tenantId) || null;
  }

  public listMembers(context: TenantContext): OrganizationMember[] {
    return this.members.get(context.tenantId) || [];
  }

  public addMember(context: TenantContext, member: Omit<OrganizationMember, 'id' | 'invitedAt'>): OrganizationMember {
    const id = this.safeRandomId('mem');
    const newMember: OrganizationMember = {
      ...member,
      id,
      invitedAt: new Date().toISOString(),
    };
    const list = this.listMembers(context);
    list.push(newMember);
    this.members.set(context.tenantId, list);
    return newMember;
  }

  // --- HOMES ---
  public listHomes(context: TenantContext): HomeProfile[] {
    return this.homes.get(context.tenantId) || [];
  }

  public createHome(context: TenantContext, profile: Omit<HomeProfile, 'id' | 'createdAt'>): HomeProfile {
    const id = (profile as any).id || this.safeRandomId('home');
    const newHome: HomeProfile = {
      ...profile,
      id,
      tenantId: context.tenantId,
      createdAt: new Date().toISOString(),
    };
    const list = this.listHomes(context);
    list.push(newHome);
    this.homes.set(context.tenantId, list);
    return newHome;
  }

  // --- SUBSCRIPTIONS ---
  public getSubscription(tenantId: string): SubscriptionPlan {
    const org = this.organizations.get(tenantId);
    return org?.plan || {
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
    };
  }

  public upgradeSubscription(tenantId: string, tier: SubscriptionTier): void {
    const org = this.organizations.get(tenantId);
    if (!org) return;

    const limits: Record<SubscriptionTier, { maxHomes: number; maxDevices: number; calls: number }> = {
      STARTER_HOME: { maxHomes: 1, maxDevices: 3, calls: 10 },
      SMART_RESIDENCE: { maxHomes: 5, maxDevices: 15, calls: 500 },
      ESTATE_ENTERPRISE: { maxHomes: 100, maxDevices: 500, calls: 10000 },
    };

    const target = limits[tier] || limits.STARTER_HOME;
    org.plan = {
      ...org.plan,
      tier,
      maxHomes: target.maxHomes,
      maxDevicesPerHome: target.maxDevices,
      geminiCallsPerDay: target.calls,
    };
    org.updatedAt = new Date().toISOString();
    this.organizations.set(tenantId, org);
  }

  // --- DEVICES ---
  public listDevices(tenantId: string, homeId?: string): DeviceRecord[] {
    const all = this.devices.get(tenantId) || [];
    if (homeId) {
      return all.filter(d => d.homeId === homeId);
    }
    return all;
  }

  public countDevices(tenantId: string, homeId?: string): number {
    return this.listDevices(tenantId, homeId).length;
  }

  public registerDevice(device: Omit<DeviceRecord, 'id' | 'createdAt'>): DeviceRecord {
    const id = this.safeRandomId('dev');
    const newDevice: DeviceRecord = {
      ...device,
      id,
      status: 'ONLINE',
      createdAt: new Date().toISOString(),
    };
    const list = this.devices.get(device.tenantId) || [];
    list.push(newDevice);
    this.devices.set(device.tenantId, list);
    return newDevice;
  }

  public revokeDevice(tenantId: string, deviceId: string): boolean {
    const list = this.devices.get(tenantId) || [];
    const target = list.find(d => d.id === deviceId);
    if (!target) return false;
    target.status = 'DISCONNECTED';
    return true;
  }

  // --- PAIRING ---
  public generatePairingToken(
    tenantId: string,
    homeId: string,
    deviceType: DeviceRecord['deviceType'],
    adapterType: any
  ): any {
    const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const token = {
      token: code,
      tenantId,
      homeId,
      deviceType,
      adapterType,
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000,
      status: 'PENDING',
      attemptsCount: 0,
      maxAttempts: 5,
    };
    return token;
  }

  public redeemPairingToken(
    tenantId: string,
    tokenStr: string,
    deviceDetails: {
      name: string;
      manufacturer?: string;
      model?: string;
      serialNumber?: string;
      metadata?: Record<string, any>;
    }
  ): { success: boolean; device?: DeviceRecord; error?: string } {
    const homes = this.listHomes({ tenantId, userId: '', userEmail: '', role: 'OWNER', accessibleHomeIds: [] });
    const registered = this.registerDevice({
      tenantId,
      homeId: homes[0]?.id || 'home-default',
      name: deviceDetails.name,
      deviceType: 'MAIN_METER',
      adapterType: 'LOCAL_GATEWAY',
      manufacturer: deviceDetails.manufacturer,
      model: deviceDetails.model,
      serialNumber: deviceDetails.serialNumber || `SN-${tokenStr}`,
      measurementQuality: 'PHYSICAL_METERED',
      isSubMeteredOnly: false,
      status: 'ONLINE',
      metadata: deviceDetails.metadata,
    });
    return { success: true, device: registered };
  }

  // --- AUDIT LOGS ---
  public listAuditLogs(tenantId: string, limit: number = 20): AuditLogEntry[] {
    const logs = this.auditLogs.get(tenantId) || [];
    return logs.slice(-limit).reverse();
  }

  // --- DATA PRIVACY (KVKK) ---
  public exportTenantData(context: TenantContext): any {
    return {
      exportVersion: '1.0',
      exportTimestamp: new Date().toISOString(),
      tenantId: context.tenantId,
      organization: this.getOrganization(context.tenantId),
      members: this.listMembers(context),
      homes: this.listHomes(context),
      devices: this.listDevices(context.tenantId),
      auditLogsCount: (this.auditLogs.get(context.tenantId) || []).length,
    };
  }

  public purgeTenantData(context: TenantContext, confirmation: string): { success: boolean; message: string } {
    if (confirmation !== context.tenantId) {
      throw new Error(`Onay kodu hatalı. Silme işlemini teyit etmek için kiracı ID'sini (${context.tenantId}) yazmalısınız.`);
    }
    this.homes.delete(context.tenantId);
    this.devices.delete(context.tenantId);
    this.members.delete(context.tenantId);
    return {
      success: true,
      message: `Kiracı '${context.tenantId}' verileri (KVKK Kapsamında) başarıyla temizlendi.`,
    };
  }
}

export const aetherApiClientInstance = AetherApiClient.getInstance();
