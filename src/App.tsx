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

// New Residential & SaaS Modules
import { EnergyIntelligenceView } from './components/residential/EnergyIntelligenceView';
import { IntegrationMarketplaceView } from './components/residential/IntegrationMarketplaceView';
import { DeviceRegistryView } from './components/residential/DeviceRegistryView';
import { AddHomeModal } from './components/residential/AddHomeModal';
import { PairingModal } from './components/residential/PairingModal';
import { ManualBillModal } from './components/residential/ManualBillModal';
import { OrganizationManagementView } from './components/saas/OrganizationManagementView';
import { SubscriptionLimitsView } from './components/saas/SubscriptionLimitsView';
import { PrivacySecurityView } from './components/saas/PrivacySecurityView';

import { aetherApiClientInstance } from './services/api/aetherApiClient';
import { HomeProfile, IntegrationPathway, DeviceRecord } from './types/residential';
import { TenantContext } from './types/saas';

import { 
  LayoutDashboard, 
  BrainCircuit, 
  Sliders, 
  FileCheck2,
  Zap,
  Layers,
  Cpu,
  Building2,
  CreditCard,
  ShieldCheck
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isSourceModalOpen, setIsSourceModalOpen] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isAddHomeModalOpen, setIsAddHomeModalOpen] = useState<boolean>(false);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState<boolean>(false);
  const [isManualBillModalOpen, setIsManualBillModalOpen] = useState<boolean>(false);
  const [selectedPathwayForPairing, setSelectedPathwayForPairing] = useState<IntegrationPathway>('LOCAL_GATEWAY');

  // Default Tenant Context
  const [tenantContext] = useState<TenantContext>({
    tenantId: 'tenant-karargah-etkim',
    userId: 'user-aras-demirtas',
    userEmail: 'aras@aether-energy.io',
    role: 'OWNER',
    accessibleHomeIds: [],
  });

  const [homes, setHomes] = useState<HomeProfile[]>(() =>
    aetherApiClientInstance.listHomes(tenantContext)
  );

  const [activeHome, setActiveHome] = useState<HomeProfile | null>(() =>
    homes.length > 0 ? homes[0] : null
  );

  const handleCreateHome = (homeData: Omit<HomeProfile, 'id' | 'createdAt'>) => {
    const created = aetherApiClientInstance.createHome(tenantContext, homeData);
    const updatedHomes = aetherApiClientInstance.listHomes(tenantContext);
    setHomes(updatedHomes);
    setActiveHome(created);
    setActiveTab('device-registry');
  };

  const handleStartPairingPathway = (pathway: IntegrationPathway) => {
    setSelectedPathwayForPairing(pathway);
    setIsPairingModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Üst Komuta Başlığı & Konut Seçici */}
      <Header
        onOpenSourceModal={() => setIsSourceModalOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        homes={homes}
        activeHome={activeHome}
        onSelectHome={(h) => setActiveHome(h)}
        onOpenAddHome={() => setIsAddHomeModalOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        
        {/* Yan Menü (Masaüstü) */}
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          homeName={activeHome?.name}
        />

        {/* Ana İçerik Alanı */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          
          {/* Mobil Yatay Menü / Hızlı Sekmeler */}
          <div className="flex md:hidden overflow-x-auto gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono scrollbar-none">
            {[
              { id: 'dashboard' as NavTab, label: 'Pano', icon: LayoutDashboard },
              { id: 'energy-intelligence' as NavTab, label: 'Zeka & NILM', icon: Zap },
              { id: 'marketplace' as NavTab, label: 'Pazaryeri', icon: Layers },
              { id: 'device-registry' as NavTab, label: 'Cihazlar', icon: Cpu },
              { id: 'ai-engine' as NavTab, label: 'AI Karar', icon: BrainCircuit },
              { id: 'stress-test' as NavTab, label: 'What-If', icon: Sliders },
              { id: 'cop31-report' as NavTab, label: 'COP31', icon: FileCheck2 },
              { id: 'organization' as NavTab, label: 'Ekip', icon: Building2 },
              { id: 'subscription' as NavTab, label: 'Abonelik', icon: CreditCard },
              { id: 'privacy-security' as NavTab, label: 'KVKK', icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0 ${
                    isActive ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-700' : 'text-slate-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* 1. Komuta Merkezi / Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <MetricGrid />
              <LiveTelemetryTicker />
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

          {/* 2. Enerji Zekası & NILM */}
          {activeTab === 'energy-intelligence' && <EnergyIntelligenceView />}

          {/* 3. Entegrasyon Pazaryeri */}
          {activeTab === 'marketplace' && (
            <IntegrationMarketplaceView
              onSelectPathway={handleStartPairingPathway}
              onOpenManualBill={() => setIsManualBillModalOpen(true)}
            />
          )}

          {/* 4. Sayaç & Cihaz Kayıt Defteri */}
          {activeTab === 'device-registry' && (
            <DeviceRegistryView
              tenantId={tenantContext.tenantId}
              homeId={activeHome?.id || 'home-default'}
              onOpenPairing={() => setIsPairingModalOpen(true)}
            />
          )}

          {/* 5. AI Karar Motoru */}
          {activeTab === 'ai-engine' && <DecisionDeck />}

          {/* 6. What-If Simülatörü */}
          {activeTab === 'stress-test' && <WhatIfSimulator />}

          {/* 7. COP31 Karbon Karnesi */}
          {activeTab === 'cop31-report' && <COP31AuditView />}

          {/* 8. Ekip & Roller (RBAC) */}
          {activeTab === 'organization' && (
            <OrganizationManagementView context={tenantContext} />
          )}

          {/* 9. Abonelik & Kotalar */}
          {activeTab === 'subscription' && (
            <SubscriptionLimitsView context={tenantContext} />
          )}

          {/* 10. KVKK & Gizlilik */}
          {activeTab === 'privacy-security' && (
            <PrivacySecurityView context={tenantContext} />
          )}

        </main>
      </div>

      {/* MODALS */}
      <HardwareSourceModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
      />

      <GeminiConfigModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />

      <AddHomeModal
        isOpen={isAddHomeModalOpen}
        onClose={() => setIsAddHomeModalOpen(false)}
        tenantId={tenantContext.tenantId}
        onSaveHome={handleCreateHome}
      />

      <PairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        tenantId={tenantContext.tenantId}
        homeId={activeHome?.id || 'home-default'}
        initialPathway={selectedPathwayForPairing}
        onDevicePaired={() => {
          // Trigger device registry refresh
        }}
      />

      <ManualBillModal
        isOpen={isManualBillModalOpen}
        onClose={() => setIsManualBillModalOpen(false)}
        tenantId={tenantContext.tenantId}
        homeId={activeHome?.id || 'home-default'}
        onBillAdded={() => {
          setActiveTab('dashboard');
        }}
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
