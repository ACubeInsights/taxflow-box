/**
 * AuthService — Authenticates users against Box App Users (clients)
 * and a local employee/admin registry stored as Box metadata.
 *
 * Supports two modes:
 *   1. DB-backed: Uses UserRepository, SessionRepository, ResetTokenRepository
 *   2. In-memory fallback: Uses Maps (for tests or when DB is not initialized)
 *
 * Auth flow:
 *   1. Client login: look up user by email (DB or Box) → verify password → session
 *   2. Employee/Admin login: same flow
 *
 * Requirements: 16.1, 16.2, 16.7
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

// ─── Vault Mapping Helper ────────────────────────────────────────────────

/**
 * Maps a client_vaults DB row to the API response shape.
 * @param {object} row - Database row from client_vaults table
 * @returns {object|null}
 */
function mapVaultFromDb(row) {
  if (!row) return null;
  return {
    clientId: row.client_id,
    financialYear: row.financial_year,
    root: row.root_folder_id,
    year: row.year_folder_id,
    projects: row.projects_folder_id,
    tax: row.tax_folder_id,
    uploads: row.uploads_folder_id,
    supportingDocs: row.supporting_docs_folder_id,
    signedDocuments: row.signed_documents_folder_id,
    internalNotes: row.internal_notes_folder_id,
  };
}

// ─── AuthService Class ──────────────────────────────────────────────────

export class AuthService {
  /**
   * @param {object} [deps={}] - Optional repository dependencies
   * @param {import('../db/repositories/UserRepository.js').UserRepository} [deps.userRepository]
   * @param {import('../db/repositories/SessionRepository.js').SessionRepository} [deps.sessionRepository]
   * @param {import('../db/repositories/ResetTokenRepository.js').ResetTokenRepository} [deps.resetTokenRepository]
   */
  constructor(deps = {}) {
    /** @type {import('../db/repositories/UserRepository.js').UserRepository | null} */
    this._userRepo = deps.userRepository || null;
    /** @type {import('../db/repositories/SessionRepository.js').SessionRepository | null} */
    this._sessionRepo = deps.sessionRepository || null;
    /** @type {import('../db/repositories/ResetTokenRepository.js').ResetTokenRepository | null} */
    this._resetTokenRepo = deps.resetTokenRepository || null;

    // Keep in-memory fallbacks for backward compatibility (used when repos are not available)
    /** In-memory session store (maps sessionToken → session data). Fallback when DB not available. */
    this._sessions = new Map();
    /** In-memory reset token store (maps resetToken → { userId, email, expiresAt }). Fallback when DB not available. */
    this._resetTokens = new Map();
  }

  /**
   * Injects repository dependencies after construction. Called by the wiring module after DB initialization.
   * @param {{ userRepo?: object, sessionRepo?: object, resetTokenRepo?: object }} repos
   */
  setRepositories({ userRepo, sessionRepo, resetTokenRepo, clientVaultRepo, clientRepo } = {}) {
    if (userRepo) this._userRepo = userRepo;
    if (sessionRepo) this._sessionRepo = sessionRepo;
    if (resetTokenRepo) this._resetTokenRepo = resetTokenRepo;
    if (clientVaultRepo) this._clientVaultRepo = clientVaultRepo;
    if (clientRepo) this._clientRepo = clientRepo;
  }

  /**
   * Creates a session and returns the auth response.
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.email
   * @param {string} params.name
   * @param {string} params.role
   * @returns {Promise<{ sessionToken: string, user: object, expiresAt: string }>}
   */
  async createSession({ userId, email, name, role }) {
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    if (this._sessionRepo) {
      await this._sessionRepo.create({ token: sessionToken, userId, email, name, role, expiresAt });
    } else {
      this._sessions.set(sessionToken, { userId, email, name, role, expiresAt });
      setTimeout(() => this._sessions.delete(sessionToken), SESSION_TTL_MS);
    }

    return {
      sessionToken,
      user: { id: userId, email, name, role },
      expiresAt,
    };
  }

  /**
   * Validates a session token and returns session data if valid.
   * @param {string} token
   * @returns {Promise<object|null>}
   */
  async validateSession(token) {
    if (this._sessionRepo) {
      const session = await this._sessionRepo.findByToken(token);
      if (!session) return null;
      return {
        userId: session.user_id,
        email: session.email,
        name: session.name,
        role: session.role,
        expiresAt: session.expires_at,
      };
    }

    // In-memory fallback
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
   * @returns {Promise<void>}
   */
  async logout(token) {
    if (this._sessionRepo) {
      await this._sessionRepo.deleteByToken(token);
    } else {
      this._sessions.delete(token);
    }
  }

  /**
   * Refreshes a session by extending its expiry.
   * @param {string} token
   * @returns {Promise<{ expiresAt: string }|null>}
   */
  async refreshSession(token) {
    if (this._sessionRepo) {
      const session = await this._sessionRepo.findByToken(token);
      if (!session) return null;
      const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      await this._sessionRepo.refreshExpiry(token, newExpiresAt);
      return { expiresAt: newExpiresAt };
    }

    // In-memory fallback
    const session = this._sessions.get(token);
    if (!session) return null;
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    return { expiresAt: session.expiresAt };
  }

  /**
   * Enriches a session response with vault data for client users.
   * Non-fatal: if vault lookup fails, logs a warning and returns the session as-is.
   * @param {object} session - The session response from createSession()
   * @param {string} email - The user's email
   * @returns {Promise<object>} The enriched session response
   */
  async _enrichSessionWithVault(session, email) {
    if (session.user.role !== 'client' || !this._clientVaultRepo || !this._clientRepo) {
      return session;
    }

    try {
      const clientRecord = await this._clientRepo.findByEmail(email);
      if (clientRecord) {
        session.user.externalId = clientRecord.external_id;
        const vaultRow = await this._clientVaultRepo.findByClientId(clientRecord.id);
        if (vaultRow) {
          session.vault = mapVaultFromDb(vaultRow);
        }
      }
    } catch (err) {
      console.warn('[Auth] Vault lookup failed during login, continuing without vault:', err.message);
    }

    return session;
  }

  /**
   * Unified login — authenticates any user (client, employee, cxo) by email + password.
   * If DB repos are available, looks up user in DB first. Falls back to Box API.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ sessionToken: string, user: object, expiresAt: string, vault?: object }>}
   */
  async login(email, password) {
    // Try DB-backed login first
    if (this._userRepo) {
      const user = await this._userRepo.findByEmail(email);
      if (user) {
        if (!verifyPassword(password, user.password_hash)) {
          throw createHttpError('Invalid credentials', 401, 'UNAUTHORIZED');
        }
        const session = await this.createSession({
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        });
        return this._enrichSessionWithVault(session, email);
      }
    }

    // Fallback to Box API lookup
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

    // Auto-sync: if DB repos are available, ensure this Box user exists in the local users table
    // so the session FK constraint is satisfied
    if (this._userRepo) {
      const existingDbUser = await this._userRepo.findByBoxUserId(found.id);
      if (!existingDbUser) {
        try {
          await this._userRepo.create({
            box_user_id: found.id,
            email: email.toLowerCase(),
            name: found.name,
            role,
            password_hash: extId,
          });
        } catch (err) {
          if (!err.message?.includes('UNIQUE constraint')) {
            console.error('Failed to auto-sync Box user to local DB:', err.message);
          }
        }
      }
      const dbUser = await this._userRepo.findByEmail(email);
      if (dbUser) {
        const session = await this.createSession({
          userId: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
        });
        return this._enrichSessionWithVault(session, email);
      }
    }

    const session = await this.createSession({
      userId: found.id,
      email: email,
      name: found.name,
      role,
    });
    return this._enrichSessionWithVault(session, email);
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
    // If DB is available, try DB-backed password change
    if (this._userRepo) {
      const user = await this._userRepo.findById(userId);
      if (user) {
        if (!verifyPassword(currentPassword, user.password_hash)) {
          throw createHttpError('Current password is incorrect', 401, 'UNAUTHORIZED');
        }
        const newHash = hashPassword(newPassword);
        await this._userRepo.updatePasswordHash(userId, newHash);
        return { success: true };
      }
    }

    // Fallback to Box API
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

    if (this._resetTokenRepo) {
      await this._resetTokenRepo.create({ token: resetToken, email: email.toLowerCase(), expiresAt });
    } else {
      this._resetTokens.set(resetToken, { email: email.toLowerCase(), expiresAt });
      setTimeout(() => this._resetTokens.delete(resetToken), 30 * 60 * 1000);
    }

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
    let entry;

    if (this._resetTokenRepo) {
      const row = await this._resetTokenRepo.findByToken(token);
      if (!row) {
        throw createHttpError('Invalid or expired reset token', 400, 'VALIDATION_ERROR');
      }
      entry = { email: row.email, expiresAt: row.expires_at };
      await this._resetTokenRepo.deleteByToken(token);
    } else {
      entry = this._resetTokens.get(token);
      if (!entry || new Date(entry.expiresAt) < new Date()) {
        throw createHttpError('Invalid or expired reset token', 400, 'VALIDATION_ERROR');
      }
      this._resetTokens.delete(token);
    }

    // If DB user repo is available, try to update password in DB
    if (this._userRepo) {
      const user = await this._userRepo.findByEmail(entry.email);
      if (user) {
        const newHash = hashPassword(newPassword);
        await this._userRepo.updatePasswordHash(user.id, newHash);
        return { success: true };
      }
    }

    // Fallback to Box API
    const client = boxService.getBoxClient();
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
