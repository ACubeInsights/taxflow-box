import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from '../circuitBreaker.js';

describe('CircuitBreaker', () => {
  /** @type {CircuitBreaker} */
  let breaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      windowMs: 60_000,
      threshold: 0.5,
      cooldownMs: 30_000,
      minRequests: 10,
    });
  });

  describe('closed state — normal operation', () => {
    it('should start in closed state', () => {
      expect(breaker.getState()).toBe('closed');
    });

    it('should execute and return the result when closed', async () => {
      const result = await breaker.execute(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('should propagate errors from the wrapped function', async () => {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow('fail');
      expect(breaker.getState()).toBe('closed');
    });

    it('should remain closed when failure rate is below threshold', async () => {
      // 9 successes, 1 failure → 10% failure rate, well below 50%
      for (let i = 0; i < 9; i++) {
        await breaker.execute(() => Promise.resolve('ok'));
      }
      await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('closed → open transition (Req 38.1, 38.2)', () => {
    it('should open when failure rate exceeds 50% with >= 10 requests', async () => {
      // 4 successes + 6 failures = 60% failure rate with 10 requests
      for (let i = 0; i < 4; i++) {
        await breaker.execute(() => Promise.resolve('ok'));
      }
      for (let i = 0; i < 6; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      expect(breaker.getState()).toBe('open');
    });

    it('should NOT open when fewer than minRequests have been recorded', async () => {
      // 9 requests, all failures → 100% failure rate but only 9 requests
      for (let i = 0; i < 9; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      expect(breaker.getState()).toBe('closed');
    });

    it('should reject requests with 503 when open', async () => {
      // Trip the breaker
      for (let i = 0; i < 4; i++) {
        await breaker.execute(() => Promise.resolve('ok'));
      }
      for (let i = 0; i < 6; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      expect(breaker.getState()).toBe('open');

      try {
        await breaker.execute(() => Promise.resolve('should not run'));
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.statusCode).toBe(503);
        expect(err.message).toContain('open');
      }
    });
  });

  describe('rolling window (Req 38.1)', () => {
    it('should only count requests within the rolling window', async () => {
      // Use a short window for testing
      const shortBreaker = new CircuitBreaker({
        windowMs: 100,
        threshold: 0.5,
        cooldownMs: 30_000,
        minRequests: 4,
      });

      // Record 4 failures (100% failure rate, meets minRequests)
      for (let i = 0; i < 4; i++) {
        await shortBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      expect(shortBreaker.getState()).toBe('open');

      // Reset for a fresh breaker with same short window
      const shortBreaker2 = new CircuitBreaker({
        windowMs: 100,
        threshold: 0.5,
        cooldownMs: 30_000,
        minRequests: 4,
      });

      // Record 2 failures
      for (let i = 0; i < 2; i++) {
        await shortBreaker2.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      // Wait for the window to expire
      await new Promise((r) => setTimeout(r, 150));

      // Now record 4 successes — old failures should be pruned
      for (let i = 0; i < 4; i++) {
        await shortBreaker2.execute(() => Promise.resolve('ok'));
      }
      expect(shortBreaker2.getState()).toBe('closed');
    });
  });

  describe('open → half-open transition (Req 38.3)', () => {
    it('should transition to half-open after cooldown', async () => {
      const fastBreaker = new CircuitBreaker({
        windowMs: 60_000,
        threshold: 0.5,
        cooldownMs: 50, // 50ms cooldown for fast test
        minRequests: 4,
      });

      // Trip the breaker
      for (let i = 0; i < 2; i++) {
        await fastBreaker.execute(() => Promise.resolve('ok'));
      }
      for (let i = 0; i < 3; i++) {
        await fastBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      expect(fastBreaker.getState()).toBe('open');

      // Wait for cooldown
      await new Promise((r) => setTimeout(r, 60));

      expect(fastBreaker.getState()).toBe('half-open');
    });
  });

  describe('half-open state — probe request (Req 38.4)', () => {
    /** @type {CircuitBreaker} */
    let fastBreaker;

    beforeEach(async () => {
      fastBreaker = new CircuitBreaker({
        windowMs: 60_000,
        threshold: 0.5,
        cooldownMs: 50,
        minRequests: 4,
      });

      // Trip the breaker
      for (let i = 0; i < 2; i++) {
        await fastBreaker.execute(() => Promise.resolve('ok'));
      }
      for (let i = 0; i < 3; i++) {
        await fastBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      // Wait for cooldown
      await new Promise((r) => setTimeout(r, 60));
      expect(fastBreaker.getState()).toBe('half-open');
    });

    it('should close on successful probe', async () => {
      const result = await fastBreaker.execute(() => Promise.resolve('probe-ok'));
      expect(result).toBe('probe-ok');
      expect(fastBreaker.getState()).toBe('closed');
    });

    it('should re-open on failed probe', async () => {
      await fastBreaker.execute(() => Promise.reject(new Error('probe-fail'))).catch(() => {});
      expect(fastBreaker.getState()).toBe('open');
    });

    it('should reject concurrent requests while probe is in flight', async () => {
      // Start a slow probe
      const probePromise = fastBreaker.execute(
        () => new Promise((r) => setTimeout(() => r('slow-probe'), 100))
      );

      // Second request should be rejected
      try {
        await fastBreaker.execute(() => Promise.resolve('concurrent'));
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.statusCode).toBe(503);
        expect(err.message).toContain('half-open');
      }

      await probePromise;
      expect(fastBreaker.getState()).toBe('closed');
    });
  });

  describe('onStateChange listener (Req 38.5)', () => {
    it('should emit state change events', async () => {
      const transitions = [];
      const fastBreaker = new CircuitBreaker({
        windowMs: 60_000,
        threshold: 0.5,
        cooldownMs: 50,
        minRequests: 4,
      });

      fastBreaker.onStateChange((from, to) => {
        transitions.push({ from, to });
      });

      // Trip: closed → open
      for (let i = 0; i < 2; i++) {
        await fastBreaker.execute(() => Promise.resolve('ok'));
      }
      for (let i = 0; i < 3; i++) {
        await fastBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      expect(transitions).toContainEqual({ from: 'closed', to: 'open' });

      // Wait for cooldown: open → half-open
      await new Promise((r) => setTimeout(r, 60));
      fastBreaker.getState(); // triggers lazy transition

      expect(transitions).toContainEqual({ from: 'open', to: 'half-open' });

      // Successful probe: half-open → closed
      await fastBreaker.execute(() => Promise.resolve('probe'));

      expect(transitions).toContainEqual({ from: 'half-open', to: 'closed' });
      expect(transitions).toHaveLength(3);
    });

    it('should not break if a listener throws', async () => {
      const fastBreaker = new CircuitBreaker({
        windowMs: 60_000,
        threshold: 0.5,
        cooldownMs: 50,
        minRequests: 4,
      });

      fastBreaker.onStateChange(() => {
        throw new Error('listener error');
      });

      // Trip the breaker — should not throw from listener
      for (let i = 0; i < 2; i++) {
        await fastBreaker.execute(() => Promise.resolve('ok'));
      }
      for (let i = 0; i < 3; i++) {
        await fastBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      expect(fastBreaker.getState()).toBe('open');
    });
  });

  describe('configurable options', () => {
    it('should use default options when none provided', () => {
      const defaultBreaker = new CircuitBreaker();
      expect(defaultBreaker.getState()).toBe('closed');
      expect(defaultBreaker._windowMs).toBe(60_000);
      expect(defaultBreaker._threshold).toBe(0.5);
      expect(defaultBreaker._cooldownMs).toBe(30_000);
      expect(defaultBreaker._minRequests).toBe(10);
    });
  });
});
