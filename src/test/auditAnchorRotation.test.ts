import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { AuditAnchorStore, AuditCheckpoint } from '../services/persistence/audit/AuditAnchorStore';

describe('Audit Integrity: AuditAnchorStore Threat Boundary, Key Rotation & Disaster Recovery', () => {
  let store: AuditAnchorStore;
  const initialKey = 'test_key_phase_1_super_secret';
  const rotatedKey = 'test_key_phase_2_rotated_secret';
  const tenantId = 'tenant-corp-anchor-test';

  beforeEach(() => {
    AuditAnchorStore.resetInstance();
    store = new AuditAnchorStore(initialKey);
  });

  it('generates cryptographic checkpoint and verifies valid signature', () => {
    const checkpoint = store.createCheckpoint(tenantId, 10, 'hash_abc123');
    expect(checkpoint.tenantId).toBe(tenantId);
    expect(checkpoint.lastSeq).toBe(10);
    expect(checkpoint.signature).toBeDefined();

    const isValid = store.verifyCheckpointSignature(checkpoint);
    expect(isValid).toBe(true);
  });

  it('rejects verification if checkpoint payload or signature is tampered', () => {
    const checkpoint = store.createCheckpoint(tenantId, 10, 'hash_abc123');

    // Tamper with sequence number
    const tamperedSeq: AuditCheckpoint = {
      ...checkpoint,
      lastSeq: 11,
    };
    expect(store.verifyCheckpointSignature(tamperedSeq)).toBe(false);

    // Tamper with record hash
    const tamperedHash: AuditCheckpoint = {
      ...checkpoint,
      lastRecordHash: 'hash_corrupted_999',
    };
    expect(store.verifyCheckpointSignature(tamperedHash)).toBe(false);

    // Tamper with signature
    const tamperedSig: AuditCheckpoint = {
      ...checkpoint,
      signature: crypto.randomBytes(32).toString('hex'),
    };
    expect(store.verifyCheckpointSignature(tamperedSig)).toBe(false);
  });

  it('verifies historical checkpoints after key rotation through retired key history', () => {
    // 1. Create checkpoint under initial key
    const checkpointV1 = store.createCheckpoint(tenantId, 5, 'hash_v1');
    expect(store.verifyCheckpointSignature(checkpointV1)).toBe(true);

    // 2. Rotate to new master key
    store.rotateKey(rotatedKey);

    // 3. Create new checkpoint under rotated key
    const checkpointV2 = store.createCheckpoint(tenantId, 12, 'hash_v2');

    // Both v1 (using retired key history) and v2 (using current key) verify successfully
    expect(store.verifyCheckpointSignature(checkpointV2)).toBe(true);
    expect(store.verifyCheckpointSignature(checkpointV1)).toBe(true);
  });

  it('fails verification if an old checkpoint was signed by an unknown/untrusted key not in rotation', () => {
    const rogueStore = new AuditAnchorStore('rogue_unauthorized_key');
    const rogueCheckpoint = rogueStore.createCheckpoint(tenantId, 20, 'hash_rogue');

    expect(store.verifyCheckpointSignature(rogueCheckpoint)).toBe(false);
  });

  it('simulates disaster recovery: exports checkpoints, wipes memory, and restores validated state', () => {
    const cpAlpha = store.createCheckpoint('tenant-alpha', 100, 'hash_alpha');
    const cpBeta = store.createCheckpoint('tenant-beta', 250, 'hash_beta');

    // Cold-backup export
    const snapshot = store.exportCheckpoints();
    expect(Object.keys(snapshot)).toHaveLength(2);

    // Process crash / RAM wipe
    store.clear();
    expect(store.getCheckpoint('tenant-alpha')).toBeNull();
    expect(store.getCheckpoint('tenant-beta')).toBeNull();

    // Cold-restore
    store.importCheckpoints(snapshot);
    expect(store.getCheckpoint('tenant-alpha')?.signature).toBe(cpAlpha.signature);
    expect(store.getCheckpoint('tenant-beta')?.signature).toBe(cpBeta.signature);
    expect(store.verifyCheckpointSignature(store.getCheckpoint('tenant-alpha')!)).toBe(true);
  });
});
