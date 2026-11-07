import { DataSourceMode, TelemetryPoint } from '../../types/telemetry';
import { ScenarioModifiers } from '../../types/scenarios';

export type TelemetryCallback = (point: TelemetryPoint) => void;

export interface ITelemetryProvider {
  /** Veri akışını başlatır */
  start(callback: TelemetryCallback): void;
  
  /** Veri akışını durdurur */
  stop(): void;
  
  /** Çalışma modu: Simülasyon mu, Canlı Donanım (MQTT/WS/REST) mi? */
  getSourceMode(): DataSourceMode;
  
  /** Yapay zeka veya operatör müdahalesiyle aktif yük düşürme komutu enjekte eder */
  injectIntervention(kwReduction: number, subsystem: string): void;
  
  /** Aktif müdahaleleri temizler veya günceller */
  clearInterventions(): void;
  
  /** Jüri stres testi senaryo modifiye edicilerini uygular */
  setScenarioModifiers(modifiers: ScenarioModifiers): void;
  
  /** Bağlantı durumu bilgisi */
  getStatus(): {
    connected: boolean;
    packetRateHz: number;
    lastPingMs: number;
    sourceEndpoint: string;
  };
}
