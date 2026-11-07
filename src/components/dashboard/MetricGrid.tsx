import React from 'react';
import { 
  Zap, 
  Leaf, 
  Gauge, 
  DollarSign, 
  Ghost,
  ArrowDownRight
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const MetricGrid: React.FC = () => {
  const { telemetry, metrics } = useTelemetry();

  if (!telemetry) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      
      {/* 1. Anlık Güç ve Tasarruf Kartı */}
      <div className="glass-panel rounded-2xl p-4.5 border border-slate-800/90 hover:border-cyan-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
            Anlık Şebeke Çekişi
          </span>
          <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <Zap className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
            {metrics.currentPowerKw.toFixed(1)}
          </span>
          <span className="text-xs font-mono text-slate-400">kW</span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-slate-800/80">
          <span className="text-slate-400">Beklenen Baz:</span>
          <span className="font-mono text-slate-300">{metrics.baselinePowerKw.toFixed(1)} kW</span>
        </div>

        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-slate-400">AETHER Farkı:</span>
          <span className="font-mono text-emerald-400 font-bold flex items-center gap-0.5">
            <ArrowDownRight className="w-3.5 h-3.5" />
            -{metrics.instantSavingKw.toFixed(1)} kW (%{metrics.instantSavingPercent})
          </span>
        </div>
      </div>

      {/* 2. COP31 Karbon Sayacı (Önlenen CO2e) */}
      <div className="glass-panel rounded-2xl p-4.5 border border-slate-800/90 hover:border-emerald-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
            Önlenen Karbon Salımı
          </span>
          <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <Leaf className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold font-mono text-emerald-400 tracking-tight">
            {metrics.savedCo2KgToday.toFixed(1)}
          </span>
          <span className="text-xs font-mono text-slate-400">kg CO2e</span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-slate-800/80">
          <span className="text-slate-400">Şebeke Karbon Yoğunluğu:</span>
          <span className="font-mono text-slate-300">
            {telemetry.gridCarbonIntensityGCo2PerKwh} g/kWh
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-slate-400">Kurtarılan Enerji:</span>
          <span className="font-mono text-emerald-400 font-bold">
            {metrics.savedKwhToday.toFixed(1)} kWh
          </span>
        </div>
      </div>

      {/* 3. Mali Tasarruf & Tarife Optimizasyonu */}
      <div className="glass-panel rounded-2xl p-4.5 border border-slate-800/90 hover:border-amber-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
            Günlük Net Tasarruf
          </span>
          <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold font-mono text-amber-400 tracking-tight">
            {metrics.savedCostTryToday.toFixed(0)}
          </span>
          <span className="text-xs font-mono text-slate-400">TL / gün</span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-slate-800/80">
          <span className="text-slate-400">Anlık Şebeke Tarifesi:</span>
          <span className="font-mono text-slate-300">
            {telemetry.gridElectricityPriceTryPerKwh.toFixed(2)} TL/kWh
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-slate-400">Aylık Projeksiyon:</span>
          <span className="font-mono text-amber-300 font-bold">
            ~{(metrics.savedCostTryToday * 30).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
          </span>
        </div>
      </div>

      {/* 4. AETHER Verimlilik Skoru & Hayalet Yük Oranı */}
      <div className="glass-panel rounded-2xl p-4.5 border border-slate-800/90 hover:border-cyan-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
            AETHER Verimlilik Endeksi
          </span>
          <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <Gauge className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className={`text-3xl font-extrabold font-mono tracking-tight ${
            metrics.efficiencyScore >= 80 ? 'text-emerald-400' : metrics.efficiencyScore >= 60 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            %{metrics.efficiencyScore}
          </span>
          <span className="text-xs font-mono text-slate-400">/ 100</span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-slate-800/80">
          <span className="text-slate-400 flex items-center gap-1">
            <Ghost className="w-3.5 h-3.5 text-rose-400" />
            Hayalet Yük Payı:
          </span>
          <span className={`font-mono font-semibold ${
            metrics.phantomLoadPercent > 20 ? 'text-rose-400 font-bold' : 'text-slate-300'
          }`}>
            %{metrics.phantomLoadPercent} ({telemetry.nilm.phantomLoadKw.toFixed(1)} kW)
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-slate-400">Şebeke Stabilite:</span>
          <span className="font-mono text-cyan-300 font-bold">
            %{metrics.frequencyStabilityPercent} (50 Hz)
          </span>
        </div>
      </div>

    </div>
  );
};
