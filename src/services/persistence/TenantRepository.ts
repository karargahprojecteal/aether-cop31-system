import { DatabaseSync } from 'node:sqlite';
import { Organization, OrganizationMember, SubscriptionPlan } from '../../types/saas';
import { HomeProfile, DeviceRecord } from '../../types/residential';
import { DatabaseService } from './DatabaseService';

export class TenantRepository {
  private db: DatabaseSync;

  constructor(db?: DatabaseSync) {
    this.db = db || DatabaseService.getInstance().getDb();
  }

  public createOrganization(org: Organization, plan: SubscriptionPlan): Organization {
    const insertOrg = this.db.prepare(`
      INSERT INTO organizations (id, name, slug, contact_email, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        contact_email = excluded.contact_email,
        updated_at = excluded.updated_at
    `);
    insertOrg.run(org.id, org.name, org.slug, org.contactEmail, org.createdAt, org.updatedAt);

    const insertSub = this.db.prepare(`
      INSERT INTO subscriptions (
        tenant_id, tier, status, current_period_end, max_homes, max_devices_per_home,
        telemetry_interval_seconds, allow_realtime_websocket, allow_autonomous_control,
        gemini_calls_per_day, used_gemini_calls_today, last_quota_reset_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET
        tier = excluded.tier,
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        max_homes = excluded.max_homes,
        max_devices_per_home = excluded.max_devices_per_home,
        updated_at = excluded.updated_at
    `);
    insertSub.run(
      org.id,
      plan.tier,
      plan.status,
      plan.currentPeriodEnd,
      plan.maxHomes,
      plan.maxDevicesPerHome,
      plan.telemetryIntervalSeconds,
      plan.allowRealtimeWebSocket ? 1 : 0,
      plan.allowAutonomousControl ? 1 : 0,
      plan.geminiCallsPerDay,
      plan.usedGeminiCallsToday,
      new Date().toISOString().slice(0, 10),
      new Date().toISOString(),
      new Date().toISOString()
    );

    return org;
  }

  public getOrganization(tenantId: string): Organization | null {
    const stmt = this.db.prepare(`
      SELECT o.id, o.name, o.slug, o.contact_email, o.created_at, o.updated_at,
             s.tier, s.status, s.current_period_end, s.max_homes, s.max_devices_per_home,
             s.telemetry_interval_seconds, s.allow_realtime_websocket, s.allow_autonomous_control,
             s.gemini_calls_per_day, s.used_gemini_calls_today
      FROM organizations o
      LEFT JOIN subscriptions s ON o.id = s.tenant_id
      WHERE o.id = ?
    `);
    const row = stmt.get(tenantId) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      contactEmail: row.contact_email,
      plan: {
        tier: row.tier || 'STARTER_HOME',
        status: row.status || 'ACTIVE',
        currentPeriodEnd: row.current_period_end || new Date().toISOString(),
        maxHomes: row.max_homes ?? 1,
        maxDevicesPerHome: row.max_devices_per_home ?? 3,
        telemetryIntervalSeconds: row.telemetry_interval_seconds ?? 60,
        allowRealtimeWebSocket: Boolean(row.allow_realtime_websocket),
        allowAutonomousControl: Boolean(row.allow_autonomous_control),
        geminiCallsPerDay: row.gemini_calls_per_day ?? 10,
        usedGeminiCallsToday: row.used_gemini_calls_today ?? 0,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public createHome(home: HomeProfile): HomeProfile {
    const stmt = this.db.prepare(`
      INSERT INTO homes (
        id, tenant_id, name, address, city, housing_type, square_meters, resident_count,
        meter_infrastructure, meter_clock_offset_hours, primary_heating, has_solar_pv,
        has_ev_charger, tariff_plan, tariff_version, is_primary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      home.id,
      home.tenantId,
      home.name,
      home.address,
      home.city,
      home.housingType,
      home.squareMeters,
      home.residentCount,
      home.meterInfrastructure,
      home.meterClockOffsetHours || 0,
      home.primaryHeating,
      home.hasSolarPv ? 1 : 0,
      home.hasEvCharger ? 1 : 0,
      home.tariffPlan,
      home.tariffVersion || '2024-Q3-MESKEN-01',
      home.isPrimary ? 1 : 0,
      home.createdAt,
      new Date().toISOString()
    );

    return home;
  }

  public getHome(tenantId: string, homeId: string): HomeProfile | null {
    // Isolated by tenant_id!
    const stmt = this.db.prepare(`
      SELECT * FROM homes WHERE id = ? AND tenant_id = ?
    `);
    const row = stmt.get(homeId, tenantId) as any;
    if (!row) return null;

    return this.mapRowToHome(row);
  }

  public listHomes(tenantId: string, allowedHomeIds?: string[]): HomeProfile[] {
    let query = `SELECT * FROM homes WHERE tenant_id = ?`;
    const params: any[] = [tenantId];

    if (allowedHomeIds && allowedHomeIds.length > 0) {
      const placeholders = allowedHomeIds.map(() => '?').join(',');
      query += ` AND id IN (${placeholders})`;
      params.push(...allowedHomeIds);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(r => this.mapRowToHome(r));
  }

  public countHomes(tenantId: string): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as cnt FROM homes WHERE tenant_id = ?`);
    const row = stmt.get(tenantId) as any;
    return row ? Number(row.cnt) : 0;
  }

  public addMember(member: OrganizationMember): OrganizationMember {
    const stmt = this.db.prepare(`
      INSERT INTO organization_members (
        id, tenant_id, user_id, email, name, role, assigned_home_ids, invited_at, joined_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      member.id,
      member.tenantId,
      member.userId,
      member.email,
      member.name,
      member.role,
      JSON.stringify(member.assignedHomeIds || []),
      member.invitedAt,
      member.joinedAt || null
    );
    return member;
  }

  public getMember(tenantId: string, userId: string): OrganizationMember | null {
    const stmt = this.db.prepare(`
      SELECT * FROM organization_members WHERE tenant_id = ? AND user_id = ?
    `);
    const row = stmt.get(tenantId, userId) as any;
    if (!row) return null;

    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      email: row.email,
      name: row.name,
      role: row.role,
      assignedHomeIds: JSON.parse(row.assigned_home_ids || '[]'),
      invitedAt: row.invited_at,
      joinedAt: row.joined_at || undefined,
    };
  }

  public listMembers(tenantId: string): OrganizationMember[] {
    const stmt = this.db.prepare(`
      SELECT * FROM organization_members WHERE tenant_id = ? ORDER BY invited_at ASC
    `);
    const rows = stmt.all(tenantId) as any[];
    return rows.map(r => ({
      id: r.id,
      tenantId: r.tenant_id,
      userId: r.user_id,
      email: r.email,
      name: r.name,
      role: r.role,
      assignedHomeIds: JSON.parse(r.assigned_home_ids || '[]'),
      invitedAt: r.invited_at,
      joinedAt: r.joined_at || undefined,
    }));
  }

  public registerDevice(device: DeviceRecord): DeviceRecord {
    const stmt = this.db.prepare(`
      INSERT INTO devices (
        id, tenant_id, home_id, name, device_type, adapter_type, manufacturer, model,
        serial_number, measurement_quality, is_sub_metered_only, nominal_power_w,
        status, last_heartbeat, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      device.id,
      device.tenantId,
      device.homeId,
      device.name,
      device.deviceType,
      device.adapterType,
      device.manufacturer || null,
      device.model || null,
      device.serialNumber || null,
      device.measurementQuality,
      device.isSubMeteredOnly ? 1 : 0,
      device.nominalPowerW ?? null,
      device.status || 'ONLINE',
      device.lastHeartbeat || null,
      device.metadata ? JSON.stringify(device.metadata) : null,
      device.createdAt,
      new Date().toISOString()
    );

    return device;
  }

  public getDevice(tenantId: string, deviceId: string): DeviceRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM devices WHERE id = ? AND tenant_id = ?
    `);
    const row = stmt.get(deviceId, tenantId) as any;
    if (!row) return null;
    return this.mapRowToDevice(row);
  }

  public listDevices(tenantId: string, homeId?: string): DeviceRecord[] {
    let query = `SELECT * FROM devices WHERE tenant_id = ?`;
    const params: any[] = [tenantId];
    if (homeId) {
      query += ` AND home_id = ?`;
      params.push(homeId);
    }
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(r => this.mapRowToDevice(r));
  }

  public countDevices(tenantId: string, homeId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM devices WHERE tenant_id = ? AND home_id = ?
    `);
    const row = stmt.get(tenantId, homeId) as any;
    return row ? Number(row.cnt) : 0;
  }

  private mapRowToHome(row: any): HomeProfile {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      address: row.address,
      city: row.city,
      housingType: row.housing_type,
      squareMeters: row.square_meters,
      residentCount: row.resident_count,
      meterInfrastructure: row.meter_infrastructure,
      meterClockOffsetHours: row.meter_clock_offset_hours || 0,
      primaryHeating: row.primary_heating,
      hasSolarPv: Boolean(row.has_solar_pv),
      hasEvCharger: Boolean(row.has_ev_charger),
      tariffPlan: row.tariff_plan,
      tariffVersion: row.tariff_version,
      isPrimary: Boolean(row.is_primary),
      createdAt: row.created_at,
    };
  }

  private mapRowToDevice(row: any): DeviceRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      homeId: row.home_id,
      name: row.name,
      deviceType: row.device_type,
      adapterType: row.adapter_type,
      manufacturer: row.manufacturer || undefined,
      model: row.model || undefined,
      serialNumber: row.serial_number || undefined,
      measurementQuality: row.measurement_quality,
      isSubMeteredOnly: Boolean(row.is_sub_metered_only),
      nominalPowerW: row.nominal_power_w ?? undefined,
      status: row.status,
      lastHeartbeat: row.last_heartbeat || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    };
  }
}
