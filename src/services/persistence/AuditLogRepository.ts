import { DatabaseSync } from 'node:sqlite';
import * as crypto from 'node:crypto';
import { AuditLogEntry } from '../../types/saas';
import { DatabaseService } from './DatabaseService';

export class AuditLogRepository {
  private db: DatabaseSync;

  constructor(db?: DatabaseSync) {
    this.db = db || DatabaseService.getInstance().getDb();
    this.enforceImmutabilityTriggers();
  }

  /**
   * Enforces append-only storage at database engine level.
   * Prevents UPDATE and DELETE operations on audit_logs table.
   */
  private enforceImmutabilityTriggers(): void {
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS audit_logs_no_update
      BEFORE UPDATE ON audit_logs
      BEGIN
        SELECT RAISE(FAIL, 'SECURITY ALERT: audit_logs is an append-only immutable ledger. Updates are prohibited.');
      END;

      CREATE TRIGGER IF NOT EXISTS audit_logs_no_delete
      BEFORE DELETE ON audit_logs
      BEGIN
        SELECT RAISE(FAIL, 'SECURITY ALERT: audit_logs is an append-only immutable ledger. Deletions are prohibited.');
      END;
    `);
  }

  /**
   * Records a new audit log entry with cryptographic hash chaining
   */
  public record(entry: {
    tenantId: string;
    userId: string;
    userEmail?: string;
    action: string;
    category: AuditLogEntry['category'];
    details: Record<string, any>;
    severity: AuditLogEntry['severity'];
  }): AuditLogEntry {
    const id = `aud-${crypto.randomBytes(8).toString('hex')}`;
    const timestamp = new Date().toISOString();

    // 1. Fetch latest record hash for this tenant to form the chain
    const latestStmt = this.db.prepare(`
      SELECT record_hash FROM audit_logs WHERE tenant_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1
    `);
    const latest = latestStmt.get(entry.tenantId) as any;
    const prevHash = latest ? latest.record_hash : 'GENESIS_BLOCK_0000000000000000000000000000000000000000000000000000000000000000';

    // 2. Compute cryptographic record hash
    const detailsJson = JSON.stringify(entry.details);
    const hashPayload = `${prevHash}|${entry.tenantId}|${entry.userId}|${entry.action}|${entry.category}|${timestamp}|${detailsJson}`;
    const recordHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    // 3. Insert into database
    const insertStmt = this.db.prepare(`
      INSERT INTO audit_logs (
        id, tenant_id, user_id, user_email, action, category, details,
        severity, prev_record_hash, record_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      id,
      entry.tenantId,
      entry.userId,
      entry.userEmail || null,
      entry.action,
      entry.category,
      detailsJson,
      entry.severity,
      prevHash,
      recordHash,
      timestamp
    );

    return {
      id,
      tenantId: entry.tenantId,
      userId: entry.userId,
      userEmail: entry.userEmail,
      action: entry.action,
      category: entry.category,
      details: entry.details,
      severity: entry.severity,
      timestamp,
      prevRecordHash: prevHash,
      recordHash,
    };
  }

  /**
   * Retrieves audit logs for a tenant with strict tenant boundary filtering
   */
  public listLogs(tenantId: string, limit: number = 50): AuditLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs
      WHERE tenant_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT ?
    `);
    const rows = stmt.all(tenantId, limit) as any[];
    return rows.map(r => ({
      id: r.id,
      tenantId: r.tenant_id,
      userId: r.user_id,
      userEmail: r.user_email || undefined,
      action: r.action,
      category: r.category,
      details: JSON.parse(r.details || '{}'),
      severity: r.severity,
      timestamp: r.created_at,
      prevRecordHash: r.prev_record_hash,
      recordHash: r.record_hash,
    }));
  }

  /**
   * Verifies the cryptographic integrity of the audit log hash chain for a tenant.
   * Returns valid: true if untouched, or valid: false with tamper details.
   */
  public verifyIntegrity(tenantId: string): { valid: boolean; totalChecked: number; tamperedRecordId?: string; error?: string } {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs
      WHERE tenant_id = ?
      ORDER BY created_at ASC, rowid ASC
    `);
    const rows = stmt.all(tenantId) as any[];
    let expectedPrevHash = 'GENESIS_BLOCK_0000000000000000000000000000000000000000000000000000000000000000';

    for (const r of rows) {
      if (r.prev_record_hash !== expectedPrevHash) {
        return {
          valid: false,
          totalChecked: rows.length,
          tamperedRecordId: r.id,
          error: `Broken chain link: record ${r.id} expected prev_hash ${expectedPrevHash} but got ${r.prev_record_hash}`,
        };
      }

      // Recompute record hash
      const payload = `${r.prev_record_hash}|${r.tenant_id}|${r.user_id}|${r.action}|${r.category}|${r.created_at}|${r.details}`;
      const computed = crypto.createHash('sha256').update(payload).digest('hex');

      if (computed !== r.record_hash) {
        return {
          valid: false,
          totalChecked: rows.length,
          tamperedRecordId: r.id,
          error: `Payload tamper detected: record ${r.id} computed hash ${computed} does not match stored ${r.record_hash}`,
        };
      }

      expectedPrevHash = r.record_hash;
    }

    return { valid: true, totalChecked: rows.length };
  }
}
