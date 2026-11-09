import * as crypto from 'node:crypto';

export interface AuditCheckpoint {
  tenantId: string;
  lastSeq: number;
  lastRecordHash: string;
  timestamp: string;
  signature: string;
}

export class AuditAnchorStore {
  private static instance: AuditAnchorStore | null = null;
  private checkpoints: Map<string, AuditCheckpoint> = new Map();
  private secretKey: string;
  private previousKeys: string[] = [];

  constructor(secretKey?: string, previousKeys: string[] = []) {
    this.secretKey = secretKey || process.env.AUDIT_ANCHOR_SECRET || 'aether_audit_anchor_master_signing_key_2026';
    this.previousKeys = [...previousKeys];
    if (process.env.AUDIT_ANCHOR_PREVIOUS_SECRETS) {
      const envKeys = process.env.AUDIT_ANCHOR_PREVIOUS_SECRETS.split(',').map(k => k.trim()).filter(Boolean);
      this.previousKeys.push(...envKeys);
    }
  }

  public static getInstance(): AuditAnchorStore {
    if (!AuditAnchorStore.instance) {
      AuditAnchorStore.instance = new AuditAnchorStore();
    }
    return AuditAnchorStore.instance;
  }

  public static resetInstance(): void {
    AuditAnchorStore.instance = null;
  }

  /**
   * Rotates primary signing secret, retiring the current key to the previousKeys list.
   */
  public rotateKey(newKey: string): void {
    if (!newKey || newKey === this.secretKey) return;
    this.previousKeys.push(this.secretKey);
    this.secretKey = newKey;
  }

  /**
   * Adds an older retired key to the rotation verification list.
   */
  public addRotationKey(key: string): void {
    if (key && !this.previousKeys.includes(key) && key !== this.secretKey) {
      this.previousKeys.push(key);
    }
  }

  public createCheckpoint(tenantId: string, lastSeq: number, lastRecordHash: string): AuditCheckpoint {
    const timestamp = new Date().toISOString();
    const payload = `${tenantId}:${lastSeq}:${lastRecordHash}:${timestamp}`;
    const signature = crypto.createHmac('sha256', this.secretKey).update(payload).digest('hex');

    const checkpoint: AuditCheckpoint = {
      tenantId,
      lastSeq,
      lastRecordHash,
      timestamp,
      signature,
    };

    this.checkpoints.set(tenantId, checkpoint);
    return checkpoint;
  }

  public getCheckpoint(tenantId: string): AuditCheckpoint | null {
    return this.checkpoints.get(tenantId) || null;
  }

  /**
   * Verifies HMAC signature of a checkpoint against the current active signing key
   * or any retired keys registered in the key rotation history.
   */
  public verifyCheckpointSignature(checkpoint: AuditCheckpoint, allowedKeys?: string[]): boolean {
    const payload = `${checkpoint.tenantId}:${checkpoint.lastSeq}:${checkpoint.lastRecordHash}:${checkpoint.timestamp}`;
    const candidateKeys = [this.secretKey, ...this.previousKeys, ...(allowedKeys || [])];

    for (const key of candidateKeys) {
      const expected = crypto.createHmac('sha256', key).update(payload).digest('hex');
      if (checkpoint.signature.length === expected.length) {
        if (crypto.timingSafeEqual(Buffer.from(checkpoint.signature), Buffer.from(expected))) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Exports all in-memory tenant checkpoints for disaster recovery or cold-storage anchoring.
   */
  public exportCheckpoints(): Record<string, AuditCheckpoint> {
    const output: Record<string, AuditCheckpoint> = {};
    for (const [k, v] of this.checkpoints.entries()) {
      output[k] = { ...v };
    }
    return output;
  }

  /**
   * Imports checkpoints after container restart or during disaster recovery.
   */
  public importCheckpoints(data: Record<string, AuditCheckpoint>): void {
    for (const [k, v] of Object.entries(data)) {
      if (this.verifyCheckpointSignature(v)) {
        this.checkpoints.set(k, v);
      }
    }
  }

  public clear(): void {
    this.checkpoints.clear();
  }
}

