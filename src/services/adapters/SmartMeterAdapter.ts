import { IRuntimeAdapter, AdapterHealth } from './IRuntimeAdapter';
import { NormalizedEnergyMeasurement, IntegrationPathway } from '../../types/residential';
import { EnergyDataNormalizer } from '../integration/EnergyDataNormalizer';

export class SmartMeterAdapter implements IRuntimeAdapter {
  public readonly adapterId: string;
  public readonly adapterType: IntegrationPathway = 'SMART_METER';

  private tenantId: string = '';
  private homeId: string = '';
  private deviceId: string = '';
  private isConnected: boolean = false;
  private dataCallback: ((m: NormalizedEnergyMeasurement) => void) | null = null;
  private errorCallback: ((err: Error) => void) | null = null;
  private packetsReceived: number = 0;
  private packetErrors: number = 0;
  private lastHeartbeat: string = new Date().toISOString();

  constructor(adapterId: string = 'smart-meter-p1-opt') {
    this.adapterId = adapterId;
  }

  public async initialize(config: Record<string, any>): Promise<void> {
    this.tenantId = config.tenantId || 'tenant-default';
    this.homeId = config.homeId || 'home-default';
    this.deviceId = config.deviceId || 'dev-smart-meter';
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
    const errorRate = this.packetsReceived > 0 
      ? Number(((this.packetErrors / this.packetsReceived) * 100).toFixed(1)) 
      : 0;

    return {
      connected: this.isConnected,
      status: this.isConnected ? (errorRate > 10 ? 'DEGRADED' : 'ONLINE') : 'DISCONNECTED',
      latencyMs: 14,
      packetsReceived: this.packetsReceived,
      packetErrors: this.packetErrors,
      errorRatePercent: errorRate,
      lastHeartbeat: this.lastHeartbeat,
    };
  }

  /**
   * Parses raw DLMS / IEC 62056-21 / DSMR P1 telegram
   */
  public ingestRawTelegram(telegramText: string): NormalizedEnergyMeasurement {
    try {
      this.lastHeartbeat = new Date().toISOString();
      
      // Basic envelope validation
      if (!telegramText.includes('1.8.0') && !telegramText.includes('1.7.0')) {
        throw new Error('Invalid OBIS frame: Missing 1.8.0 or 1.7.0 power indicators');
      }

      // Extract Active Import Energy 1.8.0(001452.123*kWh)
      const energyMatch = telegramText.match(/1\.8\.0\(([0-9.]+)\*kWh\)/i);
      const energyKwh = energyMatch ? parseFloat(energyMatch[1]) : 0;

      // Extract Instantaneous Power 1.7.0(0003.850*kW) or 1.7.0(3850*W)
      let activePowerW = 0;
      const powerKwMatch = telegramText.match(/1\.7\.0\(([0-9.]+)\*kW\)/i);
      const powerWMatch = telegramText.match(/1\.7\.0\(([0-9.]+)\*W\)/i);

      if (powerKwMatch) {
        activePowerW = parseFloat(powerKwMatch[1]) * 1000;
      } else if (powerWMatch) {
        activePowerW = parseFloat(powerWMatch[1]);
      }

      // Extract Voltage 32.7.0(230.4*V)
      const voltageMatch = telegramText.match(/32\.7\.0\(([0-9.]+)\*V\)/i);
      const voltage = voltageMatch ? parseFloat(voltageMatch[1]) : 230.0;

      // Extract Current 31.7.0(016.4*A)
      const currentMatch = telegramText.match(/31\.7\.0\(([0-9.]+)\*A\)/i);
      const current = currentMatch ? parseFloat(currentMatch[1]) : undefined;

      const normalized = EnergyDataNormalizer.normalize({
        tenantId: this.tenantId,
        homeId: this.homeId,
        deviceId: this.deviceId,
        source: 'SMART_METER',
        power: activePowerW,
        powerUnit: 'W',
        energy: energyKwh,
        energyUnit: 'kWh',
        voltage,
        current,
        frequency: 50.0,
        isSubMeteredOnly: false,
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
