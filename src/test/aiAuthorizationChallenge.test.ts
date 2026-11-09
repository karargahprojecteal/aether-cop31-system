import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleAiDecisionEndpoint } from '../services/ai/aiServerEndpoint';
import { signJwtToken, verifyJwtToken, getJwtSecret } from '../services/auth/jwtVerifier';
import { TelemetryPoint } from '../types/telemetry';

describe('AI Authorization & JWT Remediation Challenge', () => {
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

  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

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

  it('REMEDIATED: Production environment strictly fails closed when JWT_SECRET is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    expect(() => getJwtSecret()).toThrow(/FATAL SECURITY MISCONFIGURATION: process.env.JWT_SECRET is strictly required/i);
  });

  it('REMEDIATED: Algorithm pinning rejects tokens with alg !== HS256 (e.g. alg: none attack)', () => {
    // Craft alg: none token
    const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', tenantId: victimTenant, exp: 9999999999, iat: 1000 })).toString('base64url');
    const tokenNone = `${headerNone}.${payload}.`;

    const res = verifyJwtToken(tokenNone);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Insecure or unsupported JWT algorithm/i);
  });

  it('REMEDIATED: Mandatory tenantRepo ensures non-member requests are rejected with 403 even when token is signed', async () => {
    // Attacker signs token with valid secret for a victim tenant where they are NOT a member
    const rogueToken = signJwtToken({ sub: 'non-member-stranger', tenantId: victimTenant });

    // Call without passing tenantRepo (the default signature)
    const res = await handleAiDecisionEndpoint(
      { tenantId: victimTenant, userId: 'non-member-stranger', telemetry: baseTelemetry },
      `Bearer ${rogueToken}`
      // tenantRepo defaulted to new TenantRepository()
    );

    // Membership WAS strictly checked and rejected with 403 Forbidden!
    expect(res.statusCode).toBe(403);
    expect(res.error).toMatch(/403 Forbidden: User 'non-member-stranger' is not an active member/i);
  });
});
