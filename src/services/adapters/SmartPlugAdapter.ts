import { IRuntimeAdapter, AdapterHealth } from './IRuntimeAdapter';
import { NormalizedEnergyMeasurement, IntegrationPathway } from '../../types/residential';
import { EnergyDataNormalizer } from '../integration/EnergyDataNormalizer';

export interface SmartPlugReading {
  powerWatts: number;
  totalKwh: number;
  voltage?: number;
  current?: number;
  applianceType?: 'REFRIGERATOR' | 'WASHING_MACHINE' | 'DISHWASHER' | 'EV_CHARGER' | 'OTHER';
}

export class SmartPlugAdapter implements IRuntimeAdapter {
  public readonly adapterId: string;
  public readonly adapterType: IntegrationPathway = 'SMART_PLUG';

  private tenantId: string = '';
  private homeId: string = '';
  private deviceId: string = '';
  private isConnected: boolean = false;
  private dataCallback: ((m: NormalizedEnergyMeasurement) => void) | null = null;
  private errorCallback: ((err: Error) => void) | null = null;
  private packetsReceived: number = 0;
  private lastHeartbeat: string = new Date().toISOString();

  constructor(adapterId: string = 'smart-plug-submeter') {
    this.adapterId = adapterId;
  }

  public async initialize(config: Record<string, any>): Promise<void> {
    this.tenantId = config.tenantId || 'tenant-default';
    this.homeId = config.homeId || 'home-default';
    this.deviceId = config.deviceId || 'dev-smart-plug';
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
      latencyMs: 16,
      packetsReceived: this.packetsReceived,
      packetErrors: 0,
      errorRatePercent: 0,
      lastHeartbeat: this.lastHeartbeat,
    };
  }

  public ingestPlugReading(reading: SmartPlugReading): NormalizedEnergyMeasurement {
    this.lastHeartbeat = new Date().toISOString();

    const normalized = EnergyDataNormalizer.normalize({
      tenantId: this.tenantId,
      homeId: this.homeId,
      deviceId: this.deviceId,
      source: 'SMART_PLUG',
      power: reading.powerWatts,
      powerUnit: 'W',
      energy: reading.totalKwh,
      energyUnit: 'kWh',
      voltage: reading.voltage,
      current: reading.current,
      isSubMeteredOnly: true, // Crucial distinction: Never mixed with whole-home load
      rawMetadata: { applianceType: reading.applianceType || 'OTHER' },
    });

    this.packetsReceived++;
    if (this.dataCallback) {
      this.dataCallback(normalized);
    }
    return normalized;
  }
}
