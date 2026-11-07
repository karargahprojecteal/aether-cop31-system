import { DatabaseSync } from 'node:sqlite';
import { DatabaseService } from './DatabaseService';
import { IDatabaseAdapter, ISyncDatabaseAdapter } from './adapter/IDatabaseAdapter';
import { SqliteDatabaseAdapter } from './adapter/SqliteDatabaseAdapter';

export class RateLimiterRepository {
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

  /**
   * Distributed sliding window rate limiter backed by durable SQL storage
   * Portable across SQLite and PostgreSQL engines.
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

    return this.adapter.transaction(() => {
      // 1. Clean up expired buckets for this key
      this.adapter.execute(
        'DELETE FROM rate_limit_buckets WHERE bucket_key = ? AND window_start_ms < ?',
        [key, cutoff]
      );

      // 2. Query total request count in the current window
      const row = this.adapter.queryOne<{ total: number | string | null }>(
        'SELECT SUM(request_count) as total FROM rate_limit_buckets WHERE bucket_key = ? AND window_start_ms >= ?',
        [key, cutoff]
      );
      const currentTotal = row && row.total ? Number(row.total) : 0;

      if (currentTotal >= maxRequests) {
        // Find oldest active bucket to calculate retry after
        const oldestRow = this.adapter.queryOne<{ oldest: number | string | null }>(
          'SELECT MIN(window_start_ms) as oldest FROM rate_limit_buckets WHERE bucket_key = ? AND window_start_ms >= ?',
          [key, cutoff]
        );
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
      const expiresAtIso = new Date(expiryMs).toISOString();

      this.adapter.execute(
        `INSERT INTO rate_limit_buckets (bucket_key, window_start_ms, request_count, expires_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(bucket_key, window_start_ms) DO UPDATE SET
           request_count = rate_limit_buckets.request_count + 1`,
        [key, currentSliceMs, expiresAtIso]
      );

      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - (currentTotal + 1)),
        retryAfterSeconds: 0,
      };
    }) as { allowed: boolean; remaining: number; retryAfterSeconds: number };
  }

  public resetKey(key: string): void {
    this.adapter.execute('DELETE FROM rate_limit_buckets WHERE bucket_key = ?', [key]);
  }
}
