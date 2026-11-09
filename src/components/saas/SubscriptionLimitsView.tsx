import React, { useState } from 'react';
import { 
  CreditCard, 
  Check, 
  Sparkles, 
  Gauge, 
  ShieldCheck, 
  ExternalLink,
  Zap,
  ArrowRight
} from 'lucide-react';
import { SubscriptionTier, TenantContext } from '../../types/saas';
import { aetherApiClientInstance } from '../../services/api/aetherApiClient';

interface SubscriptionProps {
  context: TenantContext;
}

export const SubscriptionLimitsView: React.FC<SubscriptionProps> = ({ context }) => {
  const [org, setOrg] = useState(() =>
    aetherApiClientInstance.getOrganization(context.tenantId)
  );

  const homes = aetherApiClientInstance.listHomes(context);
  const totalDevices = homes.reduce((acc, h) => acc + aetherApiClientInstance.countDevices(context.tenantId, h.id), 0);

  const plan = org?.plan || aetherApiClientInstance.getSubscription(context.tenantId);

  const handleUpgrade = (tier: SubscriptionTier) => {
    aetherApiClientInstance.upgradeSubscription(context.tenantId, tier);
    setOrg(aetherApiClientInstance.getOrganization(context.tenantId));
  };

  const tiers: {
    id: SubscriptionTier;
    name: string;
    price: string;
    description: string;
    maxHomes: number;
    maxDevices: number;
    resolution: string;
    features: string[];
    isPopular?: boolean;
  }[] = [
    {
      id: 'STARTER_HOME',
      name: 'Starter Home (Ücretsiz / Deneme)',
      price: '0 TL / ay',
      description: 'Tekil daire veya müstakil ev için temel enerji takibi ve fatura analizi.',
      maxHomes: 1,
      maxDevices: 3,
      resolution: '60 Saniye',
      features: [
        '1 Konut / Mülk Desteği',
        'Maksimum 3 Cihaz / Sayaç',
        'Temel NILM Ayrıştırması',
        'Günde 10 Gemini AI Kararı',
        '30 Günlük Veri Saklama',
      ],
    },
    {
      id: 'SMART_RESIDENCE',
      name: 'Smart Residence (Pro)',
      price: '249 TL / ay',
      description: 'Çoklu konut, villa veya gelişmiş akıllı ev otomasyonu için profesyonel sürüm.',
      maxHomes: 5,
      maxDevices: 25,
      resolution: '1 Hz (Saniyelik)',
      isPopular: true,
      features: [
        '5 Konuta Kadar Eşzamanlı Takip',
        '25 Adet Cihaz & Alt Sayaç',
        '1 Hz Canlı Telemetri & WebSocket',
        'Tam 6-Kategori NILM Ayrıştırması',
        'Günde 500 Gemini AI Kararı',
        '2 Yıl Veri Saklama & KVKK Dışa Aktarma',
      ],
    },
    {
      id: 'ESTATE_ENTERPRISE',
      name: 'Estate Enterprise (Kurumsal)',
      price: '1.450 TL / ay',
      description: 'Siteler, toplu konut yönetimleri, rezidanslar ve ticari kampüsler için.',
      maxHomes: 9999,
      maxDevices: 9999,
      resolution: 'Sub-Second (10 Hz)',
      features: [
        'Sınırsız Konut & Tesis',
        'Sınırsız Cihaz & CT Clamp',
        'Özel Tahsisli Gemini 2.5 LLM',
        'COP31 Resmi Denetçi Raporu',
        'Öncelikli SLA & Telefon Desteği',
        '10 Yıl Blokzincir Doğrulamalı Arşiv',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/90 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Abonelik Paketleri, Kullanım Kotaları & Yetkiler
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Aktif planınız: <strong className="text-cyan-300">{plan.tier}</strong> (Dönem Sonu: {new Date(plan.currentPeriodEnd).toLocaleDateString('tr-TR')})
            </p>
          </div>
        </div>

        {/* Quota Progress Bars */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Konut Kullanımı:</span>
              <span className="text-white font-bold">{homes.length} / {plan.maxHomes >= 999 ? '∞' : plan.maxHomes}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full"
                style={{ width: `${Math.min(100, (homes.length / (plan.maxHomes || 1)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Bağlı Cihazlar:</span>
              <span className="text-white font-bold">{totalDevices} / {plan.maxDevicesPerHome >= 999 ? '∞' : plan.maxDevicesPerHome}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, (totalDevices / (plan.maxDevicesPerHome || 1)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Gemini AI Günlük Çağrı:</span>
              <span className="text-white font-bold">{plan.usedGeminiCallsToday} / {plan.geminiCallsPerDay}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${Math.min(100, (plan.usedGeminiCallsToday / (plan.geminiCallsPerDay || 1)) * 100)}%` }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {tiers.map((t) => {
          const isCurrent = plan.tier === t.id;
          return (
            <div
              key={t.id}
              className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                isCurrent
                  ? 'bg-cyan-950/30 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                  : t.isPopular
                  ? 'glass-panel border-cyan-500/30 shadow-lg'
                  : 'glass-panel border-slate-800/90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-mono font-bold text-white">{t.name}</span>
                  {t.isPopular && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700">
                      ÖNERİLEN
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold">
                      MEVCUT PLAN
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-2xl font-extrabold font-mono text-white">{t.price}</div>
                  <p className="text-xs text-slate-400 mt-1.5 font-sans leading-relaxed">{t.description}</p>
                </div>

                <ul className="mt-5 space-y-2.5 text-xs font-mono text-slate-300">
                  {t.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                {isCurrent ? (
                  <div className="w-full text-center py-2 text-xs font-mono text-emerald-400 font-bold">
                    Aktif Olarak Kullanılıyor
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(t.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 text-xs font-mono font-bold transition-all cursor-pointer border border-slate-700 hover:border-cyan-500"
                  >
                    <span>Bu Plana Yükselt</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
