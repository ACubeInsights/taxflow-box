/**
 * Tests for Sprint 4 monitoring features.
 *
 * Covers:
 * - BoxService.healthCheck() — connectivity verification with caching
 * - WebhookService.verifyWebhooksHealthy() — detect and re-register missing webhooks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoxService } from '../boxService.js';
import { WebhookService } from '../webhookService.js';

// Mock dependencies for BoxService
vi.mock('../../../box-wrapper-service/dist/index.js', () => ({
  BoxWrapperService: class {
    constructor() {}
    getBoxClient() { return mockBoxClient; }
    syncMetadataSchema() { return Promise.resolve(); }
    static detectTier() { return Promise.resolve({ tier: 'enterprise', enterpriseId: '123', detectedAt: new Date().toISOString() }); }
  },
}));

vi.mock('../config.js', () => ({
  config: {
    boxConfigPath: '/fake/path',
    boxRootFolderId: '0',
    boxEnterpriseId: '123',
    webhookEndpointUrl: 'https://test.com/webhooks/box',
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../rateLimiter.js', () => ({
  default: { enqueue: vi.fn().mockImplementation(async (fn) => fn()) },
}));

let mockBoxClient;

beforeEach(() => {
  mockBoxClient = {
    users: {
      getCurrentUser: vi.fn().mockResolvedValue({ id: 'svc-123', name: 'TaxFlow Service', login: 'AutomationUser_123@boxdevedition.com' }),
    },
    webhooks: {
      getWebhooks: vi.fn().mockResolvedValue({ entries: [] }),
      createWebhook: vi.fn().mockResolvedValue({ id: 'wh-new', primary_signature_key: 'pk', secondary_signature_key: 'sk' }),
    },
  };
});

describe('BoxService.healthCheck', () => {
  it('returns connected=true when Box API responds', async () => {
    const service = new BoxService();
    service.initialized = true;
    service.tier = 'enterprise';
    service.tierDetectionResult = { tier: 'enterprise', enterpriseId: '123', detectedAt: '2026-06-26T00:00:00Z' };
    service.service = { getBoxClient: () => mockBoxClient };

    const result = await service.healthCheck();

    expect(result.connected).toBe(true);
    expect(result.tier).toBe('enterprise');
    expect(result.enterpriseId).toBe('123');
    expect(result.serviceAccount).toBe('TaxFlow Service');
  });

  it('returns connected=false when Box API fails', async () => {
    mockBoxClient.users.getCurrentUser.mockRejectedValue(new Error('Network timeout'));

    const service = new BoxService();
    service.initialized = true;
    service.tier = 'enterprise';
    service.service = { getBoxClient: () => mockBoxClient };

    const result = await service.healthCheck();

    expect(result.connected).toBe(false);
    expect(result.error).toBe('Network timeout');
  });

  it('caches result for 60 seconds (does not call API again)', async () => {
    const service = new BoxService();
    service.initialized = true;
    service.tier = 'enterprise';
    service.tierDetectionResult = { enterpriseId: '123' };
    service.service = { getBoxClient: () => mockBoxClient };

    await service.healthCheck();
    await service.healthCheck();
    await service.healthCheck();

    expect(mockBoxClient.users.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('returns connected=false when service not initialized', async () => {
    const service = new BoxService();
    service.initialized = false;

    const result = await service.healthCheck();

    expect(result.connected).toBe(false);
    expect(result.error).toContain('not initialized');
  });
});

describe('WebhookService.verifyWebhooksHealthy', () => {
  it('reports all healthy when Box has all registered webhooks', async () => {
    const service = new WebhookService();
    service._webhookStore.set('folder-1', { webhookId: 'wh-1', primaryKey: 'pk', secondaryKey: 'sk' });
    service._webhookStore.set('folder-2', { webhookId: 'wh-2', primaryKey: 'pk', secondaryKey: 'sk' });

    // Directly mock the _getBoxClient for testing
    service._getBoxClient = () => mockBoxClient;
    mockBoxClient.webhooks.getWebhooks.mockResolvedValue({
      entries: [
        { id: 'wh-1', target: { type: 'folder', id: 'folder-1' } },
        { id: 'wh-2', target: { type: 'folder', id: 'folder-2' } },
      ],
    });

    const result = await service.verifyWebhooksHealthy();

    expect(result.total).toBe(2);
    expect(result.healthy).toBe(2);
    expect(result.missing).toBe(0);
    expect(result.reregistered).toBe(0);
  });

  it('detects missing webhooks and re-registers them', async () => {
    const service = new WebhookService();
    service._webhookStore.set('folder-1', { webhookId: 'wh-1', primaryKey: 'pk', secondaryKey: 'sk' });
    service._webhookStore.set('folder-2', { webhookId: 'wh-2', primaryKey: 'pk', secondaryKey: 'sk' });
    service._webhookStore.set('folder-3', { webhookId: 'wh-3', primaryKey: 'pk', secondaryKey: 'sk' });

    service._getBoxClient = () => mockBoxClient;
    mockBoxClient.webhooks.getWebhooks.mockResolvedValue({
      entries: [
        { id: 'wh-1', target: { type: 'folder', id: 'folder-1' } },
      ],
    });

    service.registerWebhook = vi.fn().mockResolvedValue({ webhookId: 'wh-new' });

    const result = await service.verifyWebhooksHealthy();

    expect(result.total).toBe(3);
    expect(result.healthy).toBe(1);
    expect(result.missing).toBe(2);
    expect(result.reregistered).toBe(2);
    expect(service.registerWebhook).toHaveBeenCalledTimes(2);
  });

  it('reports errors when re-registration fails', async () => {
    const service = new WebhookService();
    service._webhookStore.set('folder-1', { webhookId: 'wh-1', primaryKey: 'pk', secondaryKey: 'sk' });

    service._getBoxClient = () => mockBoxClient;
    mockBoxClient.webhooks.getWebhooks.mockResolvedValue({ entries: [] });
    service.registerWebhook = vi.fn().mockRejectedValue(new Error('Rate limited'));

    const result = await service.verifyWebhooksHealthy();

    expect(result.missing).toBe(1);
    expect(result.reregistered).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('Rate limited');
  });

  it('skips re-registration when reregister=false', async () => {
    const service = new WebhookService();
    service._webhookStore.set('folder-1', { webhookId: 'wh-1', primaryKey: 'pk', secondaryKey: 'sk' });

    service._getBoxClient = () => mockBoxClient;
    mockBoxClient.webhooks.getWebhooks.mockResolvedValue({ entries: [] });
    service.registerWebhook = vi.fn();

    const result = await service.verifyWebhooksHealthy({ reregister: false });

    expect(result.missing).toBe(1);
    expect(result.reregistered).toBe(0);
    expect(service.registerWebhook).not.toHaveBeenCalled();
  });

  it('returns empty result when no webhooks registered locally', async () => {
    const service = new WebhookService();
    service._getBoxClient = () => mockBoxClient;

    const result = await service.verifyWebhooksHealthy();

    expect(result.total).toBe(0);
    expect(result.healthy).toBe(0);
    expect(mockBoxClient.webhooks.getWebhooks).not.toHaveBeenCalled();
  });
});
