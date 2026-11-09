# AETHER Device & Meter Adapter Specification
## Unified Hardware Abstraction Layer & Ingestion Pipeline

---

## 1. Unified Measurement Data Contract
All adapters—regardless of protocol, transport, or frequency—must normalize incoming frames into the canonical `NormalizedEnergyMeasurement` contract before ingestion into the intelligence pipeline.

```typescript
export type MeasurementQuality = 
  | 'PHYSICAL_METERED'  // Certified whole-home physical meter or CT clamp
  | 'SUB_METERED'       // Smart plug or dedicated circuit relay (e.g. Shelly)
  | 'DERIVED_NILM'      // Machine learning disaggregated estimate
  | 'ESTIMATED'         // Statistical or interpolation approximation
  | 'MANUAL_BILL';      // Monthly utility invoice entry

export interface NormalizedEnergyMeasurement {
  tenantId: string;
  homeId: string;
  deviceId: string;
  timestamp: string;          // ISO 8601 UTC
  
  // Electrical metrics
  activePowerW: number;       // Instantaneous active power in Watts (W)
  cumulativeEnergyKwh: number;// Monotonic meter index in kWh
  voltageV?: number;          // RMS Volts (optional if unmeasured)
  currentA?: number;          // RMS Amperes (optional if unmeasured)
  powerFactor?: number;       // cos phi 0.0 - 1.0 (optional)
  frequencyHz?: number;       // Nominal 50.0 Hz (optional)
  
  // Quality & Provenance metadata
  source: 'SMART_METER' | 'HOME_ASSISTANT' | 'LOCAL_GATEWAY' | 'SMART_PLUG' | 'MANUAL_INVOICE' | 'SYNTHETIC_SIM';
  measurementQuality: MeasurementQuality;
  confidenceScore: number;    // 0.00 to 1.00
  isSubMeteredOnly: boolean;  // True if measuring only a single appliance, not main feeder
  sequenceId: number;         // Monotonically increasing packet counter for deduplication
  sourceMetadata?: Record<string, string | number | boolean>;
}
```

---

## 2. Common Adapter Lifecycle & Capability Contract (`IRuntimeAdapter`)

Every adapter implements the `IRuntimeAdapter` contract with four explicit lifecycle verification stages:

### 2.1 Lifecycle Maturity Classification
1. **STAGE_1_PARSER_IMPLEMENTED:** Telemetry parser is implemented and verified with synthetic raw frames (e.g. IEC 62056-21 OBIS telegram strings).
2. **STAGE_2_PROTOCOL_IMPLEMENTED:** Protocol network transport (MQTT/TLS, REST, WebSocket) and sequence deduplication are implemented and verified with mock servers.
3. **STAGE_3_LAB_HARDWARE_TESTED:** Validated on physical bench hardware in controlled lab setting with actual serial probes or DIN-rail CT clamps.
4. **STAGE_4_PRODUCTION_ACCEPTED:** Field-accepted in commercial residential installation with signed telemetry accuracy verification.

### 2.2 Adapter Capability & Safety Model
```typescript
export interface AdapterCapability {
  lifecycleStage: AdapterLifecycleStage;
  requiresCertifiedElectrician: boolean;
  supportsBiDirectionalControl: boolean; // Always FALSE for passive residential safety
  isPassiveReadOnly: boolean;            // Always TRUE
  physicalHardwareAttached: boolean;
  physicalHardwareEvidence?: string;
  supportedTransports: ('SERIAL_OPTICAL' | 'MQTT_TLS' | 'REST_HTTP' | 'SMART_PLUG_API' | 'MANUAL_ENTRY')[];
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
```

### 2.3 Physical Connection Honesty Guarantee
- `SmartMeterAdapter.connect()` checks for physical serial port existence. In sandbox and cloud environments without an attached physical USB optical probe, it transitions to `PARSER_ONLY_NO_HARDWARE` and explicitly reports that physical hardware is not connected.
- `LocalGatewayAdapter` sets `requiresCertifiedElectrician: true` because connecting split-core current transformers inside main distribution boards involves live 230V/400V busbars and must be performed by certified licensed personnel under Turkish Electrical Internal Facilities Regulations.

---

## 3. Detailed Adapter Implementations

### 3.1 `SmartMeterAdapter` (P1 / Optical DLMS)
- **Inputs:** Serial byte stream (115200 8N1 for P1, 9600 7E1 for IEC 62056-21).
- **Validation:** CRC-16 checksum verification across packet envelope.
- **OBIS Code Mapping:**
  - `1.8.0` / `1.8.1` / `1.8.2`: Import Energy Total / Tariff 1 / Tariff 2 ($kWh$)
  - `1.7.0`: Instantaneous Active Power Import ($kW \rightarrow \times 1000 = W$)
  - `32.7.0`: L1 Voltage ($V$)
  - `31.7.0`: L1 Current ($A$)
- **Timeout Policy:** 15-second heartbeat timeout. Emits `DEGRADED` after 2 missed packets.

### 3.2 `HomeAssistantAdapter`
- **Inputs:** Home Assistant WebSocket `/api/websocket` subscribing to `state_changed` events or polling `/api/states/<entity_id>`.
- **Validation:** Bearer token authentication, JSON schema parsing, unit verification (`W`, `kW`, `Wh`, `kWh` converted to canonical $W$ and $kWh$).
- **Reconnect Policy:** Exponential backoff ($1s, 2s, 4s, 8s, \dots \text{max } 60s$) with $\pm 20\%$ jitter.

### 3.3 `LocalGatewayAdapter` (MQTT over TLS)
- **Inputs:** MQTT Topic `aether/{tenantId}/{homeId}/telemetry`.
- **Payload Schema:**
  ```json
  {
    "seq": 48102,
    "ts": "2026-11-07T08:15:20Z",
    "p_w": 3450.8,
    "e_kwh": 1420.45,
    "v": 231.2,
    "i": 15.2,
    "pf": 0.98,
    "freq": 50.01
  }
  ```
- **Idempotency:** Dropped packets buffered in gateway flash are processed idempotently using `seq` number; duplicate `seq` packets are discarded.

### 3.4 `SmartPlugAdapter`
- **Inputs:** Local REST API polling (e.g. Shelly `/rpc/Shelly.GetStatus` or Tuya Local).
- **Quality Flag:** Always tags packets with `measurementQuality = 'SUB_METERED'`, `isSubMeteredOnly = true`.
- **Appliance Allocation:** Feeds into the NILM verification engine as ground-truth training validation.

### 3.5 `ManualConsumptionAdapter`
- **Inputs:** Monthly invoice form (`totalKwh`, `totalCostTry`, `startDate`, `endDate`, `tariffType`).
- **Normalization:** Converts monthly totals into daily equivalent averages. Quality is marked `MANUAL_BILL`.

### 3.6 `SimulationAdapter`
- **Inputs:** Real-time physics mathematical synthesizer (1 Hz).
- **Quality Flag:** Strictly marked as `source = 'SYNTHETIC_SIM'`, `measurementQuality = 'ESTIMATED'`.
- **Zero Confusion Guarantee:** Clear UI indicator prevents synthetic data from ever being presented as certified utility evidence.
