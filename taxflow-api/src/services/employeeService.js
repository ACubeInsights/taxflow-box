/**
 * EmployeeService — Creates Box app users for employees.
 * Only super admins can create employees. Employees cannot self-register.
 *
 * Uses Box API: POST /users (app user, isPlatformAccessOnly: true).
 * externalAppUserId stores "taxflow:{dbUserId}" — no credentials in Box.
 * Password is stored ONLY in the local database (bcrypt hashed).
 */

import boxService from './boxService.js';
import { buildExternalId, isEmailRegistered, extractOriginalEmail, extractRole, extractDbUserId, isLegacyExternalId } from '../utils/authUtils.js';
import crypto from 'crypto';

export class EmployeeService {
  constructor() {
    /** @type {import('../db/repositories/UserRepository.js').UserRepository | null} */
    this._userRepo = null;
  }

  /**
   * Injects repository dependencies. Called after DB initialization.
   */
  setRepositories({ userRepo } = {}) {
    if (userRepo) this._userRepo = userRepo;
  }

  /**
   * Lists all employees. Prefers local DB (fast O(1) query).
   * Falls back to Box API search for backward compatibility with legacy externalAppUserId format.
   * @returns {Promise<Array<{ id: string, name: string, email: string, role: string }>>}
   */
  async listEmployees() {
    // Preferred: query local DB
    if (this._userRepo) {
      const users = await this._userRepo.findByRole('employee');
      if (users && users.length > 0) {
        return users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
        }));
      }
    }

    // Fallback: query Box (handles legacy users not yet in local DB)
    const client = boxService.getBoxClient();
    const allUsers = await client.users.getUsers({
      userType: 'all',
      fields: ['id', 'name', 'external_app_user_id'],
    });
    return (allUsers.entries || [])
      .filter((u) => {
        const extId = u.externalAppUserId || '';
        // Legacy format contains role
        if (isLegacyExternalId(extId)) {
          return extractRole(extId) === 'employee';
        }
        // New format: we can't determine role from taxflow:{uuid} alone
        // This path will shrink as migration progresses
        return false;
      })
      .map((u) => {
        const extId = u.externalAppUserId || '';
        return {
          id: u.id,
          name: u.name,
          email: extractOriginalEmail(extId) || '',
          role: extractRole(extId),
        };
      });
  }

  /**
   * Creates a Box app user for a new employee.
   * Stores password in local DB (bcrypt), not in Box.
   * externalAppUserId set to "taxflow:{dbUserId}".
   *
   * @param {string} name
   * @param {string} email
   * @param {'user'|'coadmin'} [role='user']
   * @param {string} [password] - Password (will be hashed with bcrypt and stored locally)
   */
  async createEmployee(name, email, role = 'user', password) {
    if (!email) throw new Error('email is required to create an employee');
    if (!password) throw new Error('password is required to create an employee');

    const client = boxService.getBoxClient();

    // Check for duplicate email across all users
    if (await isEmailRegistered(client, email)) {
      throw new Error(`Email ${email} is already registered. Each email can only be used once.`);
    }

    // Generate DB user ID upfront
    const dbUserId = crypto.randomUUID();

    try {
      console.log(`[Employee] Creating app user: ${name} (${email}), role: ${role}`);

      const createBody = {
        name,
        isPlatformAccessOnly: true,
        externalAppUserId: buildExternalId(dbUserId),
      };

      const user = await client.users.createUser(createBody);

      console.log(`[Employee] Created: ${user.id} ${user.name} ${user.login}`);

      // Store employee in local DB with bcrypt hash
      if (this._userRepo) {
        const { hashPassword } = await import('../utils/authUtils.js');
        const bcryptHash = await hashPassword(password);
        try {
          await this._userRepo.create({
            id: dbUserId,
            box_user_id: user.id,
            email: email.toLowerCase(),
            name,
            role: 'employee',
            password_hash: bcryptHash,
          });
        } catch (dbErr) {
          if (!dbErr.message?.includes('UNIQUE constraint')) {
            console.error('[Employee] Failed to persist to local DB:', dbErr.message);
          }
        }
      }

      return {
        userId: user.id,
        login: user.login || email,
        name: user.name,
        role: 'employee',
        isNew: true,
        dbUserId,
      };
    } catch (error) {
      if (error.statusCode === 409 || error.status === 409) {
        // User already exists — look them up
        console.log(`[Employee] 409 conflict, looking up existing user: ${email}`);
        const existing = await client.users.getUsers({ filterTerm: email });
        const entries = existing.entries || [];
        const found = entries.find(
          (u) => u.login?.toLowerCase() === email.toLowerCase()
        );
        if (found) {
          return {
            userId: found.id,
            login: found.login || email,
            name: found.name,
            role: 'employee',
            isNew: false,
            dbUserId,
          };
        }
        throw new Error(`409 conflict but no existing user found for ${email}`);
      }
      throw new Error(
        `Failed to create employee: ${error.statusCode || 'unknown'} — ${error.message}`
      );
    }
  }
}

// Singleton instance
const employeeService = new EmployeeService();
export default employeeService;
