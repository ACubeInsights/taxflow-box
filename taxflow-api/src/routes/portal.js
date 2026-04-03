/**
 * Portal routes — Client progress, employee dashboard, CXO portfolio,
 * inactive clients, file versions, and zip downloads.
 *
 * Requirements: 19.1, 20.1, 21.1, 22.1, 23.1, 24.1
 */

import express from 'express';
import portalService from '../services/portalService.js';
import projectService from '../services/projectService.js';

const router = express.Router();

/**
 * GET /api/portal/client/:clientId/progress
 * Client progress via metadata query.
 */
router.get('/client/:clientId/progress', async (req, res, next) => {
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
 * Employee dashboard: pending reviews sorted by priority.
 */
router.get('/employee/:employeeId/dashboard', async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const result = await portalService.getEmployeeDashboard(employeeId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/portal/cxo/portfolio
 * CXO portfolio: cross-client aggregation with pagination.
 */
router.get('/cxo/portfolio', async (req, res, next) => {
  try {
    const { cursor, limit } = req.query;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const result = await portalService.getCXOPortfolio(cursor, parsedLimit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/portal/inactive-clients
 * Detect clients with no activity within threshold.
 */
router.get('/inactive-clients', async (req, res, next) => {
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
 * File version history sorted by version number descending.
 */
router.get('/files/:fileId/versions', async (req, res, next) => {
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
 * Create zip download. Validates max 100 files.
 */
router.post('/zip-download', async (req, res, next) => {
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
 * Employee summary metrics via projectService.getEmployeeSummary.
 */
router.get('/employee/:employeeId/summary', async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const summary = projectService.getEmployeeSummary(employeeId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/portal/employee/:employeeId/activity
 * Activity feed via projectService.getEmployeeActivity with optional ?limit= param.
 */
router.get('/employee/:employeeId/activity', async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const activity = projectService.getEmployeeActivity(employeeId, limit);
    res.json(activity);
  } catch (error) {
    next(error);
  }
});

export default router;
