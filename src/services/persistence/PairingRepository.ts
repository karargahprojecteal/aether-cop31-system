import { DatabaseSync } from 'node:sqlite';
import * as crypto from 'node:crypto';
import { PairingToken, DeviceRecord, IntegrationPathway } from '../../types/residential';
import { DatabaseService } from './DatabaseService';
import { TenantRepository } from './TenantRepository';

const SAFE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 30 characters, no 0, O, 1, I, L

export class PairingRepository {
  private db: DatabaseSync;
  private tenantRepo: TenantRepository;

  constructor(db?: DatabaseSync, tenantRepo?: TenantRepository) {
    this.db = db || DatabaseService.getInstance().getDb();
    this.tenantRepo = tenantRepo || new TenantRepository(this.db);
  }

  /**
   * Generates a cryptographically secure, ephemeral 8-character pairing code
   * Stores SHA-256(token + salt) in the database.
   */
  public generatePairingToken(
    tenantId: string,
    homeId: string,
    deviceType: DeviceRecord['deviceType'],
    adapterType: IntegrationPathway
  ): { plainToken: string; record: PairingToken } {
    // 1. Verify Home exists and belongs to Tenant
    const home = this.tenantRepo.getHome(tenantId, homeId);
    if (!home) {
      throw new Error(`Authorization Error: Home '${homeId}' does not belong to Tenant '${tenantId}'`);
    }

    // 2. Cryptographically secure random token generation
    const randomBytes = crypto.randomBytes(8);
    let plainToken = '';
    for (let i = 0; i < 8; i++) {
      const idx = randomBytes[i] % SAFE_ALPHABET.length;
      plainToken += SAFE_ALPHABET[idx];
    }

    // 3. Salt and Hash
    const salt = crypto.randomBytes(16).toString('hex');
    const tokenHash = this.hashToken(plainToken, salt);

    const id = `ptk-${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000; // 15 Minutes TTL

    const stmt = this.db.prepare(`
      INSERT INTO pairing_tokens (
        id, tenant_id, home_id, device_type, adapter_type, token_hash, token_salt,
        status, attempts_count, max_attempts, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, 5, ?, ?)
    `);

    stmt.run(id, tenantId, homeId, deviceType, adapterType, tokenHash, salt, expiresAt, now);

    const record: PairingToken = {
      token: plainToken, // returned once to the caller
      tenantId,
      homeId,
      deviceType,
      adapterType,
      createdAt: now,
      expiresAt,
      status: 'PENDING',
      attemptsCount: 0,
      maxAttempts: 5,
    };

    return { plainToken, record };
  }

  /**
   * Atomically redeems a pairing code with multi-dimensional brute-force protection
   * and concurrency race-condition prevention.
   */
  public redeemPairingToken(
    tenantId: string,
    tokenStr: string,
    deviceDetails: {
      name: string;
      manufacturer?: string;
      model?: string;
      serialNumber?: string;
      metadata?: Record<string, any>;
    },
    clientIp: string = '127.0.0.1'
  ): { success: boolean; device?: DeviceRecord; error?: string } {
    const cleanToken = tokenStr.trim().toUpperCase();
    const now = Date.now();

    // 1. Check Multi-Dimensional Brute Force Lockouts (by Tenant and by IP)
    const tenantLockKey = `lock:tenant:${tenantId}`;
    const ipLockKey = `lock:ip:${clientIp}`;

    if (this.isLocked(tenantLockKey, now) || this.isLocked(ipLockKey, now)) {
      return {
        success: false,
        error: 'Too many invalid attempts. Pairing interface locked for this tenant/IP for 30 minutes.',
      };
    }

    // 2. Find matching candidate token record for this tenant
    const candidatesStmt = this.db.prepare(`
      SELECT * FROM pairing_tokens WHERE tenant_id = ?
    `);
    const candidates = candidatesStmt.all(tenantId) as any[];

    let matchedRow: any = null;
    for (const cand of candidates) {
      const computedHash = this.hashToken(cleanToken, cand.token_salt);
      if (crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(cand.token_hash))) {
        matchedRow = cand;
        break;
      }
    }

    if (!matchedRow) {
      this.recordFailedAttempt(tenantLockKey, now);
      this.recordFailedAttempt(ipLockKey, now);
      return { success: false, error: 'Invalid pairing token. Token not found or invalid.' };
    }

    // 3. Verify Tenant Binding
    if (matchedRow.tenant_id !== tenantId) {
      this.recordFailedAttempt(tenantLockKey, now);
      this.recordFailedAttempt(ipLockKey, now);
      return { success: false, error: 'Access denied: Token belongs to a different organization.' };
    }

    // 4. Verify Single-Use Consumption Status
    if (matchedRow.status === 'CONSUMED') {
      return { success: false, error: 'Security Violation: Pairing token has already been consumed.' };
    }

    // 5. Verify Expiration
    if (now > matchedRow.expires_at || matchedRow.status === 'EXPIRED') {
      this.db.prepare(`UPDATE pairing_tokens SET status = 'EXPIRED' WHERE id = ?`).run(matchedRow.id);
      return { success: false, error: 'Pairing token has expired (15-minute TTL elapsed).' };
    }

    // 6. ATOMIC CONSUMPTION: Compare-and-swap
    // Guarantees that two concurrent redemption requests cannot both succeed
    const updateStmt = this.db.prepare(`
      UPDATE pairing_tokens
      SET status = 'CONSUMED', consumed_at = ?
      WHERE id = ? AND status = 'PENDING' AND expires_at > ?
    `);

    const result = updateStmt.run(now, matchedRow.id, now);
    if (Number(result.changes) === 0) {
      return {
        success: false,
        error: 'Security Violation: Pairing token was concurrently consumed or expired.',
      };
    }

    // 6. Register Device into Tenant Repository
    const isSubMetered = matchedRow.device_type === 'SMART_PLUG' || matchedRow.device_type === 'SUB_METER_RELAY';
    const quality = matchedRow.adapter_type === 'SMART_METER'
      ? 'PHYSICAL_METERED'
      : isSubMetered
      ? 'SUB_METERED'
      : 'PHYSICAL_METERED';

    const deviceId = `dev-${crypto.randomBytes(6).toString('hex')}`;
    const device: DeviceRecord = {
      id: deviceId,
      tenantId: matchedRow.tenant_id,
      homeId: matchedRow.home_id,
      name: deviceDetails.name || `${matchedRow.device_type} (${cleanToken})`,
      deviceType: matchedRow.device_type,
      adapterType: matchedRow.adapter_type,
      manufacturer: deviceDetails.manufacturer || 'Certified IoT Vendor',
      model: deviceDetails.model,
      serialNumber: deviceDetails.serialNumber || `SN-${cleanToken}`,
      measurementQuality: quality,
      isSubMeteredOnly: isSubMetered,
      status: 'ONLINE',
      createdAt: new Date().toISOString(),
      metadata: deviceDetails.metadata,
    };

    const registeredDevice = this.tenantRepo.registerDevice(device);
    return { success: true, device: registeredDevice };
  }

  public revokeToken(tenantId: string, tokenId: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE pairing_tokens SET status = 'REVOKED' WHERE id = ? AND tenant_id = ?
    `);
    const res = stmt.run(tokenId, tenantId);
    return Number(res.changes) > 0;
  }

  public getPendingTokensForHome(tenantId: string, homeId: string): any[] {
    const now = Date.now();
    const stmt = this.db.prepare(`
      SELECT id, tenant_id, home_id, device_type, adapter_type, status, expires_at, created_at
      FROM pairing_tokens
      WHERE tenant_id = ? AND home_id = ? AND status = 'PENDING' AND expires_at > ?
    `);
    return stmt.all(tenantId, homeId, now);
  }

  private hashToken(plainToken: string, salt: string): string {
    return crypto.createHash('sha256').update(plainToken + salt).digest('hex');
  }

  private isLocked(lockKey: string, now: number): boolean {
    const stmt = this.db.prepare(`SELECT * FROM brute_force_locks WHERE lock_key = ?`);
    const row = stmt.get(lockKey) as any;
    if (!row) return false;
    if (row.locked_until_ms > now) return true;
    return false;
  }

  private recordFailedAttempt(lockKey: string, now: number): void {
    const stmt = this.db.prepare(`SELECT * FROM brute_force_locks WHERE lock_key = ?`);
    const row = stmt.get(lockKey) as any;
    let count = 1;
    let lockedUntil = 0;

    if (row) {
      count = row.failed_count + 1;
      if (count >= 5) {
        lockedUntil = now + 30 * 60 * 1000; // 30 minutes lockout
      }
      this.db.prepare(`
        UPDATE brute_force_locks SET failed_count = ?, locked_until_ms = ? WHERE lock_key = ?
      `).run(count, lockedUntil, lockKey);
    } else {
      this.db.prepare(`
        INSERT INTO brute_force_locks (lock_key, failed_count, locked_until_ms) VALUES (?, ?, ?)
      `).run(lockKey, count, lockedUntil);
    }
  }
}
