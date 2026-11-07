import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../services/persistence/DatabaseService';
import { AuditLogRepository } from '../services/persistence/AuditLogRepository';
import { canonicalizeJson } from '../services/crypto/canonicalJson';

describe('Audit Integrity Challenge: Truncation & External Anchor Vulnerability', () => {
  let dbService: DatabaseService;
  let auditRepo: AuditLogRepository;
  const tenantId = 'tenant-audit-challenge';

  beforeEach(() => {
    dbService = DatabaseService.createIsolatedInstance(':memory:');
    dbService.getDb().prepare(`
      INSERT INTO organizations (id, name, slug, contact_email, created_at, updated_at)
      VALUES (?, 'Challenge Org', 'challenge-org', 'challenge@test.io', datetime('now'), datetime('now'))
    `).run(tenantId);
    auditRepo = new AuditLogRepository(dbService.getDb());
  });

  it('VULNERABILITY: Tail truncation (record deletion) goes completely undetected by verifyIntegrity() due to lack of external anchor', () => {
    // 1. Record 5 sequential audit logs
    const entries = [];
    for (let i = 1; i <= 5; i++) {
      entries.push(auditRepo.record({
        tenantId,
        userId: 'admin-1',
        action: `ACTION_${i}`,
        category: 'AUTH',
        details: { step: i },
        severity: 'INFO',
      }));
    }

    // Verify all 5 are valid
    const checkInitial = auditRepo.verifyIntegrity(tenantId);
    expect(checkInitial.valid).toBe(true);
    expect(checkInitial.totalChecked).toBe(5);

    // 2. An attacker or rogue DBA drops trigger and deletes the last 2 records (truncation attack)
    const db = dbService.getDb();
    db.exec('DROP TRIGGER audit_logs_no_delete;');
    db.prepare('DELETE FROM audit_logs WHERE id IN (?, ?)').run(entries[3].id, entries[4].id);

    // 3. Re-verify integrity: verifyIntegrity() passes with valid: true!
    const checkAfterTruncation = auditRepo.verifyIntegrity(tenantId);
    expect(checkAfterTruncation.valid).toBe(true); // FAILS to detect that entries 4 and 5 were wiped!
    expect(checkAfterTruncation.totalChecked).toBe(3); // Silently reduced count!
  });

  it('VULNERABILITY: Total ledger wipe returns valid: true with 0 records checked', () => {
    const db = dbService.getDb();
    db.exec('DROP TRIGGER audit_logs_no_delete;');
    db.prepare('DELETE FROM audit_logs WHERE tenant_id = ?').run(tenantId);

    const checkWipe = auditRepo.verifyIntegrity(tenantId);
    expect(checkWipe.valid).toBe(true);
    expect(checkWipe.totalChecked).toBe(0);
  });

  it('VULNERABILITY: Middle modification with forward hash recalculation passes verification without external anchor', () => {
    // 1. Record 3 entries
    const e1 = auditRepo.record({ tenantId, userId: 'u1', action: 'CREATE', category: 'AUTH', details: { val: 1 }, severity: 'INFO' });
    const e2 = auditRepo.record({ tenantId, userId: 'u1', action: 'UPDATE', category: 'AUTH', details: { val: 2 }, severity: 'INFO' });
    const e3 = auditRepo.record({ tenantId, userId: 'u1', action: 'DELETE', category: 'AUTH', details: { val: 3 }, severity: 'INFO' });

    // 2. Attacker modifies e2 details and recalculates hashes down the chain
    const db = dbService.getDb();
    db.exec('DROP TRIGGER audit_logs_no_update;');

    const tamperedDetails = { val: 999999 };
    const canon2 = canonicalizeJson(tamperedDetails);
    const newHash2 = crypto.createHash('sha256').update(
      `${e1.recordHash}|${tenantId}|u1|UPDATE|AUTH|${e2.timestamp}|${canon2}`
    ).digest('hex');

    db.prepare('UPDATE audit_logs SET details = ?, record_hash = ? WHERE id = ?')
      .run(canon2, newHash2, e2.id);

    // Recalculate e3 to point to newHash2
    const canon3 = canonicalizeJson(e3.details);
    const newHash3 = crypto.createHash('sha256').update(
      `${newHash2}|${tenantId}|u1|DELETE|AUTH|${e3.timestamp}|${canon3}`
    ).digest('hex');

    db.prepare('UPDATE audit_logs SET prev_record_hash = ?, record_hash = ? WHERE id = ?')
      .run(newHash2, newHash3, e3.id);

    // 3. Re-verify integrity: verifyIntegrity() returns valid: true!
    const checkRewrite = auditRepo.verifyIntegrity(tenantId);
    expect(checkRewrite.valid).toBe(true); // Undetected because root/tip is NOT anchored externally!
  });
});
