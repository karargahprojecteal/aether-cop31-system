export class RateLimiter {
  private requestWindows: Map<string, number[]> = new Map();

  /**
   * Sliding window rate limiter
   * @param key Identifier e.g. "tenantId" or "ipAddress"
   * @param maxRequests Maximum allowed requests in the time window
   * @param windowSeconds Window length in seconds (default 60s)
   */
  public checkLimit(key: string, maxRequests: number = 60, windowSeconds: number = 60): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const cutoff = now - windowMs;

    const timestamps = this.requestWindows.get(key) || [];
    // Discard timestamps older than window
    const validTimestamps = timestamps.filter(t => t > cutoff);

    if (validTimestamps.length >= maxRequests) {
      const oldest = validTimestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    validTimestamps.push(now);
    this.requestWindows.set(key, validTimestamps);

    return {
      allowed: true,
      remaining: maxRequests - validTimestamps.length,
      retryAfterSeconds: 0,
    };
  }

  public resetKey(key: string): void {
    this.requestWindows.delete(key);
  }
}

export const rateLimiterInstance = new RateLimiter();
