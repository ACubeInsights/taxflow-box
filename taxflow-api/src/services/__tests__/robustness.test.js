/**
 * Tests for Sprint 3 robustness improvements.
 *
 * Covers:
 * - Context extraction from path_collection (0 API calls)
 * - Context extraction fallback (API calls when no path_collection)
 * - Metadata skip on free tier
 * - Cache invalidation (prefix-based)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostUploadPipeline } from '../postUploadPipeline.js';
import { CacheLayer } from '../cacheLayer.js';

// Mock dependencies for postUploadPipeline
vi.mock('../boxService.js', () => ({
  default: {
    getBoxClient: () => mockBoxClient,
    getTier: () => currentTier,
  },
}));

vi.mock('../rateLimiter.js', () => ({
  default: { enqueue: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../aiExtractionService.js', () => ({
  default: { extractStructuredData: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../notificationService.js', () => ({
  default: { dispatchUploadNotification: vi.fn().mockResolvedValue(undefined) },
}));

let mockBoxClient;
let currentTier;
let apiCallCount;

beforeEach(() => {
  apiCallCount = 0;
  currentTier = 'enterprise';
  mockBoxClient = {
    files: {
      getFileById: vi.fn().mockImplementation(async () => {
        apiCallCount++;
        return { parent: { id: 'folder-uploads' } };
      }),
    },
    folders: {
      getFolderById: vi.fn().mockImplementation(async (id) => {
        apiCallCount++;
        const responses = {
          'folder-uploads': { name: 'Uploads', parent: { id: 'folder-projects' } },
          'folder-projects': { name: 'Projects', parent: { id: 'folder-year' } },
          'folder-year': { name: '2025', parent: { id: 'folder-root' } },
          'folder-root': { name: 'John Smith (CL-123)' },
        };
        return responses[id] || { name: 'Unknown' };
      }),
    },
    fileMetadata: {
      createFileMetadataById: vi.fn().mockResolvedValue({}),
      getFileMetadataById: vi.fn().mockRejectedValue({ statusCode: 404 }),
    },
    tasks: {
      createTask: vi.fn().mockResolvedValue({ id: 'task-1' }),
      createTaskAssignment: vi.fn().mockResolvedValue({ id: 'ta-1' }),
    },
  };
});

describe('PostUploadPipeline._extractContext — path_collection optimization', () => {
  it('extracts clientId and financialYear from path_collection without API calls', async () => {
    const pipeline = new PostUploadPipeline();
    const eventSource = {
      path_collection: {
        entries: [
          { type: 'folder', id: '0', name: 'All Files' },
          { type: 'folder', id: '100', name: 'John Smith (CL-123)' },
          { type: 'folder', id: '101', name: '2025' },
          { type: 'folder', id: '102', name: 'Projects' },
          { type: 'folder', id: '103', name: 'Uploads' },
        ],
      },
    };

    const result = await pipeline._extractContext('file-1', mockBoxClient, eventSource);

    expect(result.clientId).toBe('CL-123');
    expect(result.financialYear).toBe('2025');
    expect(apiCallCount).toBe(0); // No API calls made
  });

  it('handles path_collection with intermediate root folder', async () => {
    const pipeline = new PostUploadPipeline();
    const eventSource = {
      path_collection: {
        entries: [
          { type: 'folder', id: '0', name: 'All Files' },
          { type: 'folder', id: '50', name: 'TaxFlow Clients' },
          { type: 'folder', id: '100', name: 'Acme Corp (EXT-456)' },
          { type: 'folder', id: '101', name: '2026' },
          { type: 'folder', id: '102', name: 'Projects' },
          { type: 'folder', id: '103', name: 'Tax' },
        ],
      },
    };

    const result = await pipeline._extractContext('file-1', mockBoxClient, eventSource);

    expect(result.clientId).toBe('EXT-456');
    expect(result.financialYear).toBe('2026');
    expect(apiCallCount).toBe(0);
  });

  it('falls back to API calls when path_collection is missing', async () => {
    const pipeline = new PostUploadPipeline();
    const eventSource = {}; // No path_collection

    const result = await pipeline._extractContext('file-1', mockBoxClient, eventSource);

    expect(result.clientId).toBe('CL-123');
    expect(result.financialYear).toBe('2025');
    expect(apiCallCount).toBe(5); // getFileById + 4x getFolderById
  });

  it('falls back to API when path_collection has too few entries', async () => {
    const pipeline = new PostUploadPipeline();
    const eventSource = {
      path_collection: {
        entries: [
          { type: 'folder', id: '0', name: 'All Files' },
          { type: 'folder', id: '1', name: 'SomeFolder' },
        ],
      },
    };

    const result = await pipeline._extractContext('file-1', mockBoxClient, eventSource);

    // Falls back because < 4 entries and no externalId pattern found
    expect(apiCallCount).toBeGreaterThan(0);
  });

  it('falls back when no folder matches (externalId) pattern', async () => {
    const pipeline = new PostUploadPipeline();
    const eventSource = {
      path_collection: {
        entries: [
          { type: 'folder', id: '0', name: 'All Files' },
          { type: 'folder', id: '1', name: 'NoParentheses' },
          { type: 'folder', id: '2', name: 'StillNothing' },
          { type: 'folder', id: '3', name: 'Projects' },
          { type: 'folder', id: '4', name: 'Uploads' },
        ],
      },
    };

    const result = await pipeline._extractContext('file-1', mockBoxClient, eventSource);

    // Falls back to API since no (externalId) pattern found
    expect(apiCallCount).toBeGreaterThan(0);
  });
});

describe('PostUploadPipeline — free tier metadata skip', () => {
  it('skips metadata API calls on free tier', async () => {
    currentTier = 'free';
    const pipeline = new PostUploadPipeline();

    const event = {
      source: {
        id: 'file-1',
        name: 'doc.pdf',
        parent: { name: 'Uploads' },
        path_collection: {
          entries: [
            { type: 'folder', id: '0', name: 'All Files' },
            { type: 'folder', id: '100', name: 'Client (CL-1)' },
            { type: 'folder', id: '101', name: '2025' },
            { type: 'folder', id: '102', name: 'Projects' },
            { type: 'folder', id: '103', name: 'Uploads' },
          ],
        },
      },
      created_by: { login: 'employee@test.com' },
    };

    const result = await pipeline.processUpload(event);

    expect(result.metadataApplied).toBe(false);
    expect(mockBoxClient.fileMetadata.createFileMetadataById).not.toHaveBeenCalled();
  });

  it('applies metadata on enterprise tier', async () => {
    currentTier = 'enterprise';
    const pipeline = new PostUploadPipeline();

    const event = {
      source: {
        id: 'file-2',
        name: 'tax.pdf',
        parent: { name: 'Uploads' },
        path_collection: {
          entries: [
            { type: 'folder', id: '0', name: 'All Files' },
            { type: 'folder', id: '100', name: 'Client (CL-2)' },
            { type: 'folder', id: '101', name: '2025' },
            { type: 'folder', id: '102', name: 'Projects' },
            { type: 'folder', id: '103', name: 'Uploads' },
          ],
        },
      },
      created_by: { login: 'employee@test.com' },
    };

    const result = await pipeline.processUpload(event);

    expect(result.metadataApplied).toBe(true);
    expect(mockBoxClient.fileMetadata.createFileMetadataById).toHaveBeenCalled();
  });
});

describe('CacheLayer.invalidate', () => {
  it('removes all entries matching a prefix', async () => {
    const cache = new CacheLayer();
    await cache.set('portal:client:abc', 'data1', 60);
    await cache.set('portal:client:xyz', 'data2', 60);
    await cache.set('portal:employee:emp1', 'data3', 60);
    await cache.set('token:user:123', 'data4', 60);

    const count = await cache.invalidate('portal:client:');

    expect(count).toBe(2);
    expect(await cache.get('portal:client:abc')).toBeNull();
    expect(await cache.get('portal:client:xyz')).toBeNull();
    expect(await cache.get('portal:employee:emp1')).not.toBeNull();
    expect(await cache.get('token:user:123')).not.toBeNull();
  });

  it('returns 0 when no entries match', async () => {
    const cache = new CacheLayer();
    await cache.set('key1', 'val1', 60);

    const count = await cache.invalidate('nonexistent:');
    expect(count).toBe(0);
  });

  it('clear() removes all entries', async () => {
    const cache = new CacheLayer();
    await cache.set('a', 1, 60);
    await cache.set('b', 2, 60);
    await cache.set('c', 3, 60);

    await cache.clear();
    expect(cache.size).toBe(0);
  });
});
