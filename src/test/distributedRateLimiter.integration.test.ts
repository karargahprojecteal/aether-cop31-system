import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService } from '../services/persistence/DatabaseService';
import { RateLimiterRepository } from '../services/persistence/RateLimiterRepository';

describe('Integration: Distributed Sliding-Window Rate Limiter', () => {
  let dbService: DatabaseService;
  let limiterInstanceA: RateLimiterRepository;
  let limiterInstanceB: RateLimiterRepository;

  beforeEach(() => {
    // Both instances share the exact same underlying SQL database
    dbService = DatabaseService.createIsolatedInstance(':memory:');
    limiterInstanceA = new RateLimiterRepository(dbService.getDb());
    limiterInstanceB = new RateLimiterRepository(dbService.getDb());
  });

  it('shares rate limit state atomically across multiple process instances', () => {
    const key = 'tenant:tenant-quota-distributed';
    const maxRequests = 5;
    const windowSeconds = 60;

    // Instance A performs 3 requests
    for (let i = 0; i < 3; i++) {
      const res = limiterInstanceA.checkLimit(key, maxRequests, windowSeconds);
      expect(res.allowed).toBe(true);
    }

    // Instance B performs 2 requests (reaching total 5)
    for (let i = 0; i < 2; i++) {
      const res = limiterInstanceB.checkLimit(key, maxRequests, windowSeconds);
      expect(res.allowed).toBe(true);
    }

    // Next request from Instance A MUST be blocked
    const blockedA = limiterInstanceA.checkLimit(key, maxRequests, windowSeconds);
    expect(blockedA.allowed).toBe(false);
    expect(blockedA.remaining).toBe(0);
    expect(blockedA.retryAfterSeconds).toBeGreaterThan(0);

    // Next request from Instance B MUST ALSO be blocked
    const blockedB = limiterInstanceB.checkLimit(key, maxRequests, windowSeconds);
    expect(blockedB.allowed).toBe(false);
    expect(blockedB.remaining).toBe(0);
  });
});
