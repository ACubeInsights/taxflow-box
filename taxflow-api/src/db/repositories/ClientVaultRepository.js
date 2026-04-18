import crypto from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class ClientVaultRepository extends BaseRepository {
  constructor(db) {
    super(db, 'client_vaults');
  }

  /**
   * Find vault by client_id. If financialYear is provided, filter by it;
   * otherwise return the most recent year.
   * @param {string} clientId
   * @param {string} [financialYear]
   * @param {import('knex').Knex.Transaction} [trx]
   * @returns {Promise<object|undefined>}
   */
  async findByClientId(clientId, financialYear, trx) {
    const q = this.query(trx).where('client_id', clientId);
    if (financialYear) {
      q.where('financial_year', financialYear);
    }
    return q.orderBy('financial_year', 'desc').first();
  }

  /**
   * Find vault by client external_id (joins clients table).
   * Returns the most recent year vault.
   * @param {string} externalId
   * @param {import('knex').Knex.Transaction} [trx]
   * @returns {Promise<object|undefined>}
   */
  async findByExternalId(externalId, trx) {
    const base = trx || this.db;
    return base('client_vaults as cv')
      .join('clients as c', 'cv.client_id', 'c.id')
      .where('c.external_id', externalId)
      .select('cv.*')
      .orderBy('cv.financial_year', 'desc')
      .first();
  }

  /**
   * Create a new vault record with generated UUID and timestamps.
   * @param {object} vaultData
   * @param {import('knex').Knex.Transaction} [trx]
   * @returns {Promise<object>}
   */
  async create(vaultData, trx) {
    const now = new Date().toISOString();
    const record = {
      id: crypto.randomUUID(),
      ...vaultData,
      created_at: now,
      updated_at: now,
    };
    await this.query(trx).insert(record);
    return record;
  }

  /**
   * Upsert — INSERT ON CONFLICT (client_id, financial_year) DO UPDATE.
   * @param {object} vaultData
   * @param {import('knex').Knex.Transaction} [trx]
   * @returns {Promise<object>}
   */
  async upsert(vaultData, trx) {
    const now = new Date().toISOString();
    const record = {
      id: crypto.randomUUID(),
      ...vaultData,
      created_at: now,
      updated_at: now,
    };
    await this.query(trx)
      .insert(record)
      .onConflict(['client_id', 'financial_year'])
      .merge({
        root_folder_id: record.root_folder_id,
        year_folder_id: record.year_folder_id,
        projects_folder_id: record.projects_folder_id,
        tax_folder_id: record.tax_folder_id,
        uploads_folder_id: record.uploads_folder_id,
        supporting_docs_folder_id: record.supporting_docs_folder_id,
        signed_documents_folder_id: record.signed_documents_folder_id,
        internal_notes_folder_id: record.internal_notes_folder_id,
        updated_at: now,
      });
    return record;
  }
}
