/**
 * Tests for chunked upload routing and logic in BoxService.
 *
 * Verifies:
 * - Files < 20MB use direct upload
 * - Files >= 20MB use chunked upload (session → parts → commit)
 * - SHA-1 digest computed for each part and whole file
 * - Session aborted on part upload failure
 * - Commit uses ordered parts list + file digest
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoxService } from '../boxService.js';

// Mock dependencies
vi.mock('../../../box-wrapper-service/dist/index.js', () => ({
  BoxWrapperService: class {
    constructor() {}
    getBoxClient() { return mockClient; }
    syncMetadataSchema() { return Promise.resolve(); }
    static detectTier() { return Promise.resolve({ tier: 'enterprise', enterpriseId: '123', detectedAt: new Date().toISOString() }); }
  },
}));

vi.mock('../config.js', () => ({
  config: {
    boxConfigPath: '/fake/path',
    boxRootFolderId: '0',
    boxEnterpriseId: '123',
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

let mockClient;
let uploadedParts;
let sessionCreated;
let commitCalled;
let directUploadCalled;

beforeEach(() => {
  uploadedParts = [];
  sessionCreated = null;
  commitCalled = null;
  directUploadCalled = null;

  mockClient = {
    uploads: {
      uploadFile: vi.fn().mockImplementation(async (opts) => {
        directUploadCalled = opts;
        return { entries: [{ id: 'file-direct-1', name: opts.attributes.name, size: 1000 }] };
      }),
    },
    chunkedUploads: {
      createFileUploadSession: vi.fn().mockImplementation(async (opts) => {
        sessionCreated = opts;
        return { id: 'session-123', partSize: 8 * 1024 * 1024 };
      }),
      uploadFilePart: vi.fn().mockImplementation(async (sessionId, opts) => {
        uploadedParts.push({ sessionId, offset: opts.offset, size: opts.chunk.length });
        return { part: { offset: opts.offset, size: opts.chunk.length, partId: `part-${uploadedParts.length}` } };
      }),
      commit: vi.fn().mockImplementation(async (sessionId, opts) => {
        commitCalled = { sessionId, partsCount: opts.parts.length, sha1: opts.sha1 };
        return { entries: [{ id: 'file-chunked-1', name: 'largefile.pdf', size: 25 * 1024 * 1024 }] };
      }),
      deleteFileUploadSession: vi.fn().mockResolvedValue(undefined),
    },
  };
});

describe('BoxService upload routing', () => {
  it('routes files < 20MB to direct upload', async () => {
    const service = new BoxService();
    service.initialized = true;
    service.service = { getBoxClient: () => mockClient };

    const smallFile = Buffer.alloc(10 * 1024 * 1024); // 10MB
    const result = await service.uploadFile('folder-1', 'small.pdf', smallFile);

    expect(directUploadCalled).not.toBeNull();
    expect(sessionCreated).toBeNull();
    expect(result.id).toBe('file-direct-1');
  });

  it('routes files >= 20MB to chunked upload', async () => {
    const service = new BoxService();
    service.initialized = true;
    service.service = { getBoxClient: () => mockClient };

    const largeFile = Buffer.alloc(25 * 1024 * 1024); // 25MB
    const result = await service.uploadFile('folder-1', 'large.pdf', largeFile);

    expect(directUploadCalled).toBeNull();
    expect(sessionCreated).not.toBeNull();
    expect(sessionCreated.folderId).toBe('folder-1');
    expect(sessionCreated.fileSize).toBe(25 * 1024 * 1024);
    expect(sessionCreated.fileName).toBe('large.pdf');
    expect(result.id).toBe('file-chunked-1');
  });

  it('routes file at exactly 20MB threshold to chunked upload', async () => {
    const service = new BoxService();
    service.initialized = true;
    service.service = { getBoxClient: () => mockClient };

    const exactThreshold = Buffer.alloc(20 * 1024 * 1024); // exactly 20MB
    await service.uploadFile('folder-1', 'exact.pdf', exactThreshold);

    expect(sessionCreated).not.toBeNull();
    expect(directUploadCalled).toBeNull();
  });
});

describe('BoxService chunked upload internals', () => {
  it('creates upload session with correct parameters', async () => {
    const service = new BoxService();
    service.initialized = true;
    service.service = { getBoxClient: () => mockClient };

    const file = Buffer.alloc(25 * 1024 * 1024);
    await service.chunkedUpload('folder-99', 'report.xlsx', file, file.length);

    expect(sessionCreated.folderId).toBe('folder-99');
    expect(sessionCreated.fileName).toBe('report.xlsx');
    expect(sessionCreated.fileSize).toBe(25 * 1024 * 1024);
  });

  it('uploads correct number of parts for file size', async () => {
    const service = new BoxService();
    service.initialized = true;
    service.service = { getBoxClient: () => mockClient };

    // 25MB file / 8MB parts = 4 parts (8 + 8 + 8 + 1MB)
    const file = Buffer.alloc(25 * 1024 * 1024);
    await service.chunkedUpload('folder-1', 'file.pdf', file, file.length);

    expect(uploadedParts.length).toBe(4);
    expect(uploadedParts[0].offset).toBe(0);
    expect(uploadedParts[0].size).toBe(8 * 1024 * 1024);
    expect(uploadedParts[3].offset).toBe(24 * 1024 * 1024);
    expect(uploadedParts[3].size).toBe(1 * 1024 * 1024);
  });

  it('commits with all parts and SHA-1 file digest', async () => {
    const service = new BoxService();
    service.initialized = true;
    service.service = { getBoxClient: () => mockClient };

    const crypto = await import('crypto');
    const file = Buffer.alloc(20 * 1024 * 1024);
    const expectedSha1 = crypto.createHash('sha1').update(file).digest('base64');

    await service.chunkedUpload('folder-1', 'file.pdf', file, file.length);

    expect(commitCalled).not.toBeNull();
    expect(commitCalled.sessionId).toBe('session-123');
    expect(commitCalled.partsCount).toBe(3); // 20MB / 8MB = 2.5 → 3 parts
    expect(commitCalled.sha1).toBe(expectedSha1);
  });

  it('aborts session and throws on part upload failure', async () => {
    const service = new BoxService();
    service.initialized = true;
    service.service = { getBoxClient: () => mockClient };

    // Fail on second part
    mockClient.chunkedUploads.uploadFilePart
      .mockResolvedValueOnce({ part: { offset: 0, size: 8 * 1024 * 1024 } })
      .mockRejectedValueOnce(Object.assign(new Error('Network error'), { statusCode: 500 }));

    const file = Buffer.alloc(25 * 1024 * 1024);

    await expect(
      service.chunkedUpload('folder-1', 'file.pdf', file, file.length)
    ).rejects.toThrow(/Chunked upload part failed at offset/);

    expect(mockClient.chunkedUploads.deleteFileUploadSession).toHaveBeenCalledWith('session-123');
  });

  it('throws on commit failure', async () => {
    const service = new BoxService();
    service.initialized = true;
    service.service = { getBoxClient: () => mockClient };

    mockClient.chunkedUploads.commit.mockRejectedValue(
      Object.assign(new Error('SHA mismatch'), { statusCode: 412 })
    );

    const file = Buffer.alloc(20 * 1024 * 1024);

    await expect(
      service.chunkedUpload('folder-1', 'file.pdf', file, file.length)
    ).rejects.toThrow(/commit failed/);
  });

  it('throws on session creation failure', async () => {
    const service = new BoxService();
    service.initialized = true;
    service.service = { getBoxClient: () => mockClient };

    mockClient.chunkedUploads.createFileUploadSession.mockRejectedValue(
      Object.assign(new Error('Insufficient storage'), { statusCode: 507 })
    );

    const file = Buffer.alloc(20 * 1024 * 1024);

    await expect(
      service.chunkedUpload('folder-1', 'file.pdf', file, file.length)
    ).rejects.toThrow(/Failed to create chunked upload session/);
  });
});

describe('BoxService.CHUNKED_THRESHOLD', () => {
  it('is 20MB', () => {
    expect(BoxService.CHUNKED_THRESHOLD).toBe(20 * 1024 * 1024);
  });
});

describe('BoxService.CHUNK_SIZE', () => {
  it('is 8MB', () => {
    expect(BoxService.CHUNK_SIZE).toBe(8 * 1024 * 1024);
  });
});
