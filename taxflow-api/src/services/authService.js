/**
 * AuthService — Authenticates users against Box App Users (clients)
 * and a local employee/admin registry stored as Box metadata.
 *
 * Clients cannot sign up — they are onboarded by employees/super admins
 * via the onboarding service which creates Box App Users.
 *
 * Auth flow:
 *   1. Client login: look up Box App User by email → verify password → session
 *   2. Employee/Admin login: look up Box managed user → verify password → session
 *
 * All identity lives in Box — no external DB.
 */

import boxService from './boxService.js';
import emailService from './emailService.js';
import crypto from 'crypto';
import { config } from '../config.js';
import { createHttpError } from '../utils/httpError.js';
import { buildExternalId, hashPassword, verifyPassword, extractOriginalEmail, extractRole } from '../utils/authUtils.js';

// Re-export auth utilities for backward compatibility
export { buildExternalId, hashPassword, verifyPassword, extractOriginalEmail };

/** Session TTL: 1 hour */
const SESSION_TTL_MS = 60 * 60 * 1000;

// ─── Utility Functions ──────────────────────────────────────────────────

/**
 * Generates a cryptographically secure session token.
 * @returns {string}
 */
function generateSessionToken() {
  return crypto.randomBytes(48).toString('base64url');
}

/**
 * Reads the externalAppUserId from a Box user object (handles SDK field name variants).
 * @param {object} user - Box user object
 * @returns {string}
 */
function getExtId(user) {
  return user.externalAppUserId || user.external_app_user_id || '';
}

// ─── AuthService Class ──────────────────────────────────────────────────

export class AuthService {
  constructor() {
    /** In-memory session store (maps sessionToken → session data). */
    this._sessions = new Map();
    /** In-memory reset token store (maps resetToken → { userId, email, expiresAt }). */
    this._resetTokens = new Map();
  }

  /**
   * Creates a session and returns the auth response.
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.email
   * @param {string} params.name
   * @param {string} params.role
   * @returns {{ sessionToken: string, user: object, expiresAt: string }}
   */
  createSession({ userId, email, name, role }) {
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    this._sessions.set(sessionToken, { userId, email, name, role, expiresAt });
    setTimeout(() => this._sessions.delete(sessionToken), SESSION_TTL_MS);

    return {
      sessionToken,
      user: { id: userId, email, name, role },
      expiresAt,
    };
  }

  /**
   * Validates a session token and returns session data if valid.
   * @param {string} token
   * @returns {object|null}
   */
  validateSession(token) {
    const session = this._sessions.get(token);
    if (!session) return null;
    if (new Date(session.expiresAt) < new Date()) {
      this._sessions.delete(token);
      return null;
    }
    return session;
  }

  /**
   * Destroys a session.
   * @param {string} token
   */
  logout(token) {
    this._sessions.delete(token);
  }

  /**
   * Refreshes a session by extending its expiry.
   * @param {string} token
   * @returns {{ expiresAt: string }|null}
   */
  refreshSession(token) {
    const session = this._sessions.get(token);
    if (!session) return null;
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    return { expiresAt: session.expiresAt };
  }

  /**
   * Authenticates a client by email and password via Box App Users.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ sessionToken: string, user: object, expiresAt: string }>}
   */
  /**
   * Unified login — authenticates any user (client, employee, cxo) by email + password.
   * Finds the user by email in externalAppUserId, verifies password, determines role automatically.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ sessionToken: string, user: object, expiresAt: string }>}
   */
  async login(email, password) {
    const client = boxService.getBoxClient();

    const allUsers = await client.users.getUsers({
      userType: 'all',
      fields: ['id', 'login', 'name', 'role', 'external_app_user_id'],
    });

    // Find user by email stored in externalAppUserId (format: pw:{hash}|em:{email}|role:{role})
    const found = (allUsers.entries || []).find((u) => {
      const extId = getExtId(u);
      if (!extId) return false;
      const match = extId.match(/\|em:([^|]+)/);
      return match && match[1].toLowerCase() === email.toLowerCase();
    });

    if (!found) throw createHttpError('Invalid credentials', 401, 'UNAUTHORIZED');

    const extId = getExtId(found);
    if (!verifyPassword(password, extId)) {
      throw createHttpError('Invalid credentials', 401, 'UNAUTHORIZED');
    }

    // Role is stored in externalAppUserId during creation
    const role = extractRole(extId);

    return this.createSession({
      userId: found.id,
      email: email,
      name: found.name,
      role,
    });
  }

  // Backward compatibility aliases
  async loginClient(email, password) { return this.login(email, password); }
  async loginStaff(email, password) { return this.login(email, password); }

  /**
   * Changes a user's password.
   * @param {string} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<{ success: boolean }>}
   */
  async changePassword(userId, currentPassword, newPassword) {
    const client = boxService.getBoxClient();
    const user = await client.users.getUserById(userId, { queryParams: { fields: ['id', 'login', 'name', 'role', 'external_app_user_id'] } });
    const extId = getExtId(user);
    if (!verifyPassword(currentPassword, extId)) {
      throw createHttpError('Current password is incorrect', 401, 'UNAUTHORIZED');
    }
    const email = extractOriginalEmail(extId) || user.login;
    await client.users.updateUserById(userId, {
      requestBody: { externalAppUserId: buildExternalId(newPassword, email) },
    });
    return { success: true };
  }

  /**
   * Initiates a password reset flow. Always returns success to prevent email enumeration.
   * @param {string} email
   * @returns {Promise<{ message: string }>}
   */
  async requestPasswordReset(email) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
    this._resetTokens.set(resetToken, { email: email.toLowerCase(), expiresAt });
    setTimeout(() => this._resetTokens.delete(resetToken), 30 * 60 * 1000);

    // Send the reset email (fire-and-forget, don't reveal if email exists)
    const resetUrl = `${config.frontendUrl || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    emailService.sendEmail(email, 'password_reset', {
      message: `Hi ${email.split('@')[0]}, We received a request to reset your TaxFlow Pro password. Click the link below to set a new password. This link expires in 30 minutes.`,
      deepLinkUrl: resetUrl,
      fileName: '',
    }).catch((err) => {
      console.error(`[Auth] Failed to send password reset email to ${email}:`, err.message);
    });

    return { message: 'If an account exists with that email, a reset link has been sent.' };
  }

  /**
   * Resets a user's password using a reset token.
   * @param {string} token
   * @param {string} newPassword
   * @returns {Promise<{ success: boolean }>}
   */
  async resetPassword(token, newPassword) {
    const entry = this._resetTokens.get(token);
    if (!entry || new Date(entry.expiresAt) < new Date()) {
      throw createHttpError('Invalid or expired reset token', 400, 'VALIDATION_ERROR');
    }
    this._resetTokens.delete(token);
    const client = boxService.getBoxClient();

    // Find user by email in externalAppUserId (same approach as login)
    const allUsers = await client.users.getUsers({
      userType: 'all',
      fields: ['id', 'login', 'name', 'external_app_user_id'],
    });
    const found = (allUsers.entries || []).find((u) => {
      const extId = getExtId(u);
      if (!extId) return false;
      const match = extId.match(/\|em:(.+)$/);
      return match && match[1].toLowerCase() === entry.email;
    });
    if (!found) throw createHttpError('User not found', 404, 'NOT_FOUND');
    await client.users.updateUserById(found.id, {
      requestBody: { externalAppUserId: buildExternalId(newPassword, entry.email) },
    });
    return { success: true };
  }
}

// Singleton instance
const authService = new AuthService();
export default authService;
