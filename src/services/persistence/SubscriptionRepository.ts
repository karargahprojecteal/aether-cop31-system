import { DatabaseSync } from 'node:sqlite';
import * as crypto from 'node:crypto';
import { SubscriptionPlan, SubscriptionTier } from '../../types/saas';
import { DatabaseService } from './DatabaseService';

export class SubscriptionRepository {
  private db: DatabaseSync;

  constructor(db?: DatabaseSync) {
    this.db = db || DatabaseService.getInstance().getDb();
  }

  public getSubscription(tenantId: string): SubscriptionPlan | null {
    const stmt = this.db.prepare(`
      SELECT * FROM subscriptions WHERE tenant_id = ?
    `);
    const row = stmt.get(tenantId) as any;
    if (!row) return null;

    // Check daily quota reset
    const today = new Date().toISOString().slice(0, 10);
    if (row.last_quota_reset_date !== today) {
      this.db.prepare(`
        UPDATE subscriptions
        SET used_gemini_calls_today = 0, last_quota_reset_date = ?
        WHERE tenant_id = ?
      `).run(today, tenantId);
      row.used_gemini_calls_today = 0;
    }

    return {
      tier: row.tier,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
      maxHomes: row.max_homes,
      maxDevicesPerHome: row.max_devices_per_home,
      telemetryIntervalSeconds: row.telemetry_interval_seconds,
      allowRealtimeWebSocket: Boolean(row.allow_realtime_websocket),
      allowAutonomousControl: Boolean(row.allow_autonomous_control),
      geminiCallsPerDay: row.gemini_calls_per_day,
      usedGeminiCallsToday: row.used_gemini_calls_today,
    };
  }

  /**
   * Atomically checks and increments Gemini AI call quota.
   * Prevents race conditions and strictly rejects when quota is exhausted.
   */
  public consumeGeminiQuota(tenantId: string): boolean {
    const today = new Date().toISOString().slice(0, 10);

    // Reset quota if new day
    this.db.prepare(`
      UPDATE subscriptions
      SET used_gemini_calls_today = 0, last_quota_reset_date = ?
      WHERE tenant_id = ? AND last_quota_reset_date != ?
    `).run(today, tenantId, today);

    // Atomic compare-and-increment
    const stmt = this.db.prepare(`
      UPDATE subscriptions
      SET used_gemini_calls_today = used_gemini_calls_today + 1
      WHERE tenant_id = ? AND used_gemini_calls_today < gemini_calls_per_day
    `);

    const result = stmt.run(tenantId);
    return Number(result.changes) > 0;
  }

  public updateTier(tenantId: string, newPlan: SubscriptionPlan): void {
    const stmt = this.db.prepare(`
      UPDATE subscriptions
      SET tier = ?, status = ?, current_period_end = ?, max_homes = ?,
          max_devices_per_home = ?, telemetry_interval_seconds = ?,
          allow_realtime_websocket = ?, allow_autonomous_control = ?,
          gemini_calls_per_day = ?, updated_at = ?
      WHERE tenant_id = ?
    `);

    stmt.run(
      newPlan.tier,
      newPlan.status,
      newPlan.currentPeriodEnd,
      newPlan.maxHomes,
      newPlan.maxDevicesPerHome,
      newPlan.telemetryIntervalSeconds,
      newPlan.allowRealtimeWebSocket ? 1 : 0,
      newPlan.allowAutonomousControl ? 1 : 0,
      newPlan.geminiCallsPerDay,
      new Date().toISOString(),
      tenantId
    );
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
      const stmt = this.db.prepare(`
        INSERT INTO webhook_events (id, provider, event_id, tenant_id, event_type, payload, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, provider, eventId, tenantId, eventType, JSON.stringify(payload), now);
      return { processed: true, isDuplicate: false };
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return { processed: false, isDuplicate: true, error: 'Replay detected: Webhook event already processed.' };
      }
      return { processed: false, isDuplicate: false, error: err.message };
    }
  }
}
