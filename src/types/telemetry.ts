export type DataSourceMode = 'SIMULATION' | 'LIVE_MQTT' | 'LIVE_WEBSOCKET' | 'LIVE_SMART_METER_REST';

export interface NILMDisaggregation {
  /** HVAC - Isıtma, Havalandırma ve İklimlendirme (kW) */
  hvacKw: number;
  /** Aydınlatma grubu (kW) */
  lightingKw: number;
  /** Sunucu odası, IT altyapısı ve kesintisiz baz yük (kW) */
  baseLoadKw: number;
  /** Hayalet Tüketim (Phantom Load) - Mesai dışı açık kalan, kaçak veya verimsiz yük (kW) */
  phantomLoadKw: number;
  /** Sanayi/motor/pompa/asansör vb. mekanik yük (kW) */
  industrialLoadKw: number;
  /** Çatı Güneş Enerjisi (GES) anlık üretim (kW) - Şebekeden çekilen yükü azaltır */
  solarGenerationKw: number;
}

export interface TelemetryPoint {
  id: string;
  timestamp: string; // ISO 8601
  
  // Elektriksel Temel Parametreler (Akıllı Sayaç & Frekans Dinleyici)
  voltage: number; // Volt (nominal ~230V / 400V)
  frequency: number; // Hz (nominal 50.00 Hz)
  current: number; // Amper (A)
  powerFactor: number; // cos φ (0.85 - 0.99)
  activePowerKw: number; // Toplam net çekilen aktif güç (kW)
  reactivePowerKvar: number; // Reaktif güç (kVAR)
  
  // Yazılımsal Yük Ayrıştırma (NILM)
  nilm: NILMDisaggregation;
  
  // Dış Ortam & Çevre Parametreleri (Çoklu Veri Füzyonu)
  outdoorTempC: number; // Dış ortam sıcaklığı (°C)
  outdoorHumidityPercent: number; // Dış ortam nemi (%)
  solarIrradianceWm2: number; // Güneş ışınımı (W/m²)
  occupancyRatePercent: number; // Bina insan doluluk oranı (%)
  
  // Şebeke & Karbon Muhasebesi (Karbon Sayacı)
  gridCarbonIntensityGCo2PerKwh: number; // Anlık şebeke karbon yoğunluğu (gCO2/kWh)
  gridElectricityPriceTryPerKwh: number; // Anlık tarife (TL/kWh)
}

export interface PowerFlowHistoryPoint {
  timestamp: string;
  timeLabel: string; // HH:mm:ss
  baselineKw: number; // AETHER müdahalesi olmasaydı beklenen tüketim (kW)
  actualKw: number; // AETHER ile optimize edilmiş gerçekleşen tüketim (kW)
  savedKw: number; // Anlık engellenen güç (kW)
  phantomLoadKw: number; // Yakalanan hayalet yük (kW)
  solarKw: number; // Güneş katkısı (kW)
  carbonIntensity: number; // gCO2/kWh
}

export interface AggregatedMetrics {
  currentPowerKw: number;
  baselinePowerKw: number;
  instantSavingKw: number;
  instantSavingPercent: number;
  
  // Günlük Birikimli
  totalKwhToday: number;
  baselineKwhToday: number;
  savedKwhToday: number;
  savedCostTryToday: number;
  savedCo2KgToday: number;
  
  // Sistem Sağlığı & COP31 İndeksleri
  efficiencyScore: number; // 0 - 100
  phantomLoadPercent: number; // Toplam yükteki hayalet yük oranı (%)
  frequencyStabilityPercent: number; // Şebeke frekans stabilite skoru
  activeNodesCount: number;
  simulatedTimeDriftSeconds: number;
}

export interface FacilityProfile {
  id: string;
  name: string;
  category: string;
  areaM2: number;
  buildingType: string;
  contractPowerKw: number;
  baseLoadNominalKw: number;
  targetSavingGoalPercent: number;
}
