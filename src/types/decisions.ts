export type AnomalyType = 
  | 'PHANTOM_LOAD'
  | 'PEAK_SURGE'
  | 'SOLAR_DIP'
  | 'THERMAL_STRESS'
  | 'TARIFF_SPIKE'
  | 'GRID_CARBON_HIGH'
  | 'SYSTEM_OPTIMAL';

export type DecisionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type DecisionStatus = 'PENDING_APPROVAL' | 'APPLIED' | 'DISMISSED' | 'AUTONOMOUSLY_EXECUTED';

export interface CommandPayload {
  subsystem: 'HVAC' | 'LIGHTING' | 'BATTERY_STORAGE' | 'LOAD_SHEDDING' | 'PUMP_CONTROL' | 'SOLAR_INVERTER';
  action: string;
  parameters: Record<string, string | number | boolean | string[]>;
  estimatedKwReduction: number;
}

export interface AIDecision {
  id: string;
  timestamp: string;
  anomalyType: AnomalyType;
  priority: DecisionPriority;
  title: string;
  diagnosis: string;
  recommendedAction: string;
  commandPayload: CommandPayload;
  projectedKwhSaving: number;
  projectedCo2ReductionKg: number;
  projectedCostSavingTry: number;
  confidenceScore: number; // 0 - 100
  status: DecisionStatus;
  source: 'GEMINI_AI' | 'HEURISTIC_ENGINE' | 'MANUAL_RULE';
  appliedAt?: string;
  reasoningNotes?: string[];
}

export interface DecisionEngineState {
  isAutonomousMode: boolean; // Otonom uygulama açık mı? (Açıkken kritik/yüksek kararlar direkt uygulanır)
  isAnalyzing: boolean;
  lastAnalysisTimestamp: string | null;
  decisions: AIDecision[];
  activeInterventionsCount: number;
  totalAutonomousActionsTaken: number;
}
