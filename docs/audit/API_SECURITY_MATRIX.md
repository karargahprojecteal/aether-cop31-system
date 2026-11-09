# AETHER System — API & Service Security Matrix
## Comprehensive Security Audit of Service Endpoints & Core Logic

- **Target Commit:** `c3e43cf`
- **Audit Scope:** All internal service endpoints, authentication gates, data validators, webhooks, and billing handlers.
- **Audit Methodology:** Static code analysis, control-flow tracing, input boundary testing, and injection analysis.

---

## 1. Service Endpoint Security Matrix

| Component / Function | File & Lines | Auth / Identity Derivation | Authz / RBAC Checks | Input Validation | Injection / DoS Vectors | Vulnerability & Remediation | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **`handleAiDecisionEndpoint`** | `src/services/ai/aiServerEndpoint.ts` (L31–L104) | **NONE (Broken).** Accepts `tenantId` & `userId` in JSON body. | **NONE.** Does not verify if `userId` belongs to `tenantId`. | Validates numerical power & voltage range. | **DoS / Quota Exhaustion:** Attacker can deplete another tenant's Gemini daily quota by sending arbitrary `tenantId`. | **Remediation:** Extract identity strictly from authenticated JWT/Session cookie. Reject unverified requests. | **CRITICAL** |
| **`generateDecisions`** | `src/services/ai/geminiServerService.ts` (L58–L130) | Server environment variable `GEMINI_API_KEY`. | Delegated to caller. | Structured JSON schema prompt with circuit breaker. | **Circuit Breaker DoS:** 3 consecutive failures open circuit breaker for 60s across all tenants on this instance. | **Remediation:** Scope circuit breaker per tenant or provider error category, not globally. | **MEDIUM** |
| **`verifyWebhookDetailed`** | `src/services/saas/billing/ProductionBillingProvider.ts` (L65–L100) | HMAC-SHA256 signature check (`timingSafeEqual`). | Verified via webhook secret. | JSON payload parsing wrapped in try/catch. | **Replay Protection Defect:** L73 creates random `eventId` if payload lacks `id`, bypassing deduplication. | **Remediation:** Require `event.id` from header or payload; reject if missing. | **HIGH** |
| **`createCheckoutSession`** | `src/services/saas/billing/ProductionBillingProvider.ts` (L13–L24) | Server-side `STRIPE_SECRET_KEY`. | Delegated to caller. | Validates tier enum. | Low risk (mock redirect URL returned if secret configured). | **Remediation:** Implement real Stripe SDK call with webhook signing secret validation. | **LOW** |
| **`redeemPairingToken`** | `src/services/persistence/PairingRepository.ts` (L79–L188) | Token hash matching via `timingSafeEqual`. | Checks `matchedRow.tenant_id === tenantId`. | Strips whitespace, uppercase normalization. | **Missing Table:** References `brute_force_locks` which is missing in PostgreSQL DDL. | **Remediation:** Add `brute_force_locks` table to PostgreSQL migration script. | **HIGH** |
| **`generatePairingToken`** | `src/services/persistence/PairingRepository.ts` (L22–L73) | Derived from caller context. | Checks `getHome(tenantId, homeId)`. | Strong CSPRNG (64-bit entropy, 30-char safe alphabet). | Zero injection risk (parameterized SQL statements). | **Remediation:** None. Implementation is sound. | **INFO** |
| **`checkLimit`** | `src/services/persistence/RateLimiterRepository.ts` (L17–L72) | Identifier key based. | N/A (Infrastructure). | Window quantized to 1s slices. | **SQL Type Crash:** Passes millisecond integer to `TIMESTAMPTZ` column. **Race Condition:** Non-atomic read-then-write. | **Remediation:** Cast to ISO string / `to_timestamp(?)`. Wrap count & insert in atomic transaction or Redis token bucket. | **CRITICAL** |
| **`record` (Audit Log)** | `src/services/persistence/AuditLogRepository.ts` (L37–L96) | Relies on caller-provided `userId`. | None at record level. | Validates category enum. | **Hash Forking:** Concurrent writes read same `prev_record_hash`. **JSONB Hash Mismatch:** PostgreSQL normalizes JSONB keys. | **Remediation:** Use RFC 8785 canonical JSON; serialize chain updates with `FOR UPDATE` lock. | **HIGH** |
| **`ingestMqttPacket`** | `src/services/adapters/LocalGatewayAdapter.ts` (L93–L135) | Device ID and packet sequence number. | None (Local gateway). | Checks power and energy types. | **Unbounded Memory Leak:** `processedSequenceIds: Set<number>` grows indefinitely. Sequence integer wrap causes rejection. | **Remediation:** Use sliding window ring buffer of last 1,000 sequence IDs or LRU cache. | **MEDIUM** |
| **`TenantManager.getHome`** | `src/services/saas/TenantManager.ts` (L58–L61) | Client-supplied `TenantContext`. | `WHERE tenant_id = ?` parameterization. | Validates non-empty string. | None in SQLite; vulnerable in browser if `DatabaseService` invoked. | **Remediation:** Route through HTTP backend API authenticated by Supabase JWT. | **HIGH** |

---

## 2. In-Depth Vulnerability Analysis & Proof of Exploits

### 2.1 [CRIT-API-01] Unauthenticated AI Endpoint & Quota Exhaustion
- **File:** `src/services/ai/aiServerEndpoint.ts#L31-L60`
- **Mechanism:**
  ```typescript
  export async function handleAiDecisionEndpoint(request: AiDecisionRequest): Promise<AiDecisionResponse> {
    // Input check only verifies truthiness of tenantId & userId
    if (!request.tenantId || !request.userId || !request.telemetry) { ... }
    
    // Consumes quota immediately from subscription service!
    const hasQuota = subscriptionServiceInstance.consumeGeminiQuota(request.tenantId);
  ```
- **Impact:** An attacker who discovers a victim organization's `tenantId` (e.g. from public slugs or invite emails) can issue repeated requests to `handleAiDecisionEndpoint`, immediately consuming the victim's daily AI decision quota (e.g., 10 calls on `STARTER_HOME`).
- **Remediation:**
  1. Bind endpoint to Next.js/Express route with `verifyAuthToken(req)` middleware.
  2. Verify `req.user.tenantId === request.tenantId` and `req.user.role IN ('OWNER', 'ENERGY_MANAGER')`.

---

### 2.2 [HIGH-API-02] Webhook Idempotency Bypass on Missing ID
- **File:** `src/services/saas/billing/ProductionBillingProvider.ts#L73`
- **Mechanism:**
  ```typescript
  const eventId = parsedPayload.id || `evt_${crypto.randomBytes(6).toString('hex')}`;
  ```
- **Impact:** If a billing provider (or attacker replaying an intercept) sends an event where `id` is omitted or nested elsewhere, a brand new `eventId` is generated on every invocation. The deduplication table `webhook_events` receives unique keys, completely bypassing replay prevention.
- **Remediation:**
  ```typescript
  if (!parsedPayload.id) {
    return { valid: false, isReplay: false, error: 'Malformed webhook: Missing required event id' };
  }
  ```

---

### 2.3 [MED-API-03] Unbounded Memory Growth in Gateway Sequence Deduplication
- **File:** `src/services/adapters/LocalGatewayAdapter.ts#L39`
- **Mechanism:**
  ```typescript
  private processedSequenceIds: Set<number> = new Set();
  ```
- **Impact:** A high-frequency local gateway publishing telemetry at 1 Hz generates $86,400$ packets/day. In long-running processes, `processedSequenceIds` retains every integer, creating an unbounded heap memory leak. Additionally, when 16-bit or 32-bit hardware sequence counters wrap around to 0, all subsequent packets are rejected as duplicates.
- **Remediation:** Replace `Set<number>` with a bounded circular bitset or FIFO ring buffer holding the most recent 1,024 sequence IDs.

---

## 3. Regression Testing Plan for Remediations

1. **`test_ai_endpoint_auth_rejection`:** Verify that calling `handleAiDecisionEndpoint` without a valid signed session token returns `401 Unauthorized` without calling `consumeGeminiQuota`.
2. **`test_webhook_missing_id_rejection`:** Verify that a webhook payload lacking `id` is rejected with `valid: false` instead of generating a randomized surrogate key.
3. **`test_ratelimiter_postgres_timestamptz`:** Verify that `RateLimiterRepository` executes against PostgreSQL 15 without throwing `ERROR: column "expires_at" is of type timestamp with time zone`.
4. **`test_local_gateway_sequence_wrapping`:** Verify that sequence counter wrap (e.g., from 65535 to 0) does not cause telemetry ingestion to stall.
