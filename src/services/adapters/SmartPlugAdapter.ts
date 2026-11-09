import { IRuntimeAdapter, AdapterHealth, AdapterCapability, AdapterConnectionState } from './IRuntimeAdapter';
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

  public readonly capability: AdapterCapability = {
    lifecycleStage: 'STAGE_2_PROTOCOL_IMPLEMENTED',
    requiresCertifiedElectrician: false, // DIY appliance plug-in
    supportsBiDirectionalControl: false,  // Passive telemetry only
    isPassiveReadOnly: true,
    physicalHardwareAttached: false,
    physicalHardwareEvidence: 'Tested with synthetic Tuya/Shelly plug fixtures.',
    supportedTransports: ['SMART_PLUG_API'],
  };

  private tenantId: string = '';
  private homeId: string = '';
  private deviceId: string = '';
  private connectionState: AdapterConnectionState = 'DISCONNECTED';
  private dataCallback: ((m: NormalizedEnergyMeasurement) => void) | null = null;
  private errorCallback: ((err: Error) => void) | null = null;
  private packetsReceived: number = 0;
  private lastHeartbeat?: string;

  constructor(adapterId: string = 'smart-plug-submeter') {
    this.adapterId = adapterId;
  }

  public async initialize(config: Record<string, any>): Promise<void> {
    this.tenantId = config.tenantId || 'tenant-default';
    this.homeId = config.homeId || 'home-default';
    this.deviceId = config.deviceId || 'dev-smart-plug';
  }

  public async connect(): Promise<{ success: boolean; state: AdapterConnectionState; message: string }> {
    this.connectionState = 'PROTOCOL_READY';
    return {
      success: true,
      state: 'PROTOCOL_READY',
      message: 'Smart plug API poller ready for appliance telemetry intake.',
    };
  }

  public async disconnect(): Promise<void> {
    this.connectionState = 'DISCONNECTED';
  }

  public onData(callback: (measurement: NormalizedEnergyMeasurement) => void): void {
    this.dataCallback = callback;
  }

  public onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  public getHealth(): AdapterHealth {
    const isConnected = this.connectionState === 'PROTOCOL_READY' || this.connectionState === 'CONNECTED_HARDWARE';
    return {
      connected: isConnected,
      connectionState: this.connectionState,
      hardwareAttached: this.capability.physicalHardwareAttached,
      status: isConnected ? 'ONLINE' : 'DISCONNECTED',
      latencyMs: isConnected ? 16 : 0,
      packetsReceived: this.packetsReceived,
      packetErrors: 0,
      errorRatePercent: 0,
      lastHeartbeat: this.lastHeartbeat,
      diagnosticMessage: isConnected ? 'Sub-metered appliance plug poller online.' : 'Disconnected.',
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
