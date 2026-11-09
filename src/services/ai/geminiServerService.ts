import { GoogleGenAI } from '@google/genai';
import { AIDecision } from '../../types/decisions';
import { TelemetryPoint } from '../../types/telemetry';
import { StressScenario } from '../../types/scenarios';
import { generateHeuristicDecisions } from './fallbackRuleEngine';
import { auditLogServiceInstance } from '../saas/AuditLogService';

export interface DecisionEngineResult {
  decisions: AIDecision[];
  executionTimeMs: number;
  source: 'GEMINI_AI' | 'DETERMINISTIC_FALLBACK';
  circuitBreakerTripped: boolean;
  provenance: {
    telemetryTimestamp: string;
    activePowerKw: number;
    phantomKw: number;
    tariffPrice: number;
    scenarioApplied: string | null;
  };
}

interface TenantCircuitState {
  consecutiveFailures: number;
  circuitOpenUntil: number;
}

export class GeminiServerService {
  private genAiClient: GoogleGenAI | null = null;
  private readonly maxFailuresBeforeCircuitTrip: number = 3;
  // Per-tenant circuit breaker state isolation (MED-AI-11)
  private tenantCircuits: Map<string, TenantCircuitState> = new Map();

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    // SECURE SERVER-SIDE ISOLATION:
    // Strictly read from server environment variables.
    // Provider credentials NEVER touch the browser bundle or client storage.
    const apiKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;

    if (apiKey && apiKey.trim()) {
      try {
        this.genAiClient = new GoogleGenAI({ apiKey: apiKey.trim() });
      } catch (err) {
        console.warn('Could not initialize GoogleGenAI client on server:', err);
      }
    }
  }

  public hasServerCredentials(): boolean {
    return !!this.genAiClient;
  }

  private getTenantCircuit(tenantId: string): TenantCircuitState {
    let state = this.tenantCircuits.get(tenantId);
    if (!state) {
      state = { consecutiveFailures: 0, circuitOpenUntil: 0 };
      this.tenantCircuits.set(tenantId, state);
    }
    return state;
  }

  public isCircuitBreakerOpen(tenantId: string = 'default'): boolean {
    const circuit = this.getTenantCircuit(tenantId);
    return circuit.circuitOpenUntil > Date.now();
  }

  public resetCircuitBreaker(tenantId: string): void {
    const circuit = this.getTenantCircuit(tenantId);
    circuit.consecutiveFailures = 0;
    circuit.circuitOpenUntil = 0;
  }

  /**
   * Generates structured energy optimization decisions with fallback & per-tenant circuit breaker
   */
  public async generateDecisions(
    tenantId: string,
    telemetry: TelemetryPoint,
    activeScenario: StressScenario | null = null
  ): Promise<DecisionEngineResult> {
    const start = Date.now();
    const now = Date.now();
    const circuit = this.getTenantCircuit(tenantId);

    const provenance = {
      telemetryTimestamp: telemetry.timestamp,
      activePowerKw: telemetry.activePowerKw,
      phantomKw: telemetry.nilm.phantomLoadKw,
      tariffPrice: telemetry.gridElectricityPriceTryPerKwh,
      scenarioApplied: activeScenario?.name || null,
    };

    // 1. Check Per-Tenant Circuit Breaker
    if (circuit.circuitOpenUntil > now) {
      const fallback = generateHeuristicDecisions(telemetry, activeScenario);
      return {
        decisions: fallback,
        executionTimeMs: Date.now() - start,
        source: 'DETERMINISTIC_FALLBACK',
        circuitBreakerTripped: true,
        provenance,
      };
    }

    // 2. Call Gemini API if server credentials configured
    if (this.genAiClient) {
      try {
        const decisions = await this.callGeminiWithRetry(telemetry, activeScenario);
        circuit.consecutiveFailures = 0;

        // Record immutable audit log
        auditLogServiceInstance.record({
          tenantId,
          userId: 'system-ai-engine',
          userEmail: 'ai-engine@aether-energy.io',
          action: 'AI_DECISIONS_GENERATED',
          category: 'AI_DECISION',
          details: { count: decisions.length, model: 'gemini-2.5-flash', latencyMs: Date.now() - start },
          severity: 'INFO',
        });

        return {
          decisions,
          executionTimeMs: Date.now() - start,
          source: 'GEMINI_AI',
          circuitBreakerTripped: false,
          provenance,
        };
      } catch (err) {
        circuit.consecutiveFailures++;
        if (circuit.consecutiveFailures >= this.maxFailuresBeforeCircuitTrip) {
          circuit.circuitOpenUntil = now + 60 * 1000; // Trip circuit breaker for 60 seconds
        }
        console.warn(`Gemini API call failed for tenant ${tenantId}, invoking deterministic rule engine:`, err);
      }
    }

    // 3. Fallback to Deterministic AETHER Physics Engine
    const fallbackDecisions = generateHeuristicDecisions(telemetry, activeScenario);
    return {
      decisions: fallbackDecisions,
      executionTimeMs: Date.now() - start,
      source: 'DETERMINISTIC_FALLBACK',
      circuitBreakerTripped: false,
      provenance,
    };
  }

  private async callGeminiWithRetry(
    telemetry: TelemetryPoint,
    activeScenario: StressScenario | null,
    maxRetries: number = 2
  ): Promise<AIDecision[]> {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const prompt = this.buildStructuredPrompt(telemetry, activeScenario);
        const response = await this.genAiClient!.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = response.text || '';
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]) as AIDecision[];
          return parsed.map((d, idx) => ({
            ...d,
            id: d.id || `gemini-dec-${Date.now()}-${idx}`,
            timestamp: new Date().toISOString(),
            source: 'GEMINI_AI',
            status: 'PENDING_APPROVAL',
          }));
        }
        throw new Error('Gemini model response did not contain a valid JSON array');
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, 500 * Math.pow(2, attempt)));
        }
      }
    }
    throw lastError;
  }

  private buildStructuredPrompt(
    telemetry: TelemetryPoint,
    activeScenario: StressScenario | null
  ): string {
    return `
You are the AETHER Energy & Carbon Neural Intelligence Engine.
Analyze this high-frequency residential smart meter telemetry and produce JSON optimization decisions.

Current Telemetry:
- Active Power: ${telemetry.activePowerKw} kW
- Grid Voltage: ${telemetry.voltage} V
- Frequency: ${telemetry.frequency} Hz
- Power Factor: ${telemetry.powerFactor}
- Current Electricity Price: ${telemetry.gridElectricityPriceTryPerKwh} TRY/kWh
- Grid Carbon Intensity: ${telemetry.gridCarbonIntensityGCo2PerKwh} gCO2/kWh
- NILM Phantom Load: ${telemetry.nilm.phantomLoadKw} kW
- HVAC Load: ${telemetry.nilm.hvacKw} kW
- Lighting Load: ${telemetry.nilm.lightingKw} kW
- Active Scenario: ${activeScenario ? `${activeScenario.name} (${activeScenario.category})` : 'Normal Operations'}

Return a valid JSON array of AIDecision objects conforming to this schema:
[
  {
    "id": "gemini-${Date.now()}",
    "timestamp": "${new Date().toISOString()}",
    "anomalyType": "PHANTOM_LOAD" | "PEAK_SURGE" | "GRID_CARBON_HIGH" | "SOLAR_DIP" | "EFFICIENCY_OPPORTUNITY",
    "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    "title": "Short descriptive title in Turkish",
    "diagnosis": "Technical explanation in Turkish",
    "recommendedAction": "Concrete automated action in Turkish",
    "commandPayload": {
      "subsystem": "HVAC" | "EV_CHARGER" | "BATTERY" | "LOAD_SHEDDING",
      "action": "STRING",
      "parameters": {}
    },
    "projectedKwhSaving": number,
    "projectedCo2ReductionKg": number,
    "projectedCostSavingTry": number,
    "confidenceScore": number (0-100),
    "status": "PENDING_APPROVAL",
    "source": "GEMINI_AI",
    "reasoningNotes": ["string"]
  }
]
`;
  }
}

export const geminiServerServiceInstance = new GeminiServerService();
