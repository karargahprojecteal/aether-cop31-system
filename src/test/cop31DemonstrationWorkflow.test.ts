import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService } from '../services/persistence/DatabaseService';
import { TenantRepository } from '../services/persistence/TenantRepository';
import { TenantManager } from '../services/saas/TenantManager';
import { AuditLogRepository } from '../services/persistence/AuditLogRepository';
import { AuditAnchorStore } from '../services/persistence/audit/AuditAnchorStore';
import { handleAiDecisionEndpoint, AiDecisionRequest } from '../services/ai/aiServerEndpoint';
import { signJwtToken, verifyJwtToken } from '../services/auth/jwtVerifier';
import { EnergyIntelligenceEngine } from '../services/intelligence/EnergyIntelligenceEngine';
import { SmartMeterAdapter } from '../services/adapters/SmartMeterAdapter';
import { LocalGatewayAdapter } from '../services/adapters/LocalGatewayAdapter';
import { HomeAssistantAdapter } from '../services/adapters/HomeAssistantAdapter';
import { SmartPlugAdapter } from '../services/adapters/SmartPlugAdapter';
import { ManualConsumptionAdapter } from '../services/adapters/ManualConsumptionAdapter';
import { seedDevelopmentTenantData } from '../services/saas/testing/seedData';
import { TelemetryPoint } from '../types/telemetry';

describe('COP31 Demonstration Readiness: End-to-End Workflow Verification', () => {
  let dbService: DatabaseService;
  let tenantRepo: TenantRepository;
  let tenantManager: TenantManager;
  let auditRepo: AuditLogRepository;
  let seedInfo: ReturnType<typeof seedDevelopmentTenantData>;

  // Deterministic COP31 Demonstration Telemetry Points
  const deterministicPuantTelemetry: TelemetryPoint = {
    id: 'tel-cop31-puant-01',
    timestamp: '2026-11-07T18:30:00Z', // 18:30 is in PUANT peak period (17:00 - 22:00)
    activePowerKw: 82.4, // Total active power in kW
    reactivePowerKvar: 12.2,
    voltage: 231.2,
    current: 126.4,
    frequency: 50.01,
    powerFactor: 0.96,
    nilm: {
      hvacKw: 38.0,
      lightingKw: 12.0,
      baseLoadKw: 8.0,
      phantomLoadKw: 18.0, // High phantom load triggering diagnosis
      industrialLoadKw: 6.4,
      solarGenerationKw: 0.0,
      batteryDischargeKw: 0.0,
      netGridImportKw: 82.4,
    },
    outdoorTempC: 14.5,
    outdoorHumidityPercent: 62,
    solarIrradianceWm2: 0,
    occupancyRatePercent: 85,
    gridCarbonIntensityGCo2PerKwh: 542, // TEİAŞ evening peaker factor
    gridElectricityPriceTryPerKwh: 6.85, // EPDK Puant rate (>= 4.5 TL/kWh)
  };

  beforeEach(() => {
    AuditAnchorStore.getInstance().clear();
    dbService = DatabaseService.createIsolatedInstance(':memory:');
    tenantRepo = new TenantRepository(dbService.getDb());
    tenantManager = new TenantManager(tenantRepo);
    auditRepo = new AuditLogRepository(dbService.getDb());

    // 1. Initial System Startup & Deterministic Seeding
    seedInfo = seedDevelopmentTenantData(tenantRepo);
  });

  it('Step 1 & 2: Startup, Authentication & Active Tenant Resolution', () => {
    expect(seedInfo.tenantId).toBe('tenant-karargah-etkim');
    expect(seedInfo.ownerUserId).toBe('user-pilot-owner');

    // Generate valid cryptographic session JWT
    const token = signJwtToken({
      sub: seedInfo.ownerUserId,
      tenantId: seedInfo.tenantId,
      role: 'OWNER',
      email: 'admin@aether-energy.io',
    });

    const verifyResult = verifyJwtToken(token);
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.claims?.tenantId).toBe(seedInfo.tenantId);
    expect(verifyResult.claims?.sub).toBe(seedInfo.ownerUserId);

    // Resolve trusted database context
    const context = tenantManager.resolveAuthenticatedContext(seedInfo.ownerUserId, seedInfo.tenantId);
    expect(context.tenantId).toBe(seedInfo.tenantId);
    expect(context.role).toBe('OWNER');

    // List homes under active tenant
    const homes = tenantManager.listHomes(context);
    expect(homes.length).toBe(2);
    expect(homes[0].name).toContain('İnovasyon');
  });

  it('Step 3: AI Decision Workflow & Graceful Deterministic Fallback', async () => {
    const token = signJwtToken({
      sub: seedInfo.ownerUserId,
      tenantId: seedInfo.tenantId,
      role: 'OWNER',
    });

    const request: AiDecisionRequest = {
      tenantId: seedInfo.tenantId,
      userId: seedInfo.ownerUserId,
      telemetry: deterministicPuantTelemetry,
    };

    // Execute decision pipeline via server endpoint (offline deterministic physics engine)
    const response = await handleAiDecisionEndpoint(request, `Bearer ${token}`, tenantRepo);

    expect(response.success).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.decisions.length).toBeGreaterThan(0);

    // Verified deterministic fallback produces valid energy optimizations
    const peakDecision = response.decisions.find(d => d.anomalyType === 'PEAK_SURGE');
    expect(peakDecision).toBeDefined();
    expect(peakDecision?.commandPayload.estimatedKwReduction).toBeGreaterThan(0);

    const phantomDecision = response.decisions.find(d => d.anomalyType === 'PHANTOM_LOAD');
    expect(phantomDecision).toBeDefined();
    expect(phantomDecision?.projectedCo2ReductionKg).toBeGreaterThan(0);
  });

  it('Step 4: Energy Intelligence — EPDK Tariffs & TEİAŞ Carbon Verification', () => {
    // 1. Verify EPDK 3-Time Tariff Calculations
    const puantOpportunity = EnergyIntelligenceEngine.evaluatePeakShaving(
      deterministicPuantTelemetry.activePowerKw * 1000,
      deterministicPuantTelemetry.nilm.hvacKw * 1000,
      'TURKISH_EPDK_3_TIME',
      deterministicPuantTelemetry.timestamp,
      0
    );

    expect(puantOpportunity).not.toBeNull();
    expect(puantOpportunity.activeTariffPeriod).toBe('PUANT');
    expect(puantOpportunity.tariffMetadata.authority).toBe('EPDK');
    expect(puantOpportunity.tariffMetadata.officialGazetteNo).toBe('32590');
    expect(puantOpportunity.tariffMetadata.officialGazetteDate).toBe('2024-07-01');

    // Regulatory Honesty: Projected savings must NOT claim verified utility measurement
    expect(puantOpportunity.isVerifiedMeasuredSavings).toBe(false);

    // 2. Verify TEİAŞ / TEDAŞ Carbon Calculations
    const carbonMetadata = EnergyIntelligenceEngine.OFFICIAL_CARBON_FACTORS_2024;
    expect(carbonMetadata.authority).toBe('TEİAŞ & TEDAŞ');
    expect(carbonMetadata.generationEmissionFactor).toBe(0.462);
    expect(carbonMetadata.consumptionPointEmissionFactor).toBe(0.498);

    // 3. Phantom Load Analysis
    const phantomAnalysis = EnergyIntelligenceEngine.analyzePhantomLoad(
      deterministicPuantTelemetry.activePowerKw * 1000,
      deterministicPuantTelemetry.nilm.phantomLoadKw * 1000,
      250,
      deterministicPuantTelemetry.occupancyRatePercent
    );

    expect(phantomAnalysis.detectedPhantomKw).toBe(18.0);
    expect(phantomAnalysis.estimatedMonthlyWastedCostTry).toBeGreaterThan(0);
    expect(phantomAnalysis.estimatedMonthlyWastedCo2Kg).toBeGreaterThan(0);
  });

  it('Step 5: Physical Hardware Honesty — Zero False Positive Connection Guarantees', async () => {
    // 1. Smart Meter Adapter with no physical optical probe hardware
    const smartMeter = new SmartMeterAdapter();
    expect(smartMeter.capability.lifecycleStage).toBe('STAGE_1_PARSER_IMPLEMENTED');
    expect(smartMeter.capability.supportsBiDirectionalControl).toBe(false);

    // Connecting without physical hardware MUST report PARSER_ONLY_NO_HARDWARE, never connected: true
    const connectResult = await smartMeter.connect();
    expect(connectResult.success).toBe(false);
    expect(connectResult.state).toBe('PARSER_ONLY_NO_HARDWARE');
    expect(connectResult.message).toMatch(/Physical optical probe is not attached/i);
    expect(smartMeter.getHealth().connectionState).toBe('PARSER_ONLY_NO_HARDWARE');

    // 2. Local Gateway Adapter (Distribution Board CT Clamps)
    const localGw = new LocalGatewayAdapter();
    expect(localGw.capability.lifecycleStage).toBe('STAGE_2_PROTOCOL_IMPLEMENTED');
    expect(localGw.capability.requiresCertifiedElectrician).toBe(true); // Turkish Electrical Code
    expect(localGw.capability.supportsBiDirectionalControl).toBe(false); // Passive read-only

    // 3. Home Assistant Adapter
    const haAdapter = new HomeAssistantAdapter();
    expect(haAdapter.capability.lifecycleStage).toBe('STAGE_2_PROTOCOL_IMPLEMENTED');

    // 4. Smart Plug Adapter
    const plugAdapter = new SmartPlugAdapter();
    expect(plugAdapter.capability.lifecycleStage).toBe('STAGE_2_PROTOCOL_IMPLEMENTED');

    // 5. Manual Consumption Adapter
    const manualAdapter = new ManualConsumptionAdapter();
    expect(manualAdapter.capability.lifecycleStage).toBe('STAGE_4_PRODUCTION_ACCEPTED');
  });

  it('Step 6: Immutable Audit Trail & Process Tamper Detection', () => {
    // Record demonstration action
    const entry1 = auditRepo.record({
      tenantId: seedInfo.tenantId,
      userId: seedInfo.ownerUserId,
      action: 'COP31_DEMO_SCENARIO_LOADED',
      category: 'DEVICE_COMMAND',
      details: { scenario: 'ANTALYA_PEAK_SHAVING', targetHome: seedInfo.primaryHomeId },
      severity: 'INFO',
    });

    const entry2 = auditRepo.record({
      tenantId: seedInfo.tenantId,
      userId: seedInfo.ownerUserId,
      action: 'COP31_PEAK_SHAVING_EXECUTED',
      category: 'AI_DECISION',
      details: { shiftedKw: 3.2, period: 'PUANT' },
      severity: 'INFO',
    });

    expect(entry1.seq).toBe(1);
    expect(entry2.seq).toBe(2);
    expect(entry2.prevRecordHash).toBe(entry1.recordHash);

    // Verify intact chain
    const verifyBefore = auditRepo.verifyIntegrity(seedInfo.tenantId);
    expect(verifyBefore.valid).toBe(true);
    expect(verifyBefore.totalChecked).toBe(2);

    // Simulate tampering: drop trigger and delete entry2
    const db = dbService.getDb();
    db.exec('DROP TRIGGER audit_logs_no_delete;');
    db.prepare('DELETE FROM audit_logs WHERE id = ?').run(entry2.id);

    // Verification detects the tamper via external signed anchor
    const verifyAfter = auditRepo.verifyIntegrity(seedInfo.tenantId);
    expect(verifyAfter.valid).toBe(false);
    expect(verifyAfter.error).toMatch(/CRITICAL AUDIT TAMPER/i);
  });

  it('Step 7: Circuit Breaker & Graceful Quota Recovery', async () => {
    const token = signJwtToken({
      sub: seedInfo.ownerUserId,
      tenantId: seedInfo.tenantId,
      role: 'OWNER',
    });

    // Artificially deplete daily AI quota
    dbService.getDb().prepare(`
      UPDATE subscriptions SET used_gemini_calls_today = gemini_calls_per_day WHERE tenant_id = ?
    `).run(seedInfo.tenantId);

    const request: AiDecisionRequest = {
      tenantId: seedInfo.tenantId,
      userId: seedInfo.ownerUserId,
      telemetry: deterministicPuantTelemetry,
    };

    // System must not crash or leak keys; must gracefully execute rule engine
    const response = await handleAiDecisionEndpoint(request, `Bearer ${token}`, tenantRepo);
    expect(response.success).toBe(true);
    expect(response.source).toBe('DETERMINISTIC_FALLBACK');
    expect(response.quotaRemaining).toBe(false);
    expect(response.error).toMatch(/quota exceeded/i);
    expect(response.decisions.length).toBeGreaterThan(0);
  });
});
