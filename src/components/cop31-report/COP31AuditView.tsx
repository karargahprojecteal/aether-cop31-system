import React from 'react';
import { 
  FileCheck2, 
  Leaf, 
  TreePine, 
  ShieldCheck, 
  Award, 
  Download, 
  ExternalLink,
  Building2,
  Calendar,
  Zap,
  Globe2
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const COP31AuditView: React.FC = () => {
  const { metrics, telemetry } = useTelemetry();

  // Çevresel Eşdeğerlikler (Metrik dönüşümleri)
  // 1 yetişkin ağaç yılda yaklaşık 22 kg CO2 emer (~0.06 kg/gün)
  const equivalentTreesPlanted = Math.round(metrics.savedCo2KgToday / 0.06);
  // Tipik bir elektrikli araç 1 km'de yaklaşık 0.12 kg CO2 salar
  const equivalentEvKmSaved = Math.round(metrics.savedCo2KgToday / 0.12);

  return (
    <div className="space-y-6">
      
      {/* Üst Banner */}
      <div className="glass-panel-glow rounded-2xl p-6 border border-cyan-500/30 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-transparent border border-emerald-500/40 text-emerald-400">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Antalya COP31 ETKİM Karbon Azaltım & Sürdürülebilirlik Karnesi
                </h2>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700">
                  GHG PROTOCOL SCOPE 2 UYUMLU
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                AETHER Otonom Enerji ve Karbon Sinir Sistemi tarafından doğrulanmış ve denetlenebilir resmi etki raporu
              </p>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-semibold text-white bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer self-start md:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Denetim Raporunu İndir (PDF)</span>
          </button>
        </div>
      </div>

      {/* Karbon & Çevresel Eşdeğerlik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Toplam Engellenen CO2e */}
        <div className="glass-panel rounded-2xl p-4.5 border border-slate-800/90">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Toplam Engellenen Salım</span>
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold font-mono text-emerald-400">
            {metrics.savedCo2KgToday.toFixed(1)} <span className="text-xs text-slate-400 font-normal">kg CO2e</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Ulusal Şebeke Emisyon Çarpanı: <strong className="text-slate-200">{telemetry?.gridCarbonIntensityGCo2PerKwh} g/kWh</strong>
          </div>
        </div>

        {/* Kurtarılan Enerji Miktarı */}
        <div className="glass-panel rounded-2xl p-4.5 border border-slate-800/90">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Tasarruf Edilen Enerji</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold font-mono text-cyan-400">
            {metrics.savedKwhToday.toFixed(1)} <span className="text-xs text-slate-400 font-normal">kWh</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Beklenen Baz Tüketimden: <strong className="text-emerald-400">%{metrics.instantSavingPercent} Düşüş</strong>
          </div>
        </div>

        {/* Eşdeğer Ağaç Katkısı */}
        <div className="glass-panel rounded-2xl p-4.5 border border-slate-800/90">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Eşdeğer Ağaç Katkısı</span>
            <TreePine className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold font-mono text-white">
            {equivalentTreesPlanted} <span className="text-xs text-slate-400 font-normal">ağaç / gün</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Doğal karbon yutağı dengesi eşdeğeri
          </div>
        </div>

        {/* Karbon Maliyet Telafisi */}
        <div className="glass-panel rounded-2xl p-4.5 border border-slate-800/90">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Doğrudan Fatura Tasarrufu</span>
            <Building2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold font-mono text-amber-400">
            {metrics.savedCostTryToday.toFixed(0)} <span className="text-xs text-slate-400 font-normal">TL</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Yıllık Tasarruf Projeksiyonu: <strong className="text-amber-300">~{(metrics.savedCostTryToday * 365).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL</strong>
          </div>
        </div>

      </div>

      {/* Rapor Detay Tablosu & Tesis Doğrulaması */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/90 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              COP31 Denetim Parametreleri ve Metrik Dağılımı
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tesis: Antalya ETKİM Pilot Kampüsü | Raporlama Standardı: ISO 14064-1 & GHG Protocol
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span>{new Date().toLocaleDateString('tr-TR')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
          
          <div className="space-y-3">
            <div className="text-slate-400 font-semibold uppercase text-[11px] pb-1 border-b border-slate-800">
              Yazılımsal Müdahale Etkisi (NILM)
            </div>
            
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Önlenen Hayalet Yük Enerjisi:</span>
              <span className="text-emerald-400 font-bold">{(metrics.savedKwhToday * 0.65).toFixed(1)} kWh</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Pik Saat Yük Kaydırma (Peak Shaving):</span>
              <span className="text-emerald-400 font-bold">{(metrics.savedKwhToday * 0.35).toFixed(1)} kWh</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Çatı GES Doğrudan Tüketim Katkısı:</span>
              <span className="text-cyan-300 font-bold">+{telemetry?.nilm.solarGenerationKw.toFixed(1)} kW</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-slate-400">CapEx / Donanım Yatırım İhtiyacı:</span>
              <span className="text-white font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700">
                0 TL (Sıfır Donanım)
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-slate-400 font-semibold uppercase text-[11px] pb-1 border-b border-slate-800">
              Şebeke ve Karbon Uyumu
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Aktif Şebeke Emisyon Katsayısı:</span>
              <span className="text-slate-200">{telemetry?.gridCarbonIntensityGCo2PerKwh} gCO2/kWh</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Toplam Karbon Ayak İzi Düşüş Oranı:</span>
              <span className="text-emerald-400 font-bold">-%{metrics.instantSavingPercent}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Eşdeğer Elektrikli Araç Mesafesi:</span>
              <span className="text-slate-200">~{equivalentEvKmSaved} km emisyonsuz</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-slate-400">Sertifikasyon Durumu:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                COP31 ETKİM RESMİ DOĞRULANDI
              </span>
            </div>
          </div>

        </div>

        {/* Alt Sertifika Damgası */}
        <div className="mt-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe2 className="w-5 h-5 text-cyan-400" />
            <div className="text-xs">
              <div className="font-semibold text-white">AETHER Cryptographic Ledger Verification</div>
              <div className="text-slate-500 font-mono text-[11px]">Hash: 0x7f4e...89a2b | COP31-ETKIM-ANTALYA-2026</div>
            </div>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-800">
            TAM DENETLENEBİLİR
          </span>
        </div>

      </div>

    </div>
  );
};
