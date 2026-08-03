/**
 * High-severity auth / password / rate-limit / comments regressions (session 47d612).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertPasswordPolicy, sanitizeRole, MIN_PASSWORD_LENGTH } from '../../utils/authUtils.js';
import { rateLimit } from '../httpRateLimit.js';
import { CommentService } from '../../services/commentService.js';

describe('assertPasswordPolicy', () => {
  it(`rejects passwords shorter than ${MIN_PASSWORD_LENGTH}`, () => {
    expect(() => assertPasswordPolicy('Abcd123')).toThrow(/at least/);
  });

  it('rejects passwords without a letter or number', () => {
    expect(() => assertPasswordPolicy('abcdefghijkl')).toThrow(/letter and one number/);
    expect(() => assertPasswordPolicy('123456789012')).toThrow(/letter and one number/);
  });

  it('accepts a strong password', () => {
    expect(() => assertPasswordPolicy('SecurePass12')).not.toThrow();
  });
});

describe('sanitizeRole', () => {
  it('allowlists known roles and defaults unknown to client', () => {
    expect(sanitizeRole('superadmin')).toBe('superadmin');
    expect(sanitizeRole('employee')).toBe('employee');
    expect(sanitizeRole('client')).toBe('client');
    expect(sanitizeRole('admin')).toBe('client');
    expect(sanitizeRole('')).toBe('client');
  });
});

describe('rateLimit middleware', () => {
  it('returns 429 after max requests', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2, keyFn: () => 'test-key' });
    const res = () => {
      const headers = {};
      return {
        setHeader: (k, v) => { headers[k] = v; },
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        headers,
      };
    };

    const r1 = res();
    const r2 = res();
    const r3 = res();
    const next = vi.fn();

    mw({ path: '/login' }, r1, next);
    mw({ path: '/login' }, r2, next);
    mw({ path: '/login' }, r3, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(r3.status).toHaveBeenCalledWith(429);
  });
});

describe('CommentService includeInternal filter', () => {
  it('strips internal comments when includeInternal is false', async () => {
    const service = new CommentService();
    await service.addComment('doc1', { type: 'review', authorId: 'c1', authorName: 'Client', text: 'Visible' });
    await service.addComment('doc1', { type: 'internal', authorId: 'e1', authorName: 'Emp', text: 'Secret' });

    const forClient = await service.getComments('doc1', { includeInternal: false });
    const forStaff = await service.getComments('doc1', { includeInternal: true });

    expect(forClient).toHaveLength(1);
    expect(forClient[0].type).toBe('review');
    expect(forStaff).toHaveLength(2);
    expect(forStaff.some((c) => c.type === 'internal')).toBe(true);
  });
});
