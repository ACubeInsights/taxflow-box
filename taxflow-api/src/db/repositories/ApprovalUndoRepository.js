import { BaseRepository } from './BaseRepository.js';

export class ApprovalUndoRepository extends BaseRepository {
  constructor(db) {
    super(db, 'approval_undo');
  }

  async upsert(documentId, approvedAt, trx) {
    const now = new Date().toISOString();
    const record = {
      document_id: documentId,
      approved_at: approvedAt,
      created_at: now,
    };
    await this.query(trx).insert(record).onConflict('document_id').merge();
    return record;
  }

  async findByDocumentId(documentId, trx) {
    return this.query(trx).where('document_id', documentId).first();
  }

  async deleteByDocumentId(documentId, trx) {
    await this.query(trx).where('document_id', documentId).del();
  }

  async deleteExpired(windowMs, trx) {
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    return this.query(trx).where('approved_at', '<', cutoff).del();
  }
}
