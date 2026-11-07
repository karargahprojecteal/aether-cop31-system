import React from 'react';
import { X, Sparkles, ShieldCheck, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';
import { useDecisions } from '../../context/DecisionContext';

interface GeminiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeminiConfigModal: React.FC<GeminiConfigModalProps> = ({ isOpen, onClose }) => {
  const { hasValidApiKey } = useDecisions();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0d131f] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Glow Header */}
        <div className="relative p-6 border-b border-slate-800 bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-purple-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                <Sparkles className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  AETHER AI Karar Motoru
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                    gemini-2.5-flash
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Sunucu Tarafı Güvenli Kimlik & Otonom Karar Sınırı</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Security Architecture Badge */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-200 space-y-1">
              <p className="font-semibold text-emerald-300">Sıfır İstemci Sızıntısı (Zero-Client Leak Policy)</p>
              <p className="text-slate-300 leading-relaxed">
                AETHER mimarisinde Gemini API kimlik bilgileri asla tarayıcıda (<code className="text-emerald-300">localStorage</code>) saklanmaz. Tüm analizler, kiracı kotası doğrulanmış ve şema korumalı sunucu API uç noktası üzerinden yürütülür.
              </p>
            </div>
          </div>

          {/* Engine Parameters */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Aktif Karar Altyapısı Parametreleri
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Model Servisi</span>
                <span className="font-mono text-cyan-300 font-semibold">Gemini 2.5 Flash</span>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Kimlik Doğrulama</span>
                <div className="flex items-center gap-1.5 font-semibold">
                  {hasValidApiKey ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Server Secret Aktif</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-amber-300">Deterministik Kural Modu</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Devre Kesici (Circuit Breaker)</span>
                <span className="font-mono text-slate-200">3 Hata / 60s Geri Çekilme</span>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Yedek Fallback</span>
                <span className="font-mono text-purple-300">Deterministik Fizik Motoru</span>
              </div>
            </div>
          </div>

          {/* Fallback Engine Info */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-3">
            <Cpu className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-white">Yedek Karar Motoru (AETHER Physics Rules)</p>
              <p className="text-slate-400 leading-relaxed">
                Ağ kesintisi, API kota tükenmesi veya devre kesici durumunda sistem kesintiye uğramaz; anında yerel kural motoruyla (NILM hayalet yük tespiti ve EPDK Puant saatleri optimizasyonu) tam uyumlu kararlar üretmeye devam eder.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
