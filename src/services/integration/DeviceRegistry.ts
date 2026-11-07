import { DeviceRecord, IntegrationPathway } from '../../types/residential';

export class DeviceRegistry {
  private devices: Map<string, DeviceRecord> = new Map();

  constructor() {
    this.seedDefaultDevices();
  }

  public registerDevice(record: Omit<DeviceRecord, 'id' | 'createdAt' | 'pairingStatus'>): DeviceRecord {
    const id = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newDevice: DeviceRecord = {
      ...record,
      id,
      pairingStatus: 'PAIRED',
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };
    this.devices.set(id, newDevice);
    return newDevice;
  }

  public getDevice(tenantId: string, deviceId: string): DeviceRecord | null {
    const device = this.devices.get(deviceId);
    if (!device) return null;
    // Strict tenant isolation check
    if (device.tenantId !== tenantId) {
      throw new Error(`Security Violation: Tenant ${tenantId} cannot access device ${deviceId}`);
    }
    return device;
  }

  public listDevicesForHome(tenantId: string, homeId: string): DeviceRecord[] {
    const result: DeviceRecord[] = [];
    for (const device of this.devices.values()) {
      if (device.tenantId === tenantId && device.homeId === homeId) {
        result.push(device);
      }
    }
    return result;
  }

  public updateLastSeen(tenantId: string, deviceId: string): void {
    const device = this.getDevice(tenantId, deviceId);
    if (device) {
      device.lastSeenAt = new Date().toISOString();
      this.devices.set(deviceId, device);
    }
  }

  public revokeDevice(tenantId: string, deviceId: string): boolean {
    const device = this.getDevice(tenantId, deviceId);
    if (!device) return false;
    device.pairingStatus = 'REVOKED';
    this.devices.set(deviceId, device);
    return true;
  }

  public countDevices(tenantId: string, homeId?: string): number {
    let count = 0;
    for (const d of this.devices.values()) {
      if (d.tenantId === tenantId && (!homeId || d.homeId === homeId)) {
        if (d.pairingStatus === 'PAIRED') {
          count++;
        }
      }
    }
    return count;
  }

  private seedDefaultDevices(): void {
    const defaultHomeId = 'home-etkim-antalya';
    const defaultTenantId = 'tenant-karargah-etkim';

    const defaultMainsMeter: DeviceRecord = {
      id: 'dev-mains-01',
      tenantId: defaultTenantId,
      homeId: defaultHomeId,
      name: 'Ana Tesis Akıllı Sayaç & Frekans Dinleyici',
      deviceType: 'MAIN_METER',
      adapterType: 'SMART_METER',
      manufacturer: 'AETHER NILM Virtual Meter',
      model: 'OSOS-HAL-2026',
      serialNumber: 'TR-ANT-2026-0042',
      pairingStatus: 'PAIRED',
      measurementQuality: 'PHYSICAL_METERED',
      isSubMeteredOnly: false,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      metadata: { port: 'RS485-Modbus-RTU', baudRate: 9600 },
    };

    const heatPumpSubmeter: DeviceRecord = {
      id: 'dev-sub-hvac',
      tenantId: defaultTenantId,
      homeId: defaultHomeId,
      name: 'Isı Pompası & Chiller Alt Sayaç',
      deviceType: 'SUB_METER_RELAY',
      adapterType: 'LOCAL_GATEWAY',
      manufacturer: 'Shelly',
      model: 'Pro 3EM',
      pairingStatus: 'PAIRED',
      measurementQuality: 'SUB_METERED',
      isSubMeteredOnly: true,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.devices.set(defaultMainsMeter.id, defaultMainsMeter);
    this.devices.set(heatPumpSubmeter.id, heatPumpSubmeter);
  }
}

export const deviceRegistryInstance = new DeviceRegistry();
