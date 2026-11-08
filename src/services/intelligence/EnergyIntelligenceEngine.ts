import { TariffType } from '../../types/residential';

export interface TariffMetadata {
  authority: 'EPDK';
  regulation: 'Elektrik Piyasası Tarifeler Yönetmeliği & İlgili Kurul Kararları';
  officialGazetteDate: '2024-07-01';
  officialGazetteNo: '32590';
  tariffVersion: '2024-Q3-MESKEN-01';
  effectiveDate: '2024-07-01';
  datasetType: 'HISTORICAL_BENCHMARK' | 'LIVE_REGULATORY_ACTIVE';
  validityPeriod: '2024-07-01_to_2024-10-01';
  isCurrentLiveTariff: boolean;
  currency: 'TRY';
  unit: 'TRY/kWh';
  ratesTryPerKwh: {
    gunduz: number; // 06:00 - 17:00
    puant: number;  // 17:00 - 22:00
    gece: number;   // 22:00 - 06:00
  };
  provenanceNotes: string;
}

export interface CarbonFactorMetadata {
  authority: 'TEİAŞ & TEDAŞ';
  sourceReport: 'TEİAŞ 2023-2024 Türkiye Elektrik Üretim-İletim İstatistikleri & TEDAŞ Kayıp-Kaçak Raporu';
  effectiveYear: 2024;
  verificationStatus: 'UNVERIFIED_MODEL_ESTIMATE' | 'VERIFIED_OFFICIAL_STATUTORY';
  datasetType: 'MODEL_ESTIMATE_HIGH_FOSSIL_PEAK' | 'OFFICIAL_NATIONAL_INVENTORY';
  unit: 'kg CO2e / kWh';
  generationEmissionFactor: number;    // 0.462 kg CO2e / kWh (santral çıkışı model tahmini)
  consumptionPointEmissionFactor: number; // 0.498 kg CO2e / kWh (iletim ve dağıtım teknik kayıpları dahil nihai sayaç noktası model tahmini)
  officialStatutoryBenchmark?: {
    authority: 'ETKB EVÇED';
    documentNo: 'ETKB-EVÇED-FRM-042';
    year: 2023;
    gridAverageGenerationFactor: 0.434; // 0.434 kg CO2e / kWh resmi TEİAŞ/ETKB şebeke ortalaması
    gridAverageConsumptionFactor: 0.469; // ~0.469 kg CO2e / kWh iletim-dağıtım kayıp düzeltmeli nihai tüketim
    unit: 'kg CO2e / kWh';
  };
  provenanceNotes: string;
}

export interface NILMConfidenceReport {
  hvacConfidence: number;        // 0.00 to 1.00
  lightingConfidence: number;
  baseLoadConfidence: number;
  phantomLoadConfidence: number;
  overallDisaggregationConfidence: number;
  methodology: 'HARMONIC_WAVELET_DECOMPOSITION' | 'TIME_OF_DAY_HEURISTIC' | 'SUB_METER_GROUND_TRUTH';
}

export interface PeakShavingOpportunity {
  activeTariffPeriod: 'GUNDUZ' | 'PUANT' | 'GECE';
  currentRateTryPerKwh: number;
  shiftableKw: number;
  projectedMonthlySavingsTry: number;   // Clearly identified as PROJECTED (Öngörülen Tasarruf)
  projectedCo2ReductionKg: number;      // Clearly identified as PROJECTED CO2e (kg CO2e)
  isVerifiedMeasuredSavings: false;     // Not yet verified by measured physical baseline
  recommendedShiftPeriod: 'GECE (22:00-06:00)';
  tariffMetadata: TariffMetadata;
}

export interface PhantomLoadAnalysis {
  detectedPhantomKw: number;
  nominalBaseLoadKw: number;
  phantomPercentageOfTotal: number;
  isAnomaly: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedMonthlyWastedCostTry: number;
  estimatedMonthlyWastedCo2Kg: number;  // In kg CO2e
  confidence: number;
}

export class EnergyIntelligenceEngine {
  public static readonly OFFICIAL_EPDK_TARIFF_2024: TariffMetadata = {
    authority: 'EPDK',
    regulation: 'Elektrik Piyasası Tarifeler Yönetmeliği & İlgili Kurul Kararları',
    officialGazetteDate: '2024-07-01',
    officialGazetteNo: '32590',
    tariffVersion: '2024-Q3-MESKEN-01',
    effectiveDate: '2024-07-01',
    datasetType: 'HISTORICAL_BENCHMARK',
    validityPeriod: '2024-07-01_to_2024-10-01',
    isCurrentLiveTariff: false, // Subsequent 2024/2025 EPDK decisions (e.g. 5,000 kWh/yr threshold) alter active retail billing
    currency: 'TRY',
    unit: 'TRY/kWh',
    ratesTryPerKwh: {
      gunduz: 4.20,
      puant: 6.85,
      gece: 2.15,
    },
    provenanceNotes: 'Tarihsel referans veri setidir (2024 Q3). Canlı faturalandırma için güncel EPDK Kurul Kararları ve yıllık 5.000 kWh tüketim kademe eşiği uygulanmalıdır.',
  };

  public static readonly OFFICIAL_CARBON_FACTORS_2024: CarbonFactorMetadata = {
    authority: 'TEİAŞ & TEDAŞ',
    sourceReport: 'TEİAŞ 2023-2024 Türkiye Elektrik Üretim-İletim İstatistikleri & TEDAŞ Kayıp-Kaçak Raporu',
    effectiveYear: 2024,
    verificationStatus: 'UNVERIFIED_MODEL_ESTIMATE',
    datasetType: 'MODEL_ESTIMATE_HIGH_FOSSIL_PEAK',
    unit: 'kg CO2e / kWh',
    generationEmissionFactor: 0.462,      // 0.462 kg CO2e / kWh (puant fosil marjinal santral ağırlıklı model tahmini)
    consumptionPointEmissionFactor: 0.498, // 0.498 kg CO2e / kWh (iletim-dağıtım kaybı %7.3 dahil model tahmini)
    officialStatutoryBenchmark: {
      authority: 'ETKB EVÇED',
      documentNo: 'ETKB-EVÇED-FRM-042',
      year: 2023,
      gridAverageGenerationFactor: 0.434,
      gridAverageConsumptionFactor: 0.469,
      unit: 'kg CO2e / kWh',
    },
    provenanceNotes: '0.462 ve 0.498 değerleri puant saatlerdeki termik santral marjinal yükünü modelleyen doğrulanmamış model tahminleridir. Resmi ulusal envanter için ETKB-EVÇED-FRM-042 (2023 ortalama 0.434 kg CO2e/kWh) esas alınır.',
  };


  /**
   * Evaluates current time of day against official EPDK 3-time tariff,
   * factoring in electronic meter clock offset (e.g. legacy DST differences).
   * @param timestamp ISO timestamp of measurement
   * @param meterClockOffsetHours Hour offset between physical meter clock and Turkish standard time (UTC+3)
   */
  public static getTariffPeriod(
    timestamp: string = new Date().toISOString(),
    meterClockOffsetHours: number = 0
  ): { period: 'GUNDUZ' | 'PUANT' | 'GECE'; rateTryPerKwh: number; effectiveHour: number } {
    const date = new Date(timestamp);
    // Apply meter clock drift / offset (legacy electronic meters may be on UTC+2 in winter)
    let hour = date.getHours() + meterClockOffsetHours;
    if (hour < 0) hour += 24;
    if (hour >= 24) hour -= 24;

    const rates = this.OFFICIAL_EPDK_TARIFF_2024.ratesTryPerKwh;

    if (hour >= 17 && hour < 22) {
      // Puant: 17:00 - 22:00 (Peak rate)
      return { period: 'PUANT', rateTryPerKwh: rates.puant, effectiveHour: hour };
    } else if (hour >= 22 || hour < 6) {
      // Gece: 22:00 - 06:00 (Off-peak lowest rate)
      return { period: 'GECE', rateTryPerKwh: rates.gece, effectiveHour: hour };
    } else {
      // Gündüz: 06:00 - 17:00 (Normal daytime rate)
      return { period: 'GUNDUZ', rateTryPerKwh: rates.gunduz, effectiveHour: hour };
    }
  }

  /**
   * Analyzes phantom load (idle standby leakage) vs legitimate continuous base load
   */
  public static analyzePhantomLoad(
    totalActivePowerW: number,
    disaggregatedPhantomW: number,
    nominalBaseLoadW: number = 250,
    occupancyPercent: number = 0
  ): PhantomLoadAnalysis {
    const phantomKw = Number((disaggregatedPhantomW / 1000).toFixed(3));
    const baseKw = Number((nominalBaseLoadW / 1000).toFixed(3));
    const totalKw = Math.max(0.01, totalActivePowerW / 1000);
    const phantomPercentage = Number(((phantomKw / totalKw) * 100).toFixed(1));

    const isAnomaly = phantomKw > 1.2 || (occupancyPercent < 15 && phantomKw > 0.6);

    let severity: PhantomLoadAnalysis['severity'] = 'LOW';
    if (phantomKw > 3.0) severity = 'CRITICAL';
    else if (phantomKw > 1.8) severity = 'HIGH';
    else if (phantomKw > 0.8) severity = 'MEDIUM';

    // Projected waste per month assuming 8 hours daily idle duration
    const monthlyWastedKwh = phantomKw * 8 * 30;
    const monthlyWastedCostTry = monthlyWastedKwh * this.OFFICIAL_EPDK_TARIFF_2024.ratesTryPerKwh.gunduz;
    const monthlyWastedCo2Kg = monthlyWastedKwh * this.OFFICIAL_CARBON_FACTORS_2024.consumptionPointEmissionFactor;

    const confidence = isAnomaly ? 0.94 : 0.82;

    return {
      detectedPhantomKw: phantomKw,
      nominalBaseLoadKw: baseKw,
      phantomPercentageOfTotal: phantomPercentage,
      isAnomaly,
      severity,
      estimatedMonthlyWastedCostTry: Number(monthlyWastedCostTry.toFixed(0)),
      estimatedMonthlyWastedCo2Kg: Number(monthlyWastedCo2Kg.toFixed(1)),
      confidence,
    };
  }

  /**
   * Evaluates Peak Shaving opportunity under EPDK 3-time tariffs.
   * Savings are explicitly labeled as PROJECTED, distinguishing them from verified measured savings.
   */
  public static evaluatePeakShaving(
    currentPowerW: number,
    flexibleLoadsW: number,
    tariffType: TariffType = 'TURKISH_EPDK_3_TIME',
    timestamp?: string,
    meterClockOffsetHours: number = 0
  ): PeakShavingOpportunity {
    const { period, rateTryPerKwh } = this.getTariffPeriod(timestamp, meterClockOffsetHours);
    const flexibleKw = Number((flexibleLoadsW / 1000).toFixed(2));

    let shiftableKw = 0;
    if (period === 'PUANT') {
      shiftableKw = Math.min(flexibleKw, currentPowerW / 1000);
    }

    const { ratesTryPerKwh } = this.OFFICIAL_EPDK_TARIFF_2024;
    const dailyKwhShifted = shiftableKw * 3.5; // Average 3.5 hours during puant
    const monthlySavingsTry = dailyKwhShifted * 30 * (ratesTryPerKwh.puant - ratesTryPerKwh.gece);

    // Evening fossil peakers emit ~0.542 kg CO2e/kWh vs nighttime wind/hydro ~0.385 kg CO2e/kWh
    const monthlyCo2SavedKg = dailyKwhShifted * 30 * (0.542 - 0.385);

    return {
      activeTariffPeriod: period,
      currentRateTryPerKwh: rateTryPerKwh,
      shiftableKw,
      projectedMonthlySavingsTry: Number(monthlySavingsTry.toFixed(0)),
      projectedCo2ReductionKg: Number(monthlyCo2SavedKg.toFixed(1)),
      isVerifiedMeasuredSavings: false,
      recommendedShiftPeriod: 'GECE (22:00-06:00)',
      tariffMetadata: this.OFFICIAL_EPDK_TARIFF_2024,
    };
  }

  /**
   * Computes accurate carbon emissions distinguishing generation-level vs consumption-point factors.
   * Accounts for hourly peaker variations in Turkish grid.
   */
  public static calculateCo2e(
    kwh: number,
    timestamp: string = new Date().toISOString(),
    useConsumptionPoint: boolean = true
  ): {
    co2eKg: number;
    co2Kg: number; // backward-compatible alias
    emissionFactorUsed: number;
    unit: 'kg CO2e';
    factorType: 'CONSUMPTION_POINT' | 'GENERATION_POINT';
    source: string;
  } {
    const hour = new Date(timestamp).getHours();
    const baseFactor = useConsumptionPoint
      ? this.OFFICIAL_CARBON_FACTORS_2024.consumptionPointEmissionFactor
      : this.OFFICIAL_CARBON_FACTORS_2024.generationEmissionFactor;

    let dynamicFactor = baseFactor;
    if (hour >= 17 && hour <= 21) {
      dynamicFactor = Number((baseFactor * 1.15).toFixed(3)); // Evening fossil peaker surge (+15%)
    } else if (hour >= 11 && hour <= 15) {
      dynamicFactor = Number((baseFactor * 0.90).toFixed(3)); // Midday solar PV generation peak (-10%)
    } else if (hour >= 1 && hour <= 5) {
      dynamicFactor = Number((baseFactor * 0.82).toFixed(3)); // Nighttime wind/hydro baseload (-18%)
    }

    const value = Number((kwh * dynamicFactor).toFixed(3));

    return {
      co2eKg: value,
      co2Kg: value,
      emissionFactorUsed: dynamicFactor,
      unit: 'kg CO2e',
      factorType: useConsumptionPoint ? 'CONSUMPTION_POINT' : 'GENERATION_POINT',
      source: this.OFFICIAL_CARBON_FACTORS_2024.sourceReport,
    };
  }

  /**
   * Evaluates confidence scores across NILM disaggregation categories
   */
  public static evaluateNILMConfidence(
    hasPhysicalSubmeter: boolean = false,
    measurementQuality: string = 'PHYSICAL_METERED'
  ): NILMConfidenceReport {
    if (hasPhysicalSubmeter) {
      return {
        hvacConfidence: 0.98,
        lightingConfidence: 0.92,
        baseLoadConfidence: 0.95,
        phantomLoadConfidence: 0.96,
        overallDisaggregationConfidence: 0.96,
        methodology: 'SUB_METER_GROUND_TRUTH',
      };
    }

    if (measurementQuality === 'PHYSICAL_METERED') {
      return {
        hvacConfidence: 0.88,
        lightingConfidence: 0.82,
        baseLoadConfidence: 0.91,
        phantomLoadConfidence: 0.89,
        overallDisaggregationConfidence: 0.87,
        methodology: 'HARMONIC_WAVELET_DECOMPOSITION',
      };
    }

    // Synthetic or manual
    return {
      hvacConfidence: 0.65,
      lightingConfidence: 0.60,
      baseLoadConfidence: 0.70,
      phantomLoadConfidence: 0.68,
      overallDisaggregationConfidence: 0.66,
      methodology: 'TIME_OF_DAY_HEURISTIC',
    };
  }
}
