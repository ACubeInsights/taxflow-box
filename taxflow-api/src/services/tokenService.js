/**
 * TokenService — Manages Box token lifecycle: Service Account, App User,
 * downscoped, and preview tokens with caching and proactive refresh.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5,
 *               16.1, 16.2, 16.3, 16.4
 */

import boxService from './boxService.js';
import cacheLayer from './cacheLayer.js';

/** @typedef {'item_preview' | 'item_download' | 'item_upload' | 'item_readwrite'} TokenScope */

/**
 * @typedef {object} TokenResult
 * @property {string} accessToken
 * @property {number} expiresIn
 * @property {string} expiresAt - ISO 8601
 * @property {string} tokenType
 */

/** Max preview token TTL in seconds (60 minutes). */
const MAX_PREVIEW_TTL_SECONDS = 3600;

/** Retry delay in ms for token generation failures. */
const RETRY_DELAY_MS = 1000;

/**
 * Builds a TokenResult from a raw token response.
 *
 * @param {string} accessToken
 * @param {number} expiresIn - seconds until expiry
 * @returns {TokenResult}
 */
function buildTokenResult(accessToken, expiresIn) {
  return {
    accessToken,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    tokenType: 'bearer',
  };
}

/**
 * Sleeps for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TokenService {
  /**
   * @param {object} [deps] - Injectable dependencies for testing.
   * @param {typeof boxService} [deps.boxService]
   * @param {typeof cacheLayer} [deps.cacheLayer]
   */
  constructor(deps = {}) {
    this._boxService = deps.boxService ?? boxService;
    this._cache = deps.cacheLayer ?? cacheLayer;
  }

  // ─── Service Account Token (Req 5.1, 5.3, 5.4, 5.5) ───────────────

  /**
   * Returns a Service Account token for admin operations.
   * Cached at 90% of the token's TTL.
   *
   * @returns {Promise<TokenResult>}
   */
  async getServiceAccountToken() {
    const cacheKey = 'token:service_account';
    return this._cache.getOrFetch(cacheKey, 0, async () => {
      const result = await this._generateWithRetry(() => this._fetchServiceAccountToken());
      // Store with 90% TTL
      const ttl = Math.floor(result.expiresIn * 0.9);
      await this._cache.set(cacheKey, result, ttl);
      return result;
    });
  }

  /**
   * Fetches a fresh Service Account token from the Box SDK.
   * @returns {Promise<TokenResult>}
   * @private
   */
  async _fetchServiceAccountToken() {
    const client = this._boxService.getBoxClient();
    // Box Node SDK v10: the auth object exposes token retrieval
    const tokenInfo = await client.auth.downscopeToken(
      ['item_readwrite'],
      undefined // no resource restriction — full service account scope
    );
    const accessToken = tokenInfo.accessToken ?? tokenInfo.access_token;
    const expiresIn = tokenInfo.expiresIn ?? tokenInfo.expires_in ?? 3600;
    return buildTokenResult(accessToken, expiresIn);
  }

  // ─── App User Token (Req 5.2, 5.3, 5.4, 5.5) ──────────────────────

  /**
   * Generates an App User token for client-scoped operations.
   * Uses JWT bearer grant via POST /oauth2/token.
   *
   * @param {string} userId - Box App User ID
   * @returns {Promise<TokenResult>}
   */
  async getAppUserToken(userId) {
    if (!userId) throw new Error('userId is required for App User token generation');

    const cacheKey = `token:user:${userId}`;
    return this._cache.getOrFetch(cacheKey, 0, async () => {
      const result = await this._generateWithRetry(() => this._fetchAppUserToken(userId));
      const ttl = Math.floor(result.expiresIn * 0.9);
      await this._cache.set(cacheKey, result, ttl);
      return result;
    });
  }

  /**
   * Fetches a fresh App User token.
   * @param {string} userId
   * @returns {Promise<TokenResult>}
   * @private
   */
  async _fetchAppUserToken(userId) {
    const client = this._boxService.getBoxClient();
    const tokenInfo = await client.auth.downscopeToken(
      ['item_readwrite'],
      undefined,
      { userId }
    );
    const accessToken = tokenInfo.accessToken ?? tokenInfo.access_token;
    const expiresIn = tokenInfo.expiresIn ?? tokenInfo.expires_in ?? 3600;
    return buildTokenResult(accessToken, expiresIn);
  }

  // ─── Downscoped Token (Req 6.1, 6.2, 6.3, 6.4, 6.5) ───────────────

  /**
   * Generates a downscoped token restricted to a specific scope and resource.
   *
   * @param {string} parentToken - App User token to downscope
   * @param {TokenScope} scope - Permission scope
   * @param {string} resourceUrl - Box resource URL (file or folder)
   * @returns {Promise<TokenResult>}
   */
  async getDownscopedToken(parentToken, scope, resourceUrl) {
    if (!parentToken) throw new Error('parentToken is required for downscoped token generation');
    if (!scope) throw new Error('scope is required for downscoped token generation');

    const cacheKey = `token:downscoped:${scope}:${resourceUrl ?? 'global'}`;

    return this._cache.getOrFetch(cacheKey, 0, async () => {
      const result = await this._generateWithRetry(() =>
        this._fetchDownscopedToken(parentToken, scope, resourceUrl)
      );
      const ttl = Math.floor(result.expiresIn * 0.9);
      await this._cache.set(cacheKey, result, ttl);
      return result;
    });
  }

  /**
   * Fetches a fresh downscoped token via token exchange.
   * @param {string} parentToken
   * @param {TokenScope} scope
   * @param {string} resourceUrl
   * @returns {Promise<TokenResult>}
   * @private
   */
  async _fetchDownscopedToken(parentToken, scope, resourceUrl) {
    const client = this._boxService.getBoxClient();

    // Build the resource object if a URL is provided
    const resource = resourceUrl ? resourceUrl : undefined;

    const tokenInfo = await client.auth.downscopeToken(
      [scope],
      resource,
      { token: parentToken }
    );

    const accessToken = tokenInfo.accessToken ?? tokenInfo.access_token;
    const expiresIn = tokenInfo.expiresIn ?? tokenInfo.expires_in ?? 3600;
    return buildTokenResult(accessToken, expiresIn);
  }

  // ─── Preview Token (Req 16.1, 16.2, 16.3, 16.4) ───────────────────

  /**
   * Generates a preview token for Box Content Preview embedding.
   * Scoped to `item_preview` with a max 60-minute TTL.
   *
   * @param {string} fileId - Box file ID
   * @param {string} userId - App User ID for the parent token
   * @returns {Promise<TokenResult>}
   */
  async getPreviewToken(fileId, userId) {
    if (!fileId) throw new Error('fileId is required for preview token generation');
    if (!userId) throw new Error('userId is required for preview token generation');

    const resourceUrl = `https://api.box.com/2.0/files/${fileId}`;
    const cacheKey = `token:preview:${fileId}:${userId}`;

    return this._cache.getOrFetch(cacheKey, 0, async () => {
      // First get an App User token to use as the parent
      const appUserToken = await this.getAppUserToken(userId);

      const result = await this._generateWithRetry(() =>
        this._fetchDownscopedToken(appUserToken.accessToken, 'item_preview', resourceUrl)
      );

      // Cap TTL at 60 minutes
      const cappedExpiresIn = Math.min(result.expiresIn, MAX_PREVIEW_TTL_SECONDS);
      const cappedResult = buildTokenResult(result.accessToken, cappedExpiresIn);

      const ttl = Math.floor(cappedExpiresIn * 0.9);
      await this._cache.set(cacheKey, cappedResult, ttl);
      return cappedResult;
    });
  }

  // ─── Proactive Refresh (Req 5.4) ───────────────────────────────────

  /**
   * Proactively refreshes a cached token if it is within 10% of its expiry.
   * Returns the refreshed token, or null if the token is still fresh.
   *
   * @param {string} cacheKey - Cache key for the token
   * @returns {Promise<TokenResult | null>}
   */
  async refreshIfNeeded(cacheKey) {
    const cached = await this._cache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    const expiresAt = new Date(cached.expiresAt).getTime();
    const totalLifetime = cached.expiresIn * 1000;
    const remaining = expiresAt - now;

    // If remaining time is within 10% of total lifetime, refresh
    if (remaining <= totalLifetime * 0.1) {
      // Evict stale entry
      await this._cache.del(cacheKey);

      // Determine which token type to refresh based on cache key pattern
      if (cacheKey === 'token:service_account') {
        return this.getServiceAccountToken();
      }

      const userMatch = cacheKey.match(/^token:user:(.+)$/);
      if (userMatch) {
        return this.getAppUserToken(userMatch[1]);
      }

      const previewMatch = cacheKey.match(/^token:preview:(.+):(.+)$/);
      if (previewMatch) {
        return this.getPreviewToken(previewMatch[1], previewMatch[2]);
      }

      // For downscoped tokens we can't refresh without the parent token,
      // so evict and return null — caller must re-request.
      return null;
    }

    return null;
  }

  // ─── Retry Logic (Req 5.5) ─────────────────────────────────────────

  /**
   * Executes a token generation function with a single retry after 1s delay.
   *
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   * @private
   */
  async _generateWithRetry(fn) {
    try {
      return await fn();
    } catch (firstError) {
      await sleep(RETRY_DELAY_MS);
      try {
        return await fn();
      } catch (retryError) {
        const scope = retryError.scope ?? '';
        const resource = retryError.resource ?? '';
        const message = retryError.message ?? 'Unknown error';
        throw new Error(
          `Token generation failed after retry: ${message}` +
            (scope ? ` (scope: ${scope})` : '') +
            (resource ? ` (resource: ${resource})` : '')
        );
      }
    }
  }
}

// Singleton instance
const tokenService = new TokenService();
export default tokenService;
