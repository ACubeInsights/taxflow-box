import { BaseRepository } from './BaseRepository.js';

export class SessionRepository extends BaseRepository {
  constructor(db) {
    super(db, 'sessions');
  }

  async create({ token, userId, email, name, role, expiresAt }, trx) {
    const record = {
      token,
      user_id: userId,
      email,
      name,
      role,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };
    await this.query(trx).insert(record);
    return record;
  }

  async findByToken(token, trx) {
    const session = await this.query(trx).where('token', token).first();
    if (!session) return null;

    if (new Date(session.expires_at) < new Date()) {
      await this.deleteByToken(token, trx);
      return null;
    }

    return session;
  }

  async deleteByToken(token, trx) {
    await this.query(trx).where('token', token).del();
  }

  async deleteExpired(trx) {
    const now = new Date().toISOString();
    return this.query(trx).where('expires_at', '<', now).del();
  }

  async refreshExpiry(token, newExpiresAt, trx) {
    await this.query(trx).where('token', token).update({ expires_at: newExpiresAt });
  }
}
