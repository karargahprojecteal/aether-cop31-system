import { describe, it, expect } from 'vitest';
import { EnergyIntelligenceEngine } from '../services/intelligence/EnergyIntelligenceEngine';

describe('AETHER Energy Intelligence & Disaggregation Analysis', () => {
  it('correctly maps EPDK tariff periods by time of day', () => {
    // 19:30 is Puant (17:00 - 22:00)
    const puantDate = new Date('2026-11-07T19:30:00Z').toISOString();
    // 03:00 is Gece (22:00 - 06:00)
    const geceDate = new Date('2026-11-07T03:00:00Z').toISOString();
    // 12:00 is Gündüz (06:00 - 17:00)
    const gunduzDate = new Date('2026-11-07T12:00:00Z').toISOString();

    const puantTariff = EnergyIntelligenceEngine.getTariffPeriod(puantDate);
    const geceTariff = EnergyIntelligenceEngine.getTariffPeriod(geceDate);
    const gunduzTariff = EnergyIntelligenceEngine.getTariffPeriod(gunduzDate);

    expect(puantTariff.rateTryPerKwh).toBeGreaterThan(gunduzTariff.rateTryPerKwh);
    expect(geceTariff.rateTryPerKwh).toBeLessThan(gunduzTariff.rateTryPerKwh);
  });

  it('accurately identifies abnormal phantom load vs acceptable idle base', () => {
    // Scenario A: Acceptable base load (200W base, 150W idle)
    const normalAnalysis = EnergyIntelligenceEngine.analyzePhantomLoad(1200, 150, 200, 80);
    expect(normalAnalysis.isAnomaly).toBe(false);
    expect(normalAnalysis.severity).toBe('LOW');

    // Scenario B: Excessive phantom load (2.4 kW running during empty night hours)
    const leakAnalysis = EnergyIntelligenceEngine.analyzePhantomLoad(3500, 2400, 250, 0);
    expect(leakAnalysis.isAnomaly).toBe(true);
    expect(leakAnalysis.severity).toBe('HIGH');
    expect(leakAnalysis.estimatedMonthlyWastedCostTry).toBeGreaterThan(1500);
  });

  it('evaluates peak shaving savings when shifting flexible loads', () => {
    // 2500W load during Puant (19:00)
    const puantTime = new Date('2026-11-07T19:00:00Z').toISOString();
    const peakOpportunity = EnergyIntelligenceEngine.evaluatePeakShaving(4000, 2500, 'TURKISH_EPDK_3_TIME', puantTime);
    expect(peakOpportunity.shiftableKw).toBeLessThanOrEqual(2.5);
    expect(peakOpportunity.projectedMonthlySavingsTry).toBeGreaterThan(0);
  });

  it('calculates carbon emissions using Turkish TEİAŞ national baseline', () => {
    const { co2Kg, emissionFactorUsed } = EnergyIntelligenceEngine.calculateCo2e(100);
    expect(co2Kg).toBeGreaterThan(35);
    expect(co2Kg).toBeLessThan(60);
    expect(emissionFactorUsed).toBeGreaterThan(0.35);
  });

  it('differentiates NILM confidence between physical sub-meter vs derived wavelet', () => {
    const submetered = EnergyIntelligenceEngine.evaluateNILMConfidence(true);
    const derived = EnergyIntelligenceEngine.evaluateNILMConfidence(false, 'PHYSICAL_METERED');

    expect(submetered.overallDisaggregationConfidence).toBeGreaterThan(derived.overallDisaggregationConfidence);
    expect(submetered.methodology).toBe('SUB_METER_GROUND_TRUTH');
    expect(derived.methodology).toBe('HARMONIC_WAVELET_DECOMPOSITION');
  });
});
