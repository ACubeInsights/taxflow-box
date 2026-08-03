/**
 * Lightweight in-memory HTTP rate limiter (no external dependency).
 * Suitable for single-instance API; replace with Redis-backed limiter for multi-instance prod.
 */

/**
 * @param {object} options
 * @param {number} options.windowMs
 * @param {number} options.max
 * @param {(req: import('express').Request) => string} [options.keyFn]
 * @param {string} [options.message]
 */
export function rateLimit({ windowMs, max, keyFn, message }) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const buckets = new Map();

  const resolveKey =
    keyFn ||
    ((req) => {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      return `${req.path}:${ip}`;
    });

  // Periodic cleanup to avoid unbounded Map growth
  const CLEANUP_EVERY = 100;
  let hits = 0;

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = resolveKey(req);
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    hits += 1;
    if (hits % CLEANUP_EVERY === 0) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return res.status(429).json({
        error: message || 'Too many requests. Please try again later.',
        code: 'RATE_LIMITED',
      });
    }

    next();
  };
}
