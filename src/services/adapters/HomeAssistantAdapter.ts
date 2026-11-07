import { IRuntimeAdapter, AdapterHealth } from './IRuntimeAdapter';
import { NormalizedEnergyMeasurement, IntegrationPathway } from '../../types/residential';
import { EnergyDataNormalizer } from '../integration/EnergyDataNormalizer';

export interface HomeAssistantStatePayload {
  entity_id: string;
  state: string; // numeric string e.g. "3450.5" or "unavailable"
  attributes: {
    unit_of_measurement?: string; // 'W', 'kW', 'Wh', 'kWh'
    device_class?: string;        // 'power', 'energy'
    friendly_name?: string;
  };
  last_updated?: string;
}

export class HomeAssistantAdapter implements IRuntimeAdapter {
  public readonly adapterId: string;
  public readonly adapterType: IntegrationPathway = 'HOME_ASSISTANT';

  private tenantId: string = '';
  private homeId: string = '';
  private deviceId: string = '';
  private isConnected: boolean = false;
  private dataCallback: ((m: NormalizedEnergyMeasurement) => void) | null = null;
  private errorCallback: ((err: Error) => void) | null = null;
  private packetsReceived: number = 0;
  private packetErrors: number = 0;
  private lastHeartbeat: string = new Date().toISOString();

  constructor(adapterId: string = 'home-assistant-bridge') {
    this.adapterId = adapterId;
  }

  public async initialize(config: Record<string, any>): Promise<void> {
    this.tenantId = config.tenantId || 'tenant-default';
    this.homeId = config.homeId || 'home-default';
    this.deviceId = config.deviceId || 'dev-ha-bridge';
  }

  public async connect(): Promise<boolean> {
    this.isConnected = true;
    this.lastHeartbeat = new Date().toISOString();
    return true;
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  public onData(callback: (measurement: NormalizedEnergyMeasurement) => void): void {
    this.dataCallback = callback;
  }

  public onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  public getHealth(): AdapterHealth {
    return {
      connected: this.isConnected,
      status: this.isConnected ? 'ONLINE' : 'DISCONNECTED',
      latencyMs: 8,
      packetsReceived: this.packetsReceived,
      packetErrors: this.packetErrors,
      errorRatePercent: 0,
      lastHeartbeat: this.lastHeartbeat,
    };
  }

  /**
   * Ingests a Home Assistant entity state update
   */
  public ingestEntityState(payload: HomeAssistantStatePayload): NormalizedEnergyMeasurement {
    try {
      this.lastHeartbeat = new Date().toISOString();

      if (payload.state === 'unavailable' || payload.state === 'unknown') {
        throw new Error(`Home Assistant entity ${payload.entity_id} is unavailable`);
      }

      const numericVal = parseFloat(payload.state);
      if (isNaN(numericVal)) {
        throw new Error(`Invalid numeric state: ${payload.state}`);
      }

      const unit = payload.attributes.unit_of_measurement || 'W';
      const isSubMetered = !payload.entity_id.includes('grid') && !payload.entity_id.includes('main');

      let powerW = 0;
      let energyKwh = 0;

      if (payload.attributes.device_class === 'energy' || unit.toLowerCase().includes('wh')) {
        energyKwh = unit === 'Wh' ? numericVal / 1000 : numericVal;
      } else {
        powerW = unit === 'kW' ? numericVal * 1000 : numericVal;
      }

      const normalized = EnergyDataNormalizer.normalize({
        tenantId: this.tenantId,
        homeId: this.homeId,
        deviceId: this.deviceId,
        source: 'HOME_ASSISTANT',
        timestamp: payload.last_updated,
        power: powerW,
        powerUnit: 'W',
        energy: energyKwh,
        energyUnit: 'kWh',
        isSubMeteredOnly: isSubMetered,
        rawMetadata: {
          entityId: payload.entity_id,
          friendlyName: payload.attributes.friendly_name || payload.entity_id,
        },
      });

      this.packetsReceived++;
      if (this.dataCallback) {
        this.dataCallback(normalized);
      }
      return normalized;
    } catch (err: any) {
      this.packetErrors++;
      if (this.errorCallback) {
        this.errorCallback(err);
      }
      throw err;
    }
  }
}
