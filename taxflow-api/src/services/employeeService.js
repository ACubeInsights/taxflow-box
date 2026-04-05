/**
 * EmployeeService — Creates Box managed users for employees.
 * Only super admins can create employees. Employees cannot self-register.
 *
 * Uses Box API: POST /users (managed user, NOT platform-access-only).
 */

import boxService from './boxService.js';
import { buildExternalId, isEmailRegistered, extractOriginalEmail, extractRole } from '../utils/authUtils.js';

export class EmployeeService {
  /**
   * Lists all employees (users with role 'employee' or 'cxo' in externalAppUserId).
   * @returns {Promise<Array<{ id: string, name: string, email: string, role: string }>>}
   */
  async listEmployees() {
    const client = boxService.getBoxClient();
    const allUsers = await client.users.getUsers({
      userType: 'all',
      fields: ['id', 'name', 'external_app_user_id'],
    });
    return (allUsers.entries || [])
      .filter((u) => {
        const extId = u.externalAppUserId || '';
        const role = extractRole(extId);
        return role === 'employee' || role === 'cxo';
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
   * Creates a Box managed user for a new employee.
   *
   * @param {string} name
   * @param {string} email
   * @param {'user'|'coadmin'} [role='user']
   * @param {string} [password] - Initial password, hashed and stored in externalAppUserId
   */
  async createEmployee(name, email, role = 'user', password) {
    if (!email) throw new Error('email is required to create an employee');
    if (!password) throw new Error('password is required to create an employee');

    const client = boxService.getBoxClient();

    // Check for duplicate email across all users
    if (await isEmailRegistered(client, email)) {
      throw new Error(`Email ${email} is already registered. Each email can only be used once.`);
    }

    try {
      console.log(`[Employee] Creating app user: ${name} (${email}), role: ${role}`);

      // Employees are created as app users (isPlatformAccessOnly: true) so we can
      // store the password hash + email in externalAppUserId. Box doesn't allow
      // setting externalAppUserId on managed users.
      const createBody = {
        name,
        isPlatformAccessOnly: true,
        externalAppUserId: buildExternalId(password, email, role === 'coadmin' ? 'cxo' : 'employee'),
      };

      const user = await client.users.createUser(createBody);

      console.log(`[Employee] Created: ${user.id} ${user.name} ${user.login}`);
      return {
        userId: user.id,
        login: user.login || email,
        name: user.name,
        role: role === 'coadmin' ? 'cxo' : 'employee',
        isNew: true,
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
            role: found.role === 'coadmin' ? 'cxo' : 'employee',
            isNew: false,
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
