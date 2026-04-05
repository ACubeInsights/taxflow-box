/**
 * Auth Utilities — Shared password hashing and external ID helpers.
 *
 * Extracted from authService.js so that onboardingService, employeeService,
 * and authService can all import these without creating circular dependencies.
 *
 * Related requirements: 12.4
 */

import crypto from 'crypto';

/**
 * Hashes a password with SHA-256. Stored in Box user's externalAppUserId field.
 * Prefixed with "pw:" to distinguish from actual external IDs.
 * @param {string} password
 * @returns {string}
 */
export function hashPassword(password) {
  return 'pw:' + crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Builds the externalAppUserId value encoding both password and original email.
 * Format: "pw:{hash}|em:{email}"
 * @param {string} password
 * @param {string} email - Original email provided during creation
 * @returns {string}
 */
export function buildExternalId(password, email) {
  const pwHash = crypto.createHash('sha256').update(password).digest('hex');
  return `pw:${pwHash}|em:${email.toLowerCase()}`;
}

/**
 * Extracts the original email from an externalAppUserId value.
 * @param {string} extId
 * @returns {string|null}
 */
export function extractOriginalEmail(extId) {
  if (!extId) return null;
  const match = extId.match(/\|em:(.+)$/);
  return match ? match[1] : null;
}

/**
 * Verifies a password against a stored hash.
 * @param {string} password
 * @param {string} storedExtId - The full externalAppUserId value
 * @returns {boolean}
 */
export function verifyPassword(password, storedExtId) {
  if (!storedExtId || !storedExtId.startsWith('pw:')) return false;
  const storedHash = storedExtId.split('|')[0]; // "pw:{hash}"
  return hashPassword(password) === storedHash;
}

/**
 * Checks if an email is already registered with any Box user.
 * Searches all users' externalAppUserId for a matching |em:{email} entry.
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
    const match = extId.match(/\|em:(.+)$/);
    return match && match[1] === normalizedEmail;
  });
}
