/**
 * AETHER Residential Integration Core Types
 */

export type MeasurementQuality = 
  | 'PHYSICAL_METERED'  // Certified whole-home physical meter or CT clamp
  | 'SUB_METERED'       // Smart plug or dedicated circuit relay (e.g. Shelly)
  | 'DERIVED_NILM'      // Machine learning disaggregated estimate
  | 'ESTIMATED'         // Statistical or interpolation approximation
  | 'MANUAL_BILL';      // Monthly utility invoice entry

export type IntegrationPathway = 
  | 'SMART_METER' 
  | 'HOME_ASSISTANT' 
  | 'LOCAL_GATEWAY' 
  | 'SMART_PLUG' 
  | 'MANUAL_INVOICE' 
  | 'SYNTHETIC_SIM';

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
  source: IntegrationPathway;
  measurementQuality: MeasurementQuality;
  confidenceScore: number;    // 0.00 to 1.00
  isSubMeteredOnly: boolean;  // True if measuring only a single appliance, not main feeder
  sequenceId: number;         // Monotonically increasing packet counter for deduplication
  sourceMetadata?: Record<string, string | number | boolean>;
}

export type HousingType = 
  | 'APARTMENT_IN_BUILDING' 
  | 'DETACHED_VILLA' 
  | 'COMMERCIAL_UNIT' 
  | 'RESIDENTIAL_ESTATE_SITE';

export type MeterInfrastructure = 
  | 'ELECTRONIC_SMART_METER'    // Has optical port / pulse
  | 'ANALOG_FERRARIS_METER'     // Mechanical rotating disc
  | 'ACCESSIBLE_P1_HAN_METER'   // European P1/HAN standard
  | 'LOCKED_BASEMENT_PANEL'     // Locked utility room without Wi-Fi
  | 'IN_UNIT_BREAKER_PANEL'     // Resident has direct access to sub-panel
  | 'UNKNOWN';

export type TariffType = 
  | 'TURKISH_EPDK_3_TIME'       // Gündüz (06-17), Puant (17-22), Gece (22-06)
  | 'SINGLE_TARIFF_FLAT' 
  | 'DYNAMIC_HOURLY';

export interface HomeProfile {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  city: string;
  housingType: HousingType;
  squareMeters: number;
  residentCount: number;
  meterInfrastructure: MeterInfrastructure;
  primaryHeating: 'HEAT_PUMP' | 'NATURAL_GAS_COMBI' | 'ELECTRIC_RESISTANCE' | 'CENTRAL_DISTRICT';
  hasSolarPv: boolean;
  hasEvCharger: boolean;
  tariffPlan: TariffType;
  createdAt: string;
  isPrimary: boolean;
}

export interface DeviceRecord {
  id: string;
  tenantId: string;
  homeId: string;
  name: string;
  deviceType: 'MAIN_METER' | 'SUB_METER_RELAY' | 'SMART_PLUG' | 'GATEWAY' | 'MANUAL_INVOICE_SOURCE';
  adapterType: IntegrationPathway;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  pairingStatus: 'PAIRED' | 'PENDING' | 'REVOKED' | 'FAILED';
  measurementQuality: MeasurementQuality;
  isSubMeteredOnly: boolean;
  lastSeenAt?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface PairingToken {
  token: string;              // 8-character cryptographic alphanumeric string
  tenantId: string;
  homeId: string;
  deviceType: DeviceRecord['deviceType'];
  adapterType: IntegrationPathway;
  createdAt: number;          // Epoch timestamp ms
  expiresAt: number;          // Epoch timestamp ms (TTL 15 mins)
  status: 'PENDING' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
  attemptsCount: number;
  maxAttempts: number;
}

export interface ManualBillRecord {
  id: string;
  tenantId: string;
  homeId: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalKwh: number;
  totalCostTry: number;
  tariffType: TariffType;
  daytimeKwh?: number;
  peakKwh?: number;
  nightKwh?: number;
  createdAt: string;
}
