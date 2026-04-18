import crypto from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class NotificationRepository extends BaseRepository {
  constructor(db) {
    super(db, 'notifications');
  }

  async create(notificationData, trx) {
    const record = {
      id: crypto.randomUUID(),
      ...notificationData,
      created_at: new Date().toISOString(),
    };
    await this.query(trx).insert(record);
    return record;
  }

  async findByRecipientId(recipientId, trx) {
    return this.query(trx)
      .where('recipient_id', recipientId)
      .orderBy('created_at', 'desc');
  }

  async markAsRead(id, trx) {
    await this.query(trx).where('id', id).update({ read: true });
  }
}
