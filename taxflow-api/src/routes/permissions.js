/**
 * Permission routes — Granular file/folder access control management.
 * Employee/superadmin can set, view, and revoke permissions for clients.
 */

import express from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import permissionService from '../services/permissionService.js';
import notificationService from '../services/notificationService.js';
import projectService from '../services/projectService.js';

const router = express.Router();

/**
 * POST /api/permissions
 * Set or update permission for a client on a resource.
 * Auth: employee or superadmin only.
 * Sends email notification to the client about the permission change.
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

    // Send email notification to client about permission change
    try {
      const client = await projectService.getClient(clientId);
      if (client && client.email) {
        const displayName = resourceName || resourceId;
        notificationService.dispatch('permission_updated', client.email, {
          clientName: client.name,
          resourceName: displayName,
          resourceType,
          accessLevel,
          grantedBy: req.user.name || req.user.email || grantedBy,
        }).catch((err) => {
          console.error(`Permission notification failed for client ${clientId}:`, err.message);
        });
      }
    } catch (notifErr) {
      // Non-fatal — don't block the permission change if notification fails
      console.error('Permission notification error:', notifErr.message);
    }

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
