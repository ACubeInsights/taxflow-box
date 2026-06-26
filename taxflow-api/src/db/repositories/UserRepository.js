import crypto from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class UserRepository extends BaseRepository {
  constructor(db) {
    super(db, 'users');
  }

  async findByEmail(email, trx) {
    return this.query(trx).whereRaw('LOWER(email) = ?', [email.toLowerCase()]).whereNull('deleted_at').first();
  }

  async findByBoxUserId(boxUserId, trx) {
    return this.query(trx).where('box_user_id', boxUserId).whereNull('deleted_at').first();
  }

  /**
   * Finds all users with a given role.
   * @param {string} role - Role to filter by (e.g., 'employee', 'client', 'superadmin')
   * @param {object} [trx] - Optional transaction
   * @returns {Promise<Array>}
   */
  async findByRole(role, trx) {
    return this.query(trx).where('role', role).whereNull('deleted_at');
  }

  async create(userData, trx) {
    const now = new Date().toISOString();
    const record = {
      id: crypto.randomUUID(),
      ...userData,
      created_at: now,
      updated_at: now,
    };
    await this.query(trx).insert(record);
    return record;
  }

  async updatePasswordHash(id, hash, trx) {
    const now = new Date().toISOString();
    await this.query(trx).where('id', id).update({
      password_hash: hash,
      updated_at: now,
    });
  }

  async deactivate(id, trx) {
    return this.softDelete(id, trx);
  }
}
