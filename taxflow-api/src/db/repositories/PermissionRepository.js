import crypto from 'crypto';
import { BaseRepository } from './BaseRepository.js';

export class PermissionRepository extends BaseRepository {
  constructor(db) {
    super(db, 'resource_permissions');
  }

  /**
   * Upsert a permission record. Creates or updates based on (client_id, resource_id) unique.
   */
  async upsert(record, trx) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const row = {
      id,
      client_id: record.clientId,
      resource_id: record.resourceId,
      resource_type: record.resourceType,
      resource_name: record.resourceName || null,
      access_level: record.accessLevel,
      granted_by: record.grantedBy,
      is_cascaded: record.isCascaded || false,
      parent_permission_id: record.parentPermissionId || null,
      created_at: now,
      updated_at: now,
    };

    const q = trx ? this.db('resource_permissions').transacting(trx) : this.db('resource_permissions');

    // SQLite upsert via INSERT ... ON CONFLICT ... DO UPDATE
    await q.insert(row).onConflict(['client_id', 'resource_id']).merge({
      access_level: record.accessLevel,
      resource_name: record.resourceName || null,
      granted_by: record.grantedBy,
      is_cascaded: record.isCascaded || false,
      parent_permission_id: record.parentPermissionId || null,
      updated_at: now,
    });

    // Return the record (fetch it since merge may have used existing ID)
    return this.findByClientAndResource(record.clientId, record.resourceId, trx);
  }

  /**
   * Bulk upsert multiple permission records (for cascade operations).
   */
  async bulkUpsert(records, trx) {
    const results = [];
    for (const record of records) {
      const result = await this.upsert(record, trx);
      results.push(result);
    }
    return results;
  }

  /**
   * Find all non-no_access permissions for a client.
   */
  async findByClientId(clientId, trx) {
    const q = trx ? this.db('resource_permissions').transacting(trx) : this.db('resource_permissions');
    return q
      .where('client_id', clientId)
      .whereNot('access_level', 'no_access')
      .orderBy('resource_type', 'asc')
      .orderBy('resource_name', 'asc');
  }

  /**
   * Find a single permission record for a client-resource pair.
   */
  async findByClientAndResource(clientId, resourceId, trx) {
    const q = trx ? this.db('resource_permissions').transacting(trx) : this.db('resource_permissions');
    return q.where({ client_id: clientId, resource_id: resourceId }).first();
  }

  /**
   * Find all cascaded children of a parent permission.
   */
  async findByParentPermissionId(parentPermissionId, trx) {
    const q = trx ? this.db('resource_permissions').transacting(trx) : this.db('resource_permissions');
    return q.where('parent_permission_id', parentPermissionId);
  }

  /**
   * Find accessible resources for a client from a given set of resource IDs.
   * Returns only those with access_level != 'no_access'.
   */
  async findAccessibleInFolder(clientId, resourceIds, trx) {
    if (!resourceIds || resourceIds.length === 0) return [];
    const q = trx ? this.db('resource_permissions').transacting(trx) : this.db('resource_permissions');
    return q
      .where('client_id', clientId)
      .whereIn('resource_id', resourceIds)
      .whereNot('access_level', 'no_access');
  }

  /**
   * Delete a permission record (hard delete).
   */
  async deleteByClientAndResource(clientId, resourceId, trx) {
    const q = trx ? this.db('resource_permissions').transacting(trx) : this.db('resource_permissions');
    return q.where({ client_id: clientId, resource_id: resourceId }).del();
  }

  /**
   * Delete all cascaded children of a parent permission.
   */
  async deleteCascadedChildren(parentPermissionId, trx) {
    const q = trx ? this.db('resource_permissions').transacting(trx) : this.db('resource_permissions');
    return q.where('parent_permission_id', parentPermissionId).del();
  }
}
