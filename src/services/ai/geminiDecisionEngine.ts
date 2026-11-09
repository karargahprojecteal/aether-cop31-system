import { AIDecision } from '../../types/decisions';
import { TelemetryPoint } from '../../types/telemetry';
import { StressScenario } from '../../types/scenarios';
import { generateHeuristicDecisions } from './fallbackRuleEngine';

export class GeminiDecisionEngine {
  private isAnalyzing: boolean = false;

  /**
   * Routes telemetry analysis.
   * In browser client, delegates to deterministic rule engine (or server API via HTTP).
   * Eliminates client-side credential storage and completely decouples browser runtime from Node modules.
   */
  public async analyzeTelemetry(
    currentTelemetry: TelemetryPoint,
    activeScenario: StressScenario | null,
    _tenantId: string = 'tenant-karargah-etkim',
    _userId: string = 'user-pilot-owner',
    _authToken?: string
  ): Promise<AIDecision[]> {
    if (this.isAnalyzing) return [];
    this.isAnalyzing = true;

    try {
      return generateHeuristicDecisions(currentTelemetry, activeScenario);
    } finally {
      this.isAnalyzing = false;
    }
  }

  public hasValidKey(): boolean {
    return typeof process !== 'undefined' ? Boolean(process.env?.GEMINI_API_KEY) : false;
  }
}

export const geminiDecisionEngineInstance = new GeminiDecisionEngine();
