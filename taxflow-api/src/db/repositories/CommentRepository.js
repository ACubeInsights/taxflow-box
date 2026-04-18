import crypto from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class CommentRepository extends BaseRepository {
  constructor(db) {
    super(db, 'comments');
  }

  async create(commentData, trx) {
    const record = {
      id: crypto.randomUUID(),
      ...commentData,
      mentions: Array.isArray(commentData.mentions)
        ? JSON.stringify(commentData.mentions)
        : commentData.mentions ?? null,
      created_at: new Date().toISOString(),
    };
    await this.query(trx).insert(record);
    return { ...record, mentions: this._parseMentions(record.mentions) };
  }

  async findByDocumentId(documentId, trx) {
    const rows = await this.query(trx)
      .where('document_id', documentId)
      .orderBy('created_at', 'asc');
    return rows.map((r) => ({ ...r, mentions: this._parseMentions(r.mentions) }));
  }

  async findById(commentId, trx) {
    const row = await this.query(trx).where('id', commentId).first();
    if (!row) return null;
    return { ...row, mentions: this._parseMentions(row.mentions) };
  }

  async updateText(commentId, text, trx) {
    const now = new Date().toISOString();
    await this.query(trx).where('id', commentId).update({ text, edited_at: now });
  }

  _parseMentions(mentions) {
    if (!mentions) return null;
    if (typeof mentions === 'string') {
      try {
        return JSON.parse(mentions);
      } catch {
        return mentions;
      }
    }
    return mentions;
  }
}
