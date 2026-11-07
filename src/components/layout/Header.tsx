import React, { useState } from 'react';
import { 
  Activity, 
  Cpu, 
  Radio, 
  Zap, 
  Sparkles, 
  Key, 
  AlertTriangle,
  Flame,
  ShieldCheck
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { useDecisions } from '../../context/DecisionContext';

interface HeaderProps {
  onOpenSourceModal: () => void;
  onOpenApiKeyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSourceModal, onOpenApiKeyModal }) => {
  const { mode, providerStatus, scenarios } = useTelemetry();
  const { state, hasValidApiKey, toggleAutonomousMode } = useDecisions();
  const [timeStr, setTimeStr] = React.useState('');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('tr-TR', { hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeScenario = scenarios.find((s) => s.isActive);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#080c14]/90 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        
        {/* Sol: Logo & Tesis Başlığı */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-emerald-500/10 to-transparent border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
            <Zap className="w-5 h-5 text-cyan-400" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-wider text-white">
                AETHER <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">COP31 MVP</span>
              </h1>
              <span className="hidden sm:inline-block text-xs font-mono text-slate-400 border-l border-slate-700 pl-2">
                Otonom Enerji ve Karbon Sinir Sistemi
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Antalya ETKİM Pilot Kampüsü</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500 font-mono text-[11px]">{timeStr}</span>
            </p>
          </div>
        </div>

        {/* Aktif Stres Senaryosu Uyarısı (Eğer Tetiklendiyse) */}
        {activeScenario && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-mono animate-pulse">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>STRES TESTİ: {activeScenario.shortTag}</span>
          </div>
        )}

        {/* Sağ: Kontrol Butonları & Canlı Göstergeler */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Canlı Donanım <-> Simülasyon Geçiş Anahtarı */}
          <button
            onClick={onOpenSourceModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
              mode === 'SIMULATION'
                ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300 hover:border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
            }`}
            title="Veri Kaynağını Değiştir (Simülasyon / Canlı Donanım)"
          >
            <Radio className={`w-3.5 h-3.5 ${mode === 'SIMULATION' ? 'text-cyan-400' : 'text-emerald-400 animate-pulse'}`} />
            <span className="font-semibold">
              {mode === 'SIMULATION' ? 'SİMÜLASYON MODU' : 'CANLI DONANIM'}
            </span>
            <span className="text-[10px] text-slate-400 hidden md:inline">
              ({providerStatus.lastPingMs}ms)
            </span>
          </button>

          {/* Otonom Karar Döngüsü Aç/Kapa Toggle */}
          <button
            onClick={toggleAutonomousMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
              state.isAutonomousMode
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Otonom Yapay Zeka Müdahale Modu"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${state.isAutonomousMode ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="hidden sm:inline font-semibold">OTONOM DÖNGÜ:</span>
            <span className={state.isAutonomousMode ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              {state.isAutonomousMode ? 'AÇIK' : 'MANUEL'}
            </span>
          </button>

          {/* Gemini AI API Konfigürasyon Butonu */}
          <button
            onClick={onOpenApiKeyModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
              hasValidApiKey
                ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:border-slate-500'
            }`}
            title="Gemini API Anahtarı ve Model Durumu"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline text-[11px]">GEMINI 2.5</span>
            <span className={`w-2 h-2 rounded-full ${hasValidApiKey ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          </button>

        </div>
      </div>
    </header>
  );
};
