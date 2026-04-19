import crypto from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class ClientRepository extends BaseRepository {
  constructor(db) {
    super(db, 'clients');
  }

  async create(clientData, trx) {
    const now = new Date().toISOString();
    const record = {
      id: crypto.randomUUID(),
      ...clientData,
      created_at: now,
      updated_at: now,
    };
    await this.query(trx).insert(record);
    return record;
  }

  async findById(id, trx) {
    return this.query(trx).where('id', id).whereNull('deleted_at').first();
  }

  async findAll(trx) {
    return this.query(trx).whereNull('deleted_at');
  }

  async findByFilters({ search, status, entityType } = {}, trx) {
    const q = this.query(trx).whereNull('deleted_at');

    if (status) {
      q.where('engagement_status', status);
    }

    if (entityType) {
      q.where('entity_type', entityType);
    }

    if (search) {
      const term = `%${search}%`;
      q.where(function () {
        this.whereRaw('LOWER(name) LIKE LOWER(?)', [term])
          .orWhereRaw('LOWER(email) LIKE LOWER(?)', [term]);
      });
    }

    return q;
  }

  async update(id, data, trx) {
    const now = new Date().toISOString();
    await this.query(trx).where('id', id).update({ ...data, updated_at: now });
    return this.findById(id, trx);
  }

  async deactivate(id, trx) {
    return this.softDelete(id, trx);
  }

  async findByEmail(email, trx) {
    return this.query(trx)
      .whereRaw('LOWER(email) = LOWER(?)', [email])
      .whereNull('deleted_at')
      .first();
  }

  async findByExternalId(externalId, trx) {
    return this.query(trx)
      .where('external_id', externalId)
      .whereNull('deleted_at')
      .first();
  }

  async findByBoxUserId(boxUserId, trx) {
    return this.query(trx)
      .where('box_user_id', boxUserId)
      .whereNull('deleted_at')
      .first();
  }

  async exists(trx) {
    const row = await this.query(trx).first();
    return !!row;
  }
}
