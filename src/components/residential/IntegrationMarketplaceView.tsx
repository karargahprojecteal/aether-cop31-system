import React, { useState } from 'react';
import { 
  Radio, 
  Cpu, 
  Layers, 
  Zap, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Lock, 
  ArrowRight,
  ExternalLink,
  Plus
} from 'lucide-react';
import { IntegrationPathway } from '../../types/residential';

interface IntegrationMarketplaceProps {
  onSelectPathway: (pathway: IntegrationPathway) => void;
  onOpenManualBill: () => void;
}

export const IntegrationMarketplaceView: React.FC<IntegrationMarketplaceProps> = ({
  onSelectPathway,
  onOpenManualBill,
}) => {
  const pathways = [
    {
      id: 'LOCAL_GATEWAY' as IntegrationPathway,
      title: 'AETHER Yerel IoT Gateway (CT Clamp Kiti)',
      badge: 'TÜRKİYE KONUTLARI İÇİN EN UYGUN',
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-500/50',
      difficulty: 'ORTA (Sıfır Kablo Kesme)',
      difficultyColor: 'text-amber-400',
      frequency: '1 Hz (Saniyede 1 Paket)',
      hardware: '1x Split-Core CT Akım Trafosu + ESP32 Wi-Fi Ağ Geçidi (~35-65 USD)',
      permissions: 'Daire içi sigorta kutusuna klemens kesmeden mandallama izni',
      turkeyStatus: 'TAM UYUMLU (%95)',
      description: 'Daire içi elektrik panosundaki ana faz kablosuna harici olarak takılır. Binanın bodrumuna inmeye veya dağıtım şirketinden izin almaya gerek kalmadan anlık 1 Hz enerji tüketimini güvenli MQTT ile aktarır.',
      actionLabel: 'Gateway Eşleştirme Kodu Al',
    },
    {
      id: 'HOME_ASSISTANT' as IntegrationPathway,
      title: 'Home Assistant & Mevcut Enerji Monitörü',
      badge: 'AKILLI EV ENTEGRASYONU',
      badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-500/50',
      difficulty: 'KOLAY (Yazılımsal Token)',
      difficultyColor: 'text-emerald-400',
      frequency: 'Canlı Event Push / 5 Saniye',
      hardware: 'Evde kurulu Home Assistant, Shelly 3EM veya Emporia Vue',
      permissions: 'Home Assistant Long-Lived Access Token (LLAT)',
      turkeyStatus: 'TAM UYUMLU (%80)',
      description: 'Evinizde zaten kurulu olan akıllı ev sistemine tek bir API token ile bağlanarak mevcut elektrik panosu sayaçlarını doğrudan AETHER sinir sistemine bağlar.',
      actionLabel: 'Home Assistant Bağla',
    },
    {
      id: 'SMART_PLUG' as IntegrationPathway,
      title: 'Akıllı Priz & Cihaz Bazlı Alt Sayaç',
      badge: 'CİHAZ ÖLÇÜMÜ (SUB-METER)',
      badgeColor: 'bg-purple-950 text-purple-300 border-purple-500/50',
      difficulty: 'ÇOK KOLAY (Tak-Çalıştır)',
      difficultyColor: 'text-emerald-400',
      frequency: '1 Saniye - 10 Saniye',
      hardware: 'Shelly Plus Plug S, Tuya veya Tasmota Akıllı Priz (~12-25 USD)',
      permissions: 'Yerel IP veya Tuya/Shelly API izni',
      turkeyStatus: 'TAM UYUMLU (%100)',
      description: 'Klima, buzdolabı veya çamaşır makinesine takılan akıllı prizlerden anlık tüketim çeker. Veri strictly "Alt Sayaç (SUB_METERED)" olarak etiketlenir, ana sayaçla karıştırılmaz.',
      actionLabel: 'Akıllı Priz Eşleştir',
    },
    {
      id: 'SMART_METER' as IntegrationPathway,
      title: 'Akıllı Sayaç (Optik Göz / P1 Portu)',
      badge: 'DOĞRUDAN DAĞITIM SAYACI',
      badgeColor: 'bg-blue-950 text-blue-300 border-blue-500/50',
      difficulty: 'KOLAY - ORTA (Manyetik Prob)',
      difficultyColor: 'text-cyan-400',
      frequency: '1 Saniye - 10 Saniye',
      hardware: 'IEC 62056-21 Manyetik Optik Okuma Probu veya P1 RJ12 Dongle',
      permissions: 'Sayaca fiziksel erişim izni (Müstakil veya Sayaç Odası)',
      turkeyStatus: 'KOŞULLU UYUMLU (%35 - Müstakil & Erişilebilir Panolar)',
      description: 'Köhler, Luna veya Makel elektronik sayaçların üzerindeki optik porta manyetik olarak yapışır. Sayaçtan doğrudan OBIS kodlu resmi tüketim indeksini (1.8.0, 1.7.0) çeker.',
      actionLabel: 'Optik Sayaç Eşleştir',
    },
    {
      id: 'MANUAL_INVOICE' as IntegrationPathway,
      title: 'Manuel & Aylık Fatura Başlangıcı',
      badge: 'SIFIR DONANIM GEREKLİ',
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-600',
      difficulty: 'SIFIR ZORLUK (Hemen Başla)',
      difficultyColor: 'text-emerald-400',
      frequency: 'Aylık Fatura Dönemi',
      hardware: 'Hiçbir cihaz gerekmez (0 TL CapEx)',
      permissions: 'Elektrik faturasındaki kWh ve tutar bilgisi',
      turkeyStatus: 'EVRENSEL (%100 Her Konutta Çalışır)',
      description: 'Mekanik sayacı olan veya sayacı kilitli bodrumda bulunan evler için anında başlangıç imkanı. Aylık tüketim, tarife analizi ve COP31 karbon ayak izi hesabını gecikmesiz başlatır.',
      actionLabel: 'Fatura Girişi Yap',
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/90 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
                <Layers className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Konut Donanım & Entegrasyon Pazaryeri
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                Hardware-Agnostic HAL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              AETHER tek bir sayaç modeline bağımlı değildir. Evinizin sayaç durumuna göre en uygun entegrasyon yöntemini seçin, güvenli eşleştirme koduyla saniyeler içinde bağlayın.
            </p>
          </div>
        </div>
      </div>

      {/* Pathways Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pathways.map((item) => (
          <div
            key={item.id}
            className="glass-panel rounded-2xl p-5 border border-slate-800/90 hover:border-cyan-500/40 transition-all shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${item.badgeColor}`}>
                  {item.badge}
                </span>
                <span className={`text-xs font-mono font-semibold ${item.difficultyColor}`}>
                  {item.difficulty}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white mt-3 tracking-wide flex items-center gap-2">
                {item.title}
              </h3>

              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                {item.description}
              </p>

              <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5 text-[11px] font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gerekli Donanım:</span>
                  <span className="text-slate-200 text-right truncate max-w-[200px]">{item.hardware}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ölçüm Frekansı:</span>
                  <span className="text-cyan-300">{item.frequency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Türkiye Uyumluluğu:</span>
                  <span className="text-emerald-400 font-semibold">{item.turkeyStatus}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">
                {item.id === 'MANUAL_INVOICE' ? 'Fatura Odaklı' : 'mTLS Şifreli İletişim'}
              </span>

              <button
                onClick={() => {
                  if (item.id === 'MANUAL_INVOICE') {
                    onOpenManualBill();
                  } else {
                    onSelectPathway(item.id);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs font-mono transition-all cursor-pointer shadow-md shadow-cyan-950"
              >
                <span>{item.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
