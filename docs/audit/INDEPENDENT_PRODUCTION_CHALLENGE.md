# AETHER System — Independent Production Security Challenge
## Adversarial Verification & Defensibility Audit of PR #1

- **Repository:** `karargahprojecteal/aether-cop31-system`
- **Branch:** `feature/residential-saas-core`
- **Audit Target HEAD:** `81bc24b`
- **PR:** #1 (`https://github.com/karargahprojecteal/aether-cop31-system/pull/1`)
- **Audit Execution Date:** 2026-11-07
- **Auditor Role:** Independent Principal Security Architect & Red-Team Adversary
- **Methodology:** Live PostgreSQL 15 engine exploitation, runtime AST & persistence inspection, connection pool boundary testing, cryptographic hash chain analysis, and adversarial test suites.

---

## 1. Executive Challenge Verdict

> [!CAUTION]
> ### FINAL VERDICT: NOT APPROVED
>
> **PR #1 MUST NOT BE MERGED INTO MAIN.**
> **PR #1 MUST NOT BE DEPLOYED TO PRODUCTION.**
>
> The previously issued production approval and 100/100 readiness score are **REVOKED**. An independent adversarial challenge reveals critical P0 architectural and security defects:
>
> 1. **[CRIT-SEC-01 / P0] Arbitrary Tenant Takeover & Privilege Escalation:** An RLS policy defect allows *any* authenticated user to insert themselves into *any* organization as an `OWNER`.
> 2. **[CRIT-ARCH-02 / P0] Phantom PostgreSQL Backend Compatibility:** The TypeScript backend has zero PostgreSQL drivers installed and is hardcoded to `node:sqlite`. Furthermore, it executes SQLite-specific syntax (`BEGIN IMMEDIATE`, `ORDER BY rowid`, SQLite triggers) that immediately crashes with fatal syntax errors on PostgreSQL.
> 3. **[CRIT-DB-03 / P0] Non-Deterministic Multi-Tenant Resolution:** `public.current_tenant_id()` performs an unordered `LIMIT 1` query over `organization_members`, locking multi-organization users out of their other tenants or non-deterministically flipping tenant context.
> 4. **[HIGH-AUDIT-04 / P0] Truncation-Blind Audit Ledger:** The audit hash chain has no external cryptographic anchor or external root witness. Deleting tail records (truncation attack) or recalculating forward hashes goes 100% undetected by `verifyIntegrity()`.
> 5. **[HIGH-AUTH-05 / P1] Hardcoded JWT Secret & Bypassed Server-Side Membership:** A hardcoded default signing secret exists in source code, and `handleAiDecisionEndpoint` leaves `tenantRepo` optional, skipping organization membership checks entirely by default.
> 6. **[HIGH-BILL-06 / P1] Webhook Race & Non-Transactional State Update:** Webhook events are inserted outside the transaction that updates subscription tiers, creating state desynchronization upon failures. Out-of-order events overwrite newer subscriptions.

---

## 2. Granular Challenge Findings

```
========================================================================================
FINDING ID   SEVERITY   PILLAR          COMPONENT                EXPLOITABILITY
========================================================================================
CRIT-SEC-01  CRITICAL   DB Security     20261107000000 DDL:L244  Remotely Exploitable (P0)
CRIT-ARCH-02 CRITICAL   Compatibility   AuditLog / RateLimiter   Crash on Postgres (P0)
CRIT-DB-03   CRITICAL   DB Security     20261107000000 DDL:L179  Broken Multi-Tenancy (P0)
HIGH-AUDIT-04 HIGH      Audit Ledger    AuditLogRepository       Undetected Tamper (P0)
HIGH-AUTH-05 HIGH      API Auth        jwtVerifier / aiEndpoint Hardcoded Key / Bypass (P1)
HIGH-BILL-06 HIGH      Billing         ProductionBilling        Out-of-Order / Desync (P1)
========================================================================================
```

---

### Finding 1: [CRIT-SEC-01] [P0] Arbitrary Tenant Takeover via Permissive RLS `WITH CHECK`

- **Severity:** **CRITICAL (P0)**
- **Exact File & Line:** [`supabase/migrations/20261107000000_residential_saas_core.sql#L240-L245`](file:///home/antigravity/aether-system/supabase/migrations/20261107000000_residential_saas_core.sql#L240-L245)
- **Vulnerable Code:**
  ```sql
  CREATE POLICY org_members_tenant_insert ON organization_members
      FOR INSERT
      WITH CHECK (
          (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('OWNER', 'ENERGY_MANAGER'))
          OR (user_id = auth.uid()::text)  -- <--- FATAL DEFECT
      );
  ```

#### Reproduction Command:
Connect as an unprivileged, authenticated user (`Mallory`, UUID `33333333-3333-3333-3333-333333333333`) who is not a member of victim organization `org-alpha`:
```sql
SET ROLE aether_test_app;
SET "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SET "request.jwt.claim.role" = 'authenticated';

INSERT INTO organization_members (id, tenant_id, user_id, email, name, role)
VALUES ('mem-pwn', 'org-alpha', '33333333-3333-3333-3333-333333333333', 'mallory@evil.io', 'Mallory Hacker', 'OWNER');
```

#### Actual Result:
```
INSERT 0 1
SELECT id, tenant_id, user_id, role FROM organization_members WHERE id = 'mem-pwn';
-- Result: mem-pwn | org-alpha | 33333333-3333-3333-3333-333333333333 | OWNER
```
The query succeeds! Mallory is now an `OWNER` of `org-alpha`. `public.current_tenant_id()` now resolves to `org-alpha`, giving Mallory complete read, update, and delete authority over `org-alpha`'s homes, devices, audit logs, and subscriptions.

#### Expected Result:
The statement must be rejected with SQLSTATE `42501` (insufficient_privilege / row-level security policy violation).

#### Remediation:
Remove `OR (user_id = auth.uid()::text)` from `WITH CHECK`. A user must NEVER self-assign organization membership or owner roles without an invitation token or tenant-scoped authorization:
```sql
CREATE POLICY org_members_tenant_insert ON organization_members
    FOR INSERT
    WITH CHECK (
        tenant_id = public.current_tenant_id() 
        AND public.current_user_role() = 'OWNER'
    );
```

#### Regression Test:
Included in `supabase/tests/reacceptance_test.sql` (Adversarial Mallory insert test).

---

### Finding 2: [CRIT-ARCH-02] [P0] Phantom PostgreSQL Backend Compatibility & SQLite Syntax Crashes

- **Severity:** **CRITICAL (P0)**
- **Exact File & Line:**
  - [`src/services/persistence/AuditLogRepository.ts#L52`](file:///home/antigravity/aether-system/src/services/persistence/AuditLogRepository.ts#L52) (`BEGIN IMMEDIATE`)
  - [`src/services/persistence/AuditLogRepository.ts#L56`](file:///home/antigravity/aether-system/src/services/persistence/AuditLogRepository.ts#L56) (`ORDER BY created_at DESC, rowid DESC`)
  - [`src/services/persistence/RateLimiterRepository.ts#L26`](file:///home/antigravity/aether-system/src/services/persistence/RateLimiterRepository.ts#L26) (`BEGIN IMMEDIATE`)
  - [`src/services/persistence/DatabaseService.ts#L1-L7`](file:///home/antigravity/aether-system/src/services/persistence/DatabaseService.ts#L1-L7) (`import { DatabaseSync } from 'node:sqlite'`)
  - [`package.json#L13-L21`](file:///home/antigravity/aether-system/package.json#L13-L21) (Zero PostgreSQL drivers)

#### Root Cause Analysis:
The project claims production PostgreSQL readiness on Supabase, but the TypeScript codebase is exclusively an in-process SQLite application:
1. `package.json` contains no `pg`, `postgres`, or `@supabase/supabase-js`.
2. `DatabaseService` instantiates `node:sqlite.DatabaseSync`.
3. Repositories execute SQLite dialect queries that fail on PostgreSQL:

#### Reproduction Commands & Real PostgreSQL 15 Outputs:
1. **`BEGIN IMMEDIATE;` on PostgreSQL 15:**
   ```bash
   $ psql -h 127.0.0.1 -p 5433 -d aether_challenge_test -c "BEGIN IMMEDIATE;"
   ERROR:  syntax error at or near "IMMEDIATE"
   LINE 1: BEGIN IMMEDIATE;
                 ^
   ```
2. **`ORDER BY rowid` on PostgreSQL 15:**
   ```bash
   $ psql -h 127.0.0.1 -p 5433 -d aether_challenge_test -c "SELECT record_hash FROM audit_logs ORDER BY created_at DESC, rowid DESC LIMIT 1;"
   ERROR:  column "rowid" does not exist
   LINE 1: ...rd_hash FROM audit_logs ORDER BY created_at DESC, rowid DESC...
                                                                ^
   ```
3. **Trigger Syntax in `AuditLogRepository.ts:24` on PostgreSQL 15:**
   ```bash
   $ psql -h 127.0.0.1 -p 5433 -d aether_challenge_test -c "CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(FAIL, '...'); END;"
   ERROR:  syntax error at or near "BEGIN"
   LINE 4:       BEGIN
                 ^
   ```

#### Actual Result:
The application persistence layer cannot connect to, migrate, or run against PostgreSQL. If attached to a PostgreSQL connection, all writes abort immediately on syntax errors.

#### Expected Result:
Repository interfaces must be decoupled from the storage engine, or an actual PostgreSQL client pool (`pg.Pool` or Supabase PostgREST client) must be implemented with dialect-specific queries.

#### Remediation:
1. Implement a database adapter interface (`IDatabaseConnection`) supporting both SQLite and PostgreSQL.
2. Replace SQLite-specific `BEGIN IMMEDIATE` with `BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE` (or parameterized transaction wrapper).
3. Replace `rowid` ordering with `created_at DESC, id DESC`.

---

### Finding 3: [CRIT-DB-03] [P0] Non-Deterministic Tenant Context for Multi-Tenant Users

- **Severity:** **CRITICAL (P0)**
- **Exact File & Line:** [`supabase/migrations/20261107000000_residential_saas_core.sql#L175-L180`](file:///home/antigravity/aether-system/supabase/migrations/20261107000000_residential_saas_core.sql#L175-L180)
- **Vulnerable Code:**
  ```sql
  CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS TEXT AS $$
      SELECT tenant_id 
      FROM organization_members 
      WHERE user_id = auth.uid()::text 
      LIMIT 1;  -- <--- NON-DETERMINISTIC & AMBIGUOUS
  $$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;
  ```

#### Reproduction Command:
Assign a user (`Alice`) to both `org-alpha` (as OWNER) and `org-beta` (as RESIDENT_VIEWER):
```sql
INSERT INTO organization_members (id, tenant_id, user_id, email, name, role)
VALUES ('mem-alice-beta', 'org-beta', '11111111-1111-1111-1111-111111111111', 'alice@alpha.io', 'Alice Viewer', 'RESIDENT_VIEWER');

SET LOCAL ROLE aether_test_app;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT public.current_tenant_id();
SELECT id, name FROM organizations;
```

#### Actual Result:
`public.current_tenant_id()` returns `org-alpha`. Alice CANNOT view or access `org-beta` because RLS filters strictly by `id = public.current_tenant_id()`. The user has no way to switch organizations or specify active tenant scope. Furthermore, under table vacuuming or index rebuilds, `LIMIT 1` without `ORDER BY` can flip to `org-beta` at random.

#### Expected Result:
Multi-tenancy RLS must read the active organization context requested by the client session:
```sql
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS TEXT AS $$
    SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claim.tenant_id', true), ''),
        (SELECT tenant_id FROM organization_members WHERE user_id = auth.uid()::text ORDER BY joined_at ASC LIMIT 1)
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;
```

---

### Finding 4: [HIGH-AUDIT-04] [P0] Undetected Audit Tail Truncation & Lack of External Root Anchor

- **Severity:** **HIGH (P0)**
- **Exact File & Line:** [`src/services/persistence/AuditLogRepository.ts#L141-L179`](file:///home/antigravity/aether-system/src/services/persistence/AuditLogRepository.ts#L141-L179)
- **Vulnerability Description:**
  The hash chain begins at a static constant (`GENESIS_BLOCK_00000...`) and each record references `prev_record_hash`. However:
  1. The tip/head hash is **never anchored outside the database** (e.g., in an external immutable S3 bucket, RFC 3161 timestamping authority, or KMS log).
  2. `verifyIntegrity()` only loops through the records currently present in `audit_logs`.

#### Reproduction Test (`src/test/auditChallenge.test.ts`):
```typescript
it('VULNERABILITY: Tail truncation (record deletion) goes completely undetected by verifyIntegrity()', () => {
  // 1. Record 5 sequential audit logs
  for (let i = 1; i <= 5; i++) {
    auditRepo.record({ tenantId, userId: 'admin-1', action: `ACTION_${i}`, category: 'AUTH', details: { step: i }, severity: 'INFO' });
  }

  // 2. Attacker deletes the last 2 records from the tail
  db.exec('DROP TRIGGER audit_logs_no_delete;');
  db.prepare('DELETE FROM audit_logs WHERE id IN (?, ?)').run(entries[3].id, entries[4].id);

  // 3. Re-verify integrity
  const check = auditRepo.verifyIntegrity(tenantId);
  expect(check.valid).toBe(true);           // PASSES! Deletion was completely undetected!
  expect(check.totalChecked).toBe(3);       // Silently reduced from 5 to 3
});
```

#### Actual Result:
Deleting the last $N$ records or wiping the entire table results in `verifyIntegrity()` returning `{ valid: true }`.

#### Expected Result:
A tamper-evident audit ledger must maintain a monotonic sequence counter and publish or verify its chain root against an external trusted anchor. If records are truncated, the counter gap or hash mismatch with the anchor must trigger a critical tamper alarm.

---

### Finding 5: [HIGH-AUTH-05] [P1] Hardcoded JWT Secret & Optional Membership Check

- **Severity:** **HIGH (P1)**
- **Exact File & Line:**
  - [`src/services/auth/jwtVerifier.ts#L12`](file:///home/antigravity/aether-system/src/services/auth/jwtVerifier.ts#L12)
  - [`src/services/ai/aiServerEndpoint.ts#L34-L38, L88-L90`](file:///home/antigravity/aether-system/src/services/ai/aiServerEndpoint.ts#L34-L38)
- **Vulnerable Code:**
  ```typescript
  // jwtVerifier.ts:12
  export const DEFAULT_JWT_SECRET = process.env.JWT_SECRET || 'aether_secure_jwt_secret_cop31_residential_saas_2026';
  ```
  ```typescript
  // aiServerEndpoint.ts:37
  export async function handleAiDecisionEndpoint(
    request: AiDecisionRequest,
    authHeader?: string,
    tenantRepo?: TenantRepository // <--- OPTIONAL!
  ) {
    ...
    if (tenantRepo) { // <--- SKIPPED IF tenantRepo IS NOT PASSED
      const member = tenantRepo.getMember(verifiedTenantId, verifiedUserId);
      ...
    }
  ```

#### Reproduction Test (`src/test/aiAuthorizationChallenge.test.ts`):
```typescript
it('VULNERABILITY: Hardcoded DEFAULT_JWT_SECRET allows forging arbitrary valid tokens', () => {
  const rogueToken = signJwtToken(
    { sub: 'rogue-actor', tenantId: victimTenant, role: 'OWNER' },
    'aether_secure_jwt_secret_cop31_residential_saas_2026'
  );
  expect(verifyJwtToken(rogueToken).valid).toBe(true);
});

it('VULNERABILITY: Omission of optional tenantRepo completely bypasses membership check', async () => {
  const rogueToken = signJwtToken({ sub: 'non-member-stranger', tenantId: victimTenant });
  const res = await handleAiDecisionEndpoint(
    { tenantId: victimTenant, userId: 'non-member-stranger', telemetry: baseTelemetry },
    `Bearer ${rogueToken}`
    // tenantRepo omitted!
  );
  expect(res.statusCode).not.toBe(403); // Bypassed membership validation!
});
```

#### Actual Result:
Any attacker reading the open-source repository can forge tokens if `process.env.JWT_SECRET` is unset. Furthermore, when `tenantRepo` is not passed, the endpoint never verifies database organization membership.

#### Expected Result:
1. `DEFAULT_JWT_SECRET` fallback must throw a fatal configuration exception in production if `process.env.JWT_SECRET` is missing.
2. `tenantRepo` must be a mandatory, non-optional dependency or instantiated via a default singleton.

---

### Finding 6: [HIGH-BILL-06] [P1] Non-Transactional Webhook Execution & Out-of-Order Regression

- **Severity:** **HIGH (P1)**
- **Exact File & Line:** [`src/services/saas/billing/ProductionBillingProvider.ts#L77-L87`](file:///home/antigravity/aether-system/src/services/saas/billing/ProductionBillingProvider.ts#L77-L87)
- **Vulnerability Description:**
  1. `processWebhookIdempotent` records the webhook event in `webhook_events`, but the subsequent subscription tier change is executed in a separate, disconnected call. If the process crashes between the two steps, retries are rejected as duplicate replays, leaving the subscription permanently un-upgraded.
  2. Webhook verification accepts events without timestamp or version sequence reconciliation. An older event arriving delayed over the network overwrites a newer tier downgrade or cancellation.

#### Reproduction Test (`src/test/billingChallenge.test.ts`):
```typescript
it('VULNERABILITY: Out-of-order webhook delivery overwrites newer state', () => {
  // Nov 7: Customer downgrades to STARTER_HOME
  subRepo.updateTier(tenantAlpha, starterPlan);

  // Delayed Nov 1 upgrade event arrives late
  const res = billingProvider.verifyWebhookDetailed(delayedUpgradePayload, header, webhookSecret);
  expect(res.valid).toBe(true);

  subRepo.updateTier(tenantAlpha, oldUpgradedPlan);
  expect(subRepo.getSubscription(tenantAlpha)?.tier).toBe('SMART_RESIDENCE'); // Regressed!
});
```

---

## 3. Disaster Recovery Rehearsal Audit

The documented down-migration procedure from [`docs/architecture/MIGRATION_AND_ROLLBACK.md`](file:///home/antigravity/aether-system/docs/architecture/MIGRATION_AND_ROLLBACK.md#L56-L73) was executed against an isolated test cluster on port 5433:

```sql
DROP RULE IF EXISTS audit_logs_no_update ON audit_logs;
DROP RULE IF EXISTS audit_logs_no_delete ON audit_logs;
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS brute_force_locks CASCADE;
DROP TABLE IF EXISTS rate_limit_buckets CASCADE;
DROP TABLE IF EXISTS pairing_tokens CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS homes CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP FUNCTION IF EXISTS public.current_user_role();
DROP FUNCTION IF EXISTS public.current_tenant_id();
```

### Empirical Results:
1. **Drop Verification:** Successfully executed with zero hanging relations. `\dt` returned `Did not find any relations.`
2. **Reinstallation & Schema Consistency:** Reapplied `20261107000000_residential_saas_core.sql`. Schema diff between initial `pg_dump` and reinstalled `pg_dump` showed **zero schema divergence** (100% consistent DDL).
3. **Backup Restoration & Data Preservation:** Restored a pre-rollback `pg_dump` into a clean database. All 6 seeded tables and rows were restored with 100% data fidelity (`organizations`, `organization_members`, `subscriptions`, `homes`, `devices`, `audit_logs`).

---

## 4. Production Readiness Scorecard (Re-Assessed)

| Evaluation Dimension | Weight | Original Claimed Score | Audit Challenge Score | Status |
| :--- | :---: | :---: | :---: | :--- |
| **1. Frontend Architecture & Secret Hygiene** | 15% | 100 / 100 | **100 / 100** | **PASSED** (Zero secrets in bundle) |
| **2. Cryptographic Security & Device Pairing** | 15% | 100 / 100 | **90 / 100** | **SUBSTANTIALLY READY** |
| **3. Database Schema, Migrations & PostgreSQL RLS** | 20% | 100 / 100 | **20 / 100** | **CRITICAL DEFECTS (P0)** (Privilege escalation) |
| **4. Backend Persistence Parity & Driver Runtime** | 15% | 100 / 100 | **15 / 100** | **CRITICAL DEFECTS (P0)** (SQLite lock-in, syntax crashes) |
| **5. Audit Log Ledger & Tamper Evidence** | 10% | 100 / 100 | **45 / 100** | **DEFECTS FOUND (P0)** (No external anchor) |
| **6. Billing, Webhooks & Quota Enforcement** | 10% | 100 / 100 | **60 / 100** | **DEFECTS FOUND (P1)** (Non-atomic, out-of-order) |
| **7. Physical Adapter Honesty & IoT Protocols** | 15% | 100 / 100 | **95 / 100** | **PASSED** (Honest reporting) |
| **TOTAL WEIGHTED SCORE** | **100%** | **100.0%** | **57.75% / 100** | **NOT APPROVED** |

---

## 5. Mandatory Remediation Checklist for Re-Audit

Before AETHER can be submitted for another production gate review, the following remediations must be implemented:

- [ ] **P0-1:** Modify `org_members_tenant_insert` RLS policy to remove `OR (user_id = auth.uid()::text)`.
- [ ] **P0-2:** Redesign `public.current_tenant_id()` to read tenant claims from JWT/session settings rather than an unordered `LIMIT 1`.
- [ ] **P0-3:** Install a real PostgreSQL driver (`pg` or `@supabase/supabase-js`) and remove all SQLite-only syntax (`BEGIN IMMEDIATE`, `rowid`, `RAISE(FAIL)`) from backend persistence repositories.
- [ ] **P0-4:** Anchor audit log hash chain roots to an external trusted store or signed tree head to prevent truncation attacks.
- [ ] **P1-5:** Remove `DEFAULT_JWT_SECRET` hardcoded fallback and mandate non-optional server-side membership validation in `handleAiDecisionEndpoint`.
- [ ] **P1-6:** Wrap webhook idempotency recording and subscription updates inside an atomic database transaction.
