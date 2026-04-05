import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff } from '../retryWithBackoff.js';

describe('retryWithBackoff', () => {
  it('returns the value on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and returns on eventual success', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn, { maxRetries: 4, baseDelayMs: 1 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 })
    ).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses default options when none provided', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await retryWithBackoff(fn);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('applies exponential backoff delays', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('done');

    const promise = retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 100 });

    // First attempt fails immediately, then waits 100 * 2^0 = 100ms
    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
