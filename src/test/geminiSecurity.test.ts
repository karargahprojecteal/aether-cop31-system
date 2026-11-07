import { describe, it, expect, beforeAll } from 'vitest';
import { handleAiDecisionEndpoint } from '../services/ai/aiServerEndpoint';
import { TelemetryPoint } from '../types/telemetry';
import { tenantManagerInstance } from '../services/saas/TenantManager';
import { subscriptionServiceInstance } from '../services/saas/SubscriptionService';

describe('AETHER Gemini AI Boundary & Zero Client Leak Security', () => {
  const tenantId = 'tenant-ai-boundary-test';
  const userId = 'user-ai-analyst';

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
  });

  it('verifies zero client-side credential storage in browser environments', () => {
    // Ensure no client-side localStorage fallback is present or populated
    if (typeof window !== 'undefined') {
      expect(window.localStorage.getItem('AETHER_GEMINI_API_KEY')).toBeNull();
    }
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

    const response = await handleAiDecisionEndpoint(invalidReq);
    expect(response.success).toBe(false);
    expect(response.error).toMatch(/Schema violation|Invalid request/i);
  });

  it('enforces server-side tenant daily quota and falls back gracefully when quota is exhausted', async () => {
    // Consume quota until depleted
    let quotaAvailable = true;
    while (quotaAvailable) {
      quotaAvailable = subscriptionServiceInstance.consumeGeminiQuota(tenantId);
    }

    // Now call AI endpoint with exhausted quota
    const response = await handleAiDecisionEndpoint({
      tenantId,
      userId,
      telemetry: sampleTelemetry,
    });

    expect(response.success).toBe(true);
    expect(response.source).toBe('DETERMINISTIC_FALLBACK');
    expect(response.quotaRemaining).toBe(false);
    expect(response.decisions.length).toBeGreaterThan(0);
    expect(response.error).toMatch(/quota exceeded/i);
  });
});
