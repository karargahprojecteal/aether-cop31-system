import React from 'react';
import { 
  BrainCircuit, 
  Cpu, 
  Ghost, 
  Zap, 
  TrendingDown, 
  ShieldCheck, 
  Clock, 
  HelpCircle,
  AlertTriangle,
  Leaf
} from 'lucide-react';
import { EnergyIntelligenceEngine } from '../../services/intelligence/EnergyIntelligenceEngine';
import { useTelemetry } from '../../context/TelemetryContext';

export const EnergyIntelligenceView: React.FC = () => {
  const { telemetry } = useTelemetry();

  if (!telemetry) return null;

  const phantomAnalysis = EnergyIntelligenceEngine.analyzePhantomLoad(
    telemetry.activePowerKw * 1000,
    telemetry.nilm.phantomLoadKw * 1000,
    250,
    telemetry.occupancyRatePercent
  );

  const tariffPeriod = EnergyIntelligenceEngine.getTariffPeriod(telemetry.timestamp);
  const peakShaving = EnergyIntelligenceEngine.evaluatePeakShaving(
    telemetry.activePowerKw * 1000,
    (telemetry.nilm.hvacKw + telemetry.nilm.industrialLoadKw) * 1000 * 0.5,
    'TURKISH_EPDK_3_TIME'
  );

  const confidenceReport = EnergyIntelligenceEngine.evaluateNILMConfidence(false, 'PHYSICAL_METERED');

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/90 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">
                AETHER Enerji Zekası & Güvenilirlik Analizi
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                VERİ KANITI TEYİTLİ
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Fiziksel sayaç ölçümü, makine öğrenmesi NILM ayrıştırması ve algoritmik hipotezler birbirinden kesin çizgilerle ayrılır; her tahmin seviyesi matematiksel güven skoruyla sunulur.
            </p>
          </div>
        </div>
      </div>

      {/* 3 Core Intelligence Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* 1. Phantom Load Hunter Card */}
        <div className={`glass-panel rounded-2xl p-5 border shadow-xl flex flex-col justify-between ${
          phantomAnalysis.isAnomaly ? 'border-rose-500/50 bg-rose-950/15' : 'border-slate-800/90'
        }`}>
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Ghost className={`w-4 h-4 ${phantomAnalysis.isAnomaly ? 'text-rose-400' : 'text-slate-400'}`} />
                <h3 className="text-xs font-bold font-mono text-white">HAYALET TÜKETİM AVCI (Phantom Load)</h3>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                phantomAnalysis.isAnomaly 
                  ? 'bg-rose-950 text-rose-300 border-rose-500/60 font-bold animate-pulse'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-700'
              }`}>
                {phantomAnalysis.isAnomaly ? 'ANOMALİ TESPİT EDİLDİ' : 'NOMİNAL DÜZEY'}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2 font-mono">
              <span className="text-3xl font-extrabold text-white">
                {phantomAnalysis.detectedPhantomKw}
              </span>
              <span className="text-xs text-slate-400">kW sızıntı</span>
              <span className="text-xs text-slate-500 ml-auto">
                (%{phantomAnalysis.phantomPercentageOfTotal} yük payı)
              </span>
            </div>

            <p className="text-xs text-slate-300 mt-3 leading-relaxed font-sans">
              Meşru kesintisiz baz yük (modem, buzdolabı rölantisi ~{phantomAnalysis.nominalBaseLoadKw} kW) filtrelendikten sonra açık unutulan iklimlendirme ve rölanti cihazları saptandı.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Aylık Gereksiz Maliyet:</span>
                <span className="text-rose-400 font-bold">~{phantomAnalysis.estimatedMonthlyWastedCostTry} TL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Önlenemeyen CO2e:</span>
                <span className="text-rose-300">~{phantomAnalysis.estimatedMonthlyWastedCo2Kg} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Teşhis Güven Skoru:</span>
                <span className="text-cyan-300 font-bold">%{Math.round(phantomAnalysis.confidence * 100)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. EPDK 3-Time Tariff Peak Shaving Card */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800/90 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold font-mono text-white">EPDK 3-ZAMANLI TARİFE & PİK KAYDIRMA</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600 font-bold">
                {tariffPeriod.period} DÖNEMİ ({tariffPeriod.rateTryPerKwh} TL/kWh)
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2 font-mono">
              <span className="text-3xl font-extrabold text-amber-400">
                {peakShaving.shiftableKw}
              </span>
              <span className="text-xs text-slate-400">kW esnek yük</span>
            </div>

            <p className="text-xs text-slate-300 mt-3 leading-relaxed font-sans">
              Elektrik şebekesinin en pahalı olduğu <strong>Puant (17:00-22:00)</strong> saatlerindeki esnek yükleri (çamaşır, bulaşık, boyler, EV şarjı) <strong>Gece (22:00-06:00)</strong> saatlerine kaydırma potansiyeli.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Tasarruf Potansiyeli:</span>
                <span className="text-emerald-400 font-bold">+{peakShaving.projectedMonthlySavingsTry} TL / ay</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Şebeke Karbon Azaltımı:</span>
                <span className="text-emerald-300">-{peakShaving.projectedCo2ReductionKg} kg CO2e</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Önerilen Hedef Aralık:</span>
                <span className="text-cyan-300 font-semibold">{peakShaving.recommendedShiftPeriod}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. NILM Mathematical Confidence Breakdown */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800/90 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold font-mono text-white">NILM GÜVEN SKORLARI & METODOLOJİ</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700">
                %{Math.round(confidenceReport.overallDisaggregationConfidence * 100)} GENEL
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs font-mono">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>İklimlendirme (HVAC):</span>
                  <span className="text-cyan-300 font-bold">%{Math.round(confidenceReport.hvacConfidence * 100)}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${confidenceReport.hvacConfidence * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Kesintisiz Baz Yük (IT):</span>
                  <span className="text-blue-300 font-bold">%{Math.round(confidenceReport.baseLoadConfidence * 100)}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${confidenceReport.baseLoadConfidence * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Hayalet Yük Tespiti:</span>
                  <span className="text-purple-300 font-bold">%{Math.round(confidenceReport.phantomLoadConfidence * 100)}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${confidenceReport.phantomLoadConfidence * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Aydınlatma Grubu:</span>
                  <span className="text-amber-300 font-bold">%{Math.round(confidenceReport.lightingConfidence * 100)}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${confidenceReport.lightingConfidence * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400">
              Metodoloji: <strong className="text-white">{confidenceReport.methodology}</strong>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
