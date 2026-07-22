/**
 * Auth middleware — validates session tokens on protected routes.
 * Attaches req.user with { userId, email, name, role }.
 */

import authService from '../services/authService.js';
import { getRepositories } from '../db/repositories/index.js';
import permissionService from '../services/permissionService.js';
import vaultDiscoveryService from '../services/vaultDiscoveryService.js';
import { isMinimalSchema } from '../db/schemaMode.js';
import { config } from '../config.js';

/**
 * Requires a valid session. Rejects with 401 if missing/expired.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);

  // Support demo/mock tokens only when explicitly enabled (never in production)
  if (config.nodeEnv !== 'production' && config.allowMockAuth) {
    const mockMatch = token.match(/^mock-token-(superadmin|employee|client)-/);
    if (mockMatch) {
      req.user = {
        userId: `demo-${mockMatch[1]}`,
        email: `${mockMatch[1]}@demo.taxflow`,
        name: `Demo ${mockMatch[1]}`,
        role: mockMatch[1],
      };
      return next();
    }
  }

  const session = await authService.validateSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  req.user = {
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
  };

  next();
}

/**
 * Requires one of the specified roles. Must be used after requireAuth.
 * @param  {...string} roles - Allowed roles (e.g., 'superadmin', 'employee')
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }

    next();
  };
}

/**
 * Validates that the requesting client has permission to access the folder.
 * Employees/superadmins bypass this check.
 * Uses Box collaborations as source of truth (Phase 2c), with vault/DB fallback.
 * Must be used after requireAuth.
 */
export async function validateFolderOwnership(req, res, next) {
  try {
    if (['employee', 'superadmin'].includes(req.user.role)) {
      return next();
    }

    const folderId = req.params.folderId;
    const client = await resolveClientForUser(req.user);

    if (!client) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Check Box collaboration access for this folder
    const hasAccess = await permissionService.hasAccess(client.id, folderId, 'viewer', 'folder');
    if (hasAccess) {
      req.clientId = client.id;
      return next();
    }

    // Fallback: discover vault folders from Box (legacy clients without explicit collabs)
    const vault = await vaultDiscoveryService.getVaultForClient(client.id);
    if (vault) {
      const vaultFolderIds = [
        vault.root,
        vault.year,
        vault.projects,
        vault.tax,
        vault.uploads,
        vault.supportingDocs,
        vault.signedDocuments,
        vault.internalNotes,
      ].filter(Boolean);

      if (vaultFolderIds.includes(folderId)) {
        req.clientId = client.id;
        return next();
      }
    }

    // No access via either method
    return res.status(404).json({ error: 'Resource not found' });
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware factory that checks granular permissions for client users on file operations.
 * Employees/superadmins bypass this check.
 * Uses Box collaborations with parent-folder inheritance.
 * @param {string} requiredLevel - Minimum access level required ('viewer','commenter','writer','delete')
 */
export function permissionCheck(requiredLevel) {
  const LEVEL_HIERARCHY = { no_access: 0, viewer: 1, commenter: 2, writer: 3, delete: 4 };

  return async (req, res, next) => {
    if (['employee', 'superadmin'].includes(req.user?.role)) {
      return next();
    }

    try {
      const resourceId = req.params.folderId || req.params.fileId;
      const resourceType = req.params.fileId ? 'file' : 'folder';

      if (!resourceId) return next();

      const client = await resolveClientForUser(req.user);

      if (!client) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      const hasAccess = await permissionService.hasAccess(
        client.id,
        resourceId,
        requiredLevel,
        resourceType
      );
      if (hasAccess) {
        req.clientId = client.id;
        return next();
      }

      // DB fallback: any folder permission at or above required level
      const allPerms = await permissionService.getClientPermissions(client.id);
      const requiredNum = LEVEL_HIERARCHY[requiredLevel] || 1;
      const hasFolderAccess = allPerms.some(
        (p) => p.resourceType === 'folder' && (LEVEL_HIERARCHY[p.accessLevel] || 0) >= requiredNum
      );

      if (hasFolderAccess) {
        req.clientId = client.id;
        return next();
      }

      return res.status(404).json({ error: 'Resource not found' });
    } catch (err) {
      next(err);
    }
  };
}

/** Staff-only shorthand: requireAuth + employee or superadmin */
export const requireStaff = [requireAuth, requireRole('employee', 'superadmin')];

/**
 * Resolves the clients-table record for the authenticated client user.
 * @param {object} user - req.user
 * @returns {Promise<object|null>}
 */
export async function resolveClientForUser(user) {
  const repos = getRepositories();
  if (isMinimalSchema()) {
    let clientUser = await repos.userRepo.findByEmail(user.email);
    if (!clientUser) clientUser = await repos.userRepo.findByBoxUserId(user.userId);
    if (clientUser?.role === 'client') {
      return {
        id: clientUser.id,
        email: clientUser.email,
        name: clientUser.name,
        external_id: clientUser.external_id,
        box_user_id: clientUser.box_user_id,
        box_folder_id: clientUser.box_folder_id,
      };
    }
    return null;
  }
  let client = await repos.clientRepo.findByEmail(user.email);
  if (!client) client = await repos.clientRepo.findByBoxUserId(user.userId);
  return client;
}

/**
 * Employees/superadmins pass; clients may only access their own clientId param.
 */
export async function requireClientAccess(req, res, next) {
  try {
    if (['employee', 'superadmin'].includes(req.user.role)) {
      return next();
    }
    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const client = await resolveClientForUser(req.user);
    if (client && client.id === req.params.clientId) {
      req.clientId = client.id;
      return next();
    }
    return res.status(404).json({ error: 'Resource not found' });
  } catch (err) {
    next(err);
  }
}

/**
 * Superadmin may access any employee; employees may only access their own id param.
 * @param {string} [paramName='employeeId']
 */
export function requireEmployeeSelfOrAdmin(paramName = 'employeeId') {
  return (req, res, next) => {
    if (req.user.role === 'superadmin') return next();
    if (req.user.role === 'employee' && req.params[paramName] === req.user.userId) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied' });
  };
}

/**
 * Validates upload target folderId in req.body for client users.
 * Must run after requireAuth.
 */
export async function validateUploadFolder(req, res, next) {
  if (['employee', 'superadmin'].includes(req.user.role)) {
    return next();
  }
  const folderId = req.body?.folderId;
  if (!folderId) {
    return res.status(400).json({ error: 'Missing folderId' });
  }
  req.params.folderId = folderId;
  return validateFolderOwnership(req, res, next);
}
