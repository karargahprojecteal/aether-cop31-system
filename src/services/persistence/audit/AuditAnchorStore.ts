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

  constructor(secretKey?: string) {
    this.secretKey = secretKey || process.env.AUDIT_ANCHOR_SECRET || 'aether_audit_anchor_master_signing_key_2026';
  }

  public static getInstance(): AuditAnchorStore {
    if (!AuditAnchorStore.instance) {
      AuditAnchorStore.instance = new AuditAnchorStore();
    }
    return AuditAnchorStore.instance;
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

  public verifyCheckpointSignature(checkpoint: AuditCheckpoint): boolean {
    const payload = `${checkpoint.tenantId}:${checkpoint.lastSeq}:${checkpoint.lastRecordHash}:${checkpoint.timestamp}`;
    const expected = crypto.createHmac('sha256', this.secretKey).update(payload).digest('hex');
    if (checkpoint.signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(checkpoint.signature), Buffer.from(expected));
  }

  public clear(): void {
    this.checkpoints.clear();
  }
}
