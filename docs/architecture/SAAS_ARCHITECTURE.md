# AETHER SaaS Architecture & Multi-Tenancy Specification

## 1. Executive Summary & Core Principles
AETHER is an autonomous energy and carbon intelligence platform architected as a secure, multi-tenant B2B/B2C SaaS platform.
The architecture enforces five fundamental tenets:
1. **Strict Tenant Data Isolation:** All tenant data is cryptographically and logically isolated at the service, data layer, and API boundaries. No client-side filtering substitutes for server-side verification.
2. **Multi-Home & Estate Hierarchy:** Organizations own one or more properties (detached residential units, residential apartments, collective housing complexes, or commercial buildings).
3. **Data Quality Integrity:** Measurements are strictly tagged by data quality tier (`PHYSICAL_METERED`, `SUB_METERED`, `DERIVED_NILM`, `ESTIMATED`, `MANUAL_BILL`) with explicit confidence scores.
4. **Resilience & Read-Only Safety Boundary:** Default operation is passive, read-only monitoring and autonomous decision support. No automated relay switching or breaker control is executed on physical electrical switchboards without human-in-the-loop and dedicated failsafe interlocks.
5. **Regulatory & Privacy by Design:** Conforms to Turkish KVKK (Law No. 6698) and European GDPR standards regarding high-resolution electrical consumption telemetry.

---

## 2. Multi-Tenant Domain Hierarchy

```
Organization (Tenant)
 ├── Subscription & Entitlement Profile
 ├── Tenant Audit Log
 ├── Organization Members & RBAC Roles (Owner, Energy Manager, Analyst, Auditor, Resident)
 └── Homes / Workspaces (Residential Units, Villas, Commercial Facilities)
      ├── Energy Profile & Tariff Plan (Single-tariff vs. 3-time Time-of-Use)
      ├── Device & Meter Registry
      │    ├── Primary Mains Meter (Smart Meter / CT Clamp / Pulse / Optical)
      │    ├── Sub-Meters (HVAC, Heat Pump, EV Charger)
      │    └── Smart Plugs & IoT Sensors
      ├── Normalization Pipeline
      ├── Energy Intelligence Engine (NILM, Baseline, Phantom Load, Peak Shaving)
      └── Decision Deck & COP31 Carbon Ledger
```

---

## 3. Tenant Isolation & Server-Side Security Model

### 3.3 Database Row-Level Security (RLS) & Persistent Storage
Tenant isolation is enforced directly at the SQL database layer via PostgreSQL Row-Level Security (RLS) policies and indexed foreign keys:
- **Schema Migration:** `supabase/migrations/20261107000000_residential_saas_core.sql` defines tables for `organizations`, `subscriptions`, `organization_members`, `homes`, `devices`, `pairing_tokens`, `rate_limit_buckets`, `audit_logs`, and `webhook_events`.
- **Policy Enforcement:** All queries filter with `WHERE tenant_id = auth.current_tenant_id()`. Cross-tenant queries return zero records at the database engine level.
- **Production Cleanliness:** In-memory maps and seeded demo identities (`Aras Demirtaş`, `Berkan Meral`, etc.) have been completely removed from production runtime classes (`TenantManager`, `DeviceRegistry`, `AuditLogService`). Production paths start clean and require real authenticated registration.

---

## 4. Subscription Tiers & Feature Entitlements

| Feature / Metric | Starter Home (Free / Trial) | Smart Residence (Pro) | Estate Enterprise |
| :--- | :---: | :---: | :---: |
| **Max Homes / Properties** | 1 Home | Up to 5 Homes | Unlimited |
| **Max Connected Devices** | 3 Devices | 25 Devices | Unlimited |
| **Telemetry Resolution** | 1 Minute | 1 Second (Real-time 1 Hz) | Sub-second (Industrial/High-rate) |
| **NILM Disaggregation** | Basic (HVAC + Base) | Full (6 Categories) | Full + Custom Machine Signatures |
| **Gemini AI Decision Engine** | 10 Calls / Day | 500 Calls / Day | 10,000 Calls / Day (Dedicated Endpoint) |
| **Data Retention** | 30 Days | 2 Years | 10 Years (Verifiable Audit Archive) |
| **COP31 Verifiable Certificate** | Standard PDF | Cryptographic Verified | On-chain & External Audit Verified |
| **API & Webhook Access** | ❌ | ✅ (60 req/min) | ✅ (1,000 req/min, Dedicated SLA) |

---

## 5. Billing Provider Abstraction & Honesty
- `IBillingProvider`: Interface defining checkout session creation, HMAC-SHA256 webhook verification, and cancellation.
- `MockBillingProvider`: Restricted strictly to `src/services/saas/testing/MockBillingProvider.ts` for unit tests and CI.
- `ProductionBillingProvider`: Validates HMAC-SHA256 signatures with constant-time equality (`crypto.timingSafeEqual`), checks timestamp drift (within 300 seconds), and enforces webhook event idempotency via the `webhook_events` database unique constraint.
- **Honesty Rule:** Sandbox checkout URLs are never presented as a working billing system. Production checkout throws an explicit configuration error if live payment gateway credentials (`STRIPE_SECRET_KEY`) are unconfigured.

---

## 6. Rate Limiting & DoS Protection
A sliding-window token bucket algorithm protects upstream compute and the Gemini decision engine:
- Tenant-level window: Default 120 requests/minute per tenant.
- Gemini Decision Engine window: 20 invocations/minute per organization.
- IoT Gateway Ingestion endpoint: 50 packets/sec with backpressure buffering.

---

## 7. KVKK / GDPR Compliance & Right to be Forgotten
1. **Data Minimization:** No personal surveillance or room-specific identity markers are stored. High-frequency electrical data is aggregated to 1-minute and 1-hour intervals after retention window.
2. **Data Portability:** Tenants can trigger a JSON/CSV data export containing all raw meter telemetry, normalized events, and audit logs.
3. **Right to Erasure (Purge):** Account deletion permanently cascades across telemetry buffers, pairing tokens, normalized histories, and AI decisions within 48 hours.
