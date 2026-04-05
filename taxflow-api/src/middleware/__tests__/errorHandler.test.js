import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler } from '../errorHandler.js';

// Mock the logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { logger } from '../../utils/logger.js';

function createMockReq(overrides = {}) {
  return { method: 'GET', path: '/test', ...overrides };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    _json: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res._json = body;
      return res;
    },
  };
  return res;
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns standard JSON with error, code, and statusCode fields', () => {
    const err = new Error('Not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(err, req, res, () => {});

    expect(res.statusCode).toBe(404);
    expect(res._json).toEqual({
      error: 'Not found',
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('defaults statusCode to 500 when not set on error', () => {
    const err = new Error('Something broke');
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(err, req, res, () => {});

    expect(res.statusCode).toBe(500);
    expect(res._json.statusCode).toBe(500);
  });

  it('defaults code to INTERNAL_ERROR when not set on error', () => {
    const err = new Error('Oops');
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(err, req, res, () => {});

    expect(res._json.code).toBe('INTERNAL_ERROR');
  });

  it('includes details when present on the error', () => {
    const err = new Error('Validation failed');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    err.details = { field: 'email', reason: 'required' };
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(err, req, res, () => {});

    expect(res._json.details).toEqual({ field: 'email', reason: 'required' });
  });

  it('does not include details when not present on the error', () => {
    const err = new Error('Generic error');
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(err, req, res, () => {});

    expect(res._json).not.toHaveProperty('details');
  });

  it('logs with structured context via logger.error', () => {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    const req = createMockReq({ method: 'POST', path: '/api/docs' });
    const res = createMockRes();

    errorHandler(err, req, res, () => {});

    expect(logger.error).toHaveBeenCalledWith('Request error', {
      method: 'POST',
      path: '/api/docs',
      statusCode: 403,
      message: 'Forbidden',
    });
  });

  it('defaults error message to "Internal server error" when err.message is empty', () => {
    const err = new Error();
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(err, req, res, () => {});

    expect(res._json.error).toBe('Internal server error');
  });
});
