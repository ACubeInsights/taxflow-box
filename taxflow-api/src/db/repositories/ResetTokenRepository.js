import { BaseRepository } from './BaseRepository.js';
import { hashBearerToken } from '../../utils/authUtils.js';

export class ResetTokenRepository extends BaseRepository {
  constructor(db) {
    super(db, 'reset_tokens');
  }

  async create({ token, email, expiresAt }, trx) {
    const record = {
      token: hashBearerToken(token),
      email,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };
    await this.query(trx).insert(record);
    return record;
  }

  async findByToken(token, trx) {
    const hashed = hashBearerToken(token);
    let row = await this.query(trx).where('token', hashed).first();

    // Legacy plaintext migration
    if (!row) {
      row = await this.query(trx).where('token', token).first();
      if (row) {
        await this.query(trx).where('token', token).update({ token: hashed });
        row.token = hashed;
      }
    }

    if (!row) return null;

    if (new Date(row.expires_at) < new Date()) {
      return null;
    }

    return row;
  }

  async deleteByToken(token, trx) {
    const hashed = hashBearerToken(token);
    await this.query(trx).where('token', hashed).del();
    await this.query(trx).where('token', token).del();
  }

  async deleteExpired(trx) {
    const now = new Date().toISOString();
    return this.query(trx).where('expires_at', '<', now).del();
  }
}
