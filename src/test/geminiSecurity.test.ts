import { describe, it, expect, beforeAll } from 'vitest';
import { handleAiDecisionEndpoint } from '../services/ai/aiServerEndpoint';
import { TelemetryPoint } from '../types/telemetry';
import { tenantManagerInstance } from '../services/saas/TenantManager';
import { subscriptionServiceInstance } from '../services/saas/SubscriptionService';
import { signJwtToken } from '../services/auth/jwtVerifier';

describe('AETHER Gemini AI Boundary & Zero Client Leak Security', () => {
  const tenantId = 'tenant-ai-boundary-test';
  const victimTenantId = 'tenant-victim-org';
  const userId = 'user-ai-analyst';

  let validAuthHeader: string;

  const sampleTelemetry: TelemetryPoint = {
    id: 'tel-test-01',
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

  beforeAll(() => {
    // Setup test organization
    tenantManagerInstance.createOrganization('AI Boundary Org', 'ai@test.io', 'ai-boundary-org', tenantId);
    tenantManagerInstance.createOrganization('Victim Org', 'victim@test.io', 'victim-org', victimTenantId);

    validAuthHeader = `Bearer ${signJwtToken({ sub: userId, tenantId })}`;
  });

  it('verifies zero client-side credential storage in browser environments', () => {
    if (typeof window !== 'undefined') {
      expect(window.localStorage.getItem('AETHER_GEMINI_API_KEY')).toBeNull();
    }
  });

  it('rejects unauthenticated requests lacking Bearer token with 401', async () => {
    const res = await handleAiDecisionEndpoint({
      tenantId,
      userId,
      telemetry: sampleTelemetry,
    });
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.error).toMatch(/Authorization Bearer token is required/i);
  });

  it('rejects expired or forged JWT tokens with 401', async () => {
    // Expired token
    const expiredToken = signJwtToken({ sub: userId, tenantId, expiresInSeconds: -10 });
    const resExpired = await handleAiDecisionEndpoint(
      { tenantId, userId, telemetry: sampleTelemetry },
      `Bearer ${expiredToken}`
    );
    expect(resExpired.success).toBe(false);
    expect(resExpired.statusCode).toBe(401);
    expect(resExpired.error).toMatch(/Token has expired/i);

    // Forged signature token
    const forgedToken = signJwtToken({ sub: userId, tenantId }, 'wrong_secret_signature');
    const resForged = await handleAiDecisionEndpoint(
      { tenantId, userId, telemetry: sampleTelemetry },
      `Bearer ${forgedToken}`
    );
    expect(resForged.success).toBe(false);
    expect(resForged.statusCode).toBe(401);
    expect(resForged.error).toMatch(/signature verification failed|tampered/i);
  });

  it('blocks cross-tenant identity spoofing and quota exhaustion attacks with 403', async () => {
    // Attacker token is for tenantId, but body targets victimTenantId to exhaust their quota
    const resCrossTenant = await handleAiDecisionEndpoint(
      {
        tenantId: victimTenantId,
        userId,
        telemetry: sampleTelemetry,
      },
      validAuthHeader // Token belongs to tenantId
    );

    expect(resCrossTenant.success).toBe(false);
    expect(resCrossTenant.statusCode).toBe(403);
    expect(resCrossTenant.error).toMatch(/Security Boundary Violation/i);
  });

  it('rejects malformed telemetry payloads with schema violation errors', async () => {
    const invalidReq: any = {
      tenantId,
      userId,
      telemetry: {
        activePowerKw: 'NOT_A_NUMBER', // Type violation
        voltage: -50,
      },
    };

    const response = await handleAiDecisionEndpoint(invalidReq, validAuthHeader);
    expect(response.success).toBe(false);
    expect(response.statusCode).toBe(400);
    expect(response.error).toMatch(/Schema violation/i);
  });

  it('enforces server-side tenant daily quota and falls back gracefully when quota is exhausted', async () => {
    // Consume quota until depleted
    let quotaAvailable = true;
    while (quotaAvailable) {
      quotaAvailable = subscriptionServiceInstance.consumeGeminiQuota(tenantId);
    }

    // Now call AI endpoint with exhausted quota
    const response = await handleAiDecisionEndpoint(
      {
        tenantId,
        userId,
        telemetry: sampleTelemetry,
      },
      validAuthHeader
    );

    expect(response.success).toBe(true);
    expect(response.source).toBe('DETERMINISTIC_FALLBACK');
    expect(response.quotaRemaining).toBe(false);
    expect(response.decisions.length).toBeGreaterThan(0);
    expect(response.error).toMatch(/quota exceeded/i);
  });
});
