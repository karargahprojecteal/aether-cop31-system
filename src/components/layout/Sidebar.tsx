import React from 'react';
import { 
  LayoutDashboard, 
  BrainCircuit, 
  Sliders, 
  FileCheck2, 
  Layers,
  Cpu,
  Building2,
  CreditCard,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useDecisions } from '../../context/DecisionContext';
import { useTelemetry } from '../../context/TelemetryContext';

export type NavTab = 
  | 'dashboard' 
  | 'energy-intelligence' 
  | 'marketplace' 
  | 'device-registry' 
  | 'ai-engine' 
  | 'stress-test' 
  | 'cop31-report' 
  | 'organization' 
  | 'subscription' 
  | 'privacy-security';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  homeName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, homeName }) => {
  const { state } = useDecisions();
  const { scenarios, metrics } = useTelemetry();

  const pendingDecisionsCount = state.decisions.filter(d => d.status === 'PENDING_APPROVAL').length;
  const activeScenariosCount = scenarios.filter(s => s.isActive).length;

  const coreModules = [
    {
      id: 'dashboard' as NavTab,
      label: 'Komuta Merkezi',
      description: 'Canlı telemetri & enerji akışı',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'energy-intelligence' as NavTab,
      label: 'Enerji Zekası & NILM',
      description: 'Ayrıştırma & Hayalet yük avı',
      icon: Zap,
      badge: null,
    },
    {
      id: 'ai-engine' as NavTab,
      label: 'AI Karar Motoru',
      description: 'Gemini 2.5 otonom optimizasyon',
      icon: BrainCircuit,
      badge: pendingDecisionsCount > 0 ? `${pendingDecisionsCount} Bekleyen` : null,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    },
    {
      id: 'stress-test' as NavTab,
      label: 'What-If Simülatörü',
      description: 'Jüri senaryo & stres paneli',
      icon: Sliders,
      badge: activeScenariosCount > 0 ? `${activeScenariosCount} Aktif` : null,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse',
    },
    {
      id: 'cop31-report' as NavTab,
      label: 'COP31 Karbon Karnesi',
      description: 'Denetlenebilir CO2e muhasebesi',
      icon: FileCheck2,
      badge: `${metrics.savedCo2KgToday.toFixed(0)} kg CO2e`,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
  ];

  const integrationModules = [
    {
      id: 'marketplace' as NavTab,
      label: 'Entegrasyon Pazaryeri',
      description: '5 Farklı konut bağlantı yolu',
      icon: Layers,
      badge: '5 Model',
      badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-700',
    },
    {
      id: 'device-registry' as NavTab,
      label: 'Sayaç & Cihaz Kaydı',
      description: 'Bağlı donanımlar & mTLS',
      icon: Cpu,
      badge: null,
    },
  ];

  const saasModules = [
    {
      id: 'organization' as NavTab,
      label: 'Ekip & Roller (RBAC)',
      description: 'Çoklu kullanıcı yetkilendirme',
      icon: Building2,
      badge: null,
    },
    {
      id: 'subscription' as NavTab,
      label: 'Abonelik & Kotalar',
      description: 'Planlar ve kullanım limitleri',
      icon: CreditCard,
      badge: null,
    },
    {
      id: 'privacy-security' as NavTab,
      label: 'KVKK & Gizlilik',
      description: 'Veri indirme & hesap silme',
      icon: ShieldCheck,
      badge: null,
    },
  ];

  const renderNavGroup = (title: string, items: typeof coreModules) => (
    <div className="space-y-1.5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-3 pt-2">
        {title}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              isActive
                ? 'bg-gradient-to-r from-cyan-950/60 to-slate-900 border-cyan-500/40 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg border ${
                isActive 
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
                  : 'bg-slate-800/40 border-slate-700/50 text-slate-400'
              }`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-semibold leading-tight">{item.label}</div>
                <div className="text-[10px] text-slate-500 leading-tight">{item.description}</div>
              </div>
            </div>

            {item.badge && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${item.badgeColor || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className="w-64 shrink-0 hidden md:flex flex-col border-r border-slate-800/80 bg-[#0a0f1a]/85 backdrop-blur-xl p-3 justify-between overflow-y-auto">
      
      <div className="space-y-4">
        {renderNavGroup('Operasyonel Komuta', coreModules)}
        {renderNavGroup('Konut & Donanım Entegrasyonu', integrationModules)}
        {renderNavGroup('SaaS & Güvenlik Yönetimi', saasModules)}
      </div>

      {/* Alt Bilgi & Tesis Profili Kartı */}
      <div className="mt-4 p-3 rounded-xl border border-slate-800/90 bg-slate-900/50">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
          <span className="truncate max-w-[130px]">{homeName || 'Aktif Konut'}</span>
          <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            1 Hz
          </span>
        </div>
        <div className="space-y-1 text-[11px] font-mono text-slate-400">
          <div className="flex justify-between">
            <span className="text-slate-500">Tarife:</span>
            <span className="text-slate-200">EPDK 3-Zamanlı</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">AETHER Tasarruf:</span>
            <span className="text-emerald-400 font-bold">%{metrics.instantSavingPercent} anlık</span>
          </div>
        </div>
      </div>

    </aside>
  );
};
