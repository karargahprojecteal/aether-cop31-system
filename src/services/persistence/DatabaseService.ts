import { DatabaseSync } from 'node:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { IDatabaseAdapter } from './adapter/IDatabaseAdapter';
import { SqliteDatabaseAdapter } from './adapter/SqliteDatabaseAdapter';
import { PostgresDatabaseAdapter } from './adapter/PostgresDatabaseAdapter';
import { PoolConfig } from 'pg';

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private db: DatabaseSync;
  private adapter: IDatabaseAdapter;

  private constructor(dbPath?: string) {
    if (!dbPath || dbPath === ':memory:') {
      this.db = new DatabaseSync(':memory:');
    } else {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new DatabaseSync(dbPath);
    }

    this.adapter = new SqliteDatabaseAdapter(this.db);
    this.initializeSchema();
  }

  public static getInstance(dbPath?: string): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(dbPath || ':memory:');
    }
    return DatabaseService.instance;
  }

  public static createIsolatedInstance(dbPath: string = ':memory:'): DatabaseService {
    return new DatabaseService(dbPath);
  }

  public static createPostgresAdapter(config: PoolConfig): PostgresDatabaseAdapter {
    return new PostgresDatabaseAdapter(config);
  }

  public getDb(): DatabaseSync {
    return this.db;
  }

  public getAdapter(): IDatabaseAdapter {
    return this.adapter;
  }

  private initializeSchema(): void {
    this.db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        contact_email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        tenant_id TEXT PRIMARY KEY,
        tier TEXT NOT NULL,
        status TEXT NOT NULL,
        current_period_end TEXT NOT NULL,
        max_homes INTEGER NOT NULL,
        max_devices_per_home INTEGER NOT NULL,
        telemetry_interval_seconds INTEGER NOT NULL,
        allow_realtime_websocket INTEGER NOT NULL,
        allow_autonomous_control INTEGER NOT NULL,
        gemini_calls_per_day INTEGER NOT NULL,
        used_gemini_calls_today INTEGER NOT NULL,
        last_quota_reset_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS organization_members (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        assigned_home_ids TEXT NOT NULL, -- JSON array
        invited_at TEXT NOT NULL,
        joined_at TEXT,
        UNIQUE(tenant_id, user_id),
        FOREIGN KEY(tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS homes (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        housing_type TEXT NOT NULL,
        square_meters REAL NOT NULL,
        resident_count INTEGER NOT NULL,
        meter_infrastructure TEXT NOT NULL,
        meter_clock_offset_hours INTEGER NOT NULL DEFAULT 0,
        primary_heating TEXT NOT NULL,
        has_solar_pv INTEGER NOT NULL,
        has_ev_charger INTEGER NOT NULL,
        tariff_plan TEXT NOT NULL,
        tariff_version TEXT NOT NULL,
        is_primary INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        home_id TEXT NOT NULL,
        name TEXT NOT NULL,
        device_type TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        manufacturer TEXT,
        model TEXT,
        serial_number TEXT,
        measurement_quality TEXT NOT NULL,
        is_sub_metered_only INTEGER NOT NULL,
        nominal_power_w REAL,
        status TEXT NOT NULL,
        last_heartbeat TEXT,
        metadata TEXT, -- JSON string
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY(home_id) REFERENCES homes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pairing_tokens (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        home_id TEXT NOT NULL,
        device_type TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        token_salt TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts_count INTEGER NOT NULL,
        max_attempts INTEGER NOT NULL,
        expires_at INTEGER NOT NULL, -- Unix epoch ms
        consumed_at INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY(home_id) REFERENCES homes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        bucket_key TEXT NOT NULL,
        window_start_ms INTEGER NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 1,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (bucket_key, window_start_ms)
      );

      CREATE TABLE IF NOT EXISTS brute_force_locks (
        lock_key TEXT PRIMARY KEY,
        failed_count INTEGER NOT NULL,
        locked_until_ms INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        seq INTEGER NOT NULL DEFAULT 1,
        user_id TEXT NOT NULL,
        user_email TEXT,
        action TEXT NOT NULL,
        category TEXT NOT NULL,
        details TEXT NOT NULL, -- JSON string
        severity TEXT NOT NULL,
        prev_record_hash TEXT,
        record_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        event_id TEXT NOT NULL,
        tenant_id TEXT,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        processed_at TEXT NOT NULL,
        UNIQUE (provider, event_id)
      );
    `);
  }
}
