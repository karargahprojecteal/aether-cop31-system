import { RateLimiterRepository } from '../persistence/RateLimiterRepository';

export class RateLimiter {
  private repository: RateLimiterRepository;

  constructor(repository?: RateLimiterRepository) {
    this.repository = repository || new RateLimiterRepository();
  }

  /**
   * Distributed sliding window rate limiter backed by durable SQL storage
   * @param key Identifier e.g. "tenantId" or "ipAddress"
   * @param maxRequests Maximum allowed requests in the time window
   * @param windowSeconds Window length in seconds (default 60s)
   */
  public checkLimit(
    key: string,
    maxRequests: number = 60,
    windowSeconds: number = 60
  ): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    return this.repository.checkLimit(key, maxRequests, windowSeconds);
  }

  public resetKey(key: string): void {
    this.repository.resetKey(key);
  }
}

export const rateLimiterInstance = new RateLimiter();
