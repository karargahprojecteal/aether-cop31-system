import React from 'react';
import { 
  LayoutDashboard, 
  BrainCircuit, 
  Sliders, 
  FileCheck2, 
  Activity,
  Layers,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { useDecisions } from '../../context/DecisionContext';
import { useTelemetry } from '../../context/TelemetryContext';

export type NavTab = 'dashboard' | 'ai-engine' | 'stress-test' | 'cop31-report';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { state } = useDecisions();
  const { scenarios, metrics } = useTelemetry();

  const pendingDecisionsCount = state.decisions.filter(d => d.status === 'PENDING_APPROVAL').length;
  const activeScenariosCount = scenarios.filter(s => s.isActive).length;

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Komuta Merkezi',
      description: 'Canlı telemetri & enerji akışı',
      icon: LayoutDashboard,
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

  return (
    <aside className="w-64 shrink-0 hidden md:flex flex-col border-r border-slate-800/80 bg-[#0a0f1a]/80 backdrop-blur-xl p-4 justify-between">
      
      {/* Menü Öğeleri */}
      <div className="space-y-6">
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 px-3">
          Sistem Modülleri
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-950/50 to-slate-900 border-cyan-500/40 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg border ${
                    isActive 
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-400'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold">{item.label}</div>
                    <div className="text-[10px] text-slate-500">{item.description}</div>
                  </div>
                </div>

                {item.badge && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Alt Bilgi & Tesis Profili Kartı */}
      <div className="p-3.5 rounded-xl border border-slate-800/90 bg-slate-900/50">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
          <span>ETKİM SİSTEM DURUMU</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            NOMİNAL
          </span>
        </div>
        <div className="space-y-1.5 text-[11px] font-mono text-slate-400">
          <div className="flex justify-between">
            <span className="text-slate-500">Alan:</span>
            <span className="text-slate-200">14.500 m² (3 Blok)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Sözleşme Gücü:</span>
            <span className="text-slate-200">180 kW Peak</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Çatı GES Kurulu:</span>
            <span className="text-cyan-300">45 kWp</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-800">
            <span className="text-slate-500">AETHER Tasarruf:</span>
            <span className="text-emerald-400 font-bold">%{metrics.instantSavingPercent} anlık</span>
          </div>
        </div>
      </div>

    </aside>
  );
};
