import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Zap, 
  Leaf, 
  DollarSign, 
  Cpu, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { AIDecision } from '../../types/decisions';

interface ActionCardProps {
  decision: AIDecision;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ decision, onApply, onDismiss }) => {
  const [showPayload, setShowPayload] = useState(false);

  const isExecuted = decision.status === 'APPLIED' || decision.status === 'AUTONOMOUSLY_EXECUTED';
  const isDismissed = decision.status === 'DISMISSED';

  const priorityStyles = {
    CRITICAL: 'bg-rose-950/60 text-rose-300 border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.2)]',
    HIGH: 'bg-amber-950/60 text-amber-300 border-amber-500/60',
    MEDIUM: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50',
    LOW: 'bg-slate-900 text-slate-400 border-slate-700',
  };

  const anomalyLabels: Record<string, string> = {
    PHANTOM_LOAD: 'HAYALET TÜKETİM AVCI (Phantom Load)',
    PEAK_SURGE: 'PİK YÜK TIRAŞLAMA (Peak Shaving)',
    SOLAR_DIP: 'GÜNEŞ ÇÖKÜŞÜ TELAFİSİ',
    GRID_CARBON_HIGH: 'ŞEBEKE KARBON TAVANI',
    THERMAL_STRESS: 'TERMAL STRES & ATALET',
    SYSTEM_OPTIMAL: 'SİSTEM OPTİMUM',
  };

  return (
    <div className={`rounded-2xl border transition-all p-5 ${
      isExecuted
        ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
        : isDismissed
        ? 'bg-slate-900/30 border-slate-800 opacity-50'
        : 'glass-panel border-slate-800/90 hover:border-cyan-500/40 shadow-xl'
    }`}>
      
      {/* Üst Başlık & Rozetler */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${priorityStyles[decision.priority]}`}>
            {decision.priority}
          </span>
          <span className="text-xs font-mono text-cyan-400 font-semibold">
            {anomalyLabels[decision.anomalyType] || decision.anomalyType}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1 text-slate-400">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Güven: %{decision.confidenceScore}</span>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-500">
            {decision.source === 'GEMINI_AI' ? 'Gemini 2.5 AI' : 'AETHER Kural Motoru'}
          </span>
        </div>
      </div>

      {/* Aksiyon Başlığı ve Teşhis */}
      <div className="mt-3">
        <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
          {decision.title}
        </h3>
        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
          <strong className="text-cyan-300">Teşhis & Kök Neden: </strong>
          {decision.diagnosis}
        </p>
      </div>

      {/* Önerilen Müdahale */}
      <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-emerald-300 leading-relaxed flex items-start gap-2">
        <Cpu className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">Önerilen Otonom Müdahale: </span>
          <span>{decision.recommendedAction}</span>
        </div>
      </div>

      {/* Projeksiyon Kartları: kWh, CO2e, Maliyet */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center font-mono">
        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Tasarruf Gücü</div>
          <div className="text-xs font-bold text-white mt-0.5">
            -{decision.commandPayload.estimatedKwReduction} kW
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">COP31 CO2e</div>
          <div className="text-xs font-bold text-emerald-400 mt-0.5">
            -{decision.projectedCo2ReductionKg} kg
          </div>
        </div>

        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Mali Kazanç</div>
          <div className="text-xs font-bold text-amber-400 mt-0.5">
            +{decision.projectedCostSavingTry} TL
          </div>
        </div>
      </div>

      {/* Komut Yükü (Command Payload) Akordeonu */}
      <div className="mt-3">
        <button
          onClick={() => setShowPayload(!showPayload)}
          className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 hover:text-cyan-300 py-1 transition-colors cursor-pointer"
        >
          <span>Bina Otomasyon Komut Yükü (JSON Payload)</span>
          {showPayload ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showPayload && (
          <pre className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto">
            {JSON.stringify(decision.commandPayload, null, 2)}
          </pre>
        )}
      </div>

      {/* Aksiyon Butonları & Durum */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
        {isExecuted ? (
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-semibold">
              {decision.status === 'AUTONOMOUSLY_EXECUTED' ? 'OTONOM OLARAK UYGULANDI' : 'ONAYLANDI VE UYGULANDI'}
            </span>
            <span className="text-slate-500 text-[11px] hidden sm:inline">
              (Telemetriye yansıtıldı)
            </span>
          </div>
        ) : isDismissed ? (
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
            <XCircle className="w-4 h-4" />
            <span>Kullanıcı tarafından reddedildi</span>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between gap-3">
            <button
              onClick={() => onDismiss(decision.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              Yoksay
            </button>

            <button
              onClick={() => onApply(decision.id)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-semibold text-white bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 shadow-md shadow-cyan-900/30 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Onayla ve Otonom Uygula</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
