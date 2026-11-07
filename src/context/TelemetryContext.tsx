import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
  AggregatedMetrics, 
  DataSourceMode, 
  PowerFlowHistoryPoint, 
  TelemetryPoint 
} from '../types/telemetry';
import { StressScenario } from '../types/scenarios';
import { telemetryManagerInstance } from '../services/telemetry/TelemetryManager';

// Varsayılan Stres Testi Senaryoları (Jüri sunumunda interaktif tetiklenebilir)
export const DEFAULT_STRESS_SCENARIOS: StressScenario[] = [
  {
    id: 'scen-phantom',
    name: 'Mesai Dışı Hayalet Yük Sızıntısı (Phantom Leak)',
    shortTag: 'PHANTOM LEAK',
    description: 'Hafta sonu mesai dışı saatte ana klima grubu ve ikincil hidrofor açık unutuldu. Beklenmedik +32 kW baz tüketim kaçağı oluştu.',
    category: 'PHANTOM_INTRUSION',
    severity: 'HIGH',
    isActive: false,
    effectSummary: '+32 kW Hayalet Yük, %28 Verim Kaybı',
    modifiers: {
      phantomKwAdd: 32.0,
      occupancyOverridePercent: 4.0,
    },
    promptHintForGemini: 'Mesai dışı bina boşken 32 kW hayalet yük kaçağı oluştu, acil NILM frekans izolasyonu gerekiyor.',
  },
  {
    id: 'scen-peak-surge',
    name: 'Şebeke Pik Yükü & Tarife Sıçraması (Peak Surge)',
    shortTag: 'GRID SURGE',
    description: 'Bölgesel şebekede aşırı talep dalgası. Elektrik tarife fiyatı 2.4 katına çıktı ve sözleşme gücü tavanı test ediliyor.',
    category: 'GRID_SURGE',
    severity: 'EXTREME',
    isActive: false,
    effectSummary: 'Tarife: 8.80 TL/kWh, +40% Talep Artışı',
    modifiers: {
      tariffMultiplier: 2.3,
      powerMultiplier: 1.35,
      gridCarbonMultiplier: 1.35,
    },
    promptHintForGemini: 'Şebeke tarifesi 8.8 TL seviyesine çıktı, acil Peak Shaving (Termal Atalet ön soğutma) uygulanmalı.',
  },
  {
    id: 'scen-solar-drop',
    name: 'Güneş Çöküşü & Ani Bulutlanma (Solar Failure)',
    shortTag: 'SOLAR DROP',
    description: 'Çatı GES panelleri ani fırtına ve yoğun bulut kütlesi sebebiyle anlık %85 üretim kaybına uğradı.',
    category: 'SOLAR_FAILURE',
    severity: 'MEDIUM',
    isActive: false,
    effectSummary: '-85% Çatı GES Üretimi, Şebeke Yük Şoku',
    modifiers: {
      solarDropPercent: 85,
    },
    promptHintForGemini: 'Çatı güneş üretimi %85 çöktü, ikincil lümenleri kısarak şebeke yük şokunu sönümleyin.',
  },
  {
    id: 'scen-extreme-heat',
    name: 'Antalya Aşırı Sıcak Dalgası (Heatwave 42°C)',
    shortTag: 'EXTREME HEAT',
    description: 'Dış ortam sıcaklığı 42°C üzerine çıktı, HVAC soğutma grubu aşırı ısınma ve verimsizlik sınırında çalışıyor.',
    category: 'EXTREME_WEATHER',
    severity: 'HIGH',
    isActive: false,
    effectSummary: 'Dış Ortam +10°C, HVAC Kompresör Aşırı Isınması',
    modifiers: {
      outdoorTempOffsetC: 11.5,
      powerMultiplier: 1.25,
    },
    promptHintForGemini: 'Antalya aşırı sıcak dalgası: Dış ortam 42C, HVAC VAV debisini optimize edin.',
  },
];

interface TelemetryContextType {
  telemetry: TelemetryPoint | null;
  history: PowerFlowHistoryPoint[];
  metrics: AggregatedMetrics;
  mode: DataSourceMode;
  setMode: (mode: DataSourceMode, endpoint?: string) => void;
  providerStatus: {
    connected: boolean;
    packetRateHz: number;
    lastPingMs: number;
    sourceEndpoint: string;
  };
  scenarios: StressScenario[];
  toggleScenario: (id: string) => void;
  resetAllScenarios: () => void;
  applyIntervention: (kwReduction: number, subsystem: string) => void;
  clearInterventions: () => void;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [telemetry, setTelemetry] = useState<TelemetryPoint | null>(null);
  const [history, setHistory] = useState<PowerFlowHistoryPoint[]>([]);
  const [metrics, setMetrics] = useState<AggregatedMetrics>(() => telemetryManagerInstance.getAggregatedMetrics());
  const [mode, setModeState] = useState<DataSourceMode>(() => telemetryManagerInstance.getMode());
  const [scenarios, setScenarios] = useState<StressScenario[]>(DEFAULT_STRESS_SCENARIOS);
  const [providerStatus, setProviderStatus] = useState(() => telemetryManagerInstance.getProviderStatus());

  useEffect(() => {
    // Telemetri servisini başlat ve abone ol
    telemetryManagerInstance.init();
    
    const unsubscribe = telemetryManagerInstance.subscribe((point) => {
      setTelemetry(point);
      setHistory(telemetryManagerInstance.getHistory());
      setMetrics(telemetryManagerInstance.getAggregatedMetrics());
      setProviderStatus(telemetryManagerInstance.getProviderStatus());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const setMode = (newMode: DataSourceMode, endpoint?: string) => {
    telemetryManagerInstance.setMode(newMode, endpoint);
    setModeState(newMode);
    setProviderStatus(telemetryManagerInstance.getProviderStatus());
  };

  const toggleScenario = (id: string) => {
    setScenarios((prev) => {
      const updated = prev.map((s) => {
        if (s.id === id) {
          const nextActive = !s.isActive;
          return { ...s, isActive: nextActive };
        }
        return s;
      });

      // Aktif olan tüm senaryoların birleşik modifiye edicilerini hesapla
      const combinedModifiers: any = {};
      updated.forEach((s) => {
        if (s.isActive) {
          if (s.modifiers.phantomKwAdd) {
            combinedModifiers.phantomKwAdd = (combinedModifiers.phantomKwAdd || 0) + s.modifiers.phantomKwAdd;
          }
          if (s.modifiers.powerMultiplier) {
            combinedModifiers.powerMultiplier = Math.max(combinedModifiers.powerMultiplier || 1, s.modifiers.powerMultiplier);
          }
          if (s.modifiers.solarDropPercent) {
            combinedModifiers.solarDropPercent = Math.max(combinedModifiers.solarDropPercent || 0, s.modifiers.solarDropPercent);
          }
          if (s.modifiers.tariffMultiplier) {
            combinedModifiers.tariffMultiplier = Math.max(combinedModifiers.tariffMultiplier || 1, s.modifiers.tariffMultiplier);
          }
          if (s.modifiers.gridCarbonMultiplier) {
            combinedModifiers.gridCarbonMultiplier = Math.max(combinedModifiers.gridCarbonMultiplier || 1, s.modifiers.gridCarbonMultiplier);
          }
          if (s.modifiers.outdoorTempOffsetC) {
            combinedModifiers.outdoorTempOffsetC = (combinedModifiers.outdoorTempOffsetC || 0) + s.modifiers.outdoorTempOffsetC;
          }
          if (s.modifiers.occupancyOverridePercent !== undefined) {
            combinedModifiers.occupancyOverridePercent = s.modifiers.occupancyOverridePercent;
          }
        }
      });

      telemetryManagerInstance.setScenarioModifiers(combinedModifiers);
      return updated;
    });
  };

  const resetAllScenarios = () => {
    setScenarios((prev) => prev.map((s) => ({ ...s, isActive: false })));
    telemetryManagerInstance.setScenarioModifiers({});
  };

  const applyIntervention = (kwReduction: number, subsystem: string) => {
    telemetryManagerInstance.applyIntervention(kwReduction, subsystem);
  };

  const clearInterventions = () => {
    telemetryManagerInstance.clearAllInterventions();
  };

  const value = useMemo(() => ({
    telemetry,
    history,
    metrics,
    mode,
    setMode,
    providerStatus,
    scenarios,
    toggleScenario,
    resetAllScenarios,
    applyIntervention,
    clearInterventions,
  }), [telemetry, history, metrics, mode, providerStatus, scenarios]);

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};

export const useTelemetry = (): TelemetryContextType => {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
};
