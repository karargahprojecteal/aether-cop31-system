import React from 'react';
import { Radio, Zap, Activity, Thermometer, Droplets, Sun, Users } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const LiveTelemetryTicker: React.FC = () => {
  const { telemetry } = useTelemetry();

  if (!telemetry) return null;

  return (
    <div className="glass-panel rounded-2xl p-4 border border-slate-800/90 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        
        {/* Frekans Dinleyici (Frekans & Stabilite) */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Şebeke Frekansı</div>
            <div className="text-white font-bold flex items-center gap-1">
              <span>{telemetry.frequency.toFixed(3)} Hz</span>
              <span className="text-[10px] px-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                STABİL
              </span>
            </div>
          </div>
        </div>

        {/* Voltaj */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Gerilim (RMS)</div>
            <div className="text-white font-bold">{telemetry.voltage.toFixed(1)} V</div>
          </div>
        </div>

        {/* Akım & Güç Faktörü */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Akım / cos φ</div>
            <div className="text-white font-bold">
              {telemetry.current.toFixed(1)} A <span className="text-slate-500">|</span> {telemetry.powerFactor.toFixed(3)}
            </div>
          </div>
        </div>

        {/* Dış Ortam Sıcaklık & Nem */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
            <Thermometer className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Meteoroloji (Dış)</div>
            <div className="text-white font-bold">
              {telemetry.outdoorTempC.toFixed(1)}°C <span className="text-slate-500">|</span> %{telemetry.outdoorHumidityPercent.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Güneş Işınımı & Doluluk */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Doluluk / Işınım</div>
            <div className="text-white font-bold">
              %{telemetry.occupancyRatePercent.toFixed(0)} <span className="text-slate-500">|</span> {telemetry.solarIrradianceWm2} W/m²
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
