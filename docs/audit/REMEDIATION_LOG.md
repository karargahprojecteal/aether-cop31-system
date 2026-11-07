# AETHER System — Remediation Log
## Technical Defects, Exact Fixes & Regression Test Specifications

- **Target PR:** #1 (`c3e43cf`)
- **Document Purpose:** Engineering instructions and concrete code modifications required to elevate AETHER from `CONDITIONALLY APPROVED` to `APPROVED FOR PRODUCTION`.

---

## 1. Remediation Summary Table

| Defect ID | Category | Severity | Component | Root Cause |
| :--- | :--- | :---: | :--- | :--- |
| **`CRIT-DB-01`** | Database | **CRITICAL** | `20261107000000_residential_saas_core.sql` | Schema `auth` not created prior to defining functions. |
| **`CRIT-DB-02`** | Database | **CRITICAL** | `20261107000000_residential_saas_core.sql` | RLS enabled on `organizations`, `subscriptions`, `organization_members` with 0 policies. |
| **`CRIT-DB-03`** | Database | **CRITICAL** | `20261107000000_residential_saas_core.sql` | `FORCE ROW LEVEL SECURITY` omitted; table owners bypass RLS. |
| **`CRIT-DB-04`** | Database | **HIGH** | `20261107000000_residential_saas_core.sql` | Table `brute_force_locks` missing in PostgreSQL DDL. |
| **`CRIT-DB-05`** | Database | **CRITICAL** | `RateLimiterRepository.ts` | Millisecond epoch integer inserted into `TIMESTAMPTZ` column. |
| **`CRIT-ARCH-06`** | Architecture | **CRITICAL** | `App.tsx` & `DatabaseService.ts` | Browser UI views import Node `node:sqlite` directly. |
| **`HIGH-API-07`** | Security | **HIGH** | `aiServerEndpoint.ts` | Endpoint accepts unauthenticated `tenantId`/`userId` payloads. |
| **`HIGH-AUDIT-08`**| Security | **HIGH** | `AuditLogRepository.ts` | Hash chain forks under concurrency; JSONB normalizes key order. |
| **`HIGH-BILL-09`** | Security | **HIGH** | `ProductionBillingProvider.ts` | Auto-generates random `eventId` when missing in payload. |
| **`MED-GW-10`** | IoT Reliability| **MEDIUM** | `LocalGatewayAdapter.ts` | Unbounded `processedSequenceIds: Set<number>` memory leak. |

---

## 2. Detailed Remediation Blueprints

### 2.1 [CRIT-DB-01 to CRIT-DB-04] PostgreSQL Migration DDL Corrections
**File:** `supabase/migrations/20261107000000_residential_saas_core.sql`

```sql
-- FIX 1: Ensure auth schema exists for self-hosted / standard PostgreSQL
CREATE SCHEMA IF NOT EXISTS auth;

-- FIX 2: Create brute_force_locks table in PostgreSQL migration
CREATE TABLE IF NOT EXISTS brute_force_locks (
    lock_key TEXT PRIMARY KEY,
    failed_count INTEGER NOT NULL DEFAULT 1,
    locked_until_ms BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brute_force_lock ON brute_force_locks(locked_until_ms);

-- FIX 3: Add missing RLS policies for organizations, subscriptions, and members
CREATE POLICY org_members_tenant_isolation ON organization_members
    FOR ALL
    USING (tenant_id = auth.current_tenant_id() OR user_id = auth.uid()::text)
    WITH CHECK (tenant_id = auth.current_tenant_id());

CREATE POLICY org_tenant_isolation ON organizations
    FOR SELECT
    USING (id = auth.current_tenant_id());

CREATE POLICY subscriptions_tenant_isolation ON subscriptions
    FOR SELECT
    USING (tenant_id = auth.current_tenant_id());

-- FIX 4: Add INSERT policy for audit_logs (allows authenticated tenant logging)
CREATE POLICY audit_logs_tenant_insert ON audit_logs
    FOR INSERT
    WITH CHECK (tenant_id = auth.current_tenant_id());

-- FIX 5: Force Row-Level Security across all tenant tables to prevent owner bypass
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE homes FORCE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;
ALTER TABLE pairing_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
```

---

### 2.2 [CRIT-DB-05] RateLimiter Timestamp Cast Fix
**File:** `src/services/persistence/RateLimiterRepository.ts` (L60–L66)

**Current Vulnerable Code:**
```typescript
const upsertStmt = this.db.prepare(`
  INSERT INTO rate_limit_buckets (bucket_key, window_start_ms, request_count, expires_at)
  VALUES (?, ?, 1, ?)
  ON CONFLICT(bucket_key, window_start_ms) DO UPDATE SET request_count = request_count + 1
`);
upsertStmt.run(key, currentSliceMs, expiryMs); // FAILS on PostgreSQL (bigint vs timestamptz)
```

**Remediated Code:**
```typescript
const expiresAtIso = new Date(expiryMs).toISOString();
const upsertStmt = this.db.prepare(`
  INSERT INTO rate_limit_buckets (bucket_key, window_start_ms, request_count, expires_at)
  VALUES (?, ?, 1, ?)
  ON CONFLICT(bucket_key, window_start_ms) DO UPDATE SET request_count = request_count + 1
`);
upsertStmt.run(key, currentSliceMs, expiresAtIso);
```

---

### 2.3 [CRIT-ARCH-06] Decoupling Browser UI from Backend `node:sqlite`
**Files:** `src/App.tsx`, `src/components/saas/OrganizationManagementView.tsx`, `src/components/saas/SubscriptionLimitsView.tsx`

**Root Cause:**
Frontend views directly import `tenantManagerInstance`, which instantiates `DatabaseService` using Node.js `node:sqlite`. In browser runtimes, `node:sqlite` is an empty object, causing runtime crashes.

**Remediation Blueprint:**
1. Abstract `ITenantClient` with two implementations:
   - `LocalHttpTenantClient`: Uses `fetch('/api/tenants/...')` to communicate with serverless API routes.
   - `EmbeddedSqliteTenantClient`: Used exclusively in Node.js server runtimes, Vitest unit tests, and CLI tools.
2. In frontend React components, inject client state through React Context (`TenantProvider`) rather than importing direct Node repository instances.

---

### 2.4 [HIGH-API-07] Server-Side Authentication on AI Endpoint
**File:** `src/services/ai/aiServerEndpoint.ts`

**Remediated Code:**
```typescript
export async function handleAiDecisionEndpoint(
  request: AiDecisionRequest, 
  authHeader?: string
): Promise<AiDecisionResponse> {
  // 1. Verify Authenticated Bearer Session Token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      decisions: [],
      executionTimeMs: 0,
      source: 'DETERMINISTIC_FALLBACK',
      circuitBreakerTripped: false,
      error: '401 Unauthorized: Valid Bearer token required.',
    };
  }

  // 2. Validate session against organization_members database
  // (Ensures token sub corresponds to request.userId and belongs to request.tenantId)
  ...
}
```

---

### 2.5 [HIGH-AUDIT-08] Audit Log Concurrency & RFC 8785 Canonical JSON
**File:** `src/services/persistence/AuditLogRepository.ts`

**Remediation Blueprint:**
1. **Concurrency Serialization:** In PostgreSQL, wrap `record()` in a transaction with table or tenant-row level locking:
   ```sql
   BEGIN;
   SELECT record_hash FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE;
   -- Compute hash with prev_record_hash
   INSERT INTO audit_logs (...) VALUES (...);
   COMMIT;
   ```
2. **Canonical JSON (JCS):** Store `details` in a dedicated `raw_payload TEXT` column, or serialize `details` with deterministic key sorting before computing SHA-256:
   ```typescript
   function canonicalJson(obj: any): string {
     return JSON.stringify(obj, Object.keys(obj).sort());
   }
   ```

---

### 2.6 [HIGH-BILL-09] Enforce Webhook Event ID
**File:** `src/services/saas/billing/ProductionBillingProvider.ts` (L73)

**Current Vulnerable Code:**
```typescript
const eventId = parsedPayload.id || `evt_${crypto.randomBytes(6).toString('hex')}`;
```

**Remediated Code:**
```typescript
const eventId = parsedPayload.id || signatureHeaderParts['event_id'];
if (!eventId) {
  return { valid: false, isReplay: false, error: 'Malformed payload: Required webhook event id is missing' };
}
```

---

### 2.7 [MED-GW-10] Bounded Sequence Ring Buffer for Gateway
**File:** `src/services/adapters/LocalGatewayAdapter.ts` (L39 & L98)

**Remediated Code:**
```typescript
// Replace unbounded Set with bounded circular buffer
private static readonly MAX_DEDUP_CAPACITY = 1000;
private processedSequenceIds: Set<number> = new Set();
private sequenceQueue: number[] = [];

public ingestMqttPacket(packet: GatewayMqttPacket): { ingested: boolean; duplicate: boolean } {
  if (this.processedSequenceIds.has(packet.seq)) {
    return { ingested: false, duplicate: true };
  }

  if (this.sequenceQueue.length >= LocalGatewayAdapter.MAX_DEDUP_CAPACITY) {
    const oldest = this.sequenceQueue.shift();
    if (oldest !== undefined) this.processedSequenceIds.delete(oldest);
  }

  this.sequenceQueue.push(packet.seq);
  this.processedSequenceIds.add(packet.seq);
  ...
}
```

---

## 3. Post-Remediation Acceptance Verification Checklist
- [ ] Run `supabase/migrations/20261107000000_residential_saas_core.sql` against fresh PostgreSQL 15 without errors.
- [ ] Verify `relrowsecurity: true` and `relforcerowsecurity: true` across all 7 tenant tables.
- [ ] Run `test_adversarial_rls.sql` and verify non-superusers can read their own organization and members.
- [ ] Verify `npm run test` passes 100% of integration tests.
- [ ] Verify `npm run build` generates clean client bundle without Node native modules.
- [ ] Sign off release gate as **APPROVED FOR PRODUCTION**.
