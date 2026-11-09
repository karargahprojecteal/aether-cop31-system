import { describe, it, expect } from 'vitest';
import { SmartMeterAdapter } from '../services/adapters/SmartMeterAdapter';
import { LocalGatewayAdapter } from '../services/adapters/LocalGatewayAdapter';
import { SmartPlugAdapter } from '../services/adapters/SmartPlugAdapter';
import { ManualConsumptionAdapter } from '../services/adapters/ManualConsumptionAdapter';

describe('AETHER Physical Adapter Honesty & Safety Verification', () => {
  it('does NOT report physical connection on SmartMeterAdapter without attached optical hardware', async () => {
    const adapter = new SmartMeterAdapter();
    expect(adapter.capability.lifecycleStage).toBe('STAGE_1_PARSER_IMPLEMENTED');
    expect(adapter.capability.physicalHardwareAttached).toBe(false);

    // Call connect() in environment without physical serial optical probe
    const connectionResult = await adapter.connect();

    // Must NOT claim connected: true
    expect(connectionResult.success).toBe(false);
    expect(connectionResult.state).toBe('PARSER_ONLY_NO_HARDWARE');

    const health = adapter.getHealth();
    expect(health.connected).toBe(false);
    expect(health.status).toBe('PARSER_ONLY');
    expect(health.diagnosticMessage).toMatch(/hardware not attached/i);
  });

  it('mandates certified electrician qualification for LocalGatewayAdapter panel installation', () => {
    const gateway = new LocalGatewayAdapter();
    expect(gateway.capability.requiresCertifiedElectrician).toBe(true);
    expect(gateway.capability.supportsBiDirectionalControl).toBe(false); // Passive read-only
    expect(gateway.capability.isPassiveReadOnly).toBe(true);
  });

  it('strictly flags SmartPlugAdapter as sub-metered only, preventing mixture with whole-home mains', async () => {
    const plug = new SmartPlugAdapter();
    await plug.initialize({ tenantId: 'tenant-test', homeId: 'home-test', deviceId: 'dev-plug-01' });
    expect(plug.capability.requiresCertifiedElectrician).toBe(false);
    expect(plug.capability.isPassiveReadOnly).toBe(true);

    const reading = plug.ingestPlugReading({
      powerWatts: 1800,
      totalKwh: 45.2,
      applianceType: 'WASHING_MACHINE',
    });

    expect(reading.isSubMeteredOnly).toBe(true);
    expect(reading.measurementQuality).toBe('SUB_METERED');
  });

  it('distinguishes manual bill data with STAGE_4 acceptance and MANUAL_BILL quality tag', async () => {
    const manualAdapter = new ManualConsumptionAdapter();
    await manualAdapter.initialize({ tenantId: 'tenant-test', homeId: 'home-test', deviceId: 'dev-manual-01' });
    expect(manualAdapter.capability.lifecycleStage).toBe('STAGE_4_PRODUCTION_ACCEPTED');
    expect(manualAdapter.capability.requiresCertifiedElectrician).toBe(false);

    const { normalized } = manualAdapter.addManualBill({
      tenantId: 'tenant-test',
      homeId: 'home-test',
      tariffType: 'TURKISH_EPDK_3_TIME',
      periodStart: '2024-06-01',
      periodEnd: '2024-06-30',
      totalKwh: 240,
      totalCostTry: 1008,
      invoiceNumber: 'INV-2024-001',
    });

    expect(normalized.measurementQuality).toBe('MANUAL_BILL');
    expect(normalized.confidenceScore).toBe(1.0);
  });
});
