import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { PostgresDatabaseAdapter } from '../services/persistence/adapter/PostgresDatabaseAdapter';
import { AuditAnchorStore } from '../services/persistence/audit/AuditAnchorStore';
import { canonicalizeJson } from '../services/crypto/canonicalJson';

describe('Phase 3: Staging Acceptance — Live PostgreSQL 15 Engine Verification', () => {
  let adapter: PostgresDatabaseAdapter;
  const dbUrl = 'postgres://antigravity@127.0.0.1:5433/aether_staging_acceptance';
  const tenantId = 'staging-tenant-acceptance';
  const userId = 'staging-admin-user';

  beforeAll(async () => {
    adapter = new PostgresDatabaseAdapter({
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 5000,
    });

    // Seed test tenant directly for staging tests
    await adapter.execute(
      `INSERT INTO organizations (id, name, slug, contact_email, created_by_user_id)
       VALUES (?, 'Staging Acceptance Org', 'staging-acceptance-org', 'staging@test.io', ?)
       ON CONFLICT (id) DO NOTHING`,
      [tenantId, userId]
    );

    await adapter.execute(
      `INSERT INTO subscriptions (
        tenant_id, tier, status, current_period_end, max_homes, max_devices_per_home,
        telemetry_interval_seconds, allow_realtime_websocket, allow_autonomous_control,
        gemini_calls_per_day, used_gemini_calls_today, last_quota_reset_date
       ) VALUES (?, 'SMART_RESIDENCE', 'ACTIVE', NOW() + INTERVAL '30 days', 5, 25, 1, TRUE, FALSE, 100, 0, CURRENT_DATE)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId]
    );
  });

  afterAll(async () => {
    await adapter.close();
  });

  it('Verifies PostgreSQL connection pool & RLS state on staging database', async () => {
    const rows = await adapter.query<any>(
      `SELECT relname, relrowsecurity, relforcerowsecurity 
       FROM pg_class 
       WHERE relname IN ('organizations', 'subscriptions', 'organization_members', 'homes', 'devices', 'pairing_tokens', 'audit_logs')`
    );

    expect(rows.length).toBe(7);
    for (const r of rows) {
      expect(r.relrowsecurity).toBe(true);
      expect(r.relforcerowsecurity).toBe(true);
    }
  });

  it('Verifies concurrent transaction execution without deadlock or race conditions', async () => {
    const concurrency = 20;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      promises.push(
        adapter.transaction(async (client) => {
          const bucketKey = `rate:tenant:${tenantId}:${i % 5}`;
          const nowMs = Date.now();
          await client?.query(
            `INSERT INTO rate_limit_buckets (bucket_key, window_start_ms, request_count, expires_at)
             VALUES ($1, $2, 1, NOW() + INTERVAL '1 minute')
             ON CONFLICT (bucket_key, window_start_ms) DO UPDATE SET request_count = rate_limit_buckets.request_count + 1`,
            [bucketKey, nowMs + i]
          );
        })
      );
    }

    await expect(Promise.all(promises)).resolves.toBeDefined();

    const countRow = await adapter.queryOne<{ count: string | number }>(
      `SELECT count(*) as count FROM rate_limit_buckets WHERE bucket_key LIKE $1`,
      [`rate:tenant:${tenantId}:%`]
    );
    expect(Number(countRow?.count)).toBeGreaterThan(0);
  });

  it('Verifies webhook idempotency and replay rejection in PostgreSQL', async () => {
    const eventId = `evt_staging_${Date.now()}`;
    const payload = JSON.stringify({ id: eventId, type: 'invoice.paid' });

    // First delivery succeeds
    const res1 = await adapter.execute(
      `INSERT INTO webhook_events (id, provider, event_id, tenant_id, event_type, payload, processed_at)
       VALUES ($1, 'stripe', $2, $3, 'invoice.paid', $4::jsonb, NOW())`,
      [`wh-${Date.now()}-1`, eventId, tenantId, payload]
    );
    expect(res1.changes).toBe(1);

    // Replay attempt fails with unique constraint violation
    await expect(
      adapter.execute(
        `INSERT INTO webhook_events (id, provider, event_id, tenant_id, event_type, payload, processed_at)
         VALUES ($1, 'stripe', $2, $3, 'invoice.paid', $4::jsonb, NOW())`,
        [`wh-${Date.now()}-2`, eventId, tenantId, payload]
      )
    ).rejects.toThrow(/duplicate key value violates unique constraint/i);
  });

  it('Verifies audit log sequence numbering and external anchor synchronization in PostgreSQL', async () => {
    const anchorStore = AuditAnchorStore.getInstance();
    const action = 'STAGING_VERIFICATION_EVENT';
    const timestamp = new Date().toISOString();
    const details = { testEnv: 'staging', cluster: 'postgres-15' };
    const detailsCanonical = canonicalizeJson(details);

    // Fetch latest sequence
    const latest = await adapter.queryOne<{ seq: string | number; record_hash: string }>(
      `SELECT seq, record_hash FROM audit_logs WHERE tenant_id = $1 ORDER BY seq DESC, created_at DESC LIMIT 1`,
      [tenantId]
    );
    const nextSeq = latest && latest.seq ? Number(latest.seq) + 1 : 1;
    const prevHash = latest && latest.record_hash ? latest.record_hash : 'GENESIS_BLOCK_0000000000000000000000000000000000000000000000000000000000000000';

    const hashPayload = `${prevHash}|${nextSeq}|${tenantId}|${userId}|${action}|AUTH|${timestamp}|${detailsCanonical}`;
    const recordHash = crypto.createHash('sha256').update(hashPayload).digest('hex');
    const logId = `aud-staging-${Date.now()}`;

    await adapter.execute(
      `INSERT INTO audit_logs (id, tenant_id, seq, user_id, action, category, details, severity, prev_record_hash, record_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, 'AUTH', $6::jsonb, 'INFO', $7, $8, $9)`,
      [logId, tenantId, nextSeq, userId, action, detailsCanonical, prevHash, recordHash, timestamp]
    );

    // Anchor externally
    const checkpoint = anchorStore.createCheckpoint(tenantId, nextSeq, recordHash);
    expect(anchorStore.verifyCheckpointSignature(checkpoint)).toBe(true);

    // Verify stored row matches anchor
    const stored = await adapter.queryOne<any>(
      `SELECT * FROM audit_logs WHERE id = $1`,
      [logId]
    );
    expect(stored).not.toBeNull();
    expect(Number(stored.seq)).toBe(checkpoint.lastSeq);
    expect(stored.record_hash).toBe(checkpoint.lastRecordHash);
  });

  it('Verifies database backup (pg_dump), restore, and schema parity', async () => {
    const dumpPath = '/tmp/aether_staging_test_dump.sql';

    // 1. Execute pg_dump
    execSync(`/usr/lib/postgresql/15/bin/pg_dump -h 127.0.0.1 -p 5433 -d aether_staging_acceptance -f ${dumpPath}`, {
      stdio: 'pipe',
    });

    // 2. Drop and recreate aether_staging_restored
    execSync(`/usr/lib/postgresql/15/bin/psql -h 127.0.0.1 -p 5433 -d postgres -c "DROP DATABASE IF EXISTS aether_staging_restored;"`, { stdio: 'pipe' });
    execSync(`/usr/lib/postgresql/15/bin/psql -h 127.0.0.1 -p 5433 -d postgres -c "CREATE DATABASE aether_staging_restored;"`, { stdio: 'pipe' });

    // 3. Restore dump into aether_staging_restored
    execSync(`/usr/lib/postgresql/15/bin/psql -h 127.0.0.1 -p 5433 -d aether_staging_restored -f ${dumpPath}`, {
      stdio: 'pipe',
    });

    // 4. Verify restored tables and row count
    const restoredAdapter = new PostgresDatabaseAdapter({
      connectionString: 'postgres://antigravity@127.0.0.1:5433/aether_staging_restored',
    });

    try {
      const origOrgCount = await adapter.queryOne<{ count: string | number }>('SELECT count(*) as count FROM organizations');
      const restoredOrgCount = await restoredAdapter.queryOne<{ count: string | number }>('SELECT count(*) as count FROM organizations');
      expect(Number(restoredOrgCount?.count)).toBe(Number(origOrgCount?.count));

      const restoredRLS = await restoredAdapter.query<any>(
        `SELECT relname, relrowsecurity, relforcerowsecurity 
         FROM pg_class 
         WHERE relname IN ('organizations', 'subscriptions', 'organization_members', 'homes', 'devices', 'pairing_tokens', 'audit_logs')`
      );
      expect(restoredRLS.length).toBe(7);
      for (const r of restoredRLS) {
        expect(r.relrowsecurity).toBe(true);
        expect(r.relforcerowsecurity).toBe(true);
      }
    } finally {
      await restoredAdapter.close();
    }
  });

  it('Verifies down-migration rollback and relation teardown', async () => {
    // Test rollback in a disposable database
    execSync(`/usr/lib/postgresql/15/bin/psql -h 127.0.0.1 -p 5433 -d postgres -c "DROP DATABASE IF EXISTS aether_disposable_rollback;"`, { stdio: 'pipe' });
    execSync(`/usr/lib/postgresql/15/bin/psql -h 127.0.0.1 -p 5433 -d postgres -c "CREATE DATABASE aether_disposable_rollback;"`, { stdio: 'pipe' });

    // Install schema
    execSync(`/usr/lib/postgresql/15/bin/psql -h 127.0.0.1 -p 5433 -d aether_disposable_rollback -f supabase/tests/bootstrap_test_env.sql`, { stdio: 'pipe' });
    execSync(`/usr/lib/postgresql/15/bin/psql -h 127.0.0.1 -p 5433 -d aether_disposable_rollback -f supabase/migrations/20261107000000_residential_saas_core.sql`, { stdio: 'pipe' });

    // Execute rollback
    execSync(`/usr/lib/postgresql/15/bin/psql -h 127.0.0.1 -p 5433 -d aether_disposable_rollback -c "
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
    "`, { stdio: 'pipe' });

    // Verify relations count is 0
    const out = execSync(`/usr/lib/postgresql/15/bin/psql -h 127.0.0.1 -p 5433 -d aether_disposable_rollback -t -A -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"`, {
      encoding: 'utf8',
    });
    expect(Number(out.trim())).toBe(0);
  });
});
