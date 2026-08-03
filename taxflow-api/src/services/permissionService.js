/**
 * PermissionService — Manages granular per-resource access control.
 * Box collaborations are the source of truth (Phase 2c); resource_permissions
 * is retained as a read fallback for legacy data when Box is unavailable.
 */

import boxCollaborationAccessService, { ACCESS_LEVELS } from './boxCollaborationAccessService.js';
import emailService from './emailService.js';
import cacheLayer from './cacheLayer.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export { ACCESS_LEVELS };

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
    this._clientRepo = null;
    this._clientVaultRepo = null;
    this._userRepo = null;
  }

  setRepositories({ permissionRepo, clientRepo, clientVaultRepo, userRepo }) {
    if (permissionRepo) this._permissionRepo = permissionRepo;
    if (clientRepo) this._clientRepo = clientRepo;
    if (clientVaultRepo) this._clientVaultRepo = clientVaultRepo;
    if (userRepo) this._userRepo = userRepo;
    boxCollaborationAccessService.setRepositories({ clientRepo, clientVaultRepo, userRepo });
  }

  get repo() {
    if (!this._permissionRepo) throw new Error('PermissionService: repositories not injected');
    return this._permissionRepo;
  }

  /**
   * Set or update a permission for a client on a resource via Box collaboration.
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

    const previous = await this.getPermission(clientId, resourceId);
    const previousLevel = previous?.accessLevel || 'no_access';

    const boxUserId = await boxCollaborationAccessService.resolveBoxUserId(clientId);
    if (!boxUserId) {
      const err = new Error('Client does not have a Box App User configured');
      err.statusCode = 400;
      throw err;
    }

    await boxCollaborationAccessService.setAccess(
      boxUserId,
      resourceId,
      resourceType,
      accessLevel
    );

    // Invalidate cached permission reads for this client
    await cacheLayer.invalidate(`boxcollab:${boxUserId}:`);

    if (previousLevel !== accessLevel) {
      this._notifyPermissionChange(
        clientId,
        resourceId,
        resourceName || previous?.resourceName,
        previousLevel,
        accessLevel,
        grantedBy,
        0
      ).catch((err) => {
        console.error('[PermissionService] Email notification failed:', err.message);
      });
    }

    return {
      clientId,
      resourceId,
      resourceType,
      accessLevel,
      grantedBy,
      source: 'box',
      cascadedCount: 0,
    };
  }

  /**
   * Get the permission for a specific client-resource pair.
   * Returns null if no access (implies no_access).
   */
  async getPermission(clientId, resourceId, resourceType = 'folder') {
    const boxUserId = await boxCollaborationAccessService.resolveBoxUserId(clientId);
    if (boxUserId) {
      try {
        const accessLevel = await boxCollaborationAccessService.resolveEffectiveAccessLevel(
          boxUserId,
          resourceId,
          resourceType
        );
        if (accessLevel) {
          return {
            clientId,
            resourceId,
            resourceType,
            accessLevel,
            capabilities: CAPABILITIES_MAP[accessLevel] || [],
            source: 'box',
          };
        }
      } catch (err) {
        logger.warn('Box permission read failed, trying DB fallback', { resourceId, error: err.message });
      }
    }

    return this._getPermissionFromDb(clientId, resourceId);
  }

  /**
   * Get all non-no_access permissions for a client.
   */
  async getClientPermissions(clientId) {
    const boxPerms = await boxCollaborationAccessService.listClientAccess(clientId);
    if (boxPerms.length) {
      return boxPerms.map((p) => ({
        resourceId: p.resourceId,
        resourceType: p.resourceType,
        resourceName: p.resourceName,
        accessLevel: p.accessLevel,
        source: 'box',
      }));
    }

    if (!this._permissionRepo) return [];
    const records = await this.repo.findByClientId(clientId);
    return records.map((r) => ({
      id: r.id,
      resourceId: r.resource_id,
      resourceType: r.resource_type,
      resourceName: r.resource_name,
      accessLevel: r.access_level,
      isCascaded: !!r.is_cascaded,
      grantedBy: r.granted_by,
      updatedAt: r.updated_at,
      source: 'db',
    }));
  }

  /**
   * Check if a client has at least the required access level for a resource.
   */
  async hasAccess(clientId, resourceId, requiredLevel, resourceType = 'folder') {
    const boxUserId = await boxCollaborationAccessService.resolveBoxUserId(clientId);
    if (boxUserId) {
      try {
        const allowed = await boxCollaborationAccessService.hasAccess(
          boxUserId,
          resourceId,
          resourceType,
          requiredLevel
        );
        if (allowed) return true;
      } catch (err) {
        logger.warn('Box hasAccess failed, trying DB fallback', { resourceId, error: err.message });
      }
    }

    if (!this._permissionRepo) return false;
    const record = await this.repo.findByClientAndResource(clientId, resourceId);
    if (!record) return false;
    const currentNumeric = ACCESS_LEVELS[record.access_level] ?? 0;
    const requiredNumeric = ACCESS_LEVELS[requiredLevel] ?? 0;
    return currentNumeric >= requiredNumeric;
  }

  /**
   * Get accessible resource IDs for a client from a set of resource IDs.
   */
  async getAccessibleResources(clientId, resourceIds, folderId) {
    const boxUserId = await boxCollaborationAccessService.resolveBoxUserId(clientId);
    if (boxUserId) {
      try {
        const accessMap = await boxCollaborationAccessService.getAccessibleResources(
          boxUserId,
          resourceIds,
          folderId
        );
        const hasAny = Object.values(accessMap).some(Boolean);
        if (hasAny) return accessMap;
      } catch (err) {
        logger.warn('Box getAccessibleResources failed, trying DB fallback', { error: err.message });
      }
    }

    if (!this._permissionRepo) return {};
    const records = await this.repo.findAccessibleInFolder(clientId, resourceIds);
    const accessMap = {};
    for (const r of records) {
      accessMap[r.resource_id] = r.access_level;
    }
    return accessMap;
  }

  /**
   * Revoke access (set to no_access).
   */
  async revokePermission(clientId, resourceId, grantedBy, resourceType = 'folder') {
    return this.setPermission(clientId, resourceId, resourceType, 'no_access', grantedBy);
  }

  async _getPermissionFromDb(clientId, resourceId) {
    if (!this._permissionRepo) return null;
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
      source: 'db',
    };
  }

  /**
   * Send email notification about a permission change.
   * @private
   */
  async _notifyPermissionChange(clientId, resourceId, resourceName, oldLevel, newLevel, grantedBy, cascadedCount) {
    try {
      const { getRepositories } = await import('../db/repositories/index.js');
      const repos = getRepositories();
      let clientEmail = null;
      if (repos.clientRepo) {
        const clientRecord = await repos.clientRepo.findById(clientId);
        clientEmail = clientRecord?.email;
      } else if (repos.userRepo) {
        const userRecord = await repos.userRepo.findById(clientId);
        clientEmail = userRecord?.email;
      }
      if (!clientEmail) return;

      let template = 'permission_changed';
      if (oldLevel === 'no_access' && newLevel !== 'no_access') template = 'permission_granted';
      if (newLevel === 'no_access') template = 'permission_revoked';

      let employeeName = 'Your tax preparer';
      try {
        const empRecord = await repos.userRepo.findById(grantedBy);
        if (empRecord) employeeName = empRecord.name;
      } catch { /* use default */ }

      const frontendUrl = config.frontendUrl || 'http://localhost:5173';
      const deepLinkUrl = newLevel !== 'no_access' ? `${frontendUrl}/dashboard` : '';

      await emailService.sendEmail(clientEmail, template, {
        message: `Your access to "${resourceName || 'a resource'}" has been updated by ${employeeName}. Previous access: ${oldLevel}. New access: ${newLevel}.`,
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
