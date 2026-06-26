/**
 * CacheLayer — In-memory LRU cache with per-entry TTL.
 *
 * Key formats:
 *   - Metadata queries: `mq:{query_hash}`
 *   - Tokens:           `token:{user_id}:{scope}`
 *
 * Requirements: 35.1, 35.2, 35.3, 35.4, 35.5, 35.6
 */

export class CacheLayer {
  /**
   * @param {object} [options]
   * @param {number} [options.maxEntries=1000] Maximum number of entries before LRU eviction.
   */
  constructor({ maxEntries = 1000 } = {}) {
    /** @type {number} */
    this.maxEntries = maxEntries;

    /**
     * Map preserves insertion order; we re-insert on access to maintain LRU ordering.
     * Each value: { value: any, expiresAt: number }
     * @type {Map<string, { value: any, expiresAt: number }>}
     */
    this._store = new Map();
  }

  /**
   * Gets a cached value. Returns null if not found or expired.
   * Promotes the key to most-recently-used on hit.
   *
   * @param {string} key
   * @returns {Promise<any | null>}
   */
  async get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }

    // Promote to most-recently-used by re-inserting
    this._store.delete(key);
    this._store.set(key, entry);

    return entry.value;
  }

  /**
   * Sets a cached value with TTL in seconds.
   *
   * @param {string} key
   * @param {any} value
   * @param {number} ttlSeconds
   * @returns {Promise<void>}
   */
  async set(key, value, ttlSeconds) {
    // Delete first so re-insert places it at the end (most-recently-used)
    this._store.delete(key);

    // Evict LRU entries if at capacity
    while (this._store.size >= this.maxEntries) {
      const oldestKey = this._store.keys().next().value;
      this._store.delete(oldestKey);
    }

    this._store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Deletes a cached entry.
   *
   * @param {string} key
   * @returns {Promise<void>}
   */
  async del(key) {
    this._store.delete(key);
  }

  /**
   * Invalidates all cache entries whose keys start with the given prefix.
   * Use after write operations to ensure fresh data on next read.
   *
   * @param {string} prefix - Key prefix to match (e.g., 'portal:client:abc123')
   * @returns {Promise<number>} Number of entries invalidated
   */
  async invalidate(prefix) {
    let count = 0;
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) {
        this._store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clears the entire cache.
   * @returns {Promise<void>}
   */
  async clear() {
    this._store.clear();
  }

  /**
   * Cache-through pattern: returns cached value if present and fresh,
   * otherwise executes the fetcher, caches the result, and returns it.
   *
   * @template T
   * @param {string} key
   * @param {number} ttlSeconds
   * @param {() => Promise<T>} fetcher
   * @returns {Promise<T>}
   */
  async getOrFetch(key, ttlSeconds, fetcher) {
    const cached = await this.get(key);
    if (cached !== null) return cached;

    const value = await fetcher();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Returns the current number of (non-expired) logical entries.
   * Note: expired entries are lazily evicted, so this counts raw map size.
   *
   * @returns {number}
   */
  get size() {
    return this._store.size;
  }
}

// Singleton instance with default settings
const cacheLayer = new CacheLayer();
export default cacheLayer;
