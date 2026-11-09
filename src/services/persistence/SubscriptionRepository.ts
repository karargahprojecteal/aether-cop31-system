import { DatabaseSync } from 'node:sqlite';
import * as crypto from 'node:crypto';
import { SubscriptionPlan, SubscriptionTier } from '../../types/saas';
import { DatabaseService } from './DatabaseService';
import { IDatabaseAdapter, ISyncDatabaseAdapter } from './adapter/IDatabaseAdapter';
import { SqliteDatabaseAdapter } from './adapter/SqliteDatabaseAdapter';

export class SubscriptionRepository {
  private adapter: ISyncDatabaseAdapter;

  constructor(dbOrAdapter?: DatabaseSync | IDatabaseAdapter) {
    if (!dbOrAdapter) {
      this.adapter = DatabaseService.getInstance().getAdapter() as ISyncDatabaseAdapter;
    } else if ('dialect' in dbOrAdapter) {
      this.adapter = dbOrAdapter as ISyncDatabaseAdapter;
    } else {
      this.adapter = new SqliteDatabaseAdapter(dbOrAdapter);
    }
  }

  public getSubscription(tenantId: string): SubscriptionPlan | null {
    const row = this.adapter.queryOne<any>(
      'SELECT * FROM subscriptions WHERE tenant_id = ?',
      [tenantId]
    );
    if (!row) return null;

    // Check daily quota reset
    const today = new Date().toISOString().slice(0, 10);
    if (row.last_quota_reset_date !== today) {
      this.adapter.execute(
        'UPDATE subscriptions SET used_gemini_calls_today = 0, last_quota_reset_date = ? WHERE tenant_id = ?',
        [today, tenantId]
      );
      row.used_gemini_calls_today = 0;
    }

    return {
      tier: row.tier as SubscriptionTier,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
      maxHomes: Number(row.max_homes),
      maxDevicesPerHome: Number(row.max_devices_per_home),
      telemetryIntervalSeconds: Number(row.telemetry_interval_seconds),
      allowRealtimeWebSocket: Boolean(row.allow_realtime_websocket),
      allowAutonomousControl: Boolean(row.allow_autonomous_control),
      geminiCallsPerDay: Number(row.gemini_calls_per_day),
      usedGeminiCallsToday: Number(row.used_gemini_calls_today),
    };
  }

  /**
   * Atomically checks and increments Gemini AI call quota.
   * Prevents race conditions and strictly rejects when quota is exhausted.
   */
  public consumeGeminiQuota(tenantId: string): boolean {
    const today = new Date().toISOString().slice(0, 10);

    return this.adapter.transaction(() => {
      // Reset quota if new day
      this.adapter.execute(
        'UPDATE subscriptions SET used_gemini_calls_today = 0, last_quota_reset_date = ? WHERE tenant_id = ? AND last_quota_reset_date != ?',
        [today, tenantId, today]
      );

      // Atomic compare-and-increment
      const result = this.adapter.execute(
        'UPDATE subscriptions SET used_gemini_calls_today = used_gemini_calls_today + 1 WHERE tenant_id = ? AND used_gemini_calls_today < gemini_calls_per_day',
        [tenantId]
      );

      return Number(result.changes) > 0;
    }) as boolean;
  }

  /**
   * Updates subscription tier with optional out-of-order stale event protection.
   * If eventTimestamp is supplied and is older than subscription.updated_at, returns false.
   */
  public updateTier(tenantId: string, newPlan: SubscriptionPlan, eventTimestamp?: string): boolean {
    const updatedAt = eventTimestamp || new Date().toISOString();

    return this.adapter.transaction(() => {
      if (eventTimestamp) {
        const current = this.adapter.queryOne<{ updated_at: string }>(
          'SELECT updated_at FROM subscriptions WHERE tenant_id = ?',
          [tenantId]
        );
        if (current && current.updated_at) {
          if (new Date(eventTimestamp).getTime() < new Date(current.updated_at).getTime()) {
            return false; // Stale event rejected
          }
        }
      }

      const res = this.adapter.execute(
        `UPDATE subscriptions
         SET tier = ?, status = ?, current_period_end = ?, max_homes = ?,
             max_devices_per_home = ?, telemetry_interval_seconds = ?,
             allow_realtime_websocket = ?, allow_autonomous_control = ?,
             gemini_calls_per_day = ?, updated_at = ?
         WHERE tenant_id = ?`,
        [
          newPlan.tier,
          newPlan.status,
          newPlan.currentPeriodEnd,
          newPlan.maxHomes,
          newPlan.maxDevicesPerHome,
          newPlan.telemetryIntervalSeconds,
          newPlan.allowRealtimeWebSocket ? 1 : 0,
          newPlan.allowAutonomousControl ? 1 : 0,
          newPlan.geminiCallsPerDay,
          updatedAt,
          tenantId,
        ]
      );
      return Number(res.changes) > 0;
    }) as boolean;
  }

  /**
   * Atomically checks for webhook event idempotency and records event.
   * If the event ID was already processed, returns false to prevent replay attacks.
   */
  public processWebhookIdempotent(
    provider: string,
    eventId: string,
    tenantId: string | null,
    eventType: string,
    payload: Record<string, any>
  ): { processed: boolean; isDuplicate: boolean; error?: string } {
    const id = `wh-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    try {
      const existing = this.adapter.queryOne<{ id: string }>(
        'SELECT id FROM webhook_events WHERE provider = ? AND event_id = ?',
        [provider, eventId]
      );
      if (existing) {
        return { processed: false, isDuplicate: true, error: 'Replay detected: Webhook event already processed.' };
      }

      this.adapter.execute(
        `INSERT INTO webhook_events (id, provider, event_id, tenant_id, event_type, payload, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, provider, eventId, tenantId, eventType, JSON.stringify(payload), now]
      );
      return { processed: true, isDuplicate: false };
    } catch (err: any) {
      if (err.message && (err.message.includes('UNIQUE constraint failed') || err.message.includes('duplicate key'))) {
        return { processed: false, isDuplicate: true, error: 'Replay detected: Webhook event already processed.' };
      }
      return { processed: false, isDuplicate: false, error: err.message };
    }
  }

  /**
   * Atomic webhook execution that bundles idempotency recording and subscription plan updates
   * inside a single database transaction. Also protects against out-of-order network arrival.
   */
  public processWebhookAndApplySubscription(options: {
    provider: string;
    eventId: string;
    tenantId: string;
    eventType: string;
    eventTimestamp: string;
    payload: Record<string, any>;
    newPlan?: SubscriptionPlan;
  }): { success: boolean; isReplay: boolean; isStale: boolean; error?: string } {
    const id = `wh-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    return this.adapter.transaction(() => {
      // 1. Check idempotency in webhook_events
      const existing = this.adapter.queryOne<{ id: string }>(
        'SELECT id FROM webhook_events WHERE provider = ? AND event_id = ?',
        [options.provider, options.eventId]
      );
      if (existing) {
        return {
          success: false,
          isReplay: true,
          isStale: false,
          error: `Replay detected: Webhook event ${options.eventId} already processed.`,
        };
      }

      // 2. If newPlan is supplied, verify eventTimestamp against current subscription updated_at
      if (options.newPlan) {
        const currentSub = this.adapter.queryOne<{ updated_at: string; tier: string }>(
          'SELECT updated_at, tier FROM subscriptions WHERE tenant_id = ?',
          [options.tenantId]
        );

        if (currentSub && currentSub.updated_at) {
          const currentUpdatedMs = new Date(currentSub.updated_at).getTime();
          const eventTimeMs = new Date(options.eventTimestamp).getTime();

          if (eventTimeMs < currentUpdatedMs) {
            // Out-of-order delayed delivery! Record webhook event so it is not re-processed, but do NOT overwrite newer subscription
            this.adapter.execute(
              `INSERT INTO webhook_events (id, provider, event_id, tenant_id, event_type, payload, processed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [id, options.provider, options.eventId, options.tenantId, options.eventType, JSON.stringify(options.payload), now]
            );
            return {
              success: false,
              isReplay: false,
              isStale: true,
              error: `Out-of-order event rejected: event timestamp (${options.eventTimestamp}) is older than current subscription state (${currentSub.updated_at}).`,
            };
          }
        }

        // Apply subscription update atomically in the same transaction
        const updatedTimestamp = options.eventTimestamp || now;
        this.adapter.execute(
          `UPDATE subscriptions
           SET tier = ?, status = ?, current_period_end = ?, max_homes = ?,
               max_devices_per_home = ?, telemetry_interval_seconds = ?,
               allow_realtime_websocket = ?, allow_autonomous_control = ?,
               gemini_calls_per_day = ?, updated_at = ?
           WHERE tenant_id = ?`,
          [
            options.newPlan.tier,
            options.newPlan.status,
            options.newPlan.currentPeriodEnd,
            options.newPlan.maxHomes,
            options.newPlan.maxDevicesPerHome,
            options.newPlan.telemetryIntervalSeconds,
            options.newPlan.allowRealtimeWebSocket ? 1 : 0,
            options.newPlan.allowAutonomousControl ? 1 : 0,
            options.newPlan.geminiCallsPerDay,
            updatedTimestamp,
            options.tenantId,
          ]
        );
      }

      // 3. Record webhook event
      this.adapter.execute(
        `INSERT INTO webhook_events (id, provider, event_id, tenant_id, event_type, payload, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, options.provider, options.eventId, options.tenantId, options.eventType, JSON.stringify(options.payload), now]
      );

      return { success: true, isReplay: false, isStale: false };
    }) as { success: boolean; isReplay: boolean; isStale: boolean; error?: string };
  }
}
