import { AuditLogEntry } from '../../types/saas';

export class AuditLogService {
  private logs: AuditLogEntry[] = [];

  constructor() {
    this.seedInitialAuditLogs();
  }

  public record(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const log: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.logs.unshift(log); // Prepend to show most recent first
    if (this.logs.length > 5000) {
      this.logs.pop();
    }
    return log;
  }

  public listLogs(tenantId: string, limit: number = 50): AuditLogEntry[] {
    return this.logs.filter(l => l.tenantId === tenantId).slice(0, limit);
  }

  private seedInitialAuditLogs(): void {
    const tenantId = 'tenant-karargah-etkim';
    this.logs.push({
      id: 'audit-init-01',
      tenantId,
      userId: 'user-aras-demirtas',
      userEmail: 'aras@aether-energy.io',
      action: 'ORGANIZATION_CREATED',
      category: 'AUTH',
      details: { tier: 'ESTATE_ENTERPRISE', scope: 'Antalya Pilot' },
      timestamp: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
      severity: 'INFO',
    });
    this.logs.push({
      id: 'audit-init-02',
      tenantId,
      userId: 'user-aras-demirtas',
      userEmail: 'aras@aether-energy.io',
      action: 'DEVICE_PAIRED',
      category: 'PAIRING',
      details: { deviceId: 'dev-mains-01', type: 'MAIN_METER', port: 'RS485-Modbus' },
      timestamp: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
      severity: 'INFO',
    });
  }
}

export const auditLogServiceInstance = new AuditLogService();
