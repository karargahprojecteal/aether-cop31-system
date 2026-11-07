import { TelemetryPoint } from '../../types/telemetry';
import { StressScenario } from '../../types/scenarios';
import { AIDecision } from '../../types/decisions';
import { geminiServerServiceInstance } from './geminiServerService';
import { subscriptionServiceInstance } from '../saas/SubscriptionService';
import { generateHeuristicDecisions } from './fallbackRuleEngine';
import { verifyJwtToken } from '../auth/jwtVerifier';
import { TenantRepository } from '../persistence/TenantRepository';

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
  statusCode?: number;
}

/**
 * Server-Side AI Gateway Endpoint Handler.
 * Executes on Node.js/Vercel serverless function or backend worker.
 * Strictly verifies JWT bearer token, checks tenant membership server-side,
 * prevents cross-tenant quota depletion, and validates telemetry schema constraints.
 */
export async function handleAiDecisionEndpoint(
  request: AiDecisionRequest,
  authHeader?: string,
  tenantRepo?: TenantRepository
): Promise<AiDecisionResponse> {
  const start = Date.now();

  // 1. Authenticate Request via Cryptographic JWT
  if (!authHeader || typeof authHeader !== 'string') {
    return {
      success: false,
      decisions: [],
      executionTimeMs: Date.now() - start,
      source: 'DETERMINISTIC_FALLBACK',
      circuitBreakerTripped: false,
      statusCode: 401,
      error: '401 Unauthorized: Authorization Bearer token is required.',
    };
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  const tokenResult = verifyJwtToken(token);

  if (!tokenResult.valid || !tokenResult.claims) {
    return {
      success: false,
      decisions: [],
      executionTimeMs: Date.now() - start,
      source: 'DETERMINISTIC_FALLBACK',
      circuitBreakerTripped: false,
      statusCode: 401,
      error: `401 Unauthorized: ${tokenResult.error || 'Invalid authentication token'}`,
    };
  }

  const authenticatedClaims = tokenResult.claims;
  const verifiedTenantId = authenticatedClaims.tenantId;
  const verifiedUserId = authenticatedClaims.sub;

  // 2. Reject Cross-Tenant Identity Spoofing
  // An attacker cannot supply another tenant's ID in request body
  if (request.tenantId && request.tenantId !== verifiedTenantId) {
    return {
      success: false,
      decisions: [],
      executionTimeMs: Date.now() - start,
      source: 'DETERMINISTIC_FALLBACK',
      circuitBreakerTripped: false,
      statusCode: 403,
      error: `403 Forbidden: Security Boundary Violation. Token is bound to '${verifiedTenantId}', but requested tenant was '${request.tenantId}'.`,
    };
  }

  // 3. Verify Server-Side Organization Membership
  if (tenantRepo) {
    const member = tenantRepo.getMember(verifiedTenantId, verifiedUserId);
    if (!member) {
      return {
        success: false,
        decisions: [],
        executionTimeMs: Date.now() - start,
        source: 'DETERMINISTIC_FALLBACK',
        circuitBreakerTripped: false,
        statusCode: 403,
        error: `403 Forbidden: User '${verifiedUserId}' is not an active member of organization '${verifiedTenantId}'.`,
      };
    }
  }

  // 4. Validate Input Payload Schema
  if (!request.telemetry) {
    return {
      success: false,
      decisions: [],
      executionTimeMs: Date.now() - start,
      source: 'DETERMINISTIC_FALLBACK',
      circuitBreakerTripped: false,
      statusCode: 400,
      error: 'Schema violation: telemetry payload is required.',
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
      statusCode: 400,
      error: 'Schema violation: telemetry numerical properties are invalid or out of range.',
    };
  }

  // 5. Enforce Tenant AI Quota Server-Side (strictly on the verified tenant)
  const hasQuota = subscriptionServiceInstance.consumeGeminiQuota(verifiedTenantId);
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
      statusCode: 200,
      error: 'Tenant daily AI call quota exceeded. Running deterministic rule engine.',
    };
  }

  // 6. Delegate to server service (which accesses process.env.GEMINI_API_KEY)
  try {
    const result = await geminiServerServiceInstance.generateDecisions(
      verifiedTenantId,
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
      statusCode: 200,
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
      statusCode: 200,
      error: err.message,
    };
  }
}
