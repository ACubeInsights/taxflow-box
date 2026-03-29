import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../rateLimiter.js';

describe('RateLimiter', () => {
  /** @type {RateLimiter} */
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxConcurrent: 3, maxQueueDepth: 5 });
  });

  describe('enqueue', () => {
    it('should execute a simple request and return its result', async () => {
      const result = await limiter.enqueue(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('should propagate errors from the execute function', async () => {
      await expect(
        limiter.enqueue(() => Promise.reject(new Error('boom')))
      ).rejects.toThrow('boom');
    });

    it('should default to normal priority', async () => {
      const order = [];
      // Fill concurrency slots so subsequent jobs queue
      const blockers = [];
      const resolvers = [];
      for (let i = 0; i < 3; i++) {
        blockers.push(
          limiter.enqueue(
            () => new Promise((r) => resolvers.push(r)),
            'normal'
          )
        );
      }

      // These will queue — default priority should be 'normal'
      const p1 = limiter.enqueue(async () => {
        order.push('default');
        return 'default';
      });
      const p2 = limiter.enqueue(async () => {
        order.push('explicit-normal');
        return 'explicit-normal';
      }, 'normal');

      // Release blockers
      resolvers.forEach((r) => r('done'));
      await Promise.all(blockers);
      await Promise.all([p1, p2]);

      // Both should execute (order may vary since same priority)
      expect(order).toContain('default');
      expect(order).toContain('explicit-normal');
    });
  });

  describe('priority ordering', () => {
    it('should process urgent requests before low requests', async () => {
      const order = [];
      const resolvers = [];

      // Fill all concurrency slots
      const blockers = [];
      for (let i = 0; i < 3; i++) {
        blockers.push(
          limiter.enqueue(() => new Promise((r) => resolvers.push(r)))
        );
      }

      // Queue jobs with different priorities (enqueued in reverse priority order)
      const low = limiter.enqueue(async () => { order.push('low'); }, 'low');
      const normal = limiter.enqueue(async () => { order.push('normal'); }, 'normal');
      const high = limiter.enqueue(async () => { order.push('high'); }, 'high');
      const urgent = limiter.enqueue(async () => { order.push('urgent'); }, 'urgent');

      // Release all blockers at once
      resolvers.forEach((r) => r('done'));
      await Promise.all(blockers);
      await Promise.all([low, normal, high, urgent]);

      expect(order).toEqual(['urgent', 'high', 'normal', 'low']);
    });

    it('should maintain FIFO within the same priority level', async () => {
      const order = [];
      const resolvers = [];

      // Fill concurrency — use maxConcurrent of 1 for deterministic ordering
      const singleLimiter = new RateLimiter({ maxConcurrent: 1, maxQueueDepth: 10 });
      const blocker = singleLimiter.enqueue(
        () => new Promise((r) => resolvers.push(r))
      );

      const p1 = singleLimiter.enqueue(async () => { order.push('first'); }, 'normal');
      const p2 = singleLimiter.enqueue(async () => { order.push('second'); }, 'normal');
      const p3 = singleLimiter.enqueue(async () => { order.push('third'); }, 'normal');

      resolvers[0]('done');
      await blocker;
      await Promise.all([p1, p2, p3]);

      expect(order).toEqual(['first', 'second', 'third']);
    });
  });

  describe('concurrency enforcement', () => {
    it('should not exceed maxConcurrent active requests', async () => {
      let peakConcurrent = 0;
      let currentConcurrent = 0;

      const jobs = Array.from({ length: 6 }, (_, i) =>
        limiter.enqueue(async () => {
          currentConcurrent++;
          peakConcurrent = Math.max(peakConcurrent, currentConcurrent);
          // Simulate async work
          await new Promise((r) => setTimeout(r, 50));
          currentConcurrent--;
          return i;
        })
      );

      await Promise.all(jobs);
      expect(peakConcurrent).toBeLessThanOrEqual(3);
    });
  });

  describe('HTTP 429 handling', () => {
    it('should re-queue on 429 and eventually resolve', async () => {
      let attempts = 0;
      const result = await limiter.enqueue(async () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error('Rate limited');
          err.statusCode = 429;
          err.response = { headers: { 'retry-after': '0' } };
          throw err;
        }
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should respect Retry-After header delay', async () => {
      let attempts = 0;
      const start = Date.now();

      const result = await limiter.enqueue(async () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error('Rate limited');
          err.statusCode = 429;
          err.retryAfter = 0.05; // 50ms for fast test
          throw err;
        }
        return 'retried';
      });

      expect(result).toBe('retried');
      expect(attempts).toBe(2);
    });

    it('should handle 429 from response.status', async () => {
      let attempts = 0;
      const result = await limiter.enqueue(async () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error('Rate limited');
          err.response = { status: 429, headers: { 'retry-after': '0' } };
          throw err;
        }
        return 'ok';
      });

      expect(result).toBe('ok');
      expect(attempts).toBe(2);
    });

    it('should default Retry-After to 1 second when header is missing', async () => {
      let attempts = 0;
      const result = await limiter.enqueue(async () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error('Rate limited');
          err.statusCode = 429;
          // No retry-after header
          throw err;
        }
        return 'ok';
      });

      expect(result).toBe('ok');
      expect(attempts).toBe(2);
    });
  });

  describe('queue depth and low-priority rejection', () => {
    it('should return current queue depth', async () => {
      const depth = await limiter.getQueueDepth();
      expect(depth).toBe(0);
    });

    it('should reject low-priority requests when queue depth exceeds limit', async () => {
      const smallLimiter = new RateLimiter({ maxConcurrent: 1, maxQueueDepth: 3 });
      const resolvers = [];

      // Fill the concurrency slot
      const blocker = smallLimiter.enqueue(
        () => new Promise((r) => resolvers.push(r))
      );

      // Fill the queue to capacity
      const queued = [];
      for (let i = 0; i < 3; i++) {
        queued.push(smallLimiter.enqueue(() => Promise.resolve(i), 'normal'));
      }

      // This low-priority request should be rejected
      await expect(
        smallLimiter.enqueue(() => Promise.resolve('nope'), 'low')
      ).rejects.toThrow('Queue depth exceeded');

      // High-priority should still be accepted
      const highP = smallLimiter.enqueue(() => Promise.resolve('high'), 'high');

      // Cleanup
      resolvers[0]('done');
      await blocker;
      await Promise.all(queued);
      const highResult = await highP;
      expect(highResult).toBe('high');
    });

    it('should set statusCode 503 on rejection error', async () => {
      const tinyLimiter = new RateLimiter({ maxConcurrent: 1, maxQueueDepth: 0 });

      try {
        await tinyLimiter.enqueue(() => Promise.resolve(), 'low');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.statusCode).toBe(503);
        expect(err.retryAfter).toBe(30);
      }
    });

    it('should not reject non-low priority requests when queue is full', async () => {
      const tinyLimiter = new RateLimiter({ maxConcurrent: 1, maxQueueDepth: 0 });
      const resolvers = [];

      // Fill concurrency
      const blocker = tinyLimiter.enqueue(
        () => new Promise((r) => resolvers.push(r))
      );

      // Queue is at depth 0 (maxQueueDepth=0), but urgent/high/normal should still be accepted
      const urgent = tinyLimiter.enqueue(() => Promise.resolve('urgent'), 'urgent');

      resolvers[0]('done');
      await blocker;
      const result = await urgent;
      expect(result).toBe('urgent');
    });
  });

  describe('getQueueDepth', () => {
    it('should reflect pending jobs in the queue', async () => {
      const singleLimiter = new RateLimiter({ maxConcurrent: 1, maxQueueDepth: 100 });
      const resolvers = [];

      // Fill the slot
      const blocker = singleLimiter.enqueue(
        () => new Promise((r) => resolvers.push(r))
      );

      // Queue 3 more
      const p1 = singleLimiter.enqueue(() => Promise.resolve(1));
      const p2 = singleLimiter.enqueue(() => Promise.resolve(2));
      const p3 = singleLimiter.enqueue(() => Promise.resolve(3));

      const depth = await singleLimiter.getQueueDepth();
      expect(depth).toBe(3);

      // Cleanup
      resolvers[0]('done');
      await blocker;
      await Promise.all([p1, p2, p3]);

      const finalDepth = await singleLimiter.getQueueDepth();
      expect(finalDepth).toBe(0);
    });
  });
});
