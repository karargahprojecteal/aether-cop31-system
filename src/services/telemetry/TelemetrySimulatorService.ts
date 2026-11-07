import { ITelemetryProvider, TelemetryCallback } from './ITelemetryProvider';
import { DataSourceMode, TelemetryPoint } from '../../types/telemetry';
import { ScenarioModifiers } from '../../types/scenarios';

export class TelemetrySimulatorService implements ITelemetryProvider {
  private timer: ReturnType<typeof setInterval> | null = null;
  private callback: TelemetryCallback | null = null;
  private activeInterventionsKw: number = 0;
  private scenarioModifiers: ScenarioModifiers = {};
  private tickCount: number = 0;
  private simulatedHour: number = 14; // Default starting at 14:00 (afternoon peak)
  private simulatedMinute: number = 25;
  private isConnected: boolean = true;
  private packetCounter: number = 0;

  constructor() {}

  public start(callback: TelemetryCallback): void {
    this.stop();
    this.callback = callback;
    this.isConnected = true;
    
    // Her 1 saniyede bir yeni telemetri paketi üretir (1 Hz akış)
    this.timer = setInterval(() => {
      this.tick();
    }, 1000);
    
    // İlk paketi anında gönder
    this.tick();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getSourceMode(): DataSourceMode {
    return 'SIMULATION';
  }

  public injectIntervention(kwReduction: number, _subsystem: string): void {
    // AETHER otonom müdahalesi ile yük düşüşü biriktirilir
    this.activeInterventionsKw = Math.min(65, this.activeInterventionsKw + kwReduction);
  }

  public clearInterventions(): void {
    this.activeInterventionsKw = 0;
  }

  public setScenarioModifiers(modifiers: ScenarioModifiers): void {
    this.scenarioModifiers = { ...modifiers };
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      packetRateHz: 1.0,
      lastPingMs: 12,
      sourceEndpoint: 'AETHER-Virtual-NILM-Engine://local-synth',
    };
  }

  private tick(): void {
    this.tickCount++;
    this.packetCounter++;

    // Simülasyon zamanı ilerlemesi (her 1 gerçek saniyede 10 saniye sanal ilerleme)
    this.simulatedMinute += 0.2;
    if (this.simulatedMinute >= 60) {
      this.simulatedHour = (this.simulatedHour + 1) % 24;
      this.simulatedMinute = 0;
    }

    const point = this.generateRealisticPoint();
    if (this.callback) {
      this.callback(point);
    }
  }

  private generateRealisticPoint(): TelemetryPoint {
    const hour = this.simulatedHour;
    const isWorkHours = hour >= 8 && hour <= 19;
    const isPeakTariff = hour >= 17 && hour <= 22;

    // 1. Dış Ortam & Çevre Modellemesi
    const tempOffset = this.scenarioModifiers.outdoorTempOffsetC || 0;
    const baseTemp = 24 + Math.sin(((hour - 8) / 24) * 2 * Math.PI) * 7;
    const outdoorTempC = Number((baseTemp + tempOffset + (Math.random() * 0.4 - 0.2)).toFixed(1));
    const outdoorHumidityPercent = Number((55 - (outdoorTempC - 20) * 1.5 + (Math.random() * 2 - 1)).toFixed(1));

    // Güneş Işınımı (Gündüz 06:00 - 19:00 arası tepe yapar)
    let solarBase = 0;
    if (hour >= 6 && hour <= 19) {
      solarBase = Math.sin(((hour - 6) / 13) * Math.PI) * 850;
    }
    const solarDrop = this.scenarioModifiers.solarDropPercent ?? 0;
    const solarIrradianceWm2 = Math.max(0, Number((solarBase * (1 - solarDrop / 100) + (Math.random() * 20 - 10)).toFixed(0)));

    // Doluluk Oranı
    let baseOccupancy = isWorkHours ? 75 + Math.sin(((hour - 8) / 11) * Math.PI) * 15 : 8;
    if (this.scenarioModifiers.occupancyOverridePercent !== undefined) {
      baseOccupancy = this.scenarioModifiers.occupancyOverridePercent;
    }
    const occupancyRatePercent = Number(Math.max(2, Math.min(100, baseOccupancy + (Math.random() * 4 - 2))).toFixed(1));

    // 2. NILM - Yük Ayrıştırma Hesaplaması
    // Sabit Kesintisiz Baz Yük (IT / Veri Merkezi / Güvenlik)
    const baseLoadKw = Number((26.5 + (Math.random() * 1.2 - 0.6)).toFixed(2));

    // HVAC: Sıcaklığa ve doluluğa bağlı
    let nominalHvac = (outdoorTempC > 22 ? (outdoorTempC - 22) * 5.5 : 12) + (occupancyRatePercent * 0.35);
    // Aydınlatma
    const nominalLighting = (isWorkHours ? 16 : 3.5) * (occupancyRatePercent / 80);
    // Endüstriyel / Mekanik (Asansör, hidrofor, hava kompresörü)
    const nominalIndustrial = (isWorkHours ? 22 : 6) + Math.sin(this.tickCount * 0.4) * 4;

    // Hayalet Yük (Phantom Load - Mesai dışı açık kalan klima, ekranlar, kaçak pompalar)
    let rawPhantomKw = (isWorkHours ? 12 : 24) + Math.sin(this.tickCount * 0.2) * 3;
    if (this.scenarioModifiers.phantomKwAdd) {
      rawPhantomKw += this.scenarioModifiers.phantomKwAdd;
    }

    // Güneş Çatı Üretimi (GES)
    const solarGenKw = Number(((solarIrradianceWm2 / 1000) * 42.0).toFixed(2));

    // AETHER Müdahale Etkisi:
    // Aktif müdahale öncelikle Hayalet Yükü yok eder, ardından HVAC setpoint'ini optimize eder
    let mitigatedPhantomKw = Math.max(2.1, rawPhantomKw - (this.activeInterventionsKw * 0.65));
    let mitigatedHvacKw = Math.max(14.0, nominalHvac - (this.activeInterventionsKw * 0.35));
    let mitigatedLightingKw = Math.max(3.0, nominalLighting);
    let mitigatedIndustrialKw = Math.max(5.0, nominalIndustrial);

    // Stres Senaryosu Çarpanı
    const powerMultiplier = this.scenarioModifiers.powerMultiplier || 1.0;

    const hvacKw = Number((mitigatedHvacKw * powerMultiplier).toFixed(2));
    const lightingKw = Number((mitigatedLightingKw * powerMultiplier).toFixed(2));
    const phantomLoadKw = Number((mitigatedPhantomKw * powerMultiplier).toFixed(2));
    const industrialLoadKw = Number((mitigatedIndustrialKw * powerMultiplier).toFixed(2));

    // Toplam Şebekeden Çekilen Aktif Güç (kW) = Toplam Yükler - Güneş Katkısı
    const totalDemandedKw = baseLoadKw + hvacKw + lightingKw + industrialLoadKw + phantomLoadKw;
    const activePowerKw = Math.max(8.0, Number((totalDemandedKw - solarGenKw).toFixed(2)));

    // 3. Elektriksel Parametreler (Frekans Dinleyici Çıktısı)
    // Şebeke yükü arttıkça frekansta mikro dalgalanma (nominal 50.00 Hz)
    const freqJitter = (Math.sin(this.tickCount * 0.7) * 0.02) + (Math.random() * 0.01 - 0.005);
    const frequency = Number((50.00 + freqJitter).toFixed(3));

    // Voltaj (nominal 230V)
    const voltJitter = Math.sin(this.tickCount * 0.3) * 1.5 + (Math.random() * 0.8 - 0.4);
    const voltage = Number((230.2 + voltJitter).toFixed(1));

    // Akım (I = P / (V * sqrt(3) * pf) - 3 fazlı eşdeğer veya tek faz yaklaşımı)
    const powerFactor = Number((0.95 + (Math.random() * 0.02 - 0.01)).toFixed(3));
    const current = Number(((activePowerKw * 1000) / (voltage * powerFactor)).toFixed(1));
    const reactivePowerKvar = Number((activePowerKw * Math.tan(Math.acos(powerFactor))).toFixed(2));

    // 4. Şebeke Karbon & Tarife Bilgisi
    // Pik saatlerde kömür/doğalgaz santralleri devreye girer, karbon yoğunluğu artar (gCO2/kWh)
    let baseCarbon = isPeakTariff ? 540 : 435;
    const carbonMult = this.scenarioModifiers.gridCarbonMultiplier || 1.0;
    const gridCarbonIntensityGCo2PerKwh = Number((baseCarbon * carbonMult + (Math.random() * 6 - 3)).toFixed(0));

    // Elektrik Tarife Fiyatı (TL/kWh)
    const tariffMult = this.scenarioModifiers.tariffMultiplier || 1.0;
    const baseTariff = isPeakTariff ? 5.85 : 3.90;
    const gridElectricityPriceTryPerKwh = Number((baseTariff * tariffMult).toFixed(2));

    const timestamp = new Date().toISOString();

    return {
      id: `tel-${this.tickCount}`,
      timestamp,
      voltage,
      frequency,
      current,
      powerFactor,
      activePowerKw,
      reactivePowerKvar,
      nilm: {
        hvacKw,
        lightingKw,
        baseLoadKw,
        phantomLoadKw,
        industrialLoadKw,
        solarGenerationKw: solarGenKw,
      },
      outdoorTempC,
      outdoorHumidityPercent,
      solarIrradianceWm2,
      occupancyRatePercent,
      gridCarbonIntensityGCo2PerKwh,
      gridElectricityPriceTryPerKwh,
    };
  }
}
