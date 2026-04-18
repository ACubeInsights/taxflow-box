import crypto from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class EmployeeClientRepository extends BaseRepository {
  constructor(db) {
    super(db, 'employee_clients');
  }

  async assign(employeeId, clientId, trx) {
    const record = {
      id: crypto.randomUUID(),
      employee_id: employeeId,
      client_id: clientId,
      assigned_at: new Date().toISOString(),
    };
    await this.query(trx).insert(record);
    return record;
  }

  async findClientIdsByEmployee(employeeId, trx) {
    const rows = await this.query(trx)
      .where('employee_id', employeeId)
      .select('client_id');
    return rows.map((r) => r.client_id);
  }

  async isAssigned(employeeId, clientId, trx) {
    const row = await this.query(trx)
      .where('employee_id', employeeId)
      .where('client_id', clientId)
      .first();
    return !!row;
  }
}
