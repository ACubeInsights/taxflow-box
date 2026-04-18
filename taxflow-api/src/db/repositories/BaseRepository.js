import crypto from 'crypto';

export class BaseRepository {
  constructor(db, tableName) {
    this.db = db;
    this.tableName = tableName;
  }

  query(trx) {
    return trx ? this.db(this.tableName).transacting(trx) : this.db(this.tableName);
  }

  async findById(id, trx) {
    return this.query(trx).where('id', id).first();
  }

  async insert(data, trx) {
    const record = { id: crypto.randomUUID(), ...data };
    await this.query(trx).insert(record);
    return record;
  }

  async softDelete(id, trx) {
    await this.query(trx).where('id', id).update({ deleted_at: new Date().toISOString() });
  }
}
