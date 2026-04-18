import { BaseRepository } from './BaseRepository.js';

export class ResetTokenRepository extends BaseRepository {
  constructor(db) {
    super(db, 'reset_tokens');
  }

  async create({ token, email, expiresAt }, trx) {
    const record = {
      token,
      email,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };
    await this.query(trx).insert(record);
    return record;
  }

  async findByToken(token, trx) {
    const row = await this.query(trx).where('token', token).first();
    if (!row) return null;

    if (new Date(row.expires_at) < new Date()) {
      return null;
    }

    return row;
  }

  async deleteByToken(token, trx) {
    await this.query(trx).where('token', token).del();
  }

  async deleteExpired(trx) {
    const now = new Date().toISOString();
    return this.query(trx).where('expires_at', '<', now).del();
  }
}
