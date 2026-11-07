import { describe, it, expect } from 'vitest';
import { EnergyDataNormalizer } from '../services/integration/EnergyDataNormalizer';

describe('AETHER EnergyDataNormalizer', () => {
  it('correctly converts kW to Watts and Wh to kWh', () => {
    const normalized = EnergyDataNormalizer.normalize({
      tenantId: 'tenant-test',
      homeId: 'home-test',
      deviceId: 'dev-01',
      source: 'LOCAL_GATEWAY',
      power: 4.5,
      powerUnit: 'kW',
      energy: 12500,
      energyUnit: 'Wh',
      voltage: 231.5,
      current: 19.4,
    });

    expect(normalized.activePowerW).toBe(4500);
    expect(normalized.cumulativeEnergyKwh).toBe(12.5);
    expect(normalized.voltageV).toBe(231.5);
    expect(normalized.currentA).toBe(19.4);
    expect(normalized.measurementQuality).toBe('PHYSICAL_METERED');
    expect(normalized.confidenceScore).toBe(0.97);
  });

  it('marks smart plug measurements strictly as SUB_METERED', () => {
    const plugNormalized = EnergyDataNormalizer.normalize({
      tenantId: 'tenant-test',
      homeId: 'home-test',
      deviceId: 'dev-plug-01',
      source: 'SMART_PLUG',
      power: 140,
      powerUnit: 'W',
      energy: 1.2,
      energyUnit: 'kWh',
      isSubMeteredOnly: true,
    });

    expect(plugNormalized.measurementQuality).toBe('SUB_METERED');
    expect(plugNormalized.isSubMeteredOnly).toBe(true);
    expect(plugNormalized.confidenceScore).toBe(0.98);
  });

  it('sanitizes and discards corrupt out-of-range electrical sensor voltages', () => {
    const corruptFrame = EnergyDataNormalizer.normalize({
      tenantId: 'tenant-test',
      homeId: 'home-test',
      deviceId: 'dev-err',
      source: 'LOCAL_GATEWAY',
      power: 500,
      voltage: 9999.0, // Corrupt ADC reading
      current: -50.0,  // Negative current reading
    });

    expect(corruptFrame.voltageV).toBeUndefined();
    expect(corruptFrame.currentA).toBeUndefined();
  });
});
