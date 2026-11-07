import { PairingToken, DeviceRecord, IntegrationPathway } from '../../types/residential';
import { deviceRegistryInstance } from './DeviceRegistry';

const SAFE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 30 characters, no 0, O, 1, I, L

export class PairingService {
  private activeTokens: Map<string, PairingToken> = new Map(); // token string -> PairingToken
  private failedAttempts: Map<string, { count: number; lockedUntil: number }> = new Map(); // homeId -> attempts

  /**
   * Generates a secure, ephemeral 8-character pairing code with 15-minute TTL
   */
  public generatePairingToken(
    tenantId: string,
    homeId: string,
    deviceType: DeviceRecord['deviceType'],
    adapterType: IntegrationPathway
  ): PairingToken {
    let tokenStr = '';
    for (let i = 0; i < 8; i++) {
      const idx = Math.floor(Math.random() * SAFE_ALPHABET.length);
      tokenStr += SAFE_ALPHABET[idx];
    }

    const now = Date.now();
    const pairingToken: PairingToken = {
      token: tokenStr,
      tenantId,
      homeId,
      deviceType,
      adapterType,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000, // 15 Minutes TTL
      status: 'PENDING',
      attemptsCount: 0,
      maxAttempts: 5,
    };

    this.activeTokens.set(tokenStr, pairingToken);
    return pairingToken;
  }

  /**
   * Validates and redeems a pairing code, registering the device
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
    }
  ): { success: boolean; device?: DeviceRecord; error?: string } {
    const cleanToken = tokenStr.trim().toUpperCase();

    // Check brute force lockout
    const failureKey = `${tenantId}:${cleanToken}`;
    const failureRecord = this.failedAttempts.get(failureKey);
    const now = Date.now();
    if (failureRecord && failureRecord.lockedUntil > now) {
      const remainingSec = Math.ceil((failureRecord.lockedUntil - now) / 1000);
      return { 
        success: false, 
        error: `Too many invalid attempts. Pairing locked for ${remainingSec} seconds.` 
      };
    }

    const pairingRecord = this.activeTokens.get(cleanToken);
    if (!pairingRecord) {
      this.recordFailedAttempt(failureKey);
      return { success: false, error: 'Invalid pairing token. Token not found.' };
    }

    // Tenant check
    if (pairingRecord.tenantId !== tenantId) {
      this.recordFailedAttempt(failureKey);
      return { success: false, error: 'Access denied: Token belongs to a different organization.' };
    }

    // Check single-use
    if (pairingRecord.status === 'CONSUMED') {
      return { success: false, error: 'Security Violation: Pairing token has already been consumed.' };
    }

    // Check expiration
    if (now > pairingRecord.expiresAt || pairingRecord.status === 'EXPIRED') {
      pairingRecord.status = 'EXPIRED';
      return { success: false, error: 'Pairing token has expired (15-minute TTL elapsed).' };
    }

    // Mark as consumed immediately (Single-use enforcement)
    pairingRecord.status = 'CONSUMED';
    this.activeTokens.set(cleanToken, pairingRecord);

    // Register into DeviceRegistry
    const isSubMetered = pairingRecord.deviceType === 'SMART_PLUG' || pairingRecord.deviceType === 'SUB_METER_RELAY';
    const quality = pairingRecord.adapterType === 'SMART_METER' 
      ? 'PHYSICAL_METERED' 
      : isSubMetered 
      ? 'SUB_METERED' 
      : 'PHYSICAL_METERED';

    const registeredDevice = deviceRegistryInstance.registerDevice({
      tenantId: pairingRecord.tenantId,
      homeId: pairingRecord.homeId,
      name: deviceDetails.name || `${pairingRecord.deviceType} (${cleanToken})`,
      deviceType: pairingRecord.deviceType,
      adapterType: pairingRecord.adapterType,
      manufacturer: deviceDetails.manufacturer || 'Generic IoT Vendor',
      model: deviceDetails.model,
      serialNumber: deviceDetails.serialNumber || `SN-${cleanToken}`,
      measurementQuality: quality,
      isSubMeteredOnly: isSubMetered,
      metadata: deviceDetails.metadata,
    });

    return { success: true, device: registeredDevice };
  }

  public getPendingTokensForHome(tenantId: string, homeId: string): PairingToken[] {
    const list: PairingToken[] = [];
    const now = Date.now();
    for (const token of this.activeTokens.values()) {
      if (token.tenantId === tenantId && token.homeId === homeId) {
        if (token.status === 'PENDING' && now <= token.expiresAt) {
          list.push(token);
        }
      }
    }
    return list;
  }

  private recordFailedAttempt(key: string): void {
    const now = Date.now();
    const curr = this.failedAttempts.get(key) || { count: 0, lockedUntil: 0 };
    curr.count++;
    if (curr.count >= 5) {
      curr.lockedUntil = now + 30 * 60 * 1000; // 30 mins lockout
    }
    this.failedAttempts.set(key, curr);
  }
}

export const pairingServiceInstance = new PairingService();
