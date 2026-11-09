# AETHER Security & Privacy Architecture Model

---

## 1. Threat Model & Security Posture
Energy consumption data is sensitive telemetry: minute-by-minute electrical spikes can reveal occupancy, sleep patterns, appliance usage, and high-value equipment operations.

AETHER adopts a **Zero-Trust, Privacy-First Architecture**:
1. All network communications are encrypted with TLS 1.3.
2. Tenant isolation is enforced at the server-side API boundary.
3. No credentials, tokens, or private keys are exposed to the client bundle.
4. Physical control commands to electrical equipment are strictly decoupled and blocked by default.

---

## 2. Authentication & Authorization Architecture

### 2.1 Multi-Tenant Context Enforcer
Every authenticated request is resolved into a verified `TenantContext`:
```typescript
export interface TenantContext {
  tenantId: string;
  userId: string;
  userEmail: string;
  role: 'OWNER' | 'ENERGY_MANAGER' | 'ANALYST' | 'AUDITOR' | 'RESIDENT_VIEWER';
  accessibleHomeIds: string[];
}
```
If an actor attempts to access an entity belonging to another `tenantId`, the request is denied immediately with HTTP 403 / `SecurityViolationError` and logged to the immutable audit trail.

### 2.2 Ephemeral Pairing Code Security
When a user pairs a new residential gateway or smart meter dongle:
- **Entropy:** 8-character cryptographically random alphanumeric string (excluding ambiguous characters: `0`, `O`, `1`, `I`, `L`).
- **Time-to-Live (TTL):** Exactly 15 minutes (900 seconds).
- **Single-Use Enforcement:** Upon successful claim, the pairing token is immediately marked `CONSUMED` and cannot be reused under any circumstances.
- **Brute-Force Lockout:** More than 5 failed attempts per IP or home triggers a 30-minute lockout.
- **Exchange:** Successful redemption exchanges the ephemeral code for a long-lived, scoped client token or mTLS certificate tied uniquely to `(tenantId, homeId, deviceId)`.

---

## 3. Webhook & API Security

### 3.1 Webhook Signature Verification
Incoming webhooks (e.g. billing providers, external IoT platforms) require cryptographic verification:
- Header: `X-AETHER-Signature` or `Stripe-Signature`.
- Scheme: HMAC-SHA256 computed over `timestamp + '.' + rawPayload` using a pre-shared webhook secret.
- Replay Protection: Timestamps older than 300 seconds are rejected.

### 3.2 Server-Side Gemini Decision Engine Isolation
- The Gemini API key (`GEMINI_API_KEY`) is stored strictly in server-side environment variables or backend vaults.
- The client-side application never receives or inspects raw API keys.
- Structured output schemas are validated with Zod/JSON Schema before any recommendation is rendered or applied.

---

## 4. Rate Limiting & DoS Mitigation
- Sliding-window algorithm enforced per tenant and per IP.
- Telemetry ingestion endpoints enforce payload size limits (< 10 KB per packet) and rate limits (max 50 Hz burst, 10 Hz sustained per home).
- Gemini decision invocation rate is capped per tenant tier to prevent unbounded LLM costs.

---

## 5. KVKK (Law No. 6698) & GDPR Compliance
1. **Explicit Consent (Açık Rıza):** Presented during home onboarding detailing what telemetry is recorded, retention periods, and purpose.
2. **Data Minimization:** Raw 1 Hz data is rolled up into 1-minute averages after 7 days, and 1-hour averages after 90 days.
3. **Data Export:** Residents can download their complete telemetry history in standard JSON/CSV.
4. **Right to Erasure (Unutulma Hakkı):** One-click account purge irreversibly removes all home telemetry, meter registrations, and historical logs within 48 hours.
