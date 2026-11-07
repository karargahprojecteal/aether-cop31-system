import { DatabaseSync } from 'node:sqlite';
import * as crypto from 'node:crypto';
import { AuditLogEntry } from '../../types/saas';
import { DatabaseService } from './DatabaseService';
import { canonicalizeJson } from '../crypto/canonicalJson';
import { IDatabaseAdapter, ISyncDatabaseAdapter } from './adapter/IDatabaseAdapter';
import { SqliteDatabaseAdapter } from './adapter/SqliteDatabaseAdapter';
import { AuditAnchorStore } from './audit/AuditAnchorStore';

export class AuditLogRepository {
  private adapter: ISyncDatabaseAdapter;
  private anchorStore: AuditAnchorStore;

  constructor(dbOrAdapter?: DatabaseSync | IDatabaseAdapter, anchorStore?: AuditAnchorStore) {
    if (!dbOrAdapter) {
      this.adapter = DatabaseService.getInstance().getAdapter() as ISyncDatabaseAdapter;
    } else if ('dialect' in dbOrAdapter) {
      this.adapter = dbOrAdapter as ISyncDatabaseAdapter;
    } else {
      this.adapter = new SqliteDatabaseAdapter(dbOrAdapter);
    }
    this.anchorStore = anchorStore || AuditAnchorStore.getInstance();
    this.enforceImmutabilityTriggers();
    this.ensureSchemaCompatibility();
  }

  private ensureSchemaCompatibility(): void {
    if (this.adapter.dialect === 'sqlite') {
      try {
        this.adapter.exec('ALTER TABLE audit_logs ADD COLUMN seq INTEGER NOT NULL DEFAULT 1;');
      } catch (_) {}
    }
  }

  /**
   * Enforces append-only storage at database engine level.
   * Prevents UPDATE and DELETE operations on audit_logs table.
   */
  private enforceImmutabilityTriggers(): void {
    if (this.adapter.dialect === 'sqlite') {
      try {
        this.adapter.exec(`
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
      } catch (_) {}
    }
  }

  /**
   * Records a new audit log entry with cryptographic hash chaining,
   * RFC 8785 canonical JSON, sequence numbering, and atomic transaction serialization.
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

    return this.adapter.transaction(() => {
      // 1. Fetch latest record for this tenant to form the chain and sequence
      const latest = this.adapter.queryOne<{ seq: number | string; record_hash: string }>(
        'SELECT seq, record_hash FROM audit_logs WHERE tenant_id = ? ORDER BY seq DESC, created_at DESC, id DESC LIMIT 1',
        [entry.tenantId]
      );

      const nextSeq = latest && latest.seq !== undefined && latest.seq !== null ? Number(latest.seq) + 1 : 1;
      const prevHash = latest && latest.record_hash
        ? latest.record_hash
        : 'GENESIS_BLOCK_0000000000000000000000000000000000000000000000000000000000000000';

      // 2. Compute cryptographic record hash using RFC 8785 Canonical JSON
      const detailsCanonical = canonicalizeJson(entry.details);
      const hashPayload = `${prevHash}|${nextSeq}|${entry.tenantId}|${entry.userId}|${entry.action}|${entry.category}|${timestamp}|${detailsCanonical}`;
      const recordHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

      // 3. Insert into database
      this.adapter.execute(
        `INSERT INTO audit_logs (
          id, tenant_id, seq, user_id, user_email, action, category, details,
          severity, prev_record_hash, record_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          entry.tenantId,
          nextSeq,
          entry.userId,
          entry.userEmail || null,
          entry.action,
          entry.category,
          detailsCanonical,
          entry.severity,
          prevHash,
          recordHash,
          timestamp,
        ]
      );

      // 4. Anchor state externally with HMAC signature
      this.anchorStore.createCheckpoint(entry.tenantId, nextSeq, recordHash);

      return {
        id,
        tenantId: entry.tenantId,
        seq: nextSeq,
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
    }) as AuditLogEntry;
  }

  /**
   * Retrieves audit logs for a tenant with strict tenant boundary filtering
   */
  public listLogs(tenantId: string, limit: number = 50): AuditLogEntry[] {
    const rows = this.adapter.query<any>(
      `SELECT * FROM audit_logs
       WHERE tenant_id = ?
       ORDER BY seq DESC, created_at DESC, id DESC
       LIMIT ?`,
      [tenantId, limit]
    ) as any[];

    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      seq: r.seq !== undefined && r.seq !== null ? Number(r.seq) : undefined,
      userId: r.user_id,
      userEmail: r.user_email || undefined,
      action: r.action,
      category: r.category,
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
      severity: r.severity,
      timestamp: r.created_at,
      prevRecordHash: r.prev_record_hash,
      recordHash: r.record_hash,
    }));
  }

  /**
   * Verifies the cryptographic integrity of the audit log hash chain for a tenant.
   * Enforces:
   * 1. Monotonic unbroken sequence verification (seq: 1..N).
   * 2. Hash-chain linkage (prev_record_hash match).
   * 3. Canonical payload integrity (RFC 8785 Canonical JSON).
   * 4. External signed anchor checkpoint verification to defeat tail truncation and table wipes.
   */
  public verifyIntegrity(tenantId: string): { valid: boolean; totalChecked: number; tamperedRecordId?: string; error?: string } {
    const checkpoint = this.anchorStore.getCheckpoint(tenantId);
    if (checkpoint) {
      if (!this.anchorStore.verifyCheckpointSignature(checkpoint)) {
        return {
          valid: false,
          totalChecked: 0,
          error: `Audit anchor signature invalid or tampered for tenant ${tenantId}`,
        };
      }
    }

    const rows = this.adapter.query<any>(
      `SELECT * FROM audit_logs
       WHERE tenant_id = ?
       ORDER BY seq ASC, created_at ASC, id ASC`,
      [tenantId]
    ) as any[];

    if (checkpoint && rows.length === 0) {
      return {
        valid: false,
        totalChecked: 0,
        error: `CRITICAL AUDIT TAMPER: Audit ledger has been wiped! Anchor expects lastSeq ${checkpoint.lastSeq}`,
      };
    }

    if (checkpoint && rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      const lastRowSeq = Number(lastRow.seq || 0);
      if (lastRowSeq !== checkpoint.lastSeq || lastRow.record_hash !== checkpoint.lastRecordHash) {
        return {
          valid: false,
          totalChecked: rows.length,
          tamperedRecordId: lastRow.id,
          error: `CRITICAL AUDIT TAMPER: Audit ledger tail does not match external anchor! Expected seq ${checkpoint.lastSeq} with hash ${checkpoint.lastRecordHash}, but found seq ${lastRowSeq} with hash ${lastRow.record_hash}`,
        };
      }
    }

    let expectedPrevHash = 'GENESIS_BLOCK_0000000000000000000000000000000000000000000000000000000000000000';

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const expectedSeq = i + 1;
      const actualSeq = Number(r.seq || 0);

      if (actualSeq !== expectedSeq) {
        return {
          valid: false,
          totalChecked: rows.length,
          tamperedRecordId: r.id,
          error: `Sequence gap detected: record ${r.id} has seq ${actualSeq} but expected ${expectedSeq}`,
        };
      }

      if (r.prev_record_hash !== expectedPrevHash) {
        return {
          valid: false,
          totalChecked: rows.length,
          tamperedRecordId: r.id,
          error: `Broken chain link: record ${r.id} expected prev_hash ${expectedPrevHash} but got ${r.prev_record_hash}`,
        };
      }

      // Recompute record hash using RFC 8785 Canonical JSON
      const parsedDetails = typeof r.details === 'string' ? JSON.parse(r.details) : r.details;
      const detailsCanonical = canonicalizeJson(parsedDetails);
      const payload = `${r.prev_record_hash}|${actualSeq}|${r.tenant_id}|${r.user_id}|${r.action}|${r.category}|${r.created_at}|${detailsCanonical}`;
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
