import { BaseRepository } from './BaseRepository.js';

export class WebhookKeyRepository extends BaseRepository {
  constructor(db) {
    super(db, 'webhook_keys');
  }

  async upsert(folderId, { webhookId, primaryKey, secondaryKey }, trx) {
    const now = new Date().toISOString();
    const record = {
      folder_id: folderId,
      webhook_id: webhookId,
      primary_key: primaryKey,
      secondary_key: secondaryKey,
      created_at: now,
      updated_at: now,
    };
    await this.query(trx).insert(record).onConflict('folder_id').merge();
    return record;
  }

  async findByFolderId(folderId, trx) {
    return this.query(trx).where('folder_id', folderId).first();
  }

  async findAll(trx) {
    return this.query(trx);
  }
}
