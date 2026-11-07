import React from 'react';
import { 
  Cpu, 
  Wind, 
  Lightbulb, 
  Server, 
  Ghost, 
  Factory, 
  Sun,
  ShieldAlert
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const NILMBreakdown: React.FC = () => {
  const { telemetry } = useTelemetry();

  if (!telemetry) return null;

  const nilm = telemetry.nilm;
  const totalLoad = nilm.hvacKw + nilm.lightingKw + nilm.baseLoadKw + nilm.phantomLoadKw + nilm.industrialLoadKw;

  const loadCategories = [
    {
      id: 'hvac',
      label: 'İklimlendirme (HVAC)',
      subtext: 'Chiller, AHU, VAV Üniteleri',
      kw: nilm.hvacKw,
      percent: ((nilm.hvacKw / totalLoad) * 100).toFixed(1),
      icon: Wind,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500',
      barBg: 'bg-cyan-500/20',
    },
    {
      id: 'phantom',
      label: 'Hayalet Yük (Phantom Load)',
      subtext: 'Açık kalan cihazlar, kaçaklar, rölanti',
      kw: nilm.phantomLoadKw,
      percent: ((nilm.phantomLoadKw / totalLoad) * 100).toFixed(1),
      icon: Ghost,
      color: nilm.phantomLoadKw > 15 ? 'text-rose-400' : 'text-amber-400',
      bgColor: nilm.phantomLoadKw > 15 ? 'bg-rose-500' : 'bg-amber-500',
      barBg: nilm.phantomLoadKw > 15 ? 'bg-rose-500/20' : 'bg-amber-500/20',
      alert: nilm.phantomLoadKw > 15 ? 'HEDEF TASARRUF' : undefined,
    },
    {
      id: 'base',
      label: 'Kesintisiz Baz Yük',
      subtext: 'IT altyapısı, sunucu odası, acil sistemler',
      kw: nilm.baseLoadKw,
      percent: ((nilm.baseLoadKw / totalLoad) * 100).toFixed(1),
      icon: Server,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500',
      barBg: 'bg-blue-500/20',
    },
    {
      id: 'industrial',
      label: 'Endüstriyel & Motorlar',
      subtext: 'Hidrofor, asansörler, sirkülasyon',
      kw: nilm.industrialLoadKw,
      percent: ((nilm.industrialLoadKw / totalLoad) * 100).toFixed(1),
      icon: Factory,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500',
      barBg: 'bg-purple-500/20',
    },
    {
      id: 'lighting',
      label: 'Aydınlatma Grupları',
      subtext: 'İç mekan, cephe ve otopark armatürleri',
      kw: nilm.lightingKw,
      percent: ((nilm.lightingKw / totalLoad) * 100).toFixed(1),
      icon: Lightbulb,
      color: 'text-amber-300',
      bgColor: 'bg-amber-400',
      barBg: 'bg-amber-400/20',
    },
  ];

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800/90 shadow-xl">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              Yazılımsal Yük Ayrıştırma (NILM)
            </h2>
            <p className="text-xs text-slate-400">
              Sıfır ek alt sayaç: Ana sayaç frekans imzasından yapay zeka ayrıştırması
            </p>
          </div>
        </div>

        {/* Çatı GES Üretim Rozeti */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
          <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '10s' }} />
          <span>GES: +{nilm.solarGenerationKw.toFixed(1)} kW</span>
        </div>
      </div>

      {/* Yük Grupları İlerleme Çubukları */}
      <div className="mt-4 space-y-3.5">
        {loadCategories.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                  <span className="font-semibold text-slate-200">{item.label}</span>
                  {item.alert && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 border border-rose-500/50 text-rose-300 font-sans">
                      {item.alert}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-slate-400 font-sans text-[11px] hidden sm:inline">{item.subtext}</span>
                  <span className="font-bold text-white">{item.kw.toFixed(1)} kW</span>
                  <span className="text-slate-500 text-[11px]">(%{item.percent})</span>
                </div>
              </div>

              {/* Bar */}
              <div className={`h-2 w-full rounded-full ${item.barBg} overflow-hidden`}>
                <div
                  className={`h-full rounded-full ${item.bgColor} transition-all duration-500`}
                  style={{ width: `${Math.min(100, Math.max(3, Number(item.percent)))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Alt Özet */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>Toplam Yük Talebi: <strong className="text-white">{totalLoad.toFixed(1)} kW</strong></span>
        <span>Çatı GES Net Ofset: <strong className="text-emerald-400 font-bold">-{nilm.solarGenerationKw.toFixed(1)} kW</strong></span>
      </div>

    </div>
  );
};
