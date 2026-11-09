-- ==============================================================================
-- AETHER — Standalone / Local PostgreSQL Test Environment Bootstrap
-- Provisions mock auth schema and auth.uid() function for isolated testing.
-- In Supabase Cloud, this schema is provisioned automatically by GoTrue Auth.
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

-- Simulates Supabase auth.uid() via standard PostgreSQL session settings
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ LANGUAGE SQL STABLE;

-- Simulates Supabase auth.role() via standard PostgreSQL session settings
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
$$ LANGUAGE SQL STABLE;
