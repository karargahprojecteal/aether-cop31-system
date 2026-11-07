import { 
  NormalizedEnergyMeasurement, 
  MeasurementQuality, 
  IntegrationPathway 
} from '../../types/residential';

export interface RawTelemetryFrame {
  tenantId: string;
  homeId: string;
  deviceId: string;
  source: IntegrationPathway;
  timestamp?: string | number; // ISO string or epoch ms
  
  // Possible diverse field names from various hardware models
  power?: number;         // Watts or kW depending on unit
  powerUnit?: 'W' | 'kW';
  energy?: number;        // Wh or kWh depending on unit
  energyUnit?: 'Wh' | 'kWh';
  voltage?: number;
  current?: number;
  powerFactor?: number;
  frequency?: number;
  sequenceId?: number;
  isSubMeteredOnly?: boolean;
  rawMetadata?: Record<string, any>;
}

export class EnergyDataNormalizer {
  private static sequenceCounter: number = 0;

  /**
   * Normalizes any raw hardware frame into the canonical NormalizedEnergyMeasurement
   */
  public static normalize(frame: RawTelemetryFrame): NormalizedEnergyMeasurement {
    if (!frame.tenantId || !frame.homeId || !frame.deviceId) {
      throw new Error('Normalizer Error: tenantId, homeId, and deviceId are mandatory');
    }

    // 1. Sanitize & convert Timestamp to ISO 8601 UTC
    let normalizedTs: string;
    if (!frame.timestamp) {
      normalizedTs = new Date().toISOString();
    } else if (typeof frame.timestamp === 'number') {
      normalizedTs = new Date(frame.timestamp).toISOString();
    } else {
      const parsed = new Date(frame.timestamp);
      if (isNaN(parsed.getTime())) {
        normalizedTs = new Date().toISOString();
      } else {
        normalizedTs = parsed.toISOString();
      }
    }

    // 2. Power Conversion to canonical Watts (W)
    let activePowerW = 0;
    if (frame.power !== undefined && !isNaN(frame.power)) {
      if (frame.powerUnit === 'kW') {
        activePowerW = Number((frame.power * 1000).toFixed(2));
      } else {
        activePowerW = Number(frame.power.toFixed(2));
      }
    }

    // 3. Energy Conversion to canonical kWh
    let cumulativeEnergyKwh = 0;
    if (frame.energy !== undefined && !isNaN(frame.energy)) {
      if (frame.energyUnit === 'Wh') {
        cumulativeEnergyKwh = Number((frame.energy / 1000).toFixed(4));
      } else {
        cumulativeEnergyKwh = Number(frame.energy.toFixed(4));
      }
    }

    // 4. Electrical Range Sanity Checks (Prevent corrupt or garbage ADC readings)
    const voltageV = (frame.voltage !== undefined && frame.voltage > 50 && frame.voltage < 500) 
      ? Number(frame.voltage.toFixed(1)) 
      : undefined;

    const currentA = (frame.current !== undefined && frame.current >= 0 && frame.current < 200) 
      ? Number(frame.current.toFixed(2)) 
      : undefined;

    const powerFactor = (frame.powerFactor !== undefined && frame.powerFactor >= -1 && frame.powerFactor <= 1)
      ? Number(frame.powerFactor.toFixed(3))
      : undefined;

    const frequencyHz = (frame.frequency !== undefined && frame.frequency >= 45 && frame.frequency <= 65)
      ? Number(frame.frequency.toFixed(2))
      : undefined;

    // 5. Determine Quality and Confidence Score strictly based on data source
    const { quality, confidence } = this.deriveQualityAndConfidence(frame.source, frame.isSubMeteredOnly);

    this.sequenceCounter++;
    const seq = frame.sequenceId !== undefined ? frame.sequenceId : this.sequenceCounter;

    return {
      tenantId: frame.tenantId,
      homeId: frame.homeId,
      deviceId: frame.deviceId,
      timestamp: normalizedTs,
      activePowerW,
      cumulativeEnergyKwh,
      voltageV,
      currentA,
      powerFactor,
      frequencyHz,
      source: frame.source,
      measurementQuality: quality,
      confidenceScore: confidence,
      isSubMeteredOnly: !!frame.isSubMeteredOnly,
      sequenceId: seq,
      sourceMetadata: frame.rawMetadata,
    };
  }

  private static deriveQualityAndConfidence(
    source: IntegrationPathway,
    isSubMeteredOnly?: boolean
  ): { quality: MeasurementQuality; confidence: number } {
    switch (source) {
      case 'SMART_METER':
        return { quality: 'PHYSICAL_METERED', confidence: 0.99 };
      case 'LOCAL_GATEWAY':
        return isSubMeteredOnly 
          ? { quality: 'SUB_METERED', confidence: 0.96 }
          : { quality: 'PHYSICAL_METERED', confidence: 0.97 };
      case 'HOME_ASSISTANT':
        return isSubMeteredOnly
          ? { quality: 'SUB_METERED', confidence: 0.94 }
          : { quality: 'PHYSICAL_METERED', confidence: 0.95 };
      case 'SMART_PLUG':
        return { quality: 'SUB_METERED', confidence: 0.98 };
      case 'MANUAL_INVOICE':
        return { quality: 'MANUAL_BILL', confidence: 1.0 }; // True for billing, but 0.0 for real-time
      case 'SYNTHETIC_SIM':
      default:
        return { quality: 'ESTIMATED', confidence: 0.50 };
    }
  }
}
