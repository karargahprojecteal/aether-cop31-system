import React, { useState } from 'react';
import { Home, ChevronDown, Plus, Building2, Check, Shield } from 'lucide-react';
import { HomeProfile } from '../../types/residential';

interface HomeSwitcherProps {
  homes: HomeProfile[];
  activeHome: HomeProfile | null;
  onSelectHome: (home: HomeProfile) => void;
  onOpenAddHome: () => void;
}

export const HomeSwitcher: React.FC<HomeSwitcherProps> = ({
  homes,
  activeHome,
  onSelectHome,
  onOpenAddHome,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-cyan-500/50 text-xs font-mono text-slate-200 transition-all cursor-pointer shadow-sm"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <Home className="w-3.5 h-3.5 text-cyan-400" />
        <span className="font-semibold text-white max-w-[140px] truncate">
          {activeHome?.name || 'Konut Seçin'}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-slate-700/80 bg-[#0d131f] shadow-2xl z-50 p-2 text-xs font-mono">
          <div className="px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
            Kayıtlı Konutlar & Tesisler ({homes.length})
          </div>

          <div className="max-h-60 overflow-y-auto py-1 space-y-1">
            {homes.map((h) => {
              const isSelected = activeHome?.id === h.id;
              return (
                <button
                  key={h.id}
                  onClick={() => {
                    onSelectHome(h);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-800/80'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <div className="truncate">
                      <div className="font-semibold truncate">{h.name}</div>
                      <div className="text-[10px] text-slate-500">{h.city} • {h.squareMeters} m²</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenAddHome();
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600/30 to-emerald-600/30 border border-cyan-500/40 text-cyan-300 hover:from-cyan-600/40 hover:to-emerald-600/40 transition-all cursor-pointer text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Konut / Mülk Ekle</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
