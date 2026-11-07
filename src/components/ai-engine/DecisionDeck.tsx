import React, { useState } from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  RefreshCw, 
  ShieldCheck, 
  History, 
  Code2, 
  Cpu, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useDecisions } from '../../context/DecisionContext';
import { useTelemetry } from '../../context/TelemetryContext';
import { ActionCard } from './ActionCard';

export const DecisionDeck: React.FC = () => {
  const { 
    state, 
    toggleAutonomousMode, 
    applyDecision, 
    dismissDecision, 
    triggerAnalysis,
    auditTrail 
  } = useDecisions();
  const { telemetry } = useTelemetry();
  const [activeSubTab, setActiveSubTab] = useState<'decisions' | 'audit' | 'inspector'>('decisions');

  const pendingDecisions = state.decisions.filter(d => d.status === 'PENDING_APPROVAL');
  const executedDecisions = state.decisions.filter(d => d.status === 'APPLIED' || d.status === 'AUTONOMOUSLY_EXECUTED');

  return (
    <div className="space-y-6">
      
      {/* Üst Yönetim Paneli */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800/90 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 via-emerald-500/10 to-transparent border border-cyan-500/40 text-cyan-400">
              <BrainCircuit className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  AETHER Otonom Karar ve Optimizasyon Motoru
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Gemini 2.5 Flash SDK
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Akıllı sayaç harmonik verilerini meteoroloji ve şebeke tarifesiyle çapraz analiz ederek otonom müdahale kararları üretir.
              </p>
            </div>
          </div>

          {/* Aksiyon Butonları */}
          <div className="flex items-center gap-3">
            
            {/* Otonom Mod Düğmesi */}
            <button
              onClick={toggleAutonomousMode}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold border transition-all cursor-pointer ${
                state.isAutonomousMode
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${state.isAutonomousMode ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>OTONOM DÖNGÜ:</span>
              <span className={state.isAutonomousMode ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                {state.isAutonomousMode ? 'AKTİF (Oto-Uygula)' : 'MANUEL ONAY'}
              </span>
            </button>

            {/* Yeniden Analiz Et Butonu */}
            <button
              onClick={() => triggerAnalysis()}
              disabled={state.isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold text-white bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 shadow-md shadow-cyan-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${state.isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{state.isAnalyzing ? 'Analiz Sürüyor...' : 'Şimdi Analiz Et'}</span>
            </button>

          </div>

        </div>

        {/* İstatistik Çubuğu */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div>
            Son Analiz: <span className="text-white font-bold">{state.lastAnalysisTimestamp || 'Canlı Akışta'}</span>
          </div>
          <div>
            Bekleyen Kararlar: <span className="text-cyan-400 font-bold">{pendingDecisions.length}</span>
          </div>
          <div>
            Devredeki Müdahaleler: <span className="text-emerald-400 font-bold">{executedDecisions.length}</span>
          </div>
          <div>
            Toplam Otonom Aksiyon: <span className="text-amber-400 font-bold">{state.totalAutonomousActionsTaken} adet</span>
          </div>
        </div>

      </div>

      {/* Alt Sekmeler (Kararlar / Denetim İzi / JSON Denetleyici) */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('decisions')}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
            activeSubTab === 'decisions'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Aksiyon Kartları ({pendingDecisions.length + executedDecisions.length})
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
            activeSubTab === 'audit'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Otonom Denetim İzi ({auditTrail.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('inspector')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
            activeSubTab === 'inspector'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Gemini Schema Denetleyicisi</span>
        </button>
      </div>

      {/* 1. Aksiyon Kartları Görünümü */}
      {activeSubTab === 'decisions' && (
        <div className="space-y-4">
          {state.decisions.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-slate-800/80 bg-slate-900/40">
              <Sparkles className="w-8 h-8 text-cyan-400 mx-auto animate-pulse" />
              <h3 className="text-sm font-bold text-white mt-2">Enerji Tüketimi Şu Anda Optimum Seviyede</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Yapay Zeka Karar Motoru telemetri akışını dinlemeye devam ediyor. Herhangi bir hayalet yük veya şebeke pik dalgası tespit edildiğinde burada anında aksiyon kartı oluşturulacaktır.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {state.decisions.map((decision) => (
                <ActionCard
                  key={decision.id}
                  decision={decision}
                  onApply={(id) => applyDecision(id, false)}
                  onDismiss={dismissDecision}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Otonom Denetim İzi (Audit Trail) */}
      {activeSubTab === 'audit' && (
        <div className="glass-panel rounded-2xl p-5 border border-slate-800/90 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white">COP31 Denetlenebilir Otonom Müdahale Kütüğü</h3>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tüm Aksiyonlar Şifreli ve İmzalı
            </span>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                  <th className="py-2 px-3">Zaman</th>
                  <th className="py-2 px-3">Aksiyon Başlığı</th>
                  <th className="py-2 px-3">Komut Kodu</th>
                  <th className="py-2 px-3 text-right">Güç Tasarrufu</th>
                  <th className="py-2 px-3 text-right">Engellenen CO2e</th>
                  <th className="py-2 px-3 text-center">Yürütme Modu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {auditTrail.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 text-slate-300">
                    <td className="py-2.5 px-3 text-slate-400">{log.timestamp}</td>
                    <td className="py-2.5 px-3 font-semibold text-white">{log.decisionTitle}</td>
                    <td className="py-2.5 px-3 text-cyan-400">{log.action}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">-{log.kwReduction} kW</td>
                    <td className="py-2.5 px-3 text-right text-emerald-300">-{log.co2ReductionKg} kg</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        log.mode === 'AUTONOMOUS'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-cyan-950 text-cyan-300 border-cyan-700'
                      }`}>
                        {log.mode === 'AUTONOMOUS' ? 'OTONOM' : 'MANUEL ONAY'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Gemini Schema Denetleyicisi */}
      {activeSubTab === 'inspector' && (
        <div className="glass-panel rounded-2xl p-5 border border-slate-800/90 shadow-xl space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Canlı Gemini Yapılandırılmış JSON Veri Hattı</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Sensör ve NILM telemetri verilerinin modele aktarılan canlı JSON şeması ve dönen karar çıktısı
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-mono text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Modele Beslenen Telemetri Paketi:</span>
                <span className="text-cyan-400">1 Hz Canlı Veri</span>
              </div>
              <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 max-h-96 overflow-y-auto">
                {JSON.stringify(telemetry, null, 2)}
              </pre>
            </div>

            <div>
              <div className="text-xs font-mono text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Gemini API Yapılandırılmış Çıktısı (JSON Schema):</span>
                <span className="text-emerald-400">Uygulanan Model</span>
              </div>
              <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 max-h-96 overflow-y-auto">
                {JSON.stringify(state.decisions, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
