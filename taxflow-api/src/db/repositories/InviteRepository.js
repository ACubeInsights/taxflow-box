import { BaseRepository } from './BaseRepository.js';

export class InviteRepository extends BaseRepository {
  constructor(db) {
    super(db, 'invite_records');
  }

  async create({ clientName, email, externalId, employeeEmail, financialYear, tokenExpiresAt }) {
    const record = {
      client_name: clientName,
      email: email.toLowerCase(),
      external_id: externalId,
      employee_email: employeeEmail.toLowerCase(),
      financial_year: financialYear,
      status: 'pending_invite',
      delivery_failure_flag: 0,
      resend_count: 0,
      token_expires_at: tokenExpiresAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return this.insert(record);
  }

  async findByEmail(email) {
    return this.query()
      .where('email', email.toLowerCase())
      .whereIn('status', ['pending_invite', 'accepted'])
      .first();
  }

  async findByEmployeeEmail(employeeEmail) {
    return this.query()
      .where('employee_email', employeeEmail.toLowerCase())
      .orderBy('created_at', 'desc');
  }

  async updateStatus(id, status) {
    await this.query()
      .where('id', id)
      .update({ status, updated_at: new Date().toISOString() });
  }

  async setDeliveryFailure(id, flag = true) {
    await this.query()
      .where('id', id)
      .update({ delivery_failure_flag: flag ? 1 : 0, updated_at: new Date().toISOString() });
  }

  async incrementResendCount(id) {
    const record = await this.findById(id);
    if (!record) return;
    await this.query()
      .where('id', id)
      .update({
        resend_count: (record.resend_count || 0) + 1,
        last_resend_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
  }

  async getResendCountInWindow(id, windowMs = 24 * 60 * 60 * 1000) {
    const record = await this.findById(id);
    if (!record) return 0;
    if (!record.last_resend_at) return 0;
    const windowStart = new Date(Date.now() - windowMs).toISOString();
    if (record.last_resend_at < windowStart) return 0;
    return record.resend_count || 0;
  }

  async updateTokenExpiry(id, tokenExpiresAt) {
    await this.query()
      .where('id', id)
      .update({
        token_expires_at: tokenExpiresAt,
        status: 'pending_invite',
        updated_at: new Date().toISOString(),
      });
  }

  async expirePendingInvites() {
    const now = new Date().toISOString();
    const count = await this.query()
      .where('status', 'pending_invite')
      .where('token_expires_at', '<', now)
      .update({ status: 'expired', updated_at: now });
    return count;
  }
}
