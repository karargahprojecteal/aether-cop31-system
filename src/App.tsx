import React, { useState } from 'react';
import { TelemetryProvider } from './context/TelemetryContext';
import { DecisionProvider } from './context/DecisionContext';
import { Header } from './components/layout/Header';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { HardwareSourceModal } from './components/layout/HardwareSourceModal';
import { GeminiConfigModal } from './components/ai-engine/GeminiConfigModal';
import { MetricGrid } from './components/dashboard/MetricGrid';
import { PowerFlowChart } from './components/dashboard/PowerFlowChart';
import { NILMBreakdown } from './components/dashboard/NILMBreakdown';
import { LiveTelemetryTicker } from './components/dashboard/LiveTelemetryTicker';
import { DecisionDeck } from './components/ai-engine/DecisionDeck';
import { WhatIfSimulator } from './components/stress-test/WhatIfSimulator';
import { COP31AuditView } from './components/cop31-report/COP31AuditView';
import { 
  LayoutDashboard, 
  BrainCircuit, 
  Sliders, 
  FileCheck2 
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isSourceModalOpen, setIsSourceModalOpen] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Üst Komuta Başlığı */}
      <Header
        onOpenSourceModal={() => setIsSourceModalOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        
        {/* Yan Menü (Masaüstü) */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Ana İçerik Alanı */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          
          {/* Mobil Alt Menü / Sekmeler */}
          <div className="flex md:hidden items-center justify-around p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg ${
                activeTab === 'dashboard' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-700' : 'text-slate-400'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Pano</span>
            </button>
            <button
              onClick={() => setActiveTab('ai-engine')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg ${
                activeTab === 'ai-engine' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-700' : 'text-slate-400'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>AI Karar</span>
            </button>
            <button
              onClick={() => setActiveTab('stress-test')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg ${
                activeTab === 'stress-test' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-700' : 'text-slate-400'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>What-If</span>
            </button>
            <button
              onClick={() => setActiveTab('cop31-report')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg ${
                activeTab === 'cop31-report' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-700' : 'text-slate-400'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>COP31</span>
            </button>
          </div>

          {/* Sekme İçerikleri */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Metrik Kartları */}
              <MetricGrid />

              {/* Canlı Akıllı Sayaç & Frekans Bandı */}
              <LiveTelemetryTicker />

              {/* Grafikler: Enerji Akışı ve NILM Yük Dağılımı */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                  <PowerFlowChart />
                </div>
                <div className="xl:col-span-1">
                  <NILMBreakdown />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai-engine' && <DecisionDeck />}

          {activeTab === 'stress-test' && <WhatIfSimulator />}

          {activeTab === 'cop31-report' && <COP31AuditView />}

        </main>
      </div>

      {/* Donanım Kaynağı Değiştirme Modalı */}
      <HardwareSourceModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
      />

      {/* Gemini API Konfigürasyon Modalı */}
      <GeminiConfigModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />

    </div>
  );
};

export const App: React.FC = () => {
  return (
    <TelemetryProvider>
      <DecisionProvider>
        <MainLayout />
      </DecisionProvider>
    </TelemetryProvider>
  );
};

export default App;
