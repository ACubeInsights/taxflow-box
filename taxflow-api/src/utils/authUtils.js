/**
 * Auth Utilities — Password hashing (bcrypt) with transparent migration from legacy SHA-256.
 *
 * Legacy format (stored in externalAppUserId): "pw:{sha256hex}|em:{email}|role:{role}"
 * New format (stored in users.password_hash): "$2b$12$..." (bcrypt)
 *
 * Migration strategy: On login, if hash is legacy format and verification succeeds,
 * re-hash with bcrypt and return the new hash for the caller to persist.
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';

/** bcrypt cost factor. 12 yields ~250ms hash time — secure against brute force. */
const BCRYPT_COST = 12;

// ─── Password Hashing ────────────────────────────────────────────────────

/**
 * Hashes a password with bcrypt (cost 12).
 * This is the ONLY function to use for new password creation.
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} bcrypt hash string (starts with $2b$)
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Synchronous legacy hash for backward compatibility during migration.
 * DO NOT use for new passwords — use hashPassword() instead.
 * @param {string} password
 * @returns {string} "pw:{sha256hex}" format
 * @deprecated Use hashPassword() for new passwords
 */
export function hashPasswordLegacy(password) {
  return 'pw:' + crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verifies a password against a stored hash. Handles both bcrypt and legacy SHA-256 formats.
 *
 * @param {string} password - Plaintext password to verify
 * @param {string} storedHash - Stored hash (bcrypt or legacy format)
 * @returns {Promise<{ valid: boolean, needsRehash: boolean, newHash?: string }>}
 *   - valid: true if password matches
 *   - needsRehash: true if the hash should be updated to bcrypt
 *   - newHash: the new bcrypt hash (only present if needsRehash is true and valid is true)
 */
export async function verifyPassword(password, storedHash) {
  if (!password || !storedHash) {
    return { valid: false, needsRehash: false };
  }

  // Case 1: bcrypt hash (starts with $2b$ or $2a$)
  if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: false };
  }

  // Case 2: Legacy format "pw:{sha256hex}|em:{email}|role:{role}" or just "pw:{sha256hex}"
  if (storedHash.startsWith('pw:')) {
    const hashPart = storedHash.split('|')[0]; // "pw:{hex}"
    const expectedHash = 'pw:' + crypto.createHash('sha256').update(password).digest('hex');

    if (hashPart === expectedHash) {
      // Valid legacy password — compute bcrypt hash for migration
      const newHash = await bcrypt.hash(password, BCRYPT_COST);
      return { valid: true, needsRehash: true, newHash };
    }
    return { valid: false, needsRehash: false };
  }

  // Case 3: Unknown format — reject
  return { valid: false, needsRehash: false };
}

// ─── External ID Helpers ─────────────────────────────────────────────────

/**
 * Builds the externalAppUserId value for a new Box App User.
 * New format: "taxflow:{dbUserUuid}"
 * @param {string} dbUserId - The user's UUID from our local database
 * @returns {string}
 */
export function buildExternalId(dbUserId) {
  return `taxflow:${dbUserId}`;
}

/**
 * Builds a LEGACY externalAppUserId (for backward compatibility during migration only).
 * Format: "pw:{hash}|em:{email}|role:{role}"
 * @deprecated Will be removed after migration is complete
 */
export function buildExternalIdLegacy(password, email, role = 'client') {
  const pwHash = crypto.createHash('sha256').update(password).digest('hex');
  return `pw:${pwHash}|em:${email.toLowerCase()}|role:${role}`;
}

/**
 * Extracts the original email from a legacy externalAppUserId value.
 * @param {string} extId
 * @returns {string|null}
 */
export function extractOriginalEmail(extId) {
  if (!extId) return null;
  const match = extId.match(/\|em:([^|]+)/);
  return match ? match[1] : null;
}

/**
 * Extracts the role from a legacy externalAppUserId value.
 * @param {string} extId
 * @returns {string} Defaults to 'client' if no role found
 */
export function extractRole(extId) {
  if (!extId) return 'client';
  const match = extId.match(/\|role:([^|]+)/);
  return match ? match[1] : 'client';
}

/**
 * Extracts the DB user UUID from the new-format externalAppUserId.
 * @param {string} extId - Format: "taxflow:{uuid}"
 * @returns {string|null}
 */
export function extractDbUserId(extId) {
  if (!extId) return null;
  const match = extId.match(/^taxflow:(.+)$/);
  return match ? match[1] : null;
}

/**
 * Determines if an externalAppUserId is in the legacy format.
 * @param {string} extId
 * @returns {boolean}
 */
export function isLegacyExternalId(extId) {
  return !!extId && extId.startsWith('pw:');
}

/**
 * Checks if an email is already registered with any Box user.
 * Searches all users' externalAppUserId for a matching |em:{email} entry (legacy)
 * or queries the local DB (preferred).
 * @param {object} boxClient - Box SDK client
 * @param {string} email - Email to check
 * @returns {Promise<boolean>} true if email already exists
 */
export async function isEmailRegistered(boxClient, email) {
  const allUsers = await boxClient.users.getUsers({
    userType: 'all',
    fields: ['id', 'external_app_user_id'],
  });
  const normalizedEmail = email.toLowerCase();
  return (allUsers.entries || []).some((u) => {
    const extId = u.externalAppUserId || '';
    // Check legacy format
    const legacyMatch = extId.match(/\|em:([^|]+)/);
    if (legacyMatch && legacyMatch[1] === normalizedEmail) return true;
    // New format doesn't contain email — skip
    return false;
  });
}
