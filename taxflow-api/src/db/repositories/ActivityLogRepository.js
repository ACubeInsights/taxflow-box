import crypto from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class ActivityLogRepository extends BaseRepository {
  constructor(db) {
    super(db, 'activity_log');
  }

  async insert(activityData, trx) {
    const record = {
      id: crypto.randomUUID(),
      ...activityData,
    };
    await this.query(trx).insert(record);
    return record;
  }

  async findByClientIds(clientIds, { limit } = {}, trx) {
    const q = this.query(trx)
      .whereIn('client_id', clientIds)
      .orderBy('timestamp', 'desc');

    if (limit) {
      q.limit(limit);
    }

    return q;
  }
}
