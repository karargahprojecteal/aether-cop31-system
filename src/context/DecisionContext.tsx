import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AIDecision, DecisionEngineState } from '../types/decisions';
import { useTelemetry } from './TelemetryContext';
import { geminiDecisionEngineInstance } from '../services/ai/geminiDecisionEngine';

interface DecisionContextType {
  state: DecisionEngineState;
  hasValidApiKey: boolean;
  toggleAutonomousMode: () => void;
  applyDecision: (decisionId: string, isAuto?: boolean) => void;
  dismissDecision: (decisionId: string) => void;
  triggerAnalysis: () => Promise<void>;
  auditTrail: {
    id: string;
    timestamp: string;
    decisionTitle: string;
    action: string;
    kwReduction: number;
    co2ReductionKg: number;
    mode: 'AUTONOMOUS' | 'MANUAL_APPROVAL';
  }[];
}

const DecisionContext = createContext<DecisionContextType | undefined>(undefined);

export const DecisionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { telemetry, scenarios, applyIntervention } = useTelemetry();
  const [isAutonomousMode, setIsAutonomousMode] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [lastAnalysisTimestamp, setLastAnalysisTimestamp] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<AIDecision[]>([]);
  const [totalAutonomousActions, setTotalAutonomousActions] = useState<number>(3);
  const [auditTrail, setAuditTrail] = useState<DecisionContextType['auditTrail']>([
    {
      id: 'audit-1',
      timestamp: '11:42:00',
      decisionTitle: 'Gece HVAC B Blok Frekans İzolasyonu',
      action: 'ISOLATE_PHANTOM_CIRCUITS',
      kwReduction: 14.2,
      co2ReductionKg: 6.8,
      mode: 'AUTONOMOUS',
    },
    {
      id: 'audit-2',
      timestamp: '11:49:00',
      decisionTitle: 'Pik Tarife Ön Soğutma Modülasyonu',
      action: 'EXECUTE_PEAK_SHAVING',
      kwReduction: 18.0,
      co2ReductionKg: 8.7,
      mode: 'AUTONOMOUS',
    },
  ]);

  const activeScenario = scenarios.find((s) => s.isActive) || null;
  const lastAnalyzedScenarioRef = useRef<string | null>(null);

  const toggleAutonomousMode = () => {
    setIsAutonomousMode((prev) => !prev);
  };

  const applyDecision = useCallback((decisionId: string, isAuto: boolean = false) => {
    setDecisions((prev) =>
      prev.map((d) => {
        if (d.id === decisionId) {
          // Telemetri servisine yük düşürme müdahalesini uygula
          applyIntervention(d.commandPayload.estimatedKwReduction, d.commandPayload.subsystem);

          // Denetim kütüğüne (Audit Trail) ekle
          setAuditTrail((curr) => [
            {
              id: `audit-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              decisionTitle: d.title,
              action: d.commandPayload.action,
              kwReduction: d.commandPayload.estimatedKwReduction,
              co2ReductionKg: d.projectedCo2ReductionKg,
              mode: isAuto ? 'AUTONOMOUS' : 'MANUAL_APPROVAL',
            },
            ...curr.slice(0, 19),
          ]);

          if (isAuto) {
            setTotalAutonomousActions((c) => c + 1);
          }

          return {
            ...d,
            status: isAuto ? ('AUTONOMOUSLY_EXECUTED' as const) : ('APPLIED' as const),
            appliedAt: new Date().toISOString(),
          };
        }
        return d;
      })
    );
  }, [applyIntervention]);

  const dismissDecision = useCallback((decisionId: string) => {
    setDecisions((prev) =>
      prev.map((d) => (d.id === decisionId ? { ...d, status: 'DISMISSED' as const } : d))
    );
  }, []);

  const triggerAnalysis = useCallback(async () => {
    if (!telemetry || isAnalyzing) return;
    setIsAnalyzing(true);

    try {
      const generated = await geminiDecisionEngineInstance.analyzeTelemetry(
        telemetry,
        activeScenario
      );

      setLastAnalysisTimestamp(new Date().toLocaleTimeString());

      if (generated.length > 0) {
        setDecisions((prev) => {
          const existingIds = new Set(prev.filter((d) => d.status === 'PENDING_APPROVAL').map((d) => d.anomalyType));
          const newUnique = generated.filter((g) => !existingIds.has(g.anomalyType));
          return [...newUnique, ...prev].slice(0, 15);
        });

        if (isAutonomousMode) {
          generated.forEach((dec) => {
            if (dec.priority === 'CRITICAL' || dec.priority === 'HIGH') {
              setTimeout(() => {
                applyDecision(dec.id, true);
              }, 2200);
            }
          });
        }
      }
    } catch (err) {
      console.error('Decision analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [telemetry, isAnalyzing, activeScenario, isAutonomousMode, applyDecision]);

  useEffect(() => {
    const currentScenId = activeScenario ? `${activeScenario.id}-${activeScenario.isActive}` : null;
    if (telemetry && currentScenId !== lastAnalyzedScenarioRef.current) {
      lastAnalyzedScenarioRef.current = currentScenId;
      triggerAnalysis();
    }
  }, [activeScenario, telemetry, triggerAnalysis]);

  useEffect(() => {
    const interval = setInterval(() => {
      triggerAnalysis();
    }, 25000);

    return () => clearInterval(interval);
  }, [triggerAnalysis]);

  const activeInterventionsCount = decisions.filter(
    (d) => d.status === 'APPLIED' || d.status === 'AUTONOMOUSLY_EXECUTED'
  ).length;

  const state: DecisionEngineState = {
    isAutonomousMode,
    isAnalyzing,
    lastAnalysisTimestamp,
    decisions,
    activeInterventionsCount,
    totalAutonomousActionsTaken: totalAutonomousActions,
  };

  const value = {
    state,
    hasValidApiKey: geminiDecisionEngineInstance.hasValidKey(),
    toggleAutonomousMode,
    applyDecision,
    dismissDecision,
    triggerAnalysis,
    auditTrail,
  };

  return <DecisionContext.Provider value={value}>{children}</DecisionContext.Provider>;
};

export const useDecisions = (): DecisionContextType => {
  const context = useContext(DecisionContext);
  if (!context) {
    throw new Error('useDecisions must be used within a DecisionProvider');
  }
  return context;
};
