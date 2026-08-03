/**
 * Security regression tests for Critical fixes (session 47d612).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import crypto from 'crypto';

vi.mock('../../services/vaultDiscoveryService.js', () => ({
  default: {
    getVaultForClient: vi.fn(),
    sanitizeVaultForClient: (vault) => {
      if (!vault) return null;
      const { internalNotes, ...safe } = vault;
      return safe;
    },
  },
}));

vi.mock('../../services/permissionService.js', () => ({
  default: {
    hasAccess: vi.fn(),
    getClientPermissions: vi.fn(),
  },
}));

vi.mock('../../db/repositories/index.js', () => ({
  getRepositories: () => ({
    clientRepo: {
      findByEmail: vi.fn().mockResolvedValue({ id: 'client-1', email: 'c@test.com' }),
      findByBoxUserId: vi.fn(),
    },
    userRepo: null,
  }),
}));

vi.mock('../../db/schemaMode.js', () => ({
  isBoxFirstSchema: () => false,
}));

vi.mock('../../config.js', () => ({
  config: { nodeEnv: 'test', allowMockAuth: false },
}));

vi.mock('../../services/authService.js', () => ({
  default: {
    validateSession: vi.fn(),
  },
}));

import vaultDiscoveryService from '../../services/vaultDiscoveryService.js';
import permissionService from '../../services/permissionService.js';
import {
  permissionCheck,
  validateFolderOwnership,
} from '../authMiddleware.js';
import webhookRawBody from '../webhookRawBody.js';

function safeUploadFilename(originalname) {
  const ext = path.extname(originalname || '').replace(/[^\w.]/g, '').slice(0, 16);
  const base = crypto.randomUUID();
  return ext ? `${base}${ext}` : base;
}

describe('Critical security fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sanitizeVaultForClient strips internalNotes', () => {
    const vault = {
      root: '1',
      uploads: '2',
      internalNotes: 'secret-notes',
    };
    const safe = vaultDiscoveryService.sanitizeVaultForClient(vault);
    expect(safe.internalNotes).toBeUndefined();
    expect(safe.root).toBe('1');
    expect(safe.uploads).toBe('2');
  });

  it('multer safe filename rejects path traversal segments', () => {
    const evil = '../../../etc/passwd';
    const safe = safeUploadFilename(evil);
    expect(safe.includes('..')).toBe(false);
    expect(safe.includes('/')).toBe(false);
    expect(safe.includes('\\')).toBe(false);
    expect(path.basename(safe)).toBe(safe);
  });

  it('permissionCheck denies when hasAccess is false (no any-folder bypass)', async () => {
    permissionService.hasAccess.mockResolvedValue(false);
    permissionService.getClientPermissions.mockResolvedValue([
      { resourceType: 'folder', accessLevel: 'writer', resourceId: 'uploads-only' },
    ]);

    const mw = permissionCheck('viewer');
    const req = {
      user: { role: 'client', email: 'c@test.com', userId: 'u1' },
      params: { fileId: 'other-client-file' },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await mw(req, res, next);

    expect(permissionService.hasAccess).toHaveBeenCalledWith(
      'client-1',
      'other-client-file',
      'viewer',
      'file'
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
    expect(permissionService.getClientPermissions).not.toHaveBeenCalled();
  });

  it('validateFolderOwnership rejects Internal Notes folder id', async () => {
    vaultDiscoveryService.getVaultForClient.mockResolvedValue({
      root: 'r1',
      uploads: 'u1',
      tax: 't1',
      supportingDocs: 's1',
      signedDocuments: 'sd1',
      projects: 'p1',
      year: 'y1',
      internalNotes: 'notes-secret',
    });
    permissionService.hasAccess.mockResolvedValue(false);

    const req = {
      user: { role: 'client', email: 'c@test.com', userId: 'u1' },
      params: { folderId: 'notes-secret' },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await validateFolderOwnership(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('webhookRawBody preserves Buffer rawBody for HMAC', async () => {
    const payload = Buffer.from(JSON.stringify({ trigger: 'FILE.UPLOADED' }), 'utf8');
    const req = { body: payload };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    // webhookRawBody is [express.raw(), handler] — invoke the second middleware with Buffer body
    const handler = webhookRawBody[1];
    await new Promise((resolve) => {
      handler(req, res, (...args) => {
        next(...args);
        resolve();
      });
    });

    expect(Buffer.isBuffer(req.rawBody)).toBe(true);
    expect(req.rawBody.equals(payload)).toBe(true);
    expect(req.body.trigger).toBe('FILE.UPLOADED');
    expect(next).toHaveBeenCalled();
  });

  it('webhookRawBody flags reconstructed JSON path', async () => {
    const req = { body: { trigger: 'FILE.UPLOADED' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    const handler = webhookRawBody[1];
    await new Promise((resolve) => {
      handler(req, res, (...args) => {
        next(...args);
        resolve();
      });
    });
    expect(Buffer.isBuffer(req.rawBody)).toBe(true);
    expect(next).toHaveBeenCalled();
  });
});
