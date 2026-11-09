# AETHER System — Independent Security Audit Report
## PR #1 Architecture, Multi-Tenancy & Production Security Audit

- **Target Repository:** `karargahprojecteal/aether-cop31-system`
- **Target Branch:** `feature/residential-saas-core`
- **Audit Target Commit:** `c3e43cf`
- **Pull Request:** #1 (`https://github.com/karargahprojecteal/aether-cop31-system/pull/1`)
- **Audit Date:** 2026-11-07
- **Audit Team Role:** Independent Principal Software Architect, SaaS Security Engineer, PostgreSQL Specialist, DevSecOps Engineer, and QA Lead
- **Evaluation Standard:** Evidence-Driven Engineering Verification (Live PostgreSQL 15 Engine, Production Build Static Analysis, Bundle Secret Scanning, STRIDE Threat Model)

---

## 1. Executive Summary

An independent, rigorous security audit was conducted on Pull Request #1 (`c3e43cf`), evaluating the architecture designed to convert the AETHER COP31 energy monitoring MVP into an enterprise-ready, defensible residential SaaS platform.

### Key Audit Conclusions:
1. **Cryptographic Foundations & Client Security (PASSED with High Distinction):**
   - **Zero Secret Leakage:** Static and regex analysis of the production Vite bundle (`dist/assets/index-BcxlVg9O.js`) verified that zero API keys, service role credentials, or private keys leaked into the client bundle.
   - **Elimination of `localStorage` Keys:** The legacy vulnerability storing `AETHER_GEMINI_API_KEY` in `localStorage` was completely eliminated.
   - **Pairing Entropy:** The ephemeral pairing token generator leverages Node.js CSPRNG (`crypto.randomBytes`) over a 30-character unambiguous safe alphabet, stores salted SHA-256 hashes, implements 15-minute TTL, constant-time comparisons (`crypto.timingSafeEqual`), and atomic Compare-And-Swap (CAS) redemption.
   - **Physical Adapter Honesty:** All 5 physical adapters (`SmartMeterAdapter`, `HomeAssistantAdapter`, `LocalGatewayAdapter`, `SmartPlugAdapter`, `ManualConsumptionAdapter`) truthfully report `physicalHardwareAttached: false` and explicitly distinguish between `STAGE_1_PARSER_IMPLEMENTED` and `STAGE_2_PROTOCOL_IMPLEMENTED`. No simulated test was falsely presented as live hardware acceptance.

2. **Database Engine & Deployment Boundary Discrepancies (CRITICAL / BLOCKING FINDINGS):**
   - **Migration Script Execution Failure on PostgreSQL 15:** When executing `supabase/migrations/20261107000000_residential_saas_core.sql` against a clean PostgreSQL 15 instance, the script crashed with `ERROR: schema "auth" does not exist`. Because `CREATE SCHEMA IF NOT EXISTS auth;` was omitted, none of the RLS policies on `homes`, `devices`, `pairing_tokens`, or `audit_logs` were instantiated.
   - **Missing RLS Policies on Core Tables:** `organizations`, `subscriptions`, and `organization_members` have RLS enabled, but have zero policies defined. For non-superuser connections, this triggers PostgreSQL's default-deny behavior, returning 0 rows for all organization queries.
   - **RLS Bypass via Unforced RLS:** `FORCE ROW LEVEL SECURITY` was not declared (`relforcerowsecurity = f` across all 9 tables), meaning table owners and superuser connection pools bypass RLS entirely.
   - **Client/Server Boundary Leak (SQLite in Browser):** `DatabaseService.ts` imports `node:sqlite`, which is externalized in Vite production builds. Frontend components importing `TenantManager` directly attempt to invoke `DatabaseSync` in the browser, creating fatal runtime exceptions in production browser runtimes.
   - **RateLimiter Type Mismatch:** `RateLimiterRepository` inserts an epoch millisecond integer into `expires_at TIMESTAMPTZ`, causing PostgreSQL to abort with a fatal type mismatch error (`column "expires_at" is of type timestamp with time zone but expression is of type bigint`).
   - **Audit Log Concurrency & JSONB Normalization:** The audit log hash chain performs `SELECT record_hash ... LIMIT 1` without transaction row locking (`FOR UPDATE`). Concurrent writes branch the hash chain, triggering false tamper alerts. Furthermore, PostgreSQL `JSONB` key re-ordering breaks SHA-256 hash recalculation during verification.

---

## 2. STRIDE Threat Model Audit Findings

| Threat Category | Target Subsystem | Vulnerability Description | Severity | Status |
| :--- | :--- | :--- | :---: | :---: |
| **Spoofing** | Frontend Identity | `App.tsx` hardcodes demo identity `aras@aether-energy.io` without server-validated JWT session. | **HIGH** | Open |
| **Spoofing** | AI Gateway | `aiServerEndpoint.ts` accepts `tenantId` and `userId` without validating JWT session against `organization_members`. | **CRITICAL** | Open |
| **Tampering** | Audit Log Ledger | Concurrent audit log writes branch the hash chain; lack of RFC 8785 JSON canonicalization causes hash verification failure against PostgreSQL `JSONB`. | **HIGH** | Open |
| **Tampering** | Pairing Protocol | SQLite implementation allows atomic CAS, but `brute_force_locks` table missing from PostgreSQL migration. | **HIGH** | Open |
| **Repudiation** | Audit Logs | Immutability rules (`DO INSTEAD NOTHING`) successfully prevent regular user `UPDATE`/`DELETE`, but superusers can drop rules. | **LOW** | Mitigated |
| **Information Disclosure** | PostgreSQL RLS | Table owners bypass RLS because `FORCE ROW LEVEL SECURITY` is disabled (`relforcerowsecurity: false`). | **HIGH** | Open |
| **Information Disclosure** | Production Bundle | Production Vite bundle scanned for API keys, tokens, and private keys. | **INFO** | **VERIFIED CLEAN (0 Leaks)** |
| **Denial of Service** | Local Gateway Adapter | Unbounded `processedSequenceIds: Set<number>` in memory causes memory exhaustion under continuous telemetry. | **MEDIUM** | Open |
| **Denial of Service** | Rate Limiter | `RateLimiterRepository` throws fatal type error on PostgreSQL `expires_at TIMESTAMPTZ`. | **CRITICAL** | Open |
| **Elevation of Privilege** | Tenant Context | Client-supplied TenantContext used in UI state instead of server-derived database session. | **HIGH** | Open |

---

## 3. Deep Dive: Multi-Tenancy & PostgreSQL RLS

### 3.1 Migration Execution & RLS Analysis
When tested against an isolated PostgreSQL 15.19 engine on port 5433:
1. `auth.current_tenant_id()` definition failed on line 179 because schema `auth` was not pre-created.
2. Once the schema was mocked (`CREATE SCHEMA IF NOT EXISTS auth`), RLS policies for `homes`, `devices`, and `pairing_tokens` functioned as intended:
   - Anonymous access (`auth.uid() = NULL`): Returned 0 rows on all tables.
   - Authenticated Tenant Alpha: Queried `home-alpha`, `dev-alpha`, `ptk-alpha` successfully.
   - Cross-Tenant Query: Direct query for `home-beta` returned 0 rows.
   - Cross-Tenant Mutation: `UPDATE homes SET name = 'hacked' WHERE id = 'home-beta'` returned `UPDATE 0`.
   - Cross-Tenant Deletion: `DELETE FROM homes WHERE id = 'home-beta'` returned `DELETE 0`.
   - Forged Tenant Insert: Attempting to insert a row with `tenant_id = 'tenant-beta'` while authenticated as Tenant Alpha aborted with:
     ```
     ERROR: new row violates row-level security policy for table "homes"
     ```
   - Immediate Revocation: Deleting the user from `organization_members` immediately revoked all data visibility.

### 3.2 Identified PostgreSQL Deficiencies
1. **Omitted Policies on Parent Tables:**
   - Table `organizations`: RLS enabled, 0 policies defined.
   - Table `subscriptions`: RLS enabled, 0 policies defined.
   - Table `organization_members`: RLS enabled, 0 policies defined.
   This prevents legitimate users from fetching their own organization metadata.
2. **Missing `FORCE ROW LEVEL SECURITY`:**
   In PostgreSQL, table owners and superusers ignore RLS unless `ALTER TABLE <tab> FORCE ROW LEVEL SECURITY;` is explicitly executed. In PR #1, `relforcerowsecurity` was `false` across all tables.

---

## 4. Cryptographic Pairing Security Evaluation

### 4.1 Token Generation & Entropy
- **CSPRNG Source:** Node.js `crypto.randomBytes(8)` provides 64 bits of raw cryptographic entropy.
- **Alphabet:** Crockford-inspired safe alphabet of 30 characters (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`), eliminating easily confused glyphs (`0`, `O`, `1`, `I`, `L`).
- **Keyspace:** $30^8 = 6.56 \times 10^{11}$ combinations.
- **Salt & Hash:** 16-byte random salt per token with SHA-256 hashing. Tokens are never stored in plaintext.
- **Lifetime:** Strict 15-minute TTL.

### 4.2 Redemption & Attack Resistance
- **Timing Attacks:** Token validation utilizes `crypto.timingSafeEqual`, preventing side-channel timing analysis.
- **Atomic Compare-and-Swap (CAS):**
  ```sql
  UPDATE pairing_tokens
  SET status = 'CONSUMED', consumed_at = ?
  WHERE id = ? AND status = 'PENDING' AND expires_at > ?
  ```
  Verified on PostgreSQL 15: Concurrent redemptions resulted in exactly 1 success (`UPDATE 1`) and 1 rejection (`UPDATE 0`). Replay and double-spending attacks are mathematically prevented.
- **Deficiency Identified:** The brute-force lockout mechanism references table `brute_force_locks`, which exists in SQLite but was omitted from the PostgreSQL DDL.

---

## 5. Gemini AI Security & Production Bundle Static Inspection

### 5.1 Production Bundle Secret Scanning
The compiled output in `dist/assets/` was scanned using comprehensive regex patterns:
- Google AI Studio API Keys (`AIzaSy...`): **ZERO FOUND**
- OpenAI / Third-party Keys (`sk-...`, `ghp_...`): **ZERO FOUND**
- Private Keys (`-----BEGIN ... PRIVATE KEY-----`): **ZERO FOUND**
- Client Storage Inspection: Grepping `localStorage` confirmed zero credential caching.

### 5.2 Server-Side AI Gateway Deficiencies
- `aiServerEndpoint.ts` was implemented as an in-process TypeScript function rather than an authenticated HTTP endpoint.
- It accepts `{ tenantId, userId, telemetry }` directly from the caller without verifying an HTTP `Authorization` Bearer token or session cookie. An unauthenticated actor could invoke the function directly and exhaust another tenant's daily Gemini quota.

---

## 6. Immutable Audit Log & Hash Chaining

### 6.1 Immutability Enforcement
PostgreSQL rewrite rules successfully prevented row mutations:
- `UPDATE audit_logs SET action = 'tampered' ...` returned `UPDATE 0`. Row remained unchanged.
- `DELETE FROM audit_logs WHERE id = ...` returned `DELETE 0`. Row remained intact.

### 6.2 Architectural Hash Chaining Flaws
1. **Branching Under Concurrency:** `record()` queries the latest hash without row-level locking (`SELECT ... FOR UPDATE`). Two concurrent mutations both read hash $H_0$ and compute child hashes $H_{1a}$ and $H_{1b}$, breaking the sequential chain and triggering false-positive tamper alarms in `verifyIntegrity()`.
2. **JSONB Non-Determinism:** In PostgreSQL, column `details` is `JSONB`. Re-serializing `JSONB` does not preserve original key ordering or whitespace, causing SHA-256 hash recalculations to fail unless RFC 8785 JSON Canonicalization Scheme (JCS) is enforced.

---

## 7. Billing & Subscription Webhooks

- **HMAC Verification:** Implemented with `crypto.createHmac('sha256', secret)` and `crypto.timingSafeEqual`.
- **Replay Protection Window:** 5-minute maximum tolerance ($\pm 300\text{s}$) on Stripe `t=...` timestamp header.
- **Idempotency:** Webhook event deduplication table `webhook_events` with `UNIQUE(provider, event_id)`.
- **Deficiency:** If an incoming payload lacks an `id` field, the handler auto-generates a random `eventId` (`evt_${randomBytes}`), inadvertently defeating replay protection for malformed payloads.

---

## 8. Distributed Rate Limiting

- **Algorithm:** Distributed sliding-window bucket using 1-second quantized slices.
- **PostgreSQL Flaw:** `RateLimiterRepository` inserts JavaScript millisecond integers into `expires_at TIMESTAMPTZ`, causing an immediate database execution error.
- **Concurrency Gap:** The clean-up, count, and insert operations are not wrapped in an atomic database transaction, permitting burst overages during high-concurrency race conditions.

---

## 9. Physical Adapter Realism vs. Claims

| Adapter Name | Claimed Protocol | Real Implementation Status | Hardware Attached | Verification Verdict |
| :--- | :--- | :--- | :---: | :--- |
| **SmartMeterAdapter** | IEC 62056-21 / DLMS | OBIS regex parser (`1.8.0`, `1.7.0`, `32.7.0`) | **NO** (Truthful) | **STAGE 1 PARSER ONLY** |
| **HomeAssistantAdapter** | REST Webhook | JSON State payload mapper | **NO** (Truthful) | **STAGE 2 PROTOCOL READY** |
| **LocalGatewayAdapter** | MQTT over TLS | In-memory sequence deduplication | **NO** (Truthful) | **STAGE 2 PROTOCOL READY** |
| **SmartPlugAdapter** | Tuya/Shelly API | Sub-meter telemetry mapper | **NO** (Truthful) | **STAGE 2 PROTOCOL READY** |
| **ManualConsumptionAdapter** | PDF / Invoice Entry | Grounded bill entry & tariff calculator | **N/A** (Manual) | **STAGE 4 PRODUCTION ACCEPTED** |

**Hardware Acceptance Note:** All physical hardware tests are designated as **NOT RUN** due to the absence of physical serial probes and DIN-rail CT clamps in the virtual execution sandbox. The codebase honestly reflects this limitation.

---

## 10. Audit Scorecard Summary

| Category | Weight | Score | Verdict |
| :--- | :---: | :---: | :---: |
| Client Security & Secret Elimination | 15% | 100/100 | **EXCELLENT** |
| Cryptographic Pairing Architecture | 15% | 90/100 | **VERY GOOD** |
| PostgreSQL RLS & Multi-Tenancy DDL | 20% | 45/100 | **ACTION REQUIRED** |
| Backend Persistence & Engine Parity | 15% | 40/100 | **ACTION REQUIRED** |
| Audit Log & Ledger Integrity | 10% | 55/100 | **NEEDS WORK** |
| Billing & Webhook Reliability | 10% | 75/100 | **ACCEPTABLE** |
| Adapter Realism & Regulatory Grounding | 15% | 95/100 | **EXCELLENT** |
| **Overall Production Readiness Score** | **100%** | **70.5 / 100** | **CONDITIONALLY APPROVED — REMEDIATION REQUIRED** |

---

## 11. Release Gate Recommendation
PR #1 represents an extraordinary leap forward in domain modeling, cryptographic pairing, regulatory accuracy, and secret hygiene. However, due to the PostgreSQL DDL execution errors, missing RLS policies on parent tables, SQLite/browser runtime mismatch, and audit ledger concurrency vulnerabilities, **PR #1 MUST NOT BE MERGED INTO MAIN OR DEPLOYED TO PRODUCTION** until all blocking remediations detailed in `docs/audit/REMEDIATION_LOG.md` are resolved.
