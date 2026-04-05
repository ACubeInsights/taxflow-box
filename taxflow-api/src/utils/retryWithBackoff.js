/**
 * @module retryWithBackoff
 * Exponential-backoff retry utility for taxflow-api.
 *
 * Wraps an async function so that transient failures are retried with
 * exponentially increasing delays (`baseDelayMs * 2^(attempt-1)`).
 * Replaces duplicate retry loops formerly scattered across
 * notificationService, uploadService, and webhookService.
 *
 * Public API:
 * - retryWithBackoff(fn, options?) → Promise<T>
 *
 * Requirements: 5.4
 */

/**
 * Retries an async function with exponential backoff.
 * @template T
 * @param {() => Promise<T>} fn - The async function to retry.
 * @param {{ maxRetries?: number, baseDelayMs?: number }} [options]
 * @param {number} [options.maxRetries=3] - Maximum number of attempts before giving up.
 * @param {number} [options.baseDelayMs=2000] - Base delay in milliseconds. Actual delay is `baseDelayMs * 2^(attempt-1)`.
 * @returns {Promise<T>} The resolved value from `fn`.
 * @throws {Error} The last error thrown by `fn` after all retries are exhausted.
 */
export async function retryWithBackoff(fn, { maxRetries = 3, baseDelayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
