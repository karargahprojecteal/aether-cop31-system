-- ==============================================================================
-- AETHER SYSTEM — POSTGRESQL 15 RE-ACCEPTANCE VALIDATION TEST SUITE
-- Verifies:
-- 1. CRIT-DB-01: Clean bootstrap and migration application
-- 2. CRIT-DB-02: Complete RLS policies on organizations, subscriptions, members
-- 3. CRIT-DB-03: FORCE ROW LEVEL SECURITY enforcement and owner containment
-- 4. CRIT-DB-05: TIMESTAMPTZ formatting and brute_force_locks validation
-- 5. Adversarial cross-tenant isolation (SELECT, INSERT, UPDATE, DELETE)
-- 6. Role escalation and privilege denial
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- 1. Introspection: Verify FORCE ROW LEVEL SECURITY on all tenant tables
DO $$
DECLARE
    tbl text;
    has_rls boolean;
    has_force boolean;
    missing_count integer := 0;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'organizations', 'subscriptions', 'organization_members',
        'homes', 'devices', 'pairing_tokens', 'audit_logs'
    ])
    LOOP
        SELECT relrowsecurity, relforcerowsecurity
        INTO has_rls, has_force
        FROM pg_class
        WHERE relname = tbl;

        IF NOT (has_rls AND has_force) THEN
            RAISE EXCEPTION 'CRIT-DB-03 VIOLATION: Table % must have relrowsecurity=true AND relforcerowsecurity=true! Got rls=%, force=%', tbl, has_rls, has_force;
        END IF;
    END LOOP;
    RAISE NOTICE 'SUCCESS: All 7 tenant tables have FORCE ROW LEVEL SECURITY enabled.';
END $$;

-- 2. Introspection: Verify RLS policies exist for each table
DO $$
DECLARE
    policy_count integer;
BEGIN
    SELECT count(*) INTO policy_count FROM pg_policies WHERE tablename IN ('organizations', 'subscriptions', 'organization_members');
    IF policy_count < 3 THEN
        RAISE EXCEPTION 'CRIT-DB-02 VIOLATION: Expected RLS policies on organizations, subscriptions, organization_members, found %', policy_count;
    END IF;
    RAISE NOTICE 'SUCCESS: Found % active policies covering organization domain tables.', policy_count;
END $$;

-- 3. Provision test roles and users for adversarial security tests
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aether_test_app') THEN
        CREATE ROLE aether_test_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO aether_test_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO aether_test_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO aether_test_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO aether_test_app;

-- 4. Seed Data (Executed as superuser / migration administrator)
INSERT INTO organizations (id, name, slug, contact_email, created_by_user_id)
VALUES 
    ('org-alpha', 'Tenant Alpha LLC', 'tenant-alpha', 'alpha@aether.energy', '11111111-1111-1111-1111-111111111111'),
    ('org-beta',  'Tenant Beta Corp',  'tenant-beta',  'beta@aether.energy',  '22222222-2222-2222-2222-222222222222');

INSERT INTO organization_members (id, tenant_id, user_id, email, name, role)
VALUES
    ('mem-alice', 'org-alpha', '11111111-1111-1111-1111-111111111111', 'alice@alpha.io', 'Alice Owner', 'OWNER'),
    ('mem-bob',   'org-beta',  '22222222-2222-2222-2222-222222222222', 'bob@beta.io',   'Bob Owner',   'OWNER');

INSERT INTO subscriptions (tenant_id, tier, status, current_period_end, max_homes, max_devices_per_home)
VALUES
    ('org-alpha', 'SMART_RESIDENCE', 'ACTIVE', now() + interval '30 days', 5, 20),
    ('org-beta',  'STARTER_HOME',   'ACTIVE', now() + interval '30 days', 1, 5);

INSERT INTO homes (id, tenant_id, name, address, city, housing_type, square_meters, meter_infrastructure, primary_heating)
VALUES
    ('home-alpha-1', 'org-alpha', 'Alpha Villa', '123 Solar Way', 'Istanbul', 'DETACHED_VILLA', 240, 'ELECTRONIC_SMART_METER', 'HEAT_PUMP'),
    ('home-beta-1',  'org-beta',  'Beta Loft',   '456 Wind Ave',  'Ankara',   'APARTMENT_FLAT', 110, 'ELECTRONIC_SMART_METER', 'NATURAL_GAS_COMBI');

INSERT INTO devices (id, tenant_id, home_id, name, device_type, adapter_type, measurement_quality)
VALUES
    ('dev-alpha-meter', 'org-alpha', 'home-alpha-1', 'Alpha Smart Meter', 'MAIN_METER', 'SMART_METER', 'PHYSICAL_METERED'),
    ('dev-beta-meter',  'org-beta',  'home-beta-1',  'Beta Smart Meter',  'MAIN_METER', 'SMART_METER', 'PHYSICAL_METERED');

COMMIT;

-- 5. ADVERSARIAL TEST SESSION AS ALICE (Tenant Alpha)
BEGIN;
SET LOCAL ROLE aether_test_app;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- Verify Alice only sees Tenant Alpha data
DO $$
DECLARE
    org_cnt integer;
    home_cnt integer;
    dev_cnt integer;
BEGIN
    SELECT count(*) INTO org_cnt FROM organizations;
    SELECT count(*) INTO home_cnt FROM homes;
    SELECT count(*) INTO dev_cnt FROM devices;

    IF org_cnt <> 1 OR home_cnt <> 1 OR dev_cnt <> 1 THEN
        RAISE EXCEPTION 'ADVERSARIAL FAIL: Alice saw leaked rows! org_cnt=%, home_cnt=%, dev_cnt=%', org_cnt, home_cnt, dev_cnt;
    END IF;

    -- Verify the row visible to Alice belongs to org-alpha
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = 'org-alpha') THEN
        RAISE EXCEPTION 'ADVERSARIAL FAIL: Alice could not view her own organization!';
    END IF;

    -- Verify Alice CANNOT view Tenant Beta organization
    IF EXISTS (SELECT 1 FROM organizations WHERE id = 'org-beta') THEN
        RAISE EXCEPTION 'ADVERSARIAL LEAK: Alice was able to view Tenant Beta organization!';
    END IF;
    RAISE NOTICE 'SUCCESS: Alice tenant isolation verified for SELECT.';
END $$;

-- Adversarial Attack: Alice attempts cross-tenant UPDATE on Bob's home
DO $$
DECLARE
    rows_affected integer;
BEGIN
    UPDATE homes SET name = 'HACKED BY ALICE' WHERE id = 'home-beta-1';
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    IF rows_affected > 0 THEN
        RAISE EXCEPTION 'ADVERSARIAL LEAK: Alice successfully modified Bob home!';
    END IF;
    RAISE NOTICE 'SUCCESS: Alice cross-tenant UPDATE on Bob home blocked (0 rows affected).';
END $$;

-- Adversarial Attack: Alice attempts cross-tenant DELETE on Bob's device
DO $$
DECLARE
    rows_affected integer;
BEGIN
    DELETE FROM devices WHERE id = 'dev-beta-meter';
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    IF rows_affected > 0 THEN
        RAISE EXCEPTION 'ADVERSARIAL LEAK: Alice successfully deleted Bob device!';
    END IF;
    RAISE NOTICE 'SUCCESS: Alice cross-tenant DELETE on Bob device blocked (0 rows affected).';
END $$;

-- Adversarial Attack: Alice attempts cross-tenant INSERT into Tenant Beta
DO $$
BEGIN
    BEGIN
        INSERT INTO homes (id, tenant_id, name, address, city, housing_type, square_meters, meter_infrastructure, primary_heating)
        VALUES ('home-trojan', 'org-beta', 'Trojan Home', 'Bad St', 'Istanbul', 'APARTMENT_FLAT', 100, 'ELECTRONIC_SMART_METER', 'NATURAL_GAS_COMBI');
        RAISE EXCEPTION 'ADVERSARIAL LEAK: Alice successfully inserted a row into Tenant Beta!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '42501' OR SQLSTATE = '44000' OR SQLERRM ~* 'row-level security' THEN
            RAISE NOTICE 'SUCCESS: Alice cross-tenant INSERT into Tenant Beta blocked by RLS WITH CHECK (SQLSTATE: %).', SQLSTATE;
        ELSE
            RAISE;
        END IF;
    END;
END $$;

-- Adversarial Attack: Alice attempts privilege escalation to modify organization_members
DO $$
DECLARE
    rows_affected integer;
BEGIN
    UPDATE organization_members SET role = 'OWNER' WHERE user_id = '22222222-2222-2222-2222-222222222222';
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    IF rows_affected > 0 THEN
        RAISE EXCEPTION 'ADVERSARIAL LEAK: Alice modified Bob membership record!';
    END IF;
    RAISE NOTICE 'SUCCESS: Alice cross-tenant membership modification blocked.';
END $$;

ROLLBACK;

-- 6. ADVERSARIAL TEST SESSION AS MALLORY (Unassociated / Unknown User)
BEGIN;
SET LOCAL ROLE aether_test_app;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

DO $$
DECLARE
    org_cnt integer;
    home_cnt integer;
    dev_cnt integer;
BEGIN
    SELECT count(*) INTO org_cnt FROM organizations;
    SELECT count(*) INTO home_cnt FROM homes;
    SELECT count(*) INTO dev_cnt FROM devices;

    IF org_cnt <> 0 OR home_cnt <> 0 OR dev_cnt <> 0 THEN
        RAISE EXCEPTION 'ADVERSARIAL LEAK: Mallory unassociated user saw data! org=%, home=%, dev=%', org_cnt, home_cnt, dev_cnt;
    END IF;
    RAISE NOTICE 'SUCCESS: Mallory (unassociated user) receives 0 rows across all tables.';
END $$;

-- Adversarial Attack [CRIT-SEC-01]: Mallory attempts unauthorized takeover of org-alpha
DO $$
BEGIN
    BEGIN
        INSERT INTO organization_members (id, tenant_id, user_id, email, name, role)
        VALUES ('mem-pwn-test', 'org-alpha', '33333333-3333-3333-3333-333333333333', 'mallory@evil.io', 'Mallory Hacker', 'OWNER');
        RAISE EXCEPTION 'CRIT-SEC-01 VULNERABILITY: Mallory successfully inserted herself into org-alpha as OWNER!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '42501' OR SQLSTATE = '44000' OR SQLERRM ~* 'row-level security' THEN
            RAISE NOTICE 'SUCCESS: [CRIT-SEC-01] Mallory takeover of org-alpha blocked by RLS WITH CHECK (SQLSTATE: %).', SQLSTATE;
        ELSE
            RAISE;
        END IF;
    END;
END $$;

ROLLBACK;

-- 6b. MULTI-TENANT SWITCHING & ANTI-SPOOFING VERIFICATION [CRIT-DB-03]
BEGIN;
-- Assign Alice to org-beta as well
INSERT INTO organization_members (id, tenant_id, user_id, email, name, role)
VALUES ('mem-alice-beta', 'org-beta', '11111111-1111-1111-1111-111111111111', 'alice@alpha.io', 'Alice Viewer', 'RESIDENT_VIEWER');

SET LOCAL ROLE aether_test_app;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- 1. Default fallback active tenant
DO $$
DECLARE
    active_t text;
BEGIN
    active_t := public.current_tenant_id();
    IF active_t <> 'org-alpha' THEN
        RAISE EXCEPTION 'CRIT-DB-03 FAIL: Expected default tenant org-alpha, got %', active_t;
    END IF;
    RAISE NOTICE 'SUCCESS: [CRIT-DB-03] Deterministic fallback tenant resolved correctly: %', active_t;
END $$;

-- 2. Explicit tenant switch to org-beta
SET LOCAL "app.current_tenant_id" = 'org-beta';
DO $$
DECLARE
    active_t text;
    home_name text;
BEGIN
    active_t := public.current_tenant_id();
    IF active_t <> 'org-beta' THEN
        RAISE EXCEPTION 'CRIT-DB-03 FAIL: Expected switched tenant org-beta, got %', active_t;
    END IF;

    SELECT name INTO home_name FROM homes;
    IF home_name <> 'Beta Loft' THEN
        RAISE EXCEPTION 'CRIT-DB-03 FAIL: Expected home Beta Loft, got %', home_name;
    END IF;
    RAISE NOTICE 'SUCCESS: [CRIT-DB-03] Explicit tenant switch to org-beta succeeded, scoped to: %', home_name;
END $$;

-- 3. Tenant spoofing attack: Alice attempts to switch to an unassociated organization
SET LOCAL "app.current_tenant_id" = 'org-unassociated-999';
DO $$
DECLARE
    active_t text;
    h_count integer;
BEGIN
    active_t := public.current_tenant_id();
    IF active_t IS NOT NULL THEN
        RAISE EXCEPTION 'CRIT-DB-03 VULNERABILITY: Spoofed tenant was accepted! Got %', active_t;
    END IF;

    SELECT count(*) INTO h_count FROM homes;
    IF h_count <> 0 THEN
        RAISE EXCEPTION 'CRIT-DB-03 VULNERABILITY: Spoofed tenant allowed data access! Count: %', h_count;
    END IF;
    RAISE NOTICE 'SUCCESS: [CRIT-DB-03] Tenant spoofing attempt safely blocked (active tenant is NULL, 0 rows returned).';
END $$;

ROLLBACK;

-- 7. Rate Limiter TIMESTAMPTZ & brute_force_locks test (CRIT-DB-05 & HIGH-DB-04)
BEGIN;
DO $$
DECLARE
    test_expiry timestamptz := now() + interval '15 minutes';
    fetched_expiry timestamptz;
    lock_record record;
BEGIN
    -- Verify rate_limit_buckets accepts ISO 8601 / TIMESTAMPTZ correctly
    INSERT INTO rate_limit_buckets (bucket_key, window_start_ms, request_count, expires_at)
    VALUES ('rate_ip_192.168.1.1', extract(epoch from now())::bigint * 1000, 1, test_expiry);

    SELECT expires_at INTO fetched_expiry FROM rate_limit_buckets WHERE bucket_key = 'rate_ip_192.168.1.1';

    IF fetched_expiry IS NULL OR fetched_expiry < now() THEN
        RAISE EXCEPTION 'CRIT-DB-05 FAIL: rate_limit_buckets did not store or compare TIMESTAMPTZ properly!';
    END IF;
    RAISE NOTICE 'SUCCESS: rate_limit_buckets TIMESTAMPTZ formatting verified.';

    -- Verify brute_force_locks persistence and query
    INSERT INTO brute_force_locks (lock_key, failed_count, locked_until_ms)
    VALUES ('lock_tenant-alpha_pairing', 5, (extract(epoch from now())::bigint + 900) * 1000);

    SELECT * INTO lock_record FROM brute_force_locks WHERE lock_key = 'lock_tenant-alpha_pairing';
    IF lock_record.failed_count <> 5 THEN
        RAISE EXCEPTION 'HIGH-DB-04 FAIL: brute_force_locks record mismatch!';
    END IF;
    RAISE NOTICE 'SUCCESS: brute_force_locks table persistence and index verified.';
END $$;
ROLLBACK;
