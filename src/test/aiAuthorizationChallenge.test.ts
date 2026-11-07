import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';
import { handleAiDecisionEndpoint, AiDecisionRequest } from '../services/ai/aiServerEndpoint';
import { signJwtToken, verifyJwtToken, DEFAULT_JWT_SECRET } from '../services/auth/jwtVerifier';
import { TelemetryPoint } from '../types/telemetry';

describe('AI Authorization & JWT Challenge', () => {
  const victimTenant = 'tenant-victim-org';
  const attackerTenant = 'tenant-attacker-org';

  const baseTelemetry: TelemetryPoint = {
    id: 'tel-test-challenge-01',
    timestamp: new Date().toISOString(),
    activePowerKw: 14.8,
    reactivePowerKvar: 2.1,
    voltage: 230.5,
    current: 64.2,
    frequency: 50.02,
    powerFactor: 0.98,
    nilm: {
      hvacKw: 6.2,
      lightingKw: 1.5,
      baseLoadKw: 0.8,
      phantomLoadKw: 2.1,
      industrialLoadKw: 4.2,
      solarGenerationKw: 0.0,
      batteryDischargeKw: 0.0,
      netGridImportKw: 14.8,
    },
    outdoorTempC: 34.0,
    outdoorHumidityPercent: 55,
    solarIrradianceWm2: 850,
    occupancyRatePercent: 80,
    gridCarbonIntensityGCo2PerKwh: 512,
    gridElectricityPriceTryPerKwh: 6.85,
  };

  it('rejects forged JWT signatures', async () => {
    const validToken = signJwtToken({ sub: 'user-1', tenantId: victimTenant });
    const parts = validToken.split('.');
    // Corrupt signature
    const forgedToken = `${parts[0]}.${parts[1]}.bad_signature_0000000000000000000000000000`;

    const res = await handleAiDecisionEndpoint(
      { tenantId: victimTenant, userId: 'user-1', telemetry: baseTelemetry },
      `Bearer ${forgedToken}`
    );
    expect(res.statusCode).toBe(401);
    expect(res.error).toMatch(/forgery|verification failed/i);
  });

  it('rejects tokens signed with wrong cryptographic key', async () => {
    const wrongKey = 'completely_different_signing_secret_99999999';
    const tokenWrongKey = signJwtToken({ sub: 'user-1', tenantId: victimTenant }, wrongKey);

    const res = await handleAiDecisionEndpoint(
      { tenantId: victimTenant, userId: 'user-1', telemetry: baseTelemetry },
      `Bearer ${tokenWrongKey}`
    );
    expect(res.statusCode).toBe(401);
  });

  it('rejects expired tokens', async () => {
    const expiredToken = signJwtToken(
      { sub: 'user-1', tenantId: victimTenant, expiresInSeconds: -60 }
    );

    const res = await handleAiDecisionEndpoint(
      { tenantId: victimTenant, userId: 'user-1', telemetry: baseTelemetry },
      `Bearer ${expiredToken}`
    );
    expect(res.statusCode).toBe(401);
    expect(res.error).toMatch(/expired/i);
  });

  it('blocks tenant substitution attacks where body tenantId differs from verified JWT claims', async () => {
    // Attacker has valid token for their own tenant
    const attackerToken = signJwtToken({ sub: 'user-attacker', tenantId: attackerTenant });

    // Attacker tries to consume victim tenant quota
    const res = await handleAiDecisionEndpoint(
      { tenantId: victimTenant, userId: 'user-attacker', telemetry: baseTelemetry },
      `Bearer ${attackerToken}`
    );
    expect(res.statusCode).toBe(403);
    expect(res.error).toMatch(/Security Boundary Violation/i);
  });

  it('VULNERABILITY: Hardcoded DEFAULT_JWT_SECRET allows forging arbitrary valid tokens when process.env.JWT_SECRET is unset', () => {
    // If process.env.JWT_SECRET is not explicitly provided, DEFAULT_JWT_SECRET is used
    expect(DEFAULT_JWT_SECRET).toBe('aether_secure_jwt_secret_cop31_residential_saas_2026');

    // Attacker crafts arbitrary token signed with the hardcoded secret
    const rogueToken = signJwtToken(
      { sub: 'rogue-actor', tenantId: victimTenant, role: 'OWNER' },
      'aether_secure_jwt_secret_cop31_residential_saas_2026'
    );

    const verifyResult = verifyJwtToken(rogueToken);
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.claims?.tenantId).toBe(victimTenant);
  });

  it('VULNERABILITY: Omission of optional tenantRepo completely bypasses server-side membership check', async () => {
    // Attacker signs token with valid secret for a victim tenant where they are NOT a member
    const rogueToken = signJwtToken({ sub: 'non-member-stranger', tenantId: victimTenant });

    // Call without passing tenantRepo (the default signature)
    const res = await handleAiDecisionEndpoint(
      { tenantId: victimTenant, userId: 'non-member-stranger', telemetry: baseTelemetry },
      `Bearer ${rogueToken}`
      // tenantRepo omitted!
    );

    // Membership was NOT checked, request proceeded into AI decision pipeline
    expect(res.statusCode).not.toBe(403);
  });
});
