import { NormalizedEnergyMeasurement, IntegrationPathway } from '../../types/residential';
import { HealthStatus } from '../integration/ConnectionHealthMonitor';

export interface AdapterHealth {
  connected: boolean;
  status: HealthStatus;
  latencyMs: number;
  packetsReceived: number;
  packetErrors: number;
  errorRatePercent: number;
  lastHeartbeat: string;
}

export interface IRuntimeAdapter {
  readonly adapterId: string;
  readonly adapterType: IntegrationPathway;

  initialize(config: Record<string, any>): Promise<void>;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  onData(callback: (measurement: NormalizedEnergyMeasurement) => void): void;
  onError(callback: (error: Error) => void): void;
  getHealth(): AdapterHealth;
}
