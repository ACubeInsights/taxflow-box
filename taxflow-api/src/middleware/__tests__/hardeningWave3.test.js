/**
 * Hardening regressions: token hashing, invite claim, password/role utils.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { hashBearerToken, assertPasswordPolicy, sanitizeRole } from '../../utils/authUtils.js';
import { InviteRepository } from '../../db/repositories/InviteRepository.js';

describe('hashBearerToken', () => {
  it('is deterministic and does not equal plaintext', () => {
    const token = crypto.randomBytes(48).toString('base64url');
    const a = hashBearerToken(token);
    const b = hashBearerToken(token);
    expect(a).toBe(b);
    expect(a).not.toBe(token);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('differs for different tokens', () => {
    expect(hashBearerToken('aaa')).not.toBe(hashBearerToken('bbb'));
  });
});

describe('InviteRepository.claimPending', () => {
  it('returns true only once for concurrent-style sequential claims', async () => {
    const updates = [];
    const fakeDb = () => {
      const api = {
        where() { return api; },
        andWhere(fn) { if (typeof fn === 'function') fn(api); return api; },
        whereNull() { return api; },
        orWhere() { return api; },
        async update(payload) {
          updates.push(payload);
          // First call succeeds (1 row), subsequent fail (0)
          return updates.length === 1 ? 1 : 0;
        },
      };
      return api;
    };

    const repo = new InviteRepository({
      // knex-like: calling db(table) returns query builder
    });
    repo.query = () => fakeDb();

    const first = await repo.claimPending('invite-1');
    const second = await repo.claimPending('invite-1');
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(updates[0].status).toBe('accepting');
  });
});

describe('policy helpers still enforced', () => {
  it('rejects weak passwords and bad roles', () => {
    expect(() => assertPasswordPolicy('short')).toThrow();
    expect(sanitizeRole('root')).toBe('client');
  });
});
