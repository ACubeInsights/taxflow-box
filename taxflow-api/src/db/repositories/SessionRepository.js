import { BaseRepository } from './BaseRepository.js';
import { hashBearerToken } from '../../utils/authUtils.js';

export class SessionRepository extends BaseRepository {
  constructor(db) {
    super(db, 'sessions');
  }

  async create({ token, userId, email, name, role, expiresAt }, trx) {
    const record = {
      token: hashBearerToken(token),
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
    const hashed = hashBearerToken(token);
    let session = await this.query(trx).where('token', hashed).first();

    // One-time migration: upgrade legacy plaintext rows
    if (!session) {
      session = await this.query(trx).where('token', token).first();
      if (session) {
        await this.query(trx).where('token', token).update({ token: hashed });
        session.token = hashed;
      }
    }

    if (!session) return null;

    if (new Date(session.expires_at) < new Date()) {
      await this.query(trx).where('token', session.token).del();
      return null;
    }

    return session;
  }

  async deleteByToken(token, trx) {
    const hashed = hashBearerToken(token);
    await this.query(trx).where('token', hashed).del();
    // Also clear any legacy plaintext row
    await this.query(trx).where('token', token).del();
  }

  async deleteByUserId(userId, trx) {
    await this.query(trx).where('user_id', userId).del();
  }

  async deleteByEmail(email, trx) {
    await this.query(trx).where('email', String(email).toLowerCase()).del();
  }

  async deleteExpired(trx) {
    const now = new Date().toISOString();
    return this.query(trx).where('expires_at', '<', now).del();
  }

  async refreshExpiry(token, newExpiresAt, trx) {
    const hashed = hashBearerToken(token);
    const updated = await this.query(trx).where('token', hashed).update({ expires_at: newExpiresAt });
    if (!updated) {
      await this.query(trx).where('token', token).update({ expires_at: newExpiresAt, token: hashed });
    }
  }
}
