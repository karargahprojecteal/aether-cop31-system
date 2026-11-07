-- ==============================================================================
-- AETHER — Autonomous Energy & Carbon Neural System
-- Migration: 20261107000000_residential_saas_core.sql
-- Multi-Tenant Database Schema with Row-Level Security (RLS) & Audit Hash Chaining
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ORGANIZATIONS (Tenant Root)
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY DEFAULT ('tenant-' || gen_random_uuid()),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    contact_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SUBSCRIPTIONS & QUOTA STATE
CREATE TABLE IF NOT EXISTS subscriptions (
    tenant_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    tier TEXT NOT NULL CHECK (tier IN ('STARTER_HOME', 'SMART_RESIDENCE', 'ESTATE_ENTERPRISE')),
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING')),
    current_period_end TIMESTAMPTZ NOT NULL,
    max_homes INTEGER NOT NULL DEFAULT 1,
    max_devices_per_home INTEGER NOT NULL DEFAULT 3,
    telemetry_interval_seconds INTEGER NOT NULL DEFAULT 60,
    allow_realtime_websocket BOOLEAN NOT NULL DEFAULT FALSE,
    allow_autonomous_control BOOLEAN NOT NULL DEFAULT FALSE,
    gemini_calls_per_day INTEGER NOT NULL DEFAULT 10,
    used_gemini_calls_today INTEGER NOT NULL DEFAULT 0,
    last_quota_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ORGANIZATION MEMBERS & RBAC
CREATE TABLE IF NOT EXISTS organization_members (
    id TEXT PRIMARY KEY DEFAULT ('mem-' || gen_random_uuid()),
    tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- references auth.users(id) in Supabase Auth
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'ENERGY_MANAGER', 'RESIDENT_VIEWER')),
    assigned_home_ids TEXT[] DEFAULT '{}',
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    joined_at TIMESTAMPTZ,
    CONSTRAINT uq_tenant_user UNIQUE(tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_tenant_user ON organization_members(tenant_id, user_id);

-- 5. RESIDENTIAL HOMES / BUILDINGS
CREATE TABLE IF NOT EXISTS homes (
    id TEXT PRIMARY KEY DEFAULT ('home-' || gen_random_uuid()),
    tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    housing_type TEXT NOT NULL CHECK (housing_type IN ('APARTMENT_FLAT', 'DETACHED_VILLA', 'RESIDENTIAL_COMPLEX', 'COMMERCIAL_UNIT')),
    square_meters NUMERIC NOT NULL,
    resident_count INTEGER NOT NULL DEFAULT 1,
    meter_infrastructure TEXT NOT NULL CHECK (meter_infrastructure IN ('ELECTRONIC_SMART_METER', 'MECHANICAL_METER', 'IN_UNIT_BREAKER_PANEL', 'NONE_ESTIMATED')),
    meter_clock_offset_hours INTEGER NOT NULL DEFAULT 0, -- Support for legacy DST/UTC offsets in meters
    primary_heating TEXT NOT NULL CHECK (primary_heating IN ('NATURAL_GAS_COMBI', 'HEAT_PUMP', 'CENTRAL_DISTRICT', 'ELECTRIC_RESISTANCE', 'AC_INVERTER')),
    has_solar_pv BOOLEAN NOT NULL DEFAULT FALSE,
    has_ev_charger BOOLEAN NOT NULL DEFAULT FALSE,
    tariff_plan TEXT NOT NULL DEFAULT 'TURKISH_EPDK_3_TIME',
    tariff_version TEXT NOT NULL DEFAULT '2024-Q3-MESKEN-01',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_homes_tenant ON homes(tenant_id);

-- 6. DEVICES & SENSORS
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY DEFAULT ('dev-' || gen_random_uuid()),
    tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK (device_type IN ('MAIN_METER', 'SUB_METER_RELAY', 'SOLAR_INVERTER', 'EV_CHARGER', 'SMART_PLUG', 'HEAT_PUMP_GATEWAY', 'VIRTUAL_SIMULATOR')),
    adapter_type TEXT NOT NULL CHECK (adapter_type IN ('SMART_METER', 'HOME_ASSISTANT', 'LOCAL_GATEWAY', 'SMART_PLUG', 'MANUAL_INVOICE')),
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    measurement_quality TEXT NOT NULL CHECK (measurement_quality IN ('PHYSICAL_METERED', 'SUB_METERED', 'DERIVED_NILM', 'ESTIMATED', 'MANUAL_BILL')),
    is_sub_metered_only BOOLEAN NOT NULL DEFAULT FALSE,
    nominal_power_w NUMERIC,
    status TEXT NOT NULL DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'DEGRADED', 'DISCONNECTED', 'CALIBRATING')),
    last_heartbeat TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devices_tenant_home ON devices(tenant_id, home_id);

-- 7. EPHEMERAL PAIRING CREDENTIALS (Secure Hash Storage, 15m TTL)
CREATE TABLE IF NOT EXISTS pairing_tokens (
    id TEXT PRIMARY KEY DEFAULT ('ptk-' || gen_random_uuid()),
    tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
    device_type TEXT NOT NULL,
    adapter_type TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE, -- SHA-256(token + salt)
    token_salt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONSUMED', 'EXPIRED', 'REVOKED')),
    attempts_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pairing_lookup ON pairing_tokens(token_hash, status);
CREATE INDEX IF NOT EXISTS idx_pairing_tenant_home ON pairing_tokens(tenant_id, home_id);

-- 8. DISTRIBUTED RATE LIMIT BUCKETS
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    bucket_key TEXT NOT NULL,
    window_start_ms BIGINT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (bucket_key, window_start_ms)
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_expiry ON rate_limit_buckets(expires_at);

-- 9. IMMUTABLE AUDIT LOGS (Hash-Chained & Tamper-Evident)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT ('aud-' || gen_random_uuid()),
    tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_email TEXT,
    action TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('AUTH', 'PAIRING', 'DEVICE_COMMAND', 'TARIFF_CHANGE', 'KVKK_DATA_EXPORT', 'ACCOUNT_PURGE', 'AI_DECISION', 'SUBSCRIPTION')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL', 'SECURITY_ALERT')),
    prev_record_hash TEXT, -- SHA-256 of preceding row for tamper evidence
    record_hash TEXT NOT NULL, -- SHA-256(prev_hash + tenant_id + user_id + action + timestamp + details)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_logs(tenant_id, created_at DESC);

-- Prevent unauthorized UPDATE or DELETE on audit logs to ensure immutability
CREATE OR REPLACE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- 10. WEBHOOK IDEMPOTENCY & REPLAY PROTECTION
CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY DEFAULT ('wh-' || gen_random_uuid()),
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    tenant_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_webhook_provider_event UNIQUE (provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_provider_event ON webhook_events(provider, event_id);

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairing_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to extract current authenticated user's tenant ID
CREATE OR REPLACE FUNCTION auth.current_tenant_id() RETURNS TEXT AS $$
    SELECT tenant_id 
    FROM organization_members 
    WHERE user_id = auth.uid()::text 
    LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- HOMES RLS
CREATE POLICY homes_tenant_isolation ON homes
    FOR ALL
    USING (tenant_id = auth.current_tenant_id())
    WITH CHECK (tenant_id = auth.current_tenant_id());

-- DEVICES RLS
CREATE POLICY devices_tenant_isolation ON devices
    FOR ALL
    USING (tenant_id = auth.current_tenant_id())
    WITH CHECK (tenant_id = auth.current_tenant_id());

-- PAIRING TOKENS RLS
CREATE POLICY pairing_tokens_tenant_isolation ON pairing_tokens
    FOR ALL
    USING (tenant_id = auth.current_tenant_id())
    WITH CHECK (tenant_id = auth.current_tenant_id());

-- AUDIT LOGS RLS (Read-only to tenant members, insertable by system)
CREATE POLICY audit_logs_tenant_read ON audit_logs
    FOR SELECT
    USING (tenant_id = auth.current_tenant_id());
