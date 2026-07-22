/**
 * BoxCollaborationAccessService — Box collaborations as the source of truth for
 * client file/folder access. Maps between app access levels and Box roles.
 *
 * Phase 2c: replaces resource_permissions reads/writes with Box-native checks.
 */

import boxService from './boxService.js';
import cacheLayer from './cacheLayer.js';
import vaultDiscoveryService from './vaultDiscoveryService.js';
import { logger } from '../utils/logger.js';

/** Access levels in ascending severity order */
export const ACCESS_LEVELS = {
  no_access: 0,
  viewer: 1,
  commenter: 2,
  writer: 3,
  delete: 4,
};

/** App access level → Box collaboration role */
export const ACCESS_TO_BOX_ROLE = {
  viewer: 'viewer',
  commenter: 'previewer',
  writer: 'viewer uploader',
  delete: 'editor',
};

/** Box collaboration role → app access level (highest capability wins) */
export const BOX_ROLE_TO_ACCESS = {
  viewer: 'viewer',
  previewer: 'commenter',
  'viewer uploader': 'writer',
  uploader: 'writer',
  editor: 'delete',
  'co-owner': 'delete',
  owner: 'delete',
};

export function boxRoleToAccessLevel(role) {
  if (!role) return null;
  const normalized = String(role).toLowerCase();
  return BOX_ROLE_TO_ACCESS[normalized] || null;
}

export function accessLevelToBoxRole(accessLevel) {
  return ACCESS_TO_BOX_ROLE[accessLevel] || null;
}

export class BoxCollaborationAccessService {
  constructor() {
    this._clientRepo = null;
    this._clientVaultRepo = null;
    this._userRepo = null;
  }

  setRepositories({ clientRepo, clientVaultRepo, userRepo } = {}) {
    if (clientRepo) this._clientRepo = clientRepo;
    if (clientVaultRepo) this._clientVaultRepo = clientVaultRepo;
    if (userRepo) this._userRepo = userRepo;
  }

  /**
   * @param {string} clientId
   * @returns {Promise<string|null>} Box App User ID
   */
  async resolveBoxUserId(clientId) {
    if (this._clientRepo) {
      const client = await this._clientRepo.findById(clientId);
      return client?.box_user_id || null;
    }
    if (this._userRepo) {
      const user = await this._userRepo.findById(clientId);
      return user?.box_user_id || null;
    }
    return null;
  }

  /**
   * Returns the effective access level for a client on a resource via Box collaborations.
   * Walks parent folders when no direct collaboration exists (Box inheritance).
   */
  async resolveEffectiveAccessLevel(boxUserId, resourceId, resourceType = 'folder') {
    if (!boxUserId || !resourceId) return null;

    const cacheKey = `boxcollab:${boxUserId}:${resourceType}:${resourceId}`;
    const cached = await cacheLayer.get(cacheKey);
    if (cached !== null && cached !== undefined) return cached;

    let level = null;
    try {
      level = await this._resolveEffectiveAccessLevelUncached(boxUserId, resourceId, resourceType);
    } catch (err) {
      logger.warn('Box collaboration resolve failed', { resourceId, resourceType, error: err.message });
      return null;
    }

    await cacheLayer.set(cacheKey, level, 30);
    return level;
  }

  async _resolveEffectiveAccessLevelUncached(boxUserId, resourceId, resourceType) {
    const directRole = await this._getCollaborationRole(boxUserId, resourceId, resourceType);
    if (directRole) return boxRoleToAccessLevel(directRole);

    const parentChain = await this._getParentFolderChain(resourceId, resourceType);
    for (const folderId of parentChain) {
      const folderRole = await this._getCollaborationRole(boxUserId, folderId, 'folder');
      if (folderRole) return boxRoleToAccessLevel(folderRole);
    }

    return null;
  }

  /**
   * @returns {Promise<boolean>}
   */
  async hasAccess(boxUserId, resourceId, resourceType, requiredLevel) {
    const effective = await this.resolveEffectiveAccessLevel(boxUserId, resourceId, resourceType);
    if (!effective) return false;
    return (ACCESS_LEVELS[effective] ?? 0) >= (ACCESS_LEVELS[requiredLevel] ?? 0);
  }

  /**
   * Creates, updates, or removes a Box collaboration for a client App User.
   */
  async setAccess(boxUserId, resourceId, resourceType, accessLevel) {
    if (!boxUserId || !resourceId) {
      throw new Error('boxUserId and resourceId are required');
    }

    if (accessLevel === 'no_access') {
      await boxService.removeUserCollaboration(resourceId, resourceType, boxUserId);
    } else {
      const role = accessLevelToBoxRole(accessLevel);
      if (!role) {
        const err = new Error(`Cannot map access level to Box role: ${accessLevel}`);
        err.statusCode = 400;
        throw err;
      }
      await boxService.upsertUserCollaboration(resourceId, resourceType, boxUserId, role);
    }

    await this._invalidateResourceCache(boxUserId, resourceId, resourceType);
  }

  /**
   * Lists non-no_access permissions for a client from Box collaborations on vault folders.
   */
  async listClientAccess(clientId) {
    const boxUserId = await this.resolveBoxUserId(clientId);
    if (!boxUserId) return [];

    const folderIds = await this._getVaultFolderIds(clientId);
    const permissions = [];

    for (const { id, name } of folderIds) {
      try {
        const role = await this._getCollaborationRole(boxUserId, id, 'folder');
        const accessLevel = boxRoleToAccessLevel(role);
        if (accessLevel) {
          permissions.push({
            resourceId: id,
            resourceType: 'folder',
            resourceName: name,
            accessLevel,
            source: 'box',
          });
        }
      } catch (err) {
        logger.warn('Failed to read folder collaboration', { folderId: id, error: err.message });
      }
    }

    return permissions;
  }

  /**
   * Returns access levels for a set of file IDs (explicit file collab or folder inheritance).
   */
  async getAccessibleResources(boxUserId, fileIds, folderId) {
    const accessMap = {};
    if (!boxUserId || !fileIds?.length) return accessMap;

    const folderLevel = folderId
      ? await this.resolveEffectiveAccessLevel(boxUserId, folderId, 'folder')
      : null;

    for (const fileId of fileIds) {
      const fileLevel = await this.resolveEffectiveAccessLevel(boxUserId, fileId, 'file');
      accessMap[fileId] = fileLevel || folderLevel || null;
    }

    return accessMap;
  }

  async _getCollaborationRole(boxUserId, resourceId, resourceType) {
    const collabs = await boxService.getResourceCollaborations(resourceId, resourceType);
    const match = collabs.find((c) => c.accessible_by?.id === boxUserId);
    return match?.role || null;
  }

  async _getParentFolderChain(resourceId, resourceType) {
    const client = boxService.getBoxClient();
    const chain = [];

    let parentId;
    if (resourceType === 'file') {
      const file = await client.files.getFileById(resourceId, {
        queryParams: { fields: ['parent'] },
      });
      parentId = file.parent?.id;
    } else {
      const folder = await client.folders.getFolderById(resourceId, {
        queryParams: { fields: ['parent'] },
      });
      parentId = folder.parent?.id;
    }

    while (parentId && parentId !== '0') {
      chain.push(parentId);
      const parent = await client.folders.getFolderById(parentId, {
        queryParams: { fields: ['parent'] },
      });
      parentId = parent.parent?.id;
    }

    return chain;
  }

  async _getVaultFolderIds(clientId) {
    return vaultDiscoveryService.getVaultFolderIds(clientId);
  }

  async _invalidateResourceCache(boxUserId, resourceId, resourceType) {
    await cacheLayer.invalidate(`boxcollab:${boxUserId}:${resourceType}:${resourceId}`);
    if (resourceType === 'file') {
      await cacheLayer.invalidate(`boxcollab:${boxUserId}:folder:${resourceId}`);
    }
  }
}

const boxCollaborationAccessService = new BoxCollaborationAccessService();
export default boxCollaborationAccessService;
