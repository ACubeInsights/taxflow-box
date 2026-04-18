import crypto from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class ProjectRepository extends BaseRepository {
  constructor(db) {
    super(db, 'projects');
  }

  async create(projectData, trx) {
    const now = new Date().toISOString();
    const record = {
      id: crypto.randomUUID(),
      ...projectData,
      created_at: now,
      updated_at: now,
    };
    await this.query(trx).insert(record);
    return record;
  }

  async findById(id, trx) {
    return this.query(trx).where('id', id).whereNull('deleted_at').first();
  }

  async findByClientId(clientId, trx) {
    return this.query(trx).where('client_id', clientId).whereNull('deleted_at');
  }

  async update(id, data, trx) {
    const now = new Date().toISOString();
    await this.query(trx).where('id', id).update({ ...data, updated_at: now });
    return this.findById(id, trx);
  }

  async countActiveByClientId(clientId, trx) {
    const result = await this.query(trx)
      .where('client_id', clientId)
      .where('status', 'Active')
      .whereNull('deleted_at')
      .count('* as count')
      .first();
    return Number(result.count);
  }
}
