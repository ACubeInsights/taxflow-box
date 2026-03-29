import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

// Mock tokenService before importing the router
vi.mock('../../services/tokenService.js', () => {
  return {
    default: {
      getPreviewToken: vi.fn(),
    },
  };
});

import tokenService from '../../services/tokenService.js';
import tokensRouter from '../tokens.js';

/**
 * Helper: creates a minimal Express app with the tokens router mounted.
 */
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tokens', tokensRouter);
  // Error handler
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });
  return app;
}

/**
 * Lightweight supertest-style helper using native fetch against an ephemeral server.
 */
async function request(app, method, path, body) {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return { status: res.status, body: json };
  } finally {
    server.close();
  }
}

describe('POST /api/tokens/preview', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns 200 with TokenResult on success', async () => {
    const mockResult = {
      accessToken: 'preview-tok-abc',
      expiresIn: 3600,
      expiresAt: '2025-01-01T01:00:00.000Z',
      tokenType: 'bearer',
    };
    tokenService.getPreviewToken.mockResolvedValue(mockResult);

    const res = await request(app, 'POST', '/api/tokens/preview', {
      fileId: 'file-123',
      userId: 'user-456',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResult);
    expect(tokenService.getPreviewToken).toHaveBeenCalledWith('file-123', 'user-456');
  });

  it('returns 400 when fileId is missing', async () => {
    const res = await request(app, 'POST', '/api/tokens/preview', {
      userId: 'user-456',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fileId.*userId.*required/i);
    expect(tokenService.getPreviewToken).not.toHaveBeenCalled();
  });

  it('returns 400 when userId is missing', async () => {
    const res = await request(app, 'POST', '/api/tokens/preview', {
      fileId: 'file-123',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fileId.*userId.*required/i);
    expect(tokenService.getPreviewToken).not.toHaveBeenCalled();
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app, 'POST', '/api/tokens/preview', {});

    expect(res.status).toBe(400);
    expect(tokenService.getPreviewToken).not.toHaveBeenCalled();
  });

  it('returns 404 when file does not exist', async () => {
    const err = new Error('Not Found');
    err.statusCode = 404;
    tokenService.getPreviewToken.mockRejectedValue(err);

    const res = await request(app, 'POST', '/api/tokens/preview', {
      fileId: 'nonexistent',
      userId: 'user-1',
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('File not found');
  });

  it('returns 403 when caller lacks access', async () => {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    tokenService.getPreviewToken.mockRejectedValue(err);

    const res = await request(app, 'POST', '/api/tokens/preview', {
      fileId: 'file-secret',
      userId: 'user-bad',
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Access denied');
  });

  it('returns 500 on unexpected errors', async () => {
    tokenService.getPreviewToken.mockRejectedValue(new Error('Box SDK exploded'));

    const res = await request(app, 'POST', '/api/tokens/preview', {
      fileId: 'file-1',
      userId: 'user-1',
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
