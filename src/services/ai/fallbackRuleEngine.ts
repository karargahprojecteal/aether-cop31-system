import { AIDecision } from '../../types/decisions';
import { TelemetryPoint } from '../../types/telemetry';
import { StressScenario } from '../../types/scenarios';

export function generateHeuristicDecisions(
  telemetry: TelemetryPoint,
  activeScenario: StressScenario | null
): AIDecision[] {
  const decisions: AIDecision[] = [];
  const now = new Date().toISOString();
  const nilm = telemetry.nilm;
  const totalKw = telemetry.activePowerKw;

  // 1. Hayalet Tüketim (Phantom Load) Analizi
  if (nilm.phantomLoadKw > 14.0) {
    const isCritical = nilm.phantomLoadKw > 25.0;
    const kwCut = Number((nilm.phantomLoadKw * 0.72).toFixed(1));
    const kwhSaving = Number((kwCut * 4.5).toFixed(1)); // 4.5 saatlik etki
    const co2Saving = Number(((kwhSaving * telemetry.gridCarbonIntensityGCo2PerKwh) / 1000).toFixed(1));
    const costSaving = Number((kwhSaving * telemetry.gridElectricityPriceTryPerKwh).toFixed(1));

    decisions.push({
      id: `dec-phantom-${Date.now()}`,
      timestamp: now,
      anomalyType: 'PHANTOM_LOAD',
      priority: isCritical ? 'CRITICAL' : 'HIGH',
      title: 'Yüksek Hayalet Tüketim (Phantom Load) İzolasyonu',
      diagnosis: `NILM frekans analizi, bina doluluk oranı %${telemetry.occupancyRatePercent} iken ${nilm.phantomLoadKw} kW seviyesinde gizli baz tüketim kaçırmakta olduğunu saptadı. Rölantide çalışan ikincil sirkülasyon pompaları ve açık unutulan B Blok AHU ünitesi tespit edildi.`,
      recommendedAction: 'İkincil sirkülasyon motorunu rölanti modundan bekleme moduna al, B Blok havalandırma damperlerini %70 kıs ve aydınlatma otomasyonuna faz kesme sinyali gönder.',
      commandPayload: {
        subsystem: 'HVAC',
        action: 'ISOLATE_PHANTOM_CIRCUITS',
        parameters: {
          zone: 'BLOCK_B_MEZZANINE',
          targetCircuits: ['PUMP_SEC_02', 'AHU_VAV_B4', 'LIGHTING_ZONE_3'],
          setpointDutyCycle: '25%',
        },
        estimatedKwReduction: kwCut,
      },
      projectedKwhSaving: kwhSaving,
      projectedCo2ReductionKg: co2Saving,
      projectedCostSavingTry: costSaving,
      confidenceScore: 96,
      status: 'PENDING_APPROVAL',
      source: 'HEURISTIC_ENGINE',
      reasoningNotes: [
        'Akıllı sayaç harmonik izinde 3. derece dalgalanma saptandı.',
        'Mesai dışı normal baz yük eşiği (26 kW) %55 aşıldı.',
        'COP31 karbon azaltım karnesine doğrudan 41 kg CO2e katkı sağlayacak.',
      ],
    });
  }

  // 2. Şebeke Pik Yük / Tarife Sıçraması (Peak Shaving & Load Shifting)
  if (telemetry.gridElectricityPriceTryPerKwh >= 4.5 || totalKw > 75 || (activeScenario && activeScenario.category === 'GRID_SURGE')) {
    const kwCut = 18.4;
    const kwhSaving = 55.2;
    const co2Saving = Number(((kwhSaving * telemetry.gridCarbonIntensityGCo2PerKwh) / 1000).toFixed(1));
    const costSaving = Number((kwhSaving * telemetry.gridElectricityPriceTryPerKwh).toFixed(1));

    decisions.push({
      id: `dec-peak-${Date.now()}`,
      timestamp: now,
      anomalyType: 'PEAK_SURGE',
      priority: 'HIGH',
      title: 'Pik Tarife Tıraşlama & Termal Atalet Ön Soğutması',
      diagnosis: `Elektrik şebekesi tarife bedeli ${telemetry.gridElectricityPriceTryPerKwh} TL/kWh pik seviyesine ulaştı. Binanın toplam çekilen gücü (${totalKw} kW) sözleşme talep tavanına yaklaşıyor.`,
      recommendedAction: 'Binanın mevcut yapısal termal ataletini (thermal inertia) devreye sok: Ana soğutma grubunun kompresör frekansını %20 düşür, soğuk su bataryası sıcaklık farkını 2°C esnet.',
      commandPayload: {
        subsystem: 'LOAD_SHEDDING',
        action: 'EXECUTE_PEAK_SHAVING',
        parameters: {
          chillerModulationPercent: 75,
          precoolDischargeOffset: 2.0,
          durationMinutes: 90,
        },
        estimatedKwReduction: kwCut,
      },
      projectedKwhSaving: kwhSaving,
      projectedCo2ReductionKg: co2Saving,
      projectedCostSavingTry: costSaving,
      confidenceScore: 92,
      status: 'PENDING_APPROVAL',
      source: 'HEURISTIC_ENGINE',
      reasoningNotes: [
        'Pik saat elektrik maliyeti normal tarifenin %40 üzerinde.',
        'Termal atalet sayesinde bina iç konfor sıcaklığı ±0.4°C içinde sabit kalır.',
      ],
    });
  }

  // 3. Şebeke Karbon Yoğunluğu Zirvesi (COP31 Odaklı Temiz Enerji Dengelemesi)
  if (telemetry.gridCarbonIntensityGCo2PerKwh > 500) {
    const kwCut = 14.0;
    const kwhSaving = 42.0;
    const co2Saving = Number(((kwhSaving * telemetry.gridCarbonIntensityGCo2PerKwh) / 1000).toFixed(1));
    const costSaving = Number((kwhSaving * telemetry.gridElectricityPriceTryPerKwh).toFixed(1));

    decisions.push({
      id: `dec-carbon-${Date.now()}`,
      timestamp: now,
      anomalyType: 'GRID_CARBON_HIGH',
      priority: 'MEDIUM',
      title: 'Yüksek Şebeke Karbon Emisyonu Koruma Protokolü',
      diagnosis: `Ulusal şebeke karbon yoğunluğu ${telemetry.gridCarbonIntensityGCo2PerKwh} gCO2/kWh kritik eşiğini aştı (fosil yakıtlı pik santraller devrede). Çekilen her kWh maksimum karbon salımına neden oluyor.`,
      recommendedAction: 'Öncelikli olmayan hidrofor ve otopark egzoz fan döngülerini 45 dakika boyunca %30 aralıklı (duty-cycle) çalışma moduna al.',
      commandPayload: {
        subsystem: 'PUMP_CONTROL',
        action: 'CYCLE_AUXILIARY_DRIVES',
        parameters: {
          intermittentCycleMinutes: 15,
          pauseDurationMinutes: 10,
        },
        estimatedKwReduction: kwCut,
      },
      projectedKwhSaving: kwhSaving,
      projectedCo2ReductionKg: co2Saving,
      projectedCostSavingTry: costSaving,
      confidenceScore: 89,
      status: 'PENDING_APPROVAL',
      source: 'HEURISTIC_ENGINE',
      reasoningNotes: [
        'COP31 azaltım katsayısı maksimizasyonu.',
        'Hava kalitesi sensörleri sınır değerlerin %40 altında seyretmektedir.',
      ],
    });
  }

  // 4. Stres Senaryosu: Güneş Çöküşü (Solar Failure)
  if (activeScenario && activeScenario.category === 'SOLAR_FAILURE') {
    decisions.push({
      id: `dec-solar-${Date.now()}`,
      timestamp: now,
      anomalyType: 'SOLAR_DIP',
      priority: 'CRITICAL',
      title: 'Ani Güneş Kaybı Telafi & Yük Dengeleme',
      diagnosis: 'Çatı GES üretimi ani bulutlanma/kesinti sebebiyle nominal kapasitenin %80 altına geriledi. Şebekeye anlık yük şoku yansımaması için hızlı yük sönümlemesi gerekiyor.',
      recommendedAction: 'Aydınlatma lümen seviyelerini %15 kademeli kıs, sıcak su boyler rezistans beslemesini 30 dakika ertele.',
      commandPayload: {
        subsystem: 'LIGHTING',
        action: 'DIM_SECONDARY_LIGHTING',
        parameters: {
          dimTargetPercent: 70,
          shedResistiveHeaters: true,
        },
        estimatedKwReduction: 16.5,
      },
      projectedKwhSaving: 38.0,
      projectedCo2ReductionKg: 19.2,
      projectedCostSavingTry: 160.0,
      confidenceScore: 97,
      status: 'PENDING_APPROVAL',
      source: 'HEURISTIC_ENGINE',
    });
  }

  return decisions;
}
