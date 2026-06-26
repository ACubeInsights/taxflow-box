/**
 * Tests for authUtils — bcrypt password hashing with transparent SHA-256 migration.
 *
 * Verifies:
 * - New passwords hashed with bcrypt (cost 12)
 * - Legacy SHA-256 format detected and verified
 * - Transparent rehash: legacy valid → returns newHash for migration
 * - Wrong password on legacy → no rehash
 * - Wrong password on bcrypt → failure
 * - Unknown formats rejected
 * - External ID helpers (new format, legacy format, extractors)
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  hashPassword,
  hashPasswordLegacy,
  verifyPassword,
  buildExternalId,
  buildExternalIdLegacy,
  extractOriginalEmail,
  extractRole,
  extractDbUserId,
  isLegacyExternalId,
} from '../authUtils.js';

describe('hashPassword (bcrypt)', () => {
  it('returns a bcrypt hash starting with $2b$', async () => {
    const hash = await hashPassword('mySecurePassword123');
    expect(hash).toMatch(/^\$2b\$12\$/);
  });

  it('produces different hashes for the same password (salt)', async () => {
    const hash1 = await hashPassword('samePassword');
    const hash2 = await hashPassword('samePassword');
    expect(hash1).not.toBe(hash2);
  });

  it('produces a hash of expected length (~60 chars)', async () => {
    const hash = await hashPassword('test');
    expect(hash.length).toBe(60);
  });
});

describe('hashPasswordLegacy (SHA-256)', () => {
  it('returns pw: prefixed SHA-256 hex', () => {
    const hash = hashPasswordLegacy('hello');
    const expected = 'pw:' + crypto.createHash('sha256').update('hello').digest('hex');
    expect(hash).toBe(expected);
  });

  it('produces same hash for same input (no salt)', () => {
    const h1 = hashPasswordLegacy('test');
    const h2 = hashPasswordLegacy('test');
    expect(h1).toBe(h2);
  });
});

describe('verifyPassword', () => {
  describe('bcrypt hashes', () => {
    it('returns valid=true for correct password', async () => {
      const hash = await hashPassword('correctHorse');
      const result = await verifyPassword('correctHorse', hash);
      expect(result.valid).toBe(true);
      expect(result.needsRehash).toBe(false);
      expect(result.newHash).toBeUndefined();
    });

    it('returns valid=false for wrong password', async () => {
      const hash = await hashPassword('correctHorse');
      const result = await verifyPassword('wrongHorse', hash);
      expect(result.valid).toBe(false);
      expect(result.needsRehash).toBe(false);
    });

    it('returns valid=false for empty password', async () => {
      const hash = await hashPassword('somePass');
      const result = await verifyPassword('', hash);
      expect(result.valid).toBe(false);
    });
  });

  describe('legacy SHA-256 hashes (transparent migration)', () => {
    it('returns valid=true and needsRehash=true for correct password', async () => {
      const legacyHash = 'pw:' + crypto.createHash('sha256').update('legacyPass').digest('hex') + '|em:user@test.com|role:client';
      const result = await verifyPassword('legacyPass', legacyHash);
      expect(result.valid).toBe(true);
      expect(result.needsRehash).toBe(true);
      expect(result.newHash).toBeDefined();
      expect(result.newHash).toMatch(/^\$2b\$12\$/);
    });

    it('new hash from migration verifies correctly', async () => {
      const legacyHash = 'pw:' + crypto.createHash('sha256').update('migrateMe').digest('hex') + '|em:x@y.com|role:employee';
      const result = await verifyPassword('migrateMe', legacyHash);
      expect(result.valid).toBe(true);

      // The new hash should verify the same password
      const verification = await verifyPassword('migrateMe', result.newHash);
      expect(verification.valid).toBe(true);
      expect(verification.needsRehash).toBe(false);
    });

    it('returns valid=false for wrong password (no rehash)', async () => {
      const legacyHash = 'pw:' + crypto.createHash('sha256').update('realPass').digest('hex') + '|em:u@t.com|role:client';
      const result = await verifyPassword('wrongPass', legacyHash);
      expect(result.valid).toBe(false);
      expect(result.needsRehash).toBe(false);
      expect(result.newHash).toBeUndefined();
    });

    it('handles legacy format without email/role suffix', async () => {
      const legacyHash = 'pw:' + crypto.createHash('sha256').update('simplePass').digest('hex');
      const result = await verifyPassword('simplePass', legacyHash);
      expect(result.valid).toBe(true);
      expect(result.needsRehash).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns valid=false for null password', async () => {
      const result = await verifyPassword(null, '$2b$12$something');
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for null hash', async () => {
      const result = await verifyPassword('pass', null);
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for unknown hash format', async () => {
      const result = await verifyPassword('pass', 'unknown:format:here');
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for empty string hash', async () => {
      const result = await verifyPassword('pass', '');
      expect(result.valid).toBe(false);
    });
  });
});

describe('buildExternalId (new format)', () => {
  it('returns taxflow:{uuid} format', () => {
    const result = buildExternalId('abc-123-def-456');
    expect(result).toBe('taxflow:abc-123-def-456');
  });
});

describe('buildExternalIdLegacy', () => {
  it('returns pw:{hash}|em:{email}|role:{role} format', () => {
    const result = buildExternalIdLegacy('pass123', 'User@Test.COM', 'employee');
    expect(result).toMatch(/^pw:[0-9a-f]{64}\|em:user@test\.com\|role:employee$/);
  });

  it('defaults role to client', () => {
    const result = buildExternalIdLegacy('pass', 'a@b.com');
    expect(result).toContain('|role:client');
  });
});

describe('extractOriginalEmail', () => {
  it('extracts email from legacy format', () => {
    expect(extractOriginalEmail('pw:hash|em:user@example.com|role:client')).toBe('user@example.com');
  });

  it('returns null for new format', () => {
    expect(extractOriginalEmail('taxflow:uuid-here')).toBeNull();
  });

  it('returns null for null/empty', () => {
    expect(extractOriginalEmail(null)).toBeNull();
    expect(extractOriginalEmail('')).toBeNull();
  });
});

describe('extractRole', () => {
  it('extracts role from legacy format', () => {
    expect(extractRole('pw:hash|em:a@b.com|role:employee')).toBe('employee');
  });

  it('defaults to client when no role found', () => {
    expect(extractRole('taxflow:uuid')).toBe('client');
    expect(extractRole(null)).toBe('client');
  });
});

describe('extractDbUserId', () => {
  it('extracts UUID from new taxflow: format', () => {
    expect(extractDbUserId('taxflow:abc-123-def')).toBe('abc-123-def');
  });

  it('returns null for legacy format', () => {
    expect(extractDbUserId('pw:hash|em:a@b.com|role:client')).toBeNull();
  });

  it('returns null for null/empty', () => {
    expect(extractDbUserId(null)).toBeNull();
    expect(extractDbUserId('')).toBeNull();
  });
});

describe('isLegacyExternalId', () => {
  it('returns true for pw: prefix', () => {
    expect(isLegacyExternalId('pw:abc|em:x@y.com|role:client')).toBe(true);
  });

  it('returns false for taxflow: prefix', () => {
    expect(isLegacyExternalId('taxflow:uuid')).toBe(false);
  });

  it('returns false for null/empty', () => {
    expect(isLegacyExternalId(null)).toBe(false);
    expect(isLegacyExternalId('')).toBe(false);
  });
});
