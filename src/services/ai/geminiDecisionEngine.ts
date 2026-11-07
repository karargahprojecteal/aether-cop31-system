import { AIDecision } from '../../types/decisions';
import { TelemetryPoint } from '../../types/telemetry';
import { StressScenario } from '../../types/scenarios';
import { handleAiDecisionEndpoint } from './aiServerEndpoint';

export class GeminiDecisionEngine {
  private isAnalyzing: boolean = false;

  /**
   * Routes telemetry analysis through authenticated server-side endpoint.
   * Eliminates client-side credential storage.
   */
  public async analyzeTelemetry(
    currentTelemetry: TelemetryPoint,
    activeScenario: StressScenario | null,
    tenantId: string = 'tenant-karargah-etkim',
    userId: string = 'user-pilot-owner'
  ): Promise<AIDecision[]> {
    if (this.isAnalyzing) return [];
    this.isAnalyzing = true;

    try {
      const response = await handleAiDecisionEndpoint({
        tenantId,
        userId,
        telemetry: currentTelemetry,
        scenario: activeScenario,
      });

      return response.decisions;
    } finally {
      this.isAnalyzing = false;
    }
  }

  public hasValidKey(): boolean {
    // In server-side architecture, credentials are bound to backend runtime environment
    return typeof process !== 'undefined' ? Boolean(process.env?.GEMINI_API_KEY) : false;
  }
}

export const geminiDecisionEngineInstance = new GeminiDecisionEngine();
