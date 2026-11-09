import * as crypto from 'node:crypto';
import { DeviceRecord } from '../../types/residential';
import { TenantRepository } from '../persistence/TenantRepository';

export class DeviceRegistry {
  private tenantRepo: TenantRepository;

  constructor(tenantRepo?: TenantRepository) {
    this.tenantRepo = tenantRepo || new TenantRepository();
  }

  public registerDevice(record: Omit<DeviceRecord, 'id' | 'createdAt' | 'pairingStatus'>): DeviceRecord {
    const id = `dev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const newDevice: DeviceRecord = {
      ...record,
      id,
      pairingStatus: 'PAIRED',
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'ONLINE',
    };
    return this.tenantRepo.registerDevice(newDevice);
  }

  public getDevice(tenantId: string, deviceId: string): DeviceRecord | null {
    const device = this.tenantRepo.getDevice(tenantId, deviceId);
    if (!device) return null;
    if (device.tenantId !== tenantId) {
      throw new Error(`Security Violation: Tenant ${tenantId} cannot access device ${deviceId}`);
    }
    return device;
  }

  public listDevicesForHome(tenantId: string, homeId: string): DeviceRecord[] {
    return this.tenantRepo.listDevices(tenantId, homeId);
  }

  public updateLastSeen(_tenantId: string, _deviceId: string): void {
    // Handled in heartbeat update
  }

  public revokeDevice(tenantId: string, deviceId: string): boolean {
    const device = this.tenantRepo.getDevice(tenantId, deviceId);
    if (!device) return false;
    device.pairingStatus = 'REVOKED';
    device.status = 'DISCONNECTED';
    return true;
  }

  public countDevices(tenantId: string, homeId?: string): number {
    if (homeId) {
      return this.tenantRepo.countDevices(tenantId, homeId);
    }
    return this.tenantRepo.listDevices(tenantId).length;
  }
}

export const deviceRegistryInstance = new DeviceRegistry();
