import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Activity, ShieldCheck, Zap } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const PowerFlowChart: React.FC = () => {
  const { history, metrics } = useTelemetry();

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800/90 shadow-xl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              Gerçek Zamanlı Enerji Akışı: Öncesi vs. AETHER Müdahalesi
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Akıllı Sayaç (Smart Meter) frekans dalga boyu ve dinamik tasarruf delta eğrisi
          </p>
        </div>

        {/* Göstergeler */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80 border border-rose-400" />
            <span className="text-slate-300">Öncesi (Baseline): </span>
            <span className="text-rose-400 font-bold">{metrics.baselinePowerKw.toFixed(1)} kW</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 border border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-slate-300">AETHER Optimize: </span>
            <span className="text-emerald-400 font-bold">{metrics.currentPowerKw.toFixed(1)} kW</span>
          </div>
        </div>
      </div>

      {/* Recharts Area Container */}
      <div className="h-72 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {/* Actual Power Emerald Gradient */}
              <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
              </linearGradient>

              {/* Baseline Rose Gradient */}
              <linearGradient id="baselineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            
            <XAxis 
              dataKey="timeLabel" 
              stroke="#64748b" 
              fontSize={11} 
              tickLine={false} 
              axisLine={{ stroke: '#334155' }} 
            />
            
            <YAxis 
              stroke="#64748b" 
              fontSize={11} 
              tickLine={false} 
              axisLine={{ stroke: '#334155' }}
              unit=" kW"
              domain={['auto', 'auto']}
            />

            <Tooltip 
              contentStyle={{
                backgroundColor: '#0a101d',
                borderColor: '#1e293b',
                borderRadius: '0.75rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7)',
                color: '#f8fafc',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}
              formatter={(value: any, name: any) => {
                if (name === 'actualKw') return [`${Number(value).toFixed(2)} kW`, 'AETHER Optimize'];
                if (name === 'baselineKw') return [`${Number(value).toFixed(2)} kW`, 'Öncesi (Baz)'];
                if (name === 'savedKw') return [`${Number(value).toFixed(2)} kW`, 'Engellenen Güç'];
                return [value, name];
              }}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
            />

            {/* Baseline Tüketim (Öncesi / AETHER olmasaydı) */}
            <Area
              type="monotone"
              dataKey="baselineKw"
              stroke="#f43f5e"
              strokeWidth={2}
              strokeDasharray="4 4"
              fillOpacity={1}
              fill="url(#baselineGradient)"
              name="baselineKw"
              isAnimationActive={false}
            />

            {/* Gerçek Optimize Tüketim (AETHER Etkisi) */}
            <Area
              type="monotone"
              dataKey="actualKw"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#actualGradient)"
              name="actualKw"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Alt Bilgi İpuçları */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
        <div className="flex items-center gap-1 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>NILM Algoritması: Harmonik ayrıştırma sıfır fiziksel alt sayaçla devrede</span>
        </div>
        <div>
          Anlık Tasarruf Delta: <strong className="text-cyan-300">{(metrics.baselinePowerKw - metrics.currentPowerKw).toFixed(1)} kW</strong>
        </div>
      </div>

    </div>
  );
};
