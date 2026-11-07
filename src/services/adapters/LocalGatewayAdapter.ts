import { IRuntimeAdapter, AdapterHealth } from './IRuntimeAdapter';
import { NormalizedEnergyMeasurement, IntegrationPathway } from '../../types/residential';
import { EnergyDataNormalizer } from '../integration/EnergyDataNormalizer';

export interface GatewayMqttPacket {
  seq: number;
  ts: string;
  p_w: number;
  e_kwh: number;
  v?: number;
  i?: number;
  pf?: number;
  freq?: number;
}

export class LocalGatewayAdapter implements IRuntimeAdapter {
  public readonly adapterId: string;
  public readonly adapterType: IntegrationPathway = 'LOCAL_GATEWAY';

  private tenantId: string = '';
  private homeId: string = '';
  private deviceId: string = '';
  private isConnected: boolean = false;
  private dataCallback: ((m: NormalizedEnergyMeasurement) => void) | null = null;
  private errorCallback: ((err: Error) => void) | null = null;
  private packetsReceived: number = 0;
  private packetErrors: number = 0;
  private lastHeartbeat: string = new Date().toISOString();
  private processedSequenceIds: Set<number> = new Set();

  constructor(adapterId: string = 'local-gateway-mqtt') {
    this.adapterId = adapterId;
  }

  public async initialize(config: Record<string, any>): Promise<void> {
    this.tenantId = config.tenantId || 'tenant-default';
    this.homeId = config.homeId || 'home-default';
    this.deviceId = config.deviceId || 'dev-local-gw';
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
      latencyMs: 12,
      packetsReceived: this.packetsReceived,
      packetErrors: this.packetErrors,
      errorRatePercent: 0,
      lastHeartbeat: this.lastHeartbeat,
    };
  }

  /**
   * Ingests MQTT packet with idempotent sequence deduplication
   */
  public ingestMqttPacket(packet: GatewayMqttPacket): { ingested: boolean; duplicate: boolean } {
    try {
      this.lastHeartbeat = new Date().toISOString();

      // Idempotency: Check if sequenceId was already processed
      if (this.processedSequenceIds.has(packet.seq)) {
        return { ingested: false, duplicate: true };
      }

      const normalized = EnergyDataNormalizer.normalize({
        tenantId: this.tenantId,
        homeId: this.homeId,
        deviceId: this.deviceId,
        source: 'LOCAL_GATEWAY',
        timestamp: packet.ts,
        power: packet.p_w,
        powerUnit: 'W',
        energy: packet.e_kwh,
        energyUnit: 'kWh',
        voltage: packet.v,
        current: packet.i,
        powerFactor: packet.pf,
        frequency: packet.freq,
        sequenceId: packet.seq,
        isSubMeteredOnly: false,
      });

      this.processedSequenceIds.add(packet.seq);
      if (this.processedSequenceIds.size > 10000) {
        // Prevent unbounded memory growth by trimming older sequence IDs
        const arr = Array.from(this.processedSequenceIds);
        this.processedSequenceIds = new Set(arr.slice(5000));
      }

      this.packetsReceived++;
      if (this.dataCallback) {
        this.dataCallback(normalized);
      }

      return { ingested: true, duplicate: false };
    } catch (err: any) {
      this.packetErrors++;
      if (this.errorCallback) {
        this.errorCallback(err);
      }
      throw err;
    }
  }
}
