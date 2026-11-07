import { TelemetryPoint } from '../../types/telemetry';
import { StressScenario } from '../../types/scenarios';
import { AIDecision } from '../../types/decisions';
import { geminiServerServiceInstance } from './geminiServerService';
import { subscriptionServiceInstance } from '../saas/SubscriptionService';
import { generateHeuristicDecisions } from './fallbackRuleEngine';

export interface AiDecisionRequest {
  tenantId: string;
  userId: string;
  telemetry: TelemetryPoint;
  scenario?: StressScenario | null;
}

export interface AiDecisionResponse {
  success: boolean;
  decisions: AIDecision[];
  executionTimeMs: number;
  source: 'GEMINI_AI' | 'DETERMINISTIC_FALLBACK';
  circuitBreakerTripped: boolean;
  quotaRemaining?: boolean;
  error?: string;
}

/**
 * Server-Side AI Gateway Endpoint Handler.
 * Executes on Node.js/Vercel serverless function or backend worker.
 * Keeps GEMINI_API_KEY strictly in server memory, enforces tenant quotas,
 * and validates telemetry schema constraints.
 */
export async function handleAiDecisionEndpoint(request: AiDecisionRequest): Promise<AiDecisionResponse> {
  const start = Date.now();

  // 1. Validate Input Payload Schema
  if (!request.tenantId || !request.userId || !request.telemetry) {
    return {
      success: false,
      decisions: [],
      executionTimeMs: Date.now() - start,
      source: 'DETERMINISTIC_FALLBACK',
      circuitBreakerTripped: false,
      error: 'Invalid request: tenantId, userId, and telemetry payload are required.',
    };
  }

  const { activePowerKw, voltage } = request.telemetry;
  if (typeof activePowerKw !== 'number' || typeof voltage !== 'number' || activePowerKw < 0) {
    return {
      success: false,
      decisions: [],
      executionTimeMs: Date.now() - start,
      source: 'DETERMINISTIC_FALLBACK',
      circuitBreakerTripped: false,
      error: 'Schema violation: telemetry numerical properties are invalid or out of range.',
    };
  }

  // 2. Enforce Tenant AI Quota Server-Side
  const hasQuota = subscriptionServiceInstance.consumeGeminiQuota(request.tenantId);
  if (!hasQuota) {
    // Quota exhausted: gracefully fallback to deterministic physics engine
    const fallbackDecisions = generateHeuristicDecisions(request.telemetry, request.scenario || null);
    return {
      success: true,
      decisions: fallbackDecisions,
      executionTimeMs: Date.now() - start,
      source: 'DETERMINISTIC_FALLBACK',
      circuitBreakerTripped: false,
      quotaRemaining: false,
      error: 'Tenant daily AI call quota exceeded. Running deterministic rule engine.',
    };
  }

  // 3. Delegate to server service (which accesses process.env.GEMINI_API_KEY)
  try {
    const result = await geminiServerServiceInstance.generateDecisions(
      request.tenantId,
      request.telemetry,
      request.scenario || null
    );

    return {
      success: true,
      decisions: result.decisions,
      executionTimeMs: result.executionTimeMs,
      source: result.source,
      circuitBreakerTripped: result.circuitBreakerTripped,
      quotaRemaining: true,
    };
  } catch (err: any) {
    // In case of unexpected server failure, fallback deterministically
    const fallback = generateHeuristicDecisions(request.telemetry, request.scenario || null);
    return {
      success: true,
      decisions: fallback,
      executionTimeMs: Date.now() - start,
      source: 'DETERMINISTIC_FALLBACK',
      circuitBreakerTripped: true,
      quotaRemaining: true,
      error: err.message,
    };
  }
}
