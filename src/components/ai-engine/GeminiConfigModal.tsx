import React, { useState } from 'react';
import { X, Sparkles, Key, CheckCircle, ShieldAlert, Cpu, ExternalLink } from 'lucide-react';
import { useDecisions } from '../../context/DecisionContext';

interface GeminiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeminiConfigModal: React.FC<GeminiConfigModalProps> = ({ isOpen, onClose }) => {
  const { apiKey, setApiKey, hasValidApiKey, triggerAnalysis, state } = useDecisions();
  const [keyInput, setKeyInput] = useState(apiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setApiKey(keyInput.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-700/80 bg-[#0d131f] p-6 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Google Gemini Karar Motoru Entegrasyonu
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Model: <span className="text-cyan-400">gemini-2.5-flash</span> (Structured Output)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Durum Açıklaması */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Motor Çalışma Modu:</span>
            <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full border ${
              hasValidApiKey
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                : 'bg-amber-950/60 text-amber-300 border-amber-500/50'
            }`}>
              {hasValidApiKey ? 'CANLI GEMINI API AKTİF' : 'AETHER DAHİLİ KURAL MOTORU AKTİF'}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {hasValidApiKey
              ? 'Canlı Gemini 2.5 Flash modeli telemetri verilerini doğrudan analiz ederek yapılandırılmış JSON schema formatında otonom aksiyonlar üretmektedir.'
              : 'API anahtarı girilmediğinde sistem, jüri sunumunun kesintiye uğramaması için AETHER fizik temelli yerel kural motoruyla (Deterministic NILM Engine) kararlar üretmeye devam eder.'}
          </p>
        </div>

        {/* Input */}
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-mono text-slate-400">
            Gemini API Anahtarı (Google AI Studio):
          </label>
          <div className="relative">
            <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="password"
              placeholder="AIzaSy..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            API anahtarı tarayıcınızın yerel depolama alanında (localStorage) güvenle saklanır ve sadece model çağrılarında kullanılır.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={() => {
              triggerAnalysis();
            }}
            disabled={state.isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>{state.isAnalyzing ? 'Analiz Ediliyor...' : 'Test Analizi Tetikle'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Kapat
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 shadow-lg shadow-cyan-900/30 transition-all cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{savedSuccess ? 'Kaydedildi!' : 'Kaydet ve Uygula'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
