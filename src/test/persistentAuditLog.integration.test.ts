import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService } from '../services/persistence/DatabaseService';
import { AuditLogRepository } from '../services/persistence/AuditLogRepository';

describe('Integration: Persistent Audit Logs & Cryptographic Tamper-Evidence', () => {
  let dbService: DatabaseService;
  let auditRepo: AuditLogRepository;
  const tenantId = 'tenant-audit-test';

  beforeEach(() => {
    dbService = DatabaseService.createIsolatedInstance(':memory:');
    // Create tenant in DB for foreign key
    dbService.getDb().prepare(`
      INSERT INTO organizations (id, name, slug, contact_email, created_at, updated_at)
      VALUES (?, 'Audit Test Org', 'audit-test-org', 'audit@test.io', datetime('now'), datetime('now'))
    `).run(tenantId);

    auditRepo = new AuditLogRepository(dbService.getDb());
  });

  it('records audit events with cryptographic SHA-256 hash chaining', () => {
    const entry1 = auditRepo.record({
      tenantId,
      userId: 'user-admin',
      userEmail: 'admin@test.io',
      action: 'ORGANIZATION_CREATED',
      category: 'AUTH',
      details: { tier: 'STARTER_HOME' },
      severity: 'INFO',
    });

    const entry2 = auditRepo.record({
      tenantId,
      userId: 'user-admin',
      userEmail: 'admin@test.io',
      action: 'DEVICE_PAIRED',
      category: 'PAIRING',
      details: { deviceId: 'dev-plug-01' },
      severity: 'INFO',
    });

    expect(entry1.recordHash).toBeDefined();
    expect(entry1.prevRecordHash).toContain('GENESIS_BLOCK');

    // Entry 2's prevRecordHash MUST equal Entry 1's recordHash
    expect(entry2.prevRecordHash).toBe(entry1.recordHash);

    // Verify integrity of the chain
    const verification = auditRepo.verifyIntegrity(tenantId);
    expect(verification.valid).toBe(true);
    expect(verification.totalChecked).toBe(2);
  });

  it('enforces database-level append-only triggers, prohibiting UPDATE and DELETE', () => {
    const entry = auditRepo.record({
      tenantId,
      userId: 'user-admin',
      action: 'DEVICE_REVOKED',
      category: 'DEVICE_COMMAND',
      details: { deviceId: 'dev-01' },
      severity: 'WARNING',
    });

    const db = dbService.getDb();

    // Direct UPDATE attempt on the database row MUST be aborted by trigger
    expect(() => {
      db.prepare(`UPDATE audit_logs SET action = 'MALICIOUS_ALTERATION' WHERE id = ?`).run(entry.id);
    }).toThrow(/SECURITY ALERT: audit_logs is an append-only immutable ledger/);

    // Direct DELETE attempt on the database row MUST be aborted by trigger
    expect(() => {
      db.prepare(`DELETE FROM audit_logs WHERE id = ?`).run(entry.id);
    }).toThrow(/SECURITY ALERT: audit_logs is an append-only immutable ledger/);
  });

  it('detects tampering immediately when a record payload is modified', () => {
    const e1 = auditRepo.record({
      tenantId,
      userId: 'user-1',
      action: 'EVENT_1',
      category: 'AUTH',
      details: { amount: 100 },
      severity: 'INFO',
    });

    const e2 = auditRepo.record({
      tenantId,
      userId: 'user-1',
      action: 'EVENT_2',
      category: 'AUTH',
      details: { amount: 200 },
      severity: 'INFO',
    });

    // Temporarily drop trigger to simulate a direct rogue disk/DB injection attack
    const db = dbService.getDb();
    db.exec(`DROP TRIGGER audit_logs_no_update;`);

    // Tamper with e1 details
    db.prepare(`UPDATE audit_logs SET details = ? WHERE id = ?`).run(JSON.stringify({ amount: 999999 }), e1.id);

    // Re-verify chain integrity
    const check = auditRepo.verifyIntegrity(tenantId);
    expect(check.valid).toBe(false);
    expect(check.tamperedRecordId).toBe(e1.id);
    expect(check.error).toMatch(/Payload tamper detected/i);
  });
});
