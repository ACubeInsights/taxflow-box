/**
 * PermissionService — Manages granular per-resource access control.
 * Handles permission CRUD, folder cascading, and notification dispatch.
 */

import boxService from './boxService.js';
import emailService from './emailService.js';
import { config } from '../config.js';

/** Access levels in ascending severity order */
export const ACCESS_LEVELS = {
  no_access: 0,
  viewer: 1,
  commenter: 2,
  writer: 3,
  delete: 4,
};

export const ACCESS_LEVEL_NAMES = Object.keys(ACCESS_LEVELS);

/** Capabilities included at each level */
const CAPABILITIES_MAP = {
  no_access: [],
  viewer: ['view'],
  commenter: ['view', 'download', 'comment'],
  writer: ['view', 'download', 'comment', 'edit', 'upload'],
  delete: ['view', 'download', 'comment', 'edit', 'upload', 'delete'],
};

class PermissionService {
  constructor() {
    this._permissionRepo = null;
  }

  setRepositories({ permissionRepo }) {
    if (permissionRepo) this._permissionRepo = permissionRepo;
  }

  get repo() {
    if (!this._permissionRepo) throw new Error('PermissionService: repositories not injected');
    return this._permissionRepo;
  }

  /**
   * Set or update a permission for a client on a resource.
   * If resourceType is 'folder', cascades to all subfolders.
   * Triggers email notification.
   */
  async setPermission(clientId, resourceId, resourceType, accessLevel, grantedBy, resourceName) {
    if (!ACCESS_LEVEL_NAMES.includes(accessLevel)) {
      const err = new Error(`Invalid access level: ${accessLevel}. Must be one of: ${ACCESS_LEVEL_NAMES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
    if (!['file', 'folder'].includes(resourceType)) {
      const err = new Error('resourceType must be "file" or "folder"');
      err.statusCode = 400;
      throw err;
    }

    // Get previous permission for notification context
    const previous = await this.repo.findByClientAndResource(clientId, resourceId);
    const previousLevel = previous?.access_level || 'no_access';

    // Upsert the permission record
    const record = await this.repo.upsert({
      clientId,
      resourceId,
      resourceType,
      resourceName: resourceName || previous?.resource_name || null,
      accessLevel,
      grantedBy,
      isCascaded: false,
      parentPermissionId: null,
    });

    // Cascade to subfolders if this is a folder
    let cascadedCount = 0;
    if (resourceType === 'folder') {
      cascadedCount = await this.cascadeToSubfolders(clientId, resourceId, accessLevel, grantedBy, record.id);
    }

    // Fire email notification (async, non-blocking)
    if (previousLevel !== accessLevel) {
      this._notifyPermissionChange(clientId, resourceId, resourceName || record.resource_name, previousLevel, accessLevel, grantedBy, cascadedCount).catch(err => {
        console.error('[PermissionService] Email notification failed:', err.message);
      });
    }

    return {
      id: record.id,
      clientId: record.client_id,
      resourceId: record.resource_id,
      resourceType: record.resource_type,
      accessLevel: record.access_level,
      grantedBy: record.granted_by,
      cascadedCount,
    };
  }

  /**
   * Get the permission for a specific client-resource pair.
   * Returns null if no record exists (implies no_access).
   */
  async getPermission(clientId, resourceId) {
    const record = await this.repo.findByClientAndResource(clientId, resourceId);
    if (!record) return null;
    return {
      id: record.id,
      clientId: record.client_id,
      resourceId: record.resource_id,
      resourceType: record.resource_type,
      resourceName: record.resource_name,
      accessLevel: record.access_level,
      capabilities: CAPABILITIES_MAP[record.access_level] || [],
      isCascaded: !!record.is_cascaded,
      grantedBy: record.granted_by,
      updatedAt: record.updated_at,
    };
  }

  /**
   * Get all non-no_access permissions for a client.
   */
  async getClientPermissions(clientId) {
    const records = await this.repo.findByClientId(clientId);
    return records.map(r => ({
      id: r.id,
      resourceId: r.resource_id,
      resourceType: r.resource_type,
      resourceName: r.resource_name,
      accessLevel: r.access_level,
      isCascaded: !!r.is_cascaded,
      grantedBy: r.granted_by,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Check if a client has at least the required access level for a resource.
   */
  async hasAccess(clientId, resourceId, requiredLevel) {
    const record = await this.repo.findByClientAndResource(clientId, resourceId);
    if (!record) return false;
    const currentNumeric = ACCESS_LEVELS[record.access_level] ?? 0;
    const requiredNumeric = ACCESS_LEVELS[requiredLevel] ?? 0;
    return currentNumeric >= requiredNumeric;
  }

  /**
   * Get accessible resource IDs for a client from a set of resource IDs.
   */
  async getAccessibleResources(clientId, resourceIds) {
    const records = await this.repo.findAccessibleInFolder(clientId, resourceIds);
    const accessMap = {};
    for (const r of records) {
      accessMap[r.resource_id] = r.access_level;
    }
    return accessMap;
  }

  /**
   * Revoke access (set to no_access). Cascades to subfolders if folder.
   */
  async revokePermission(clientId, resourceId, grantedBy) {
    const previous = await this.repo.findByClientAndResource(clientId, resourceId);
    const previousLevel = previous?.access_level || 'no_access';
    const resourceType = previous?.resource_type || 'file';
    const resourceName = previous?.resource_name || null;

    // Set to no_access
    await this.repo.upsert({
      clientId,
      resourceId,
      resourceType,
      resourceName,
      accessLevel: 'no_access',
      grantedBy,
      isCascaded: false,
      parentPermissionId: null,
    });

    // Cascade revocation to subfolders
    let cascadedCount = 0;
    if (resourceType === 'folder') {
      cascadedCount = await this.cascadeToSubfolders(clientId, resourceId, 'no_access', grantedBy, null);
    }

    // Notify
    if (previousLevel !== 'no_access') {
      this._notifyPermissionChange(clientId, resourceId, resourceName, previousLevel, 'no_access', grantedBy, cascadedCount).catch(err => {
        console.error('[PermissionService] Revocation notification failed:', err.message);
      });
    }

    return { cascadedCount };
  }

  /**
   * Cascade an access level to all subfolders (recursive).
   * Only affects folders, NOT files.
   */
  async cascadeToSubfolders(clientId, folderId, accessLevel, grantedBy, parentPermissionId) {
    let count = 0;

    try {
      const client = boxService.getBoxClient();
      const items = await client.folders.getFolderItems(folderId, { queryParams: { fields: ['id', 'type', 'name'] } });
      const entries = items.entries || [];

      for (const item of entries) {
        // Only cascade to folders, NOT files
        if (item.type !== 'folder') continue;

        await this.repo.upsert({
          clientId,
          resourceId: item.id,
          resourceType: 'folder',
          resourceName: item.name,
          accessLevel,
          grantedBy,
          isCascaded: true,
          parentPermissionId,
        });
        count++;

        // Recurse into subfolders
        const subCount = await this.cascadeToSubfolders(clientId, item.id, accessLevel, grantedBy, parentPermissionId);
        count += subCount;
      }
    } catch (err) {
      console.warn(`[PermissionService] Cascade partial failure for folder ${folderId}:`, err.message);
    }

    return count;
  }

  /**
   * Send email notification about a permission change.
   * @private
   */
  async _notifyPermissionChange(clientId, resourceId, resourceName, oldLevel, newLevel, grantedBy, cascadedCount) {
    try {
      // Resolve client email
      const { getRepositories } = await import('../db/repositories/index.js');
      const repos = getRepositories();
      const clientRecord = await repos.clientRepo.findById(clientId);
      if (!clientRecord?.email) return;

      // Determine template
      let template = 'permission_changed';
      if (oldLevel === 'no_access' && newLevel !== 'no_access') template = 'permission_granted';
      if (newLevel === 'no_access') template = 'permission_revoked';
      if (cascadedCount >= 10) template = 'permission_cascade';

      // Resolve employee name
      let employeeName = 'Your tax preparer';
      try {
        const empRecord = await repos.userRepo.findById(grantedBy);
        if (empRecord) employeeName = empRecord.name;
      } catch { /* use default */ }

      const frontendUrl = config.frontendUrl || 'http://localhost:5173';
      const deepLinkUrl = newLevel !== 'no_access' ? `${frontendUrl}/dashboard` : '';

      await emailService.sendEmail(clientRecord.email, template, {
        message: `Your access to "${resourceName || 'a resource'}" has been updated by ${employeeName}. Previous access: ${oldLevel}. New access: ${newLevel}.${cascadedCount > 0 ? ` ${cascadedCount} subfolders were also updated.` : ''}`,
        fileName: resourceName || '',
        deepLinkUrl,
      });
    } catch (err) {
      console.error('[PermissionService] Notification dispatch failed:', err.message);
    }
  }
}

const permissionService = new PermissionService();
export default permissionService;
