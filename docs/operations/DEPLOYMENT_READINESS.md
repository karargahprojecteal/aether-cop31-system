# AETHER Production & Deployment Readiness Specification

---

## 1. Readiness State & Deployment Verification Matrix

| Area | Status | Verification & Boundary Notes |
| :--- | :---: | :--- |
| **SaaS Core Architecture** | **READY (PASS)** | Multi-tenant context, RBAC, domain services, audit logging implemented and tested. |
| **Vite SPA / Vercel Build** | **READY (PASS)** | Clean TypeScript build (`tsc -b && vite build`) with zero lint or compilation errors. |
| **Vercel Authentication** | **ENFORCED (PASS)** | Vercel Deployment Protection active; prevents unauthorized public probing. |
| **Simulated HAL Telemetry** | **READY (PASS)** | High-fidelity 1 Hz physics & NILM synthesizer operational for demos and testing. |
| **Home Assistant Integration** | **READY (PASS)** | Token-based integration tested against Home Assistant entity models. |
| **Local Gateway Adapter** | **READY (PASS)** | MQTT over TLS client with buffer/idempotent sequence tracking ready for field gateways. |
| **Manual Bill Ingestion** | **READY (PASS)** | Tested with EPDK 3-time tariffs and single-tier residential bills. |
| **Physical Meter Direct Readout** | **FIELD READY (SIMULATED TEST)** | Optical / P1 byte parser tested with synthetic frames. Field testing requires optical probe hardware. |
| **Utility Distribution Cloud API** | **REGULATION_PENDING (PLANNED)** | Blocked awaiting Turkish DSO / EPDK open data API mandates for residential meters. |
| **Physical Breaker Control** | **BLOCKED BY DESIGN** | Actuated physical control commands blocked by safety policy. System runs strictly in read-only & decision-support mode. |

---

## 2. External Approvals & Regulatory Prerequisites for Full Commercial Rollout
To transition from software SaaS staging to mass residential deployment in Turkey:
1. **EPDK Regulatory Compliance:** If sub-metering is billed to sub-tenants, compliance with EPDK Electricity Market Customer Services Regulation is required.
2. **Distribution Company (DSO) Protocol:** For utility meter optical eye reading, confirm compliance with the specific DSO's seal and optical head access policies.
3. **Certified Electrician Requirement:** Field installation kits must include official notice referencing *Elektrik İç Tesisleri Yönetmeliği* for any panel cover opening.

---

## 3. Environment Configuration & Secret Safeguards
Required environment variables in Vercel:
```bash
# Server-side Gemini API Key (Never prefixed with VITE_)
GEMINI_API_KEY="AIzaSy..."

# Multi-Tenant Auth & Webhook Secrets
AETHER_JWT_SECRET="super-secret-cryptographic-salt"
STRIPE_WEBHOOK_SECRET="whsec_..."
BILLING_PROVIDER="mock" # or "stripe"

# Application Settings
VITE_APP_ENV="production"
```
Client code never accesses `process.env.GEMINI_API_KEY` directly; all AI calls are proxied through server-side controller abstractions or deterministic local fallbacks.
