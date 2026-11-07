import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../services/saas/RateLimiter';

describe('AETHER Sliding Window RateLimiter', () => {
  it('permits requests within quota and throttles excessive bursts', () => {
    const limiter = new RateLimiter();
    const testKey = 'tenant-test-rate-limit';

    // Limit: 3 requests per 10 seconds
    const req1 = limiter.checkLimit(testKey, 3, 10);
    expect(req1.allowed).toBe(true);
    expect(req1.remaining).toBe(2);

    const req2 = limiter.checkLimit(testKey, 3, 10);
    expect(req2.allowed).toBe(true);
    expect(req2.remaining).toBe(1);

    const req3 = limiter.checkLimit(testKey, 3, 10);
    expect(req3.allowed).toBe(true);
    expect(req3.remaining).toBe(0);

    // 4th request must be throttled
    const req4 = limiter.checkLimit(testKey, 3, 10);
    expect(req4.allowed).toBe(false);
    expect(req4.remaining).toBe(0);
    expect(req4.retryAfterSeconds).toBeGreaterThan(0);
  });
});
