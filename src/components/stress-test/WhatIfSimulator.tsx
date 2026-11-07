import React from 'react';
import { 
  Sliders, 
  Flame, 
  AlertTriangle, 
  Sun, 
  Zap, 
  Ghost, 
  CheckCircle2, 
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { useDecisions } from '../../context/DecisionContext';

export const WhatIfSimulator: React.FC = () => {
  const { scenarios, toggleScenario, resetAllScenarios, metrics, telemetry } = useTelemetry();
  const { state } = useDecisions();

  const activeScenarios = scenarios.filter((s) => s.isActive);

  const categoryIcons: Record<string, any> = {
    PHANTOM_INTRUSION: Ghost,
    GRID_SURGE: Zap,
    SOLAR_FAILURE: Sun,
    EXTREME_WEATHER: Flame,
  };

  const severityColors: Record<string, string> = {
    EXTREME: 'bg-rose-950/80 text-rose-300 border-rose-500/70 shadow-[0_0_15px_rgba(244,63,94,0.3)]',
    HIGH: 'bg-amber-950/80 text-amber-300 border-amber-500/70',
    MEDIUM: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60',
    LOW: 'bg-slate-900 text-slate-400 border-slate-700',
  };

  return (
    <div className="space-y-6">
      
      {/* Başlık ve Jüri Açıklaması */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800/90 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/20 via-amber-500/10 to-transparent border border-rose-500/40 text-rose-400">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  AETHER "What-If" Senaryo & Stres Testi Simülatörü
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
                  JÜRİ ETKİLEŞİM PANELİ
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Aşırı hava olayları, ani şebeke pikleri veya hayalet kaçakları tetikleyerek AETHER'in saniyeler içinde otonom reaksiyon verip enerji şokunu nasıl sönümlediğini test edin.
              </p>
            </div>
          </div>

          {/* Tümünü Sıfırla Butonu */}
          {activeScenarios.length > 0 && (
            <button
              onClick={resetAllScenarios}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold text-rose-300 bg-rose-950/40 border border-rose-500/40 hover:bg-rose-900/50 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Tüm Stresleri Sıfırla (Nominal Durum)</span>
            </button>
          )}
        </div>

        {/* Canlı Reaksiyon Durum Bandı */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="text-slate-400">
            Aktif Stres Senaryoları: <strong className="text-white">{activeScenarios.length} adet</strong>
          </div>
          <div className="text-slate-400">
            Anlık Şebeke Çekişi: <strong className="text-cyan-400">{metrics.currentPowerKw.toFixed(1)} kW</strong>
          </div>
          <div className="text-slate-400">
            Hayalet Tüketim: <strong className={telemetry && telemetry.nilm.phantomLoadKw > 18 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
              {telemetry ? telemetry.nilm.phantomLoadKw.toFixed(1) : 0} kW
            </strong>
          </div>
          <div className="text-slate-400">
            AI Otonom Durum: <strong className="text-emerald-400">
              {state.isAutonomousMode ? 'Otonom Müdahale Açık' : 'Manuel Onay Bekliyor'}
            </strong>
          </div>
        </div>
      </div>

      {/* Senaryo Kartları Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scenarios.map((scen) => {
          const Icon = categoryIcons[scen.category] || Sliders;
          const isActive = scen.isActive;

          return (
            <div
              key={scen.id}
              className={`rounded-2xl border p-5 transition-all ${
                isActive
                  ? 'bg-rose-950/25 border-rose-500/60 shadow-[0_0_25px_rgba(244,63,94,0.18)]'
                  : 'glass-panel border-slate-800/90 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl border ${
                    isActive
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                      : 'bg-slate-800/50 border-slate-700/60 text-slate-400'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">{scen.name}</h3>
                    <span className="text-[10px] font-mono text-slate-400">{scen.shortTag}</span>
                  </div>
                </div>

                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${severityColors[scen.severity]}`}>
                  {scen.severity}
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                {scen.description}
              </p>

              {/* Etki Özeti Rozeti */}
              <div className="mt-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Senaryo Etkisi:</span>
                <span className="text-rose-400 font-bold">{scen.effectSummary}</span>
              </div>

              {/* Tetikleme Butonu */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div className="text-[11px] font-mono text-slate-500">
                  {isActive ? 'Stres telemetriye yansıtıldı' : 'Beklemede'}
                </div>

                <button
                  onClick={() => toggleScenario(scen.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/40'
                      : 'bg-slate-800 hover:bg-cyan-900/40 text-slate-200 border border-slate-700 hover:border-cyan-500/40'
                  }`}
                >
                  {isActive ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Stresi Sonlandır</span>
                    </>
                  ) : (
                    <>
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      <span>Senaryoyu Tetikle</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Jüriye Canlı Akış Gösterimi İpucu */}
      <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-cyan-300 font-semibold">Jüri Sunumu Tavsiyesi: </strong>
          Yukarıdaki senaryolardan birini (örn: <em>"Mesai Dışı Hayalet Yük Sızıntısı"</em>) tetikleyin. 
          Ardından doğrudan <strong>Komuta Merkezi</strong> veya <strong>AI Karar Motoru</strong> sekmesine geçin. 
          Telemetrideki kırmızı sıçramayı ve AETHER Yapay Zekası'nın anında oluşturduğu optimizasyon kartını canlı olarak gösterin!
        </div>
      </div>

    </div>
  );
};
