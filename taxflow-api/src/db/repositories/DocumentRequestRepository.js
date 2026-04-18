import crypto from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class DocumentRequestRepository extends BaseRepository {
  constructor(db) {
    super(db, 'document_requests');
  }

  async create(docData, trx) {
    const now = new Date().toISOString();
    const record = {
      id: crypto.randomUUID(),
      ...docData,
      created_at: now,
      updated_at: now,
    };
    await this.query(trx).insert(record);
    return record;
  }

  async findById(id, trx) {
    return this.query(trx).where('id', id).whereNull('deleted_at').first();
  }

  async findByProjectId(projectId, { status } = {}, trx) {
    const q = this.query(trx)
      .where('project_id', projectId)
      .whereNull('deleted_at');

    if (status) {
      if (Array.isArray(status)) {
        q.whereIn('status', status);
      } else {
        q.where('status', status);
      }
    }

    return q;
  }

  async findByClientId(clientId, trx) {
    return this.query(trx).where('client_id', clientId).whereNull('deleted_at');
  }

  async updateStatus(id, status, expectedVersion, extra = {}, trx) {
    const now = new Date().toISOString();
    const rowsAffected = await this.query(trx)
      .where('id', id)
      .where('version', expectedVersion)
      .update({
        status,
        ...extra,
        version: this.db.raw('version + 1'),
        updated_at: now,
      });

    if (rowsAffected === 0) {
      const error = new Error('Version conflict: document was modified by another request');
      error.status = 409;
      error.code = 'VERSION_CONFLICT';
      throw error;
    }

    return this.findById(id, trx);
  }

  async checkDuplicate(projectId, documentType, trx) {
    const existing = await this.query(trx)
      .where('project_id', projectId)
      .where('document_type', documentType)
      .whereNull('deleted_at')
      .first();
    if (existing) {
      return { isDuplicate: true, existingDocument: existing };
    }
    return { isDuplicate: false };
  }

  async computeProjectStats(projectId, trx) {
    const total = await this.query(trx)
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .count('* as count')
      .first();

    const completed = await this.query(trx)
      .where('project_id', projectId)
      .whereIn('status', ['Approved', 'Waived'])
      .whereNull('deleted_at')
      .count('* as count')
      .first();

    const documentCount = Number(total.count);
    const completedCount = Number(completed.count);
    const progressPercentage = documentCount > 0
      ? Math.round((completedCount / documentCount) * 100)
      : 0;

    return { documentCount, progressPercentage };
  }

  async countPendingByClientId(clientId, trx) {
    const result = await this.query(trx)
      .where('client_id', clientId)
      .whereNotIn('status', ['Approved', 'Waived'])
      .whereNull('deleted_at')
      .count('* as count')
      .first();
    return Number(result.count);
  }
}
