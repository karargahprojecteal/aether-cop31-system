import { describe, it, expect, beforeAll } from 'vitest';
import { pairingServiceInstance } from '../services/integration/PairingService';
import { tenantManagerInstance } from '../services/saas/TenantManager';
import { TenantContext } from '../types/saas';

describe('AETHER Ephemeral Pairing & Device Security', () => {
  const tenantId = 'tenant-test-pairing';
  const homeId = 'home-test-pairing';

  const testContext: TenantContext = {
    tenantId,
    userId: 'user-pairing-admin',
    userEmail: 'admin@pairing.test',
    role: 'OWNER',
    accessibleHomeIds: [homeId],
  };

  beforeAll(() => {
    // Register test organization and home in database so foreign keys and tenant isolation pass
    tenantManagerInstance.createOrganization('Pairing Test Org', 'admin@pairing.test', 'pairing-org', tenantId);
    tenantManagerInstance.createHome(testContext, {
      id: homeId,
      tenantId,
      name: 'Pairing Test Lab Home',
      address: 'Test Cad. No:1',
      city: 'Antalya',
      housingType: 'DETACHED_VILLA',
      squareMeters: 180,
      residentCount: 2,
      meterInfrastructure: 'IN_UNIT_BREAKER_PANEL',
      primaryHeating: 'HEAT_PUMP',
      hasSolarPv: true,
      hasEvCharger: false,
      tariffPlan: 'TURKISH_EPDK_3_TIME',
      isPrimary: true,
    } as any);
  });

  it('generates an 8-character token with 15-minute TTL', () => {
    const tokenRecord = pairingServiceInstance.generatePairingToken(
      tenantId,
      homeId,
      'GATEWAY',
      'LOCAL_GATEWAY'
    );

    expect(tokenRecord.token.length).toBe(8);
    expect(tokenRecord.status).toBe('PENDING');
    expect(tokenRecord.expiresAt - tokenRecord.createdAt).toBe(15 * 60 * 1000);
  });

  it('successfully claims and redeems a valid pairing token', () => {
    const tokenRecord = pairingServiceInstance.generatePairingToken(
      tenantId,
      homeId,
      'SUB_METER_RELAY',
      'LOCAL_GATEWAY'
    );

    const result = pairingServiceInstance.redeemPairingToken(tenantId, tokenRecord.token, {
      name: 'Test Kitchen CT Clamp',
      manufacturer: 'AETHER IoT',
      model: 'CT-100A',
    });

    expect(result.success).toBe(true);
    expect(result.device?.id).toBeDefined();
    expect(result.device?.name).toBe('Test Kitchen CT Clamp');
    expect(result.device?.isSubMeteredOnly).toBe(true);
  });

  it('strictly rejects already-consumed tokens (single-use enforcement)', () => {
    const tokenRecord = pairingServiceInstance.generatePairingToken(
      tenantId,
      homeId,
      'MAIN_METER',
      'SMART_METER'
    );

    // First claim succeeds
    const firstAttempt = pairingServiceInstance.redeemPairingToken(tenantId, tokenRecord.token, {
      name: 'Main Meter First',
    });
    expect(firstAttempt.success).toBe(true);

    // Second claim with identical token MUST fail
    const secondAttempt = pairingServiceInstance.redeemPairingToken(tenantId, tokenRecord.token, {
      name: 'Main Meter Replay Attack',
    });
    expect(secondAttempt.success).toBe(false);
    expect(secondAttempt.error).toMatch(/consumed|expired/i);
  });

  it('locks out pairing attempts after 5 consecutive failed guesses', () => {
    const invalidToken = 'BADTOKEN';
    for (let i = 0; i < 5; i++) {
      pairingServiceInstance.redeemPairingToken(tenantId, invalidToken, { name: 'Brute Force' });
    }

    const sixthAttempt = pairingServiceInstance.redeemPairingToken(tenantId, invalidToken, { name: 'Brute Force' });
    expect(sixthAttempt.success).toBe(false);
    expect(sixthAttempt.error).toMatch(/locked/i);
  });
});
