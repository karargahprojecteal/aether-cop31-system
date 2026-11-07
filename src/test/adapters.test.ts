import { describe, it, expect, beforeEach } from 'vitest';
import { SmartMeterAdapter } from '../services/adapters/SmartMeterAdapter';
import { HomeAssistantAdapter } from '../services/adapters/HomeAssistantAdapter';
import { LocalGatewayAdapter } from '../services/adapters/LocalGatewayAdapter';
import { ManualConsumptionAdapter } from '../services/adapters/ManualConsumptionAdapter';

describe('AETHER Hardware Adapters Suite', () => {
  const testConfig = {
    tenantId: 'tenant-adapter-test',
    homeId: 'home-adapter-test',
    deviceId: 'dev-adapter-test',
  };

  it('SmartMeterAdapter parses standard OBIS codes from IEC 62056-21 telegram', async () => {
    const adapter = new SmartMeterAdapter();
    await adapter.initialize(testConfig);
    await adapter.connect();

    const sampleTelegram = `
/KHL5\\2 BEM240.TF

0-0:96.1.1(TR-ANT-2026-0042)
1-0:1.8.0(001452.850*kWh)
1-0:1.7.0(0004.250*kW)
1-0:32.7.0(230.6*V)
1-0:31.7.0(018.4*A)
!4A1F
    `;

    const normalized = adapter.ingestRawTelegram(sampleTelegram);

    expect(normalized.cumulativeEnergyKwh).toBe(1452.85);
    expect(normalized.activePowerW).toBe(4250);
    expect(normalized.voltageV).toBe(230.6);
    expect(normalized.currentA).toBe(18.4);
    expect(normalized.source).toBe('SMART_METER');
  });

  it('HomeAssistantAdapter translates entity states and units correctly', async () => {
    const haAdapter = new HomeAssistantAdapter();
    await haAdapter.initialize(testConfig);
    await haAdapter.connect();

    const haPayload = {
      entity_id: 'sensor.shelly_pro_3em_grid_power',
      state: '3200.5',
      attributes: {
        unit_of_measurement: 'W',
        device_class: 'power',
        friendly_name: 'Main Feeder Power',
      },
      last_updated: '2026-11-07T08:00:00Z',
    };

    const measurement = haAdapter.ingestEntityState(haPayload);
    expect(measurement.activePowerW).toBe(3200.5);
    expect(measurement.isSubMeteredOnly).toBe(false);
  });

  it('LocalGatewayAdapter enforces idempotent packet deduplication', async () => {
    const gwAdapter = new LocalGatewayAdapter();
    await gwAdapter.initialize(testConfig);
    await gwAdapter.connect();

    const mqttPacket = {
      seq: 1042,
      ts: '2026-11-07T08:30:00Z',
      p_w: 1850,
      e_kwh: 420.5,
      v: 231.0,
      i: 8.0,
    };

    // First transmission
    const firstResult = gwAdapter.ingestMqttPacket(mqttPacket);
    expect(firstResult.ingested).toBe(true);
    expect(firstResult.duplicate).toBe(false);

    // Duplicate retransmission of same sequence ID (network retry)
    const secondResult = gwAdapter.ingestMqttPacket(mqttPacket);
    expect(secondResult.ingested).toBe(false);
    expect(secondResult.duplicate).toBe(true);
  });

  it('ManualConsumptionAdapter records utility bill and calculates daily averages', async () => {
    const manualAdapter = new ManualConsumptionAdapter();
    await manualAdapter.initialize(testConfig);

    const { record, normalized } = manualAdapter.addManualBill({
      tenantId: 'tenant-adapter-test',
      homeId: 'home-adapter-test',
      invoiceNumber: 'FAT-2026-11-001',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      totalKwh: 310,
      totalCostTry: 1302.0,
      tariffType: 'SINGLE_TARIFF_FLAT',
    });

    expect(record.id).toBeDefined();
    expect(record.totalKwh).toBe(310);
    expect(normalized.measurementQuality).toBe('MANUAL_BILL');
    // 310 kWh over 30 days = ~10.33 kWh/day -> ~430W continuous equivalent
    expect(normalized.activePowerW).toBeGreaterThan(400);
    expect(normalized.activePowerW).toBeLessThan(450);
  });
});
