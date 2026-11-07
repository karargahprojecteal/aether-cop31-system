# AETHER Residential & SaaS Automated Test Matrix

---

## 1. Test Suite Architecture & Scenarios

| Test Suite Category | Test File | Target Coverage & Verification Assertions |
| :--- | :--- | :--- |
| **Multi-Tenancy & Isolation** | `src/test/tenantIsolation.test.ts` | 1. Tenant A cannot read or mutate Tenant B's homes.<br>2. Tenant context prevents cross-tenant device queries.<br>3. Security violation audits are emitted on boundary breach. |
| **Pairing & Device Registry** | `src/test/pairingService.test.ts` | 1. Ephemeral pairing token generation with 15-min TTL.<br>2. Expired tokens are rejected.<br>3. Single-use enforcement (consumed tokens cannot be reused).<br>4. Brute force lockout after 5 invalid attempts. |
| **Data Normalization & Provenance** | `src/test/energyNormalizer.test.ts` | 1. Canonical conversion of $W, kW, Wh, kWh$.<br>2. Proper tag assignment (`PHYSICAL_METERED`, `SUB_METERED`, `DERIVED_NILM`, `MANUAL_BILL`).<br>3. Confidence score preservation. |
| **Hardware Adapters & Offline Buffering**| `src/test/adapters.test.ts` | 1. P1/Optical DLMS OBIS code parsing & CRC validation.<br>2. Home Assistant token handshake and entity mapping.<br>3. Local Gateway offline buffer deduplication (idempotency via sequence IDs).<br>4. Smart plug sub-meter identification (`isSubMeteredOnly = true`). |
| **Energy Intelligence & NILM Confidence** | `src/test/energyIntelligence.test.ts`| 1. Phantom load detection thresholding.<br>2. Separation of physical readings vs. ML disaggregation.<br>3. Peak shaving multi-time tariff shift savings calculation.<br>4. Accurate CO2e conversion using Turkish TEİAŞ grid factor. |
| **SaaS Billing & Subscription Limits** | `src/test/subscriptionLimits.test.ts`| 1. Starter Home quota limits (max 1 home, max 3 devices).<br>2. Pro tier upgrade unlocking multi-home and 1 Hz telemetry.<br>3. Signed webhook HMAC-SHA256 signature verification. |
| **Rate Limiter & API Safety** | `src/test/rateLimiter.test.ts` | 1. Sliding window request throttling.<br>2. Tenant burst mitigation and recovery. |

---

## 2. Test Execution Standard
All automated tests run via Vitest:
```bash
npm run test
```
Tests utilize strictly deterministic mock environments and synthetic byte fixtures. No active electrical hardware or live credit cards are touched during test cycles.
