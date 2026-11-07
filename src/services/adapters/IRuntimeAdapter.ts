import { NormalizedEnergyMeasurement, IntegrationPathway } from '../../types/residential';

export type AdapterLifecycleStage =
  | 'STAGE_1_PARSER_IMPLEMENTED'
  | 'STAGE_2_PROTOCOL_IMPLEMENTED'
  | 'STAGE_3_LAB_HARDWARE_TESTED'
  | 'STAGE_4_PRODUCTION_ACCEPTED';

export type AdapterConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'PARSER_ONLY_NO_HARDWARE'
  | 'PROTOCOL_READY'
  | 'CONNECTED_HARDWARE'
  | 'ERROR';

export interface AdapterCapability {
  lifecycleStage: AdapterLifecycleStage;
  requiresCertifiedElectrician: boolean;
  supportsBiDirectionalControl: boolean; // Always FALSE for passive residential safety
  isPassiveReadOnly: boolean;            // Always TRUE
  physicalHardwareAttached: boolean;
  physicalHardwareEvidence?: string;
  supportedTransports: ('SERIAL_OPTICAL' | 'MQTT_TLS' | 'REST_HTTP' | 'SMART_PLUG_API' | 'MANUAL_ENTRY')[];
}

export interface AdapterHealth {
  connected: boolean;
  connectionState: AdapterConnectionState;
  hardwareAttached: boolean;
  status: 'ONLINE' | 'DEGRADED' | 'DISCONNECTED' | 'PARSER_ONLY';
  latencyMs: number;
  packetsReceived: number;
  packetErrors: number;
  errorRatePercent: number;
  lastHeartbeat?: string;
  diagnosticMessage: string;
}

export interface IRuntimeAdapter {
  readonly adapterId: string;
  readonly adapterType: IntegrationPathway;
  readonly capability: AdapterCapability;

  initialize(config: Record<string, any>): Promise<void>;
  connect(): Promise<{ success: boolean; state: AdapterConnectionState; message: string }>;
  disconnect(): Promise<void>;
  onData(callback: (measurement: NormalizedEnergyMeasurement) => void): void;
  onError(callback: (error: Error) => void): void;
  getHealth(): AdapterHealth;
}
