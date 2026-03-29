import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenService } from '../tokenService.js';
import { CacheLayer } from '../cacheLayer.js';

/**
 * Creates a mock boxService with a configurable downscopeToken implementation.
 */
function createMockBoxService(downscopeFn) {
  return {
    getBoxClient: () => ({
      auth: {
        downscopeToken: downscopeFn ?? vi.fn().mockResolvedValue({
          accessToken: 'mock-access-token',
          expiresIn: 3600,
        }),
      },
    }),
    ensureInitialized: vi.fn(),
  };
}

describe('TokenService', () => {
  /** @type {TokenService} */
  let service;
  /** @type {CacheLayer} */
  let cache;
  let downscopeMock;

  beforeEach(() => {
    cache = new CacheLayer();
    downscopeMock = vi.fn().mockResolvedValue({
      accessToken: 'test-token-abc',
      expiresIn: 3600,
    });
    const mockBox = createMockBoxService(downscopeMock);
    service = new TokenService({ boxService: mockBox, cacheLayer: cache });
  });

  // ─── getServiceAccountToken ─────────────────────────────────────────

  describe('getServiceAccountToken', () => {
    it('returns a valid TokenResult', async () => {
      const result = await service.getServiceAccountToken();

      expect(result).toMatchObject({
        accessToken: 'test-token-abc',
        expiresIn: 3600,
        tokenType: 'bearer',
      });
      expect(result.expiresAt).toBeDefined();
      expect(new Date(result.expiresAt).toISOString()).toBe(result.expiresAt);
    });

    it('caches the token at 90% TTL', async () => {
      await service.getServiceAccountToken();

      // Second call should use cache — downscopeToken called only once
      await service.getServiceAccountToken();
      expect(downscopeMock).toHaveBeenCalledTimes(1);
    });

    it('calls downscopeToken with item_readwrite and no resource', async () => {
      await service.getServiceAccountToken();
      expect(downscopeMock).toHaveBeenCalledWith(
        ['item_readwrite'],
        undefined
      );
    });
  });

  // ─── getAppUserToken ────────────────────────────────────────────────

  describe('getAppUserToken', () => {
    it('returns a valid TokenResult for a user', async () => {
      const result = await service.getAppUserToken('user-123');

      expect(result.accessToken).toBe('test-token-abc');
      expect(result.tokenType).toBe('bearer');
    });

    it('throws when userId is missing', async () => {
      await expect(service.getAppUserToken('')).rejects.toThrow('userId is required');
    });

    it('caches per user ID', async () => {
      await service.getAppUserToken('user-A');
      await service.getAppUserToken('user-A');
      await service.getAppUserToken('user-B');

      // user-A cached, user-B is new → 2 calls total
      expect(downscopeMock).toHaveBeenCalledTimes(2);
    });

    it('passes userId in options', async () => {
      await service.getAppUserToken('user-42');
      expect(downscopeMock).toHaveBeenCalledWith(
        ['item_readwrite'],
        undefined,
        { userId: 'user-42' }
      );
    });
  });

  // ─── getDownscopedToken ─────────────────────────────────────────────

  describe('getDownscopedToken', () => {
    it('returns a downscoped token with correct scope', async () => {
      const result = await service.getDownscopedToken(
        'parent-token',
        'item_download',
        'https://api.box.com/2.0/files/123'
      );

      expect(result.accessToken).toBe('test-token-abc');
      expect(result.tokenType).toBe('bearer');
    });

    it('passes scope and resource to downscopeToken', async () => {
      const resource = 'https://api.box.com/2.0/files/456';
      await service.getDownscopedToken('parent-tok', 'item_upload', resource);

      expect(downscopeMock).toHaveBeenCalledWith(
        ['item_upload'],
        resource,
        { token: 'parent-tok' }
      );
    });

    it('throws when parentToken is missing', async () => {
      await expect(
        service.getDownscopedToken('', 'item_preview', 'https://api.box.com/2.0/files/1')
      ).rejects.toThrow('parentToken is required');
    });

    it('throws when scope is missing', async () => {
      await expect(
        service.getDownscopedToken('tok', '', 'https://api.box.com/2.0/files/1')
      ).rejects.toThrow('scope is required');
    });
  });

  // ─── getPreviewToken ────────────────────────────────────────────────

  describe('getPreviewToken', () => {
    it('returns a preview token with item_preview scope', async () => {
      const result = await service.getPreviewToken('file-99', 'user-5');

      expect(result.accessToken).toBe('test-token-abc');
      expect(result.tokenType).toBe('bearer');
    });

    it('caps TTL at 60 minutes', async () => {
      downscopeMock.mockResolvedValue({
        accessToken: 'long-lived-token',
        expiresIn: 7200, // 2 hours
      });

      const result = await service.getPreviewToken('file-1', 'user-1');
      expect(result.expiresIn).toBe(3600); // capped at 60 min
    });

    it('uses file URL as resource', async () => {
      await service.getPreviewToken('file-42', 'user-7');

      // The second downscopeToken call is for the preview (first is for app user)
      const previewCall = downscopeMock.mock.calls.find(
        (call) => call[0][0] === 'item_preview'
      );
      expect(previewCall).toBeDefined();
      expect(previewCall[1]).toBe('https://api.box.com/2.0/files/file-42');
    });

    it('throws when fileId is missing', async () => {
      await expect(service.getPreviewToken('', 'user-1')).rejects.toThrow('fileId is required');
    });

    it('throws when userId is missing', async () => {
      await expect(service.getPreviewToken('file-1', '')).rejects.toThrow('userId is required');
    });
  });

  // ─── refreshIfNeeded ────────────────────────────────────────────────

  describe('refreshIfNeeded', () => {
    it('returns null when no cached token exists', async () => {
      const result = await service.refreshIfNeeded('token:service_account');
      expect(result).toBeNull();
    });

    it('returns null when token is still fresh', async () => {
      // Seed cache with a token that expires in 1 hour (well above 10%)
      await cache.set('token:service_account', {
        accessToken: 'fresh-token',
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        tokenType: 'bearer',
      }, 3600);

      const result = await service.refreshIfNeeded('token:service_account');
      expect(result).toBeNull();
    });

    it('refreshes service account token when within 10% of expiry', async () => {
      // Token with 3600s lifetime but only 100s remaining (< 360s = 10%)
      await cache.set('token:service_account', {
        accessToken: 'stale-token',
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 100 * 1000).toISOString(),
        tokenType: 'bearer',
      }, 3600);

      const result = await service.refreshIfNeeded('token:service_account');
      expect(result).not.toBeNull();
      expect(result.accessToken).toBe('test-token-abc');
    });

    it('refreshes app user token when within 10% of expiry', async () => {
      await cache.set('token:user:u-55', {
        accessToken: 'stale-user-token',
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 50 * 1000).toISOString(),
        tokenType: 'bearer',
      }, 3600);

      const result = await service.refreshIfNeeded('token:user:u-55');
      expect(result).not.toBeNull();
      expect(result.accessToken).toBe('test-token-abc');
    });

    it('returns null for downscoped tokens (cannot refresh without parent)', async () => {
      await cache.set('token:downscoped:item_download:https://api.box.com/2.0/files/1', {
        accessToken: 'stale-ds-token',
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 10 * 1000).toISOString(),
        tokenType: 'bearer',
      }, 3600);

      const result = await service.refreshIfNeeded(
        'token:downscoped:item_download:https://api.box.com/2.0/files/1'
      );
      expect(result).toBeNull();
    });
  });

  // ─── Retry logic ────────────────────────────────────────────────────

  describe('retry on failure', () => {
    it('retries once after 1s delay on first failure', async () => {
      let callCount = 0;
      downscopeMock.mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('Transient failure');
        return Promise.resolve({ accessToken: 'retry-token', expiresIn: 3600 });
      });

      const result = await service.getServiceAccountToken();
      expect(result.accessToken).toBe('retry-token');
      expect(downscopeMock).toHaveBeenCalledTimes(2);
    });

    it('throws after both attempts fail', async () => {
      downscopeMock.mockRejectedValue(new Error('Persistent failure'));

      await expect(service.getServiceAccountToken()).rejects.toThrow(
        'Token generation failed after retry: Persistent failure'
      );
    });
  });
});
