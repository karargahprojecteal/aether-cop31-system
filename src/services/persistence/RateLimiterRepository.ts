import { DatabaseSync } from 'node:sqlite';
import { DatabaseService } from './DatabaseService';

export class RateLimiterRepository {
  private db: DatabaseSync;

  constructor(db?: DatabaseSync) {
    this.db = db || DatabaseService.getInstance().getDb();
  }

  /**
   * Distributed sliding window rate limiter backed by durable SQL storage
   * @param key Identifier e.g. "tenantId" or "ipAddress:endpoint"
   * @param maxRequests Maximum allowed requests in the time window
   * @param windowSeconds Window length in seconds (default 60s)
   */
  public checkLimit(
    key: string,
    maxRequests: number = 60,
    windowSeconds: number = 60
  ): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const cutoff = now - windowMs;

    // 1. Clean up expired buckets for this key
    this.db.prepare(`
      DELETE FROM rate_limit_buckets WHERE bucket_key = ? AND window_start_ms < ?
    `).run(key, cutoff);

    // 2. Query total request count in the current window
    const countStmt = this.db.prepare(`
      SELECT SUM(request_count) as total FROM rate_limit_buckets WHERE bucket_key = ? AND window_start_ms >= ?
    `);
    const row = countStmt.get(key, cutoff) as any;
    const currentTotal = row && row.total ? Number(row.total) : 0;

    if (currentTotal >= maxRequests) {
      // Find oldest active bucket to calculate retry after
      const oldestStmt = this.db.prepare(`
        SELECT MIN(window_start_ms) as oldest FROM rate_limit_buckets WHERE bucket_key = ? AND window_start_ms >= ?
      `);
      const oldestRow = oldestStmt.get(key, cutoff) as any;
      const oldestTime = oldestRow && oldestRow.oldest ? Number(oldestRow.oldest) : now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestTime + windowMs - now) / 1000));

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    // 3. Atomically record the current request
    // Quantize to 1-second slices to keep rows compact
    const currentSliceMs = Math.floor(now / 1000) * 1000;
    const expiryMs = currentSliceMs + windowMs;

    const upsertStmt = this.db.prepare(`
      INSERT INTO rate_limit_buckets (bucket_key, window_start_ms, request_count, expires_at)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(bucket_key, window_start_ms) DO UPDATE SET
        request_count = request_count + 1
    `);
    upsertStmt.run(key, currentSliceMs, expiryMs);

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - (currentTotal + 1)),
      retryAfterSeconds: 0,
    };
  }

  public resetKey(key: string): void {
    this.db.prepare(`DELETE FROM rate_limit_buckets WHERE bucket_key = ?`).run(key);
  }
}
