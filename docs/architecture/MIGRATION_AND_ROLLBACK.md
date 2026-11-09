# AETHER Database Migration & Rollback Architecture Plan

## 1. Migration Overview
- **Target Schema:** `supabase/migrations/20261107000000_residential_saas_core.sql`
- **Engine Support:** PostgreSQL 16+ (Supabase Cloud / Neon / AWS RDS) and zero-dependency local Node.js `node:sqlite` for isolated integration testing and offline gateways.
- **Isolation Principle:** Row-Level Security (RLS) policies at the database engine level, replacing in-memory TypeScript map filtering with enforceable SQL constraints (`tenant_id = auth.current_tenant_id()`).

---

## 2. Migration Execution Sequence (Zero-Downtime Blue/Green)

### Phase 1: Database Pre-requisites & Extensions
1. Execute `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` and `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`.
2. Verify database connection pooling (`pgbouncer` or Supabase transaction pooling on port 6543).

### Phase 2: Schema DDL Application
Apply migration `20261107000000_residential_saas_core.sql` in strict order to respect foreign key constraints:
1. `organizations` (tenant root)
2. `subscriptions` (tenant billing & quota state)
3. `organization_members` (RBAC & home assignments)
4. `homes` (physical residential dwellings & meter clock offset)
5. `devices` (hardware sensors, CT clamps, and optical probes)
6. `pairing_tokens` (salted hash tokens with 15-minute TTL)
7. `rate_limit_buckets` (sliding-window distributed counters)
8. `audit_logs` (tamper-evident SHA-256 hash-chained ledger)
9. `webhook_events` (idempotency key registry)

### Phase 3: Row-Level Security (RLS) Activation
1. Enable RLS on all tenant-facing tables:
   ```sql
   ALTER TABLE homes ENABLE ROW LEVEL SECURITY;
   ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pairing_tokens ENABLE ROW LEVEL SECURITY;
   ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
   ```
2. Bind security definer functions to Supabase Auth (`auth.uid()`).

### Phase 4: Data Validation & Smoke Test
Run synthetic verification scripts checking:
- Cross-tenant denial verification (Tenant Beta executing `SELECT * FROM homes WHERE id = 'home-alpha'` returns 0 rows).
- Immutability trigger verification (attempting `DELETE FROM audit_logs` returns abort code).
- Pairing atomic consumption test (concurrent UPDATE compare-and-swap).

---

## 3. Rollback Plan

### Triggers for Rollback
- RLS policy misconfiguration causing valid tenant requests to receive 403 Forbidden.
- Database connection pool exhaustion during peak migration traffic.
- Unique constraint violations on unmigrated legacy IDs.

### Automated Rollback Steps
If migration fails before health check sign-off, execute down-migration script:
```sql
-- DOWN MIGRATION (ROLLBACK)
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

---

## 4. Disaster Recovery & Backup SLA
- **Point-in-Time Recovery (PITR):** Continuous WAL archiving enabled with 7-day retention.
- **Recovery Time Objective (RTO):** < 15 minutes.
- **Recovery Point Objective (RPO):** < 30 seconds.
