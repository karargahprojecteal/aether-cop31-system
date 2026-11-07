import { ITelemetryProvider, TelemetryCallback } from './ITelemetryProvider';
import { TelemetrySimulatorService } from './TelemetrySimulatorService';
import { LiveStreamAdapter } from './LiveStreamAdapter';
import { 
  AggregatedMetrics, 
  DataSourceMode, 
  PowerFlowHistoryPoint, 
  TelemetryPoint 
} from '../../types/telemetry';
import { ScenarioModifiers } from '../../types/scenarios';

export class TelemetryManager {
  private simulator: TelemetrySimulatorService;
  private liveAdapter: LiveStreamAdapter;
  private activeProvider: ITelemetryProvider;
  private currentMode: DataSourceMode = 'SIMULATION';
  private listeners: Set<TelemetryCallback> = new Set();
  
  // Rolling time series buffer (son 30 ölçüm noktası)
  private historyBuffer: PowerFlowHistoryPoint[] = [];
  private maxHistoryLength: number = 30;

  // Günlük Birikimli İstatistikler
  private cumulativeBaselineKwh: number = 412.5; // Günün başından itibaren örnek baz tüketim
  private cumulativeActualKwh: number = 328.0;   // AETHER ile gerçekleşen tüketim
  private cumulativeSavedKwh: number = 84.5;
  private cumulativeSavedCostTry: number = 371.8;
  private cumulativeSavedCo2Kg: number = 41.2;

  private latestPoint: TelemetryPoint | null = null;
  private totalInterventionCount: number = 0;

  constructor() {
    this.simulator = new TelemetrySimulatorService();
    this.liveAdapter = new LiveStreamAdapter();
    this.activeProvider = this.simulator;
    
    // Geçmiş veriyi başlat (grafiğin ilk açılışta dolu gözükmesi için)
    this.seedHistory();
  }

  public init(): void {
    this.activeProvider.start(this.handleNewPoint.bind(this));
  }

  public subscribe(cb: TelemetryCallback): () => void {
    this.listeners.add(cb);
    if (this.latestPoint) {
      cb(this.latestPoint);
    }
    return () => {
      this.listeners.delete(cb);
    };
  }

  public setMode(mode: DataSourceMode, liveEndpoint?: string): void {
    if (this.currentMode === mode) return;
    
    this.activeProvider.stop();
    this.currentMode = mode;

    if (mode === 'SIMULATION') {
      this.activeProvider = this.simulator;
    } else {
      if (liveEndpoint) {
        this.liveAdapter.setConfig(mode, liveEndpoint);
      }
      this.activeProvider = this.liveAdapter;
    }

    this.activeProvider.start(this.handleNewPoint.bind(this));
  }

  public getMode(): DataSourceMode {
    return this.currentMode;
  }

  public applyIntervention(kwReduction: number, subsystem: string): void {
    this.totalInterventionCount++;
    this.activeProvider.injectIntervention(kwReduction, subsystem);
  }

  public clearAllInterventions(): void {
    this.activeProvider.clearInterventions();
  }

  public setScenarioModifiers(modifiers: ScenarioModifiers): void {
    this.activeProvider.setScenarioModifiers(modifiers);
  }

  public getHistory(): PowerFlowHistoryPoint[] {
    return [...this.historyBuffer];
  }

  public getAggregatedMetrics(): AggregatedMetrics {
    if (!this.latestPoint) {
      return {
        currentPowerKw: 0,
        baselinePowerKw: 0,
        instantSavingKw: 0,
        instantSavingPercent: 0,
        totalKwhToday: this.cumulativeActualKwh,
        baselineKwhToday: this.cumulativeBaselineKwh,
        savedKwhToday: this.cumulativeSavedKwh,
        savedCostTryToday: this.cumulativeSavedCostTry,
        savedCo2KgToday: this.cumulativeSavedCo2Kg,
        efficiencyScore: 88,
        phantomLoadPercent: 12,
        frequencyStabilityPercent: 99.8,
        activeNodesCount: 18,
        simulatedTimeDriftSeconds: 0,
      };
    }

    // AETHER müdahalesi olmasaydı beklenen tüketim (Baseline)
    // Gerçek tüketim + engellenen hayalet yük payı
    const phantom = this.latestPoint.nilm.phantomLoadKw;
    const baselinePowerKw = Number((this.latestPoint.activePowerKw + Math.max(12, phantom * 0.85)).toFixed(2));
    const currentPowerKw = this.latestPoint.activePowerKw;
    const instantSavingKw = Number(Math.max(0, baselinePowerKw - currentPowerKw).toFixed(2));
    const instantSavingPercent = Number(((instantSavingKw / baselinePowerKw) * 100).toFixed(1));

    const totalKw = currentPowerKw;
    const phantomPercent = Number(((phantom / (totalKw + 0.1)) * 100).toFixed(1));
    
    // Verimlilik Skoru: Hayalet yük ne kadar az ve tasarruf ne kadar yüksekse o kadar 100'e yakın
    const efficiencyScore = Math.min(99, Math.max(45, Math.round(100 - (phantomPercent * 1.5) + (instantSavingPercent * 0.5))));
    const freqDev = Math.abs(this.latestPoint.frequency - 50.0);
    const frequencyStabilityPercent = Number((100 - freqDev * 10).toFixed(1));

    return {
      currentPowerKw,
      baselinePowerKw,
      instantSavingKw,
      instantSavingPercent,
      totalKwhToday: Number(this.cumulativeActualKwh.toFixed(1)),
      baselineKwhToday: Number(this.cumulativeBaselineKwh.toFixed(1)),
      savedKwhToday: Number(this.cumulativeSavedKwh.toFixed(1)),
      savedCostTryToday: Number(this.cumulativeSavedCostTry.toFixed(1)),
      savedCo2KgToday: Number(this.cumulativeSavedCo2Kg.toFixed(1)),
      efficiencyScore,
      phantomLoadPercent: phantomPercent,
      frequencyStabilityPercent,
      activeNodesCount: 24,
      simulatedTimeDriftSeconds: 0,
    };
  }

  public getProviderStatus() {
    return this.activeProvider.getStatus();
  }

  private handleNewPoint(point: TelemetryPoint): void {
    this.latestPoint = point;

    // Her saniyelik adımda birikimli sayaçları güncelle (1 sn = 1/3600 kWh)
    const kwhStep = point.activePowerKw / 3600;
    const baselineStep = (point.activePowerKw + Math.max(12, point.nilm.phantomLoadKw * 0.85)) / 3600;
    const savedStep = Math.max(0, baselineStep - kwhStep);

    this.cumulativeActualKwh += kwhStep;
    this.cumulativeBaselineKwh += baselineStep;
    this.cumulativeSavedKwh += savedStep;
    this.cumulativeSavedCostTry += savedStep * point.gridElectricityPriceTryPerKwh;
    this.cumulativeSavedCo2Kg += (savedStep * point.gridCarbonIntensityGCo2PerKwh) / 1000;

    // Tarih/Saat Etiketi
    const date = new Date(point.timestamp);
    const timeLabel = date.toTimeString().split(' ')[0];

    const baselineKw = Number((point.activePowerKw + Math.max(12, point.nilm.phantomLoadKw * 0.85)).toFixed(2));
    const historyPoint: PowerFlowHistoryPoint = {
      timestamp: point.timestamp,
      timeLabel,
      baselineKw,
      actualKw: point.activePowerKw,
      savedKw: Number((baselineKw - point.activePowerKw).toFixed(2)),
      phantomLoadKw: point.nilm.phantomLoadKw,
      solarKw: point.nilm.solarGenerationKw,
      carbonIntensity: point.gridCarbonIntensityGCo2PerKwh,
    };

    this.historyBuffer.push(historyPoint);
    if (this.historyBuffer.length > this.maxHistoryLength) {
      this.historyBuffer.shift();
    }

    // Listener'lara bildir
    this.listeners.forEach((listener) => {
      try {
        listener(point);
      } catch (err) {
        console.error('Error notifying telemetry listener:', err);
      }
    });
  }

  private seedHistory(): void {
    const now = Date.now();
    for (let i = this.maxHistoryLength; i >= 1; i--) {
      const pastTime = new Date(now - i * 1000);
      const timeLabel = pastTime.toTimeString().split(' ')[0];
      const base = 58 + Math.sin(i * 0.3) * 6;
      const actual = base - 14 + Math.sin(i * 0.2) * 2;
      
      this.historyBuffer.push({
        timestamp: pastTime.toISOString(),
        timeLabel,
        baselineKw: Number(base.toFixed(2)),
        actualKw: Number(actual.toFixed(2)),
        savedKw: Number((base - actual).toFixed(2)),
        phantomLoadKw: Number((16 + Math.sin(i * 0.5) * 3).toFixed(2)),
        solarKw: Number((18 + Math.cos(i * 0.2) * 4).toFixed(2)),
        carbonIntensity: 470,
      });
    }
  }
}

// Singleton servis instance'ı
export const telemetryManagerInstance = new TelemetryManager();
