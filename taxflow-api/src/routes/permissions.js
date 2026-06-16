/**
 * Permission routes — Granular file/folder access control management.
 * Employee/superadmin can set, view, and revoke permissions for clients.
 */

import express from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import permissionService from '../services/permissionService.js';

const router = express.Router();

/**
 * POST /api/permissions
 * Set or update permission for a client on a resource.
 * Auth: employee or superadmin only.
 */
router.post('/', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { clientId, resourceId, resourceType, accessLevel, resourceName } = req.body;

    if (!clientId || !resourceId || !resourceType || !accessLevel) {
      return res.status(400).json({
        error: 'Missing required fields: clientId, resourceId, resourceType, accessLevel',
      });
    }

    const grantedBy = req.user.userId;
    const result = await permissionService.setPermission(
      clientId, resourceId, resourceType, accessLevel, grantedBy, resourceName
    );

    res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * GET /api/permissions/:clientId
 * Get all non-no_access permissions for a client.
 * Auth: employee or superadmin only.
 */
router.get('/:clientId', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const permissions = await permissionService.getClientPermissions(clientId);
    res.json({ clientId, permissions });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/permissions/:clientId/:resourceId
 * Get specific permission for a client-resource pair.
 * Auth: employee/superadmin or the client themselves.
 */
router.get('/:clientId/:resourceId', requireAuth, async (req, res, next) => {
  try {
    const { clientId, resourceId } = req.params;

    // Clients can only query their own permissions
    if (req.user.role === 'client' && req.user.userId !== clientId) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const permission = await permissionService.getPermission(clientId, resourceId);

    if (!permission || permission.accessLevel === 'no_access') {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json(permission);
  } catch (error) {
    next(error);
  }
});

export default router;
