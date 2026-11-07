import { IRuntimeAdapter, AdapterHealth } from './IRuntimeAdapter';
import { NormalizedEnergyMeasurement, IntegrationPathway, ManualBillRecord } from '../../types/residential';
import { EnergyDataNormalizer } from '../integration/EnergyDataNormalizer';

export class ManualConsumptionAdapter implements IRuntimeAdapter {
  public readonly adapterId: string;
  public readonly adapterType: IntegrationPathway = 'MANUAL_INVOICE';

  private tenantId: string = '';
  private homeId: string = '';
  private deviceId: string = '';
  private isConnected: boolean = true;
  private records: ManualBillRecord[] = [];
  private dataCallback: ((m: NormalizedEnergyMeasurement) => void) | null = null;
  private errorCallback: ((err: Error) => void) | null = null;

  constructor(adapterId: string = 'manual-bill-entry') {
    this.adapterId = adapterId;
  }

  public async initialize(config: Record<string, any>): Promise<void> {
    this.tenantId = config.tenantId || 'tenant-default';
    this.homeId = config.homeId || 'home-default';
    this.deviceId = config.deviceId || 'dev-manual-bill';
  }

  public async connect(): Promise<boolean> {
    this.isConnected = true;
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
      connected: true,
      status: 'ONLINE',
      latencyMs: 0,
      packetsReceived: this.records.length,
      packetErrors: 0,
      errorRatePercent: 0,
      lastHeartbeat: new Date().toISOString(),
    };
  }

  public addManualBill(billInput: Omit<ManualBillRecord, 'id' | 'createdAt'>): { record: ManualBillRecord; normalized: NormalizedEnergyMeasurement } {
    const id = `bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const billRecord: ManualBillRecord = {
      ...billInput,
      id,
      createdAt: new Date().toISOString(),
    };
    this.records.push(billRecord);

    // Calculate daily average power in Watts equivalent over billing period days
    const start = new Date(billInput.periodStart).getTime();
    const end = new Date(billInput.periodEnd).getTime();
    const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const dailyKwh = billInput.totalKwh / days;
    const averageWattsEquivalent = (dailyKwh * 1000) / 24;

    const normalized = EnergyDataNormalizer.normalize({
      tenantId: this.tenantId,
      homeId: this.homeId,
      deviceId: this.deviceId,
      source: 'MANUAL_INVOICE',
      timestamp: billInput.periodEnd,
      power: averageWattsEquivalent,
      powerUnit: 'W',
      energy: billInput.totalKwh,
      energyUnit: 'kWh',
      rawMetadata: {
        invoiceNumber: billInput.invoiceNumber,
        totalCostTry: billInput.totalCostTry,
        daysInPeriod: days,
        dailyAverageKwh: Number(dailyKwh.toFixed(2)),
      },
    });

    if (this.dataCallback) {
      this.dataCallback(normalized);
    }

    return { record: billRecord, normalized };
  }

  public listBills(): ManualBillRecord[] {
    return [...this.records];
  }
}
