/**
 * Portal routes — Client progress, employee dashboard, inactive clients,
 * file versions, and zip downloads.
 */

import express from 'express';
import portalService from '../services/portalService.js';
import projectService from '../services/projectService.js';
import {
  requireAuth,
  requireRole,
  requireClientAccess,
  requireEmployeeSelfOrAdmin,
} from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/portal/client/:clientId/progress
 */
router.get('/client/:clientId/progress', requireClientAccess, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const result = await portalService.getClientProgress(clientId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/portal/employee/:employeeId/dashboard
 */
router.get(
  '/employee/:employeeId/dashboard',
  requireRole('employee', 'superadmin'),
  requireEmployeeSelfOrAdmin('employeeId'),
  async (req, res, next) => {
    try {
      const { employeeId } = req.params;
      const result = await portalService.getEmployeeDashboard(employeeId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/portal/inactive-clients
 */
router.get('/inactive-clients', requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { thresholdDays } = req.query;
    const parsed = thresholdDays ? parseInt(thresholdDays, 10) : undefined;
    const result = await portalService.getInactiveClients(parsed);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/portal/files/:fileId/versions
 */
router.get('/files/:fileId/versions', requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const result = await portalService.getFileVersions(fileId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/portal/zip-download
 */
router.post('/zip-download', requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { fileIds } = req.body;

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'fileIds must be a non-empty array' });
    }

    if (fileIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 files per zip download' });
    }

    const result = await portalService.createZipDownload(fileIds);
    res.json(result);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * GET /api/portal/employee/:employeeId/summary
 */
router.get(
  '/employee/:employeeId/summary',
  requireRole('employee', 'superadmin'),
  requireEmployeeSelfOrAdmin('employeeId'),
  async (req, res, next) => {
    try {
      const { employeeId } = req.params;
      const summary = await projectService.getEmployeeSummary(employeeId);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/portal/employee/:employeeId/activity
 */
router.get(
  '/employee/:employeeId/activity',
  requireRole('employee', 'superadmin'),
  requireEmployeeSelfOrAdmin('employeeId'),
  async (req, res, next) => {
    try {
      const { employeeId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
      const activity = await projectService.getEmployeeActivity(employeeId, limit);
      res.json(activity);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
