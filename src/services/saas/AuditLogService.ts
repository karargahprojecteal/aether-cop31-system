import { AuditLogEntry } from '../../types/saas';
import { AuditLogRepository } from '../persistence/AuditLogRepository';

export class AuditLogService {
  private repository: AuditLogRepository;

  constructor(repository?: AuditLogRepository) {
    this.repository = repository || new AuditLogRepository();
  }

  public record(entry: {
    tenantId: string;
    userId: string;
    userEmail?: string;
    action: string;
    category: AuditLogEntry['category'];
    details: Record<string, any>;
    severity: AuditLogEntry['severity'];
  }): AuditLogEntry {
    return this.repository.record(entry);
  }

  public listLogs(tenantId: string, limit: number = 50): AuditLogEntry[] {
    return this.repository.listLogs(tenantId, limit);
  }

  public verifyIntegrity(tenantId: string): { valid: boolean; totalChecked: number; tamperedRecordId?: string; error?: string } {
    return this.repository.verifyIntegrity(tenantId);
  }
}

export const auditLogServiceInstance = new AuditLogService();
