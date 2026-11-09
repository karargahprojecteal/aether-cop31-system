import { PairingToken, DeviceRecord, IntegrationPathway } from '../../types/residential';
import { PairingRepository } from '../persistence/PairingRepository';

export class PairingService {
  private repository: PairingRepository;

  constructor(repository?: PairingRepository) {
    this.repository = repository || new PairingRepository();
  }

  /**
   * Generates a cryptographically secure, ephemeral 8-character pairing code
   */
  public generatePairingToken(
    tenantId: string,
    homeId: string,
    deviceType: DeviceRecord['deviceType'],
    adapterType: IntegrationPathway
  ): PairingToken {
    const { record } = this.repository.generatePairingToken(tenantId, homeId, deviceType, adapterType);
    return record;
  }

  /**
   * Validates and atomically redeems a pairing code, registering the device
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
    return this.repository.redeemPairingToken(tenantId, tokenStr, deviceDetails, clientIp);
  }

  public getPendingTokensForHome(tenantId: string, homeId: string): any[] {
    return this.repository.getPendingTokensForHome(tenantId, homeId);
  }

  public revokeToken(tenantId: string, tokenId: string): boolean {
    return this.repository.revokeToken(tenantId, tokenId);
  }
}

export const pairingServiceInstance = new PairingService();
