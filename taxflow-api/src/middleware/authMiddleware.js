/**
 * Auth middleware — validates session tokens on protected routes.
 * Attaches req.user with { userId, email, name, role }.
 */

import authService from '../services/authService.js';
import { getRepositories } from '../db/repositories/index.js';
import permissionService from '../services/permissionService.js';

/**
 * Requires a valid session. Rejects with 401 if missing/expired.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);

  // Support demo/mock tokens (format: mock-token-{role}-{timestamp})
  const mockMatch = token.match(/^mock-token-(superadmin|cxo|employee|client)-/);
  if (mockMatch) {
    req.user = {
      userId: `demo-${mockMatch[1]}`,
      email: `${mockMatch[1]}@demo.taxflow`,
      name: `Demo ${mockMatch[1]}`,
      role: mockMatch[1],
    };
    return next();
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
 * Uses the resource_permissions table for granular access control.
 * Must be used after requireAuth.
 */
export async function validateFolderOwnership(req, res, next) {
  try {
    // Employees and superadmins bypass folder ownership checks
    if (['employee', 'superadmin'].includes(req.user.role)) {
      return next();
    }

    let repos;
    try {
      repos = getRepositories();
    } catch {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    const { clientRepo } = repos;
    const userId = req.user.userId;
    const userEmail = req.user.email;
    const folderId = req.params.folderId;

    // Resolve client record from the clients table (not users table)
    let client = await clientRepo.findByEmail(userEmail);
    if (!client) client = await clientRepo.findById(userId);
    if (!client) client = await clientRepo.findByBoxUserId(userId);

    if (!client) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Check granular permission for this folder
    const hasAccess = await permissionService.hasAccess(client.id, folderId, 'viewer');
    if (!hasAccess) {
      // Return 404 (not 403) to prevent resource enumeration
      return res.status(404).json({ error: 'Resource not found' });
    }

    req.clientId = client.id;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware factory that checks granular permissions for client users on file operations.
 * Employees/superadmins bypass this check.
 * @param {string} requiredLevel - Minimum access level required ('viewer','commenter','writer','delete')
 */
export function permissionCheck(requiredLevel) {
  return async (req, res, next) => {
    // Employees and superadmins bypass permission checks
    if (['employee', 'superadmin'].includes(req.user?.role)) {
      return next();
    }

    try {
      const repos = getRepositories();
      const { clientRepo } = repos;
      const userId = req.user.userId;
      const userEmail = req.user.email;
      const resourceId = req.params.folderId || req.params.fileId;

      if (!resourceId) return next();

      // Resolve client from clients table (by email first, then by ID)
      let client = await clientRepo.findByEmail(userEmail);
      if (!client) client = await clientRepo.findById(userId);
      if (!client) client = await clientRepo.findByBoxUserId(userId);

      if (!client) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      const hasAccess = await permissionService.hasAccess(client.id, resourceId, requiredLevel);
      if (!hasAccess) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      req.clientId = client.id;
      next();
    } catch (err) {
      next(err);
    }
  };
}
