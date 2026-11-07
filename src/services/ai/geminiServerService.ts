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

export class GeminiServerService {
  private genAiClient: GoogleGenAI | null = null;
  private consecutiveFailures: number = 0;
  private readonly maxFailuresBeforeCircuitTrip: number = 3;
  private circuitOpenUntil: number = 0;

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

  public isCircuitBreakerOpen(): boolean {
    return this.circuitOpenUntil > Date.now();
  }

  /**
   * Generates structured energy optimization decisions with fallback & circuit breaker
   */
  public async generateDecisions(
    tenantId: string,
    telemetry: TelemetryPoint,
    activeScenario: StressScenario | null = null
  ): Promise<DecisionEngineResult> {
    const start = Date.now();
    const now = Date.now();

    const provenance = {
      telemetryTimestamp: telemetry.timestamp,
      activePowerKw: telemetry.activePowerKw,
      phantomKw: telemetry.nilm.phantomLoadKw,
      tariffPrice: telemetry.gridElectricityPriceTryPerKwh,
      scenarioApplied: activeScenario?.name || null,
    };

    // 1. Check Circuit Breaker
    if (this.circuitOpenUntil > now) {
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
        this.consecutiveFailures = 0;

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
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.maxFailuresBeforeCircuitTrip) {
          this.circuitOpenUntil = now + 60 * 1000; // Trip circuit breaker for 60 seconds
        }
        console.warn('Gemini API call failed, invoking deterministic rule engine:', err);
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
            timestamp: d.timestamp || new Date().toISOString(),
            source: 'GEMINI_AI' as const,
            status: 'PENDING_APPROVAL' as const,
          }));
        }
        throw new Error('Failed to parse structured JSON array from Gemini response');
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(r => setTimeout(r, (attempt + 1) * 600));
        }
      }
    }
    throw lastError;
  }

  private buildStructuredPrompt(telemetry: TelemetryPoint, activeScenario: StressScenario | null): string {
    return `
You are the core AI Decision Engine for AETHER Autonomous Residential Energy & Carbon Neural System.
Analyze this live telemetry and generate 1 to 3 structured optimization decisions in pure JSON array format:

TELEMETRY INPUTS:
- Active Power: ${telemetry.activePowerKw} kW | Voltage: ${telemetry.voltage} V | Frequency: ${telemetry.frequency} Hz | PF: ${telemetry.powerFactor}
- Disaggregated NILM:
  * HVAC: ${telemetry.nilm.hvacKw} kW
  * Lighting: ${telemetry.nilm.lightingKw} kW
  * Base Load: ${telemetry.nilm.baseLoadKw} kW
  * Phantom Leakage: ${telemetry.nilm.phantomLoadKw} kW
  * Industrial/Pumps: ${telemetry.nilm.industrialLoadKw} kW
  * Solar PV Generation: ${telemetry.nilm.solarGenerationKw} kW
- Environment: Outdoor Temp ${telemetry.outdoorTempC} C, Solar ${telemetry.solarIrradianceWm2} W/m2, Occupancy ${telemetry.occupancyRatePercent}%
- Grid: Carbon Intensity ${telemetry.gridCarbonIntensityGCo2PerKwh} gCO2/kWh, Electricity Tariff ${telemetry.gridElectricityPriceTryPerKwh} TL/kWh
${activeScenario ? `ACTIVE STRESS SCENARIO: ${activeScenario.name} (${activeScenario.category})` : ''}

OUTPUT STRICT JSON SCHEMA:
[
  {
    "id": "gemini-${Date.now()}",
    "timestamp": "${new Date().toISOString()}",
    "anomalyType": "PHANTOM_LOAD" | "PEAK_SURGE" | "SOLAR_DIP" | "GRID_CARBON_HIGH",
    "priority": "CRITICAL" | "HIGH" | "MEDIUM",
    "title": "Short title",
    "diagnosis": "Root cause diagnosis",
    "recommendedAction": "Concrete mitigation action",
    "commandPayload": {
      "subsystem": "HVAC" | "LIGHTING" | "PUMP_CONTROL" | "LOAD_SHEDDING",
      "action": "ACTION_CODE",
      "parameters": { "param": 1 },
      "estimatedKwReduction": 12.0
    },
    "projectedKwhSaving": 36.0,
    "projectedCo2ReductionKg": 16.5,
    "projectedCostSavingTry": 150.0,
    "confidenceScore": 95,
    "status": "PENDING_APPROVAL",
    "source": "GEMINI_AI"
  }
]
`;
  }
}

export const geminiServerServiceInstance = new GeminiServerService();
