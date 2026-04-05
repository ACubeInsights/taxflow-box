/**
 * Project routes — Client → Project → Document hierarchy endpoints.
 *
 * Requirements: 2.2, 3.1, 4.3, 5.1, 7.4, 7.5
 */

import express from 'express';
import projectService from '../services/projectService.js';

const router = express.Router();

/**
 * GET /api/admin/clients
 * Returns ALL clients (super admin only).
 */
router.get('/admin/clients', async (req, res, next) => {
  try {
    const clients = projectService.getAllClients();
    res.json(clients);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/employee/:employeeId/clients
 * Returns assigned clients with optional search/filter query params.
 */
router.get('/employee/:employeeId/clients', async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { search, status, entityType } = req.query;
    const clients = projectService.getEmployeeClients(employeeId, { search, status, entityType });
    res.json(clients);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/clients/:clientId/projects
 * Returns projects for a client.
 */
router.get('/clients/:clientId/projects', async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const projects = projectService.getClientProjects(clientId);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:projectId
 * Returns project detail. 404 if not found.
 */
router.get('/projects/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = projectService.getProjectDetail(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
});


/**
 * GET /api/projects/:projectId/documents
 * Returns project documents with optional ?status= filter (supports comma-separated statuses).
 */
router.get('/projects/:projectId/documents', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { status } = req.query;
    let statusFilter;
    if (status) {
      statusFilter = status.includes(',') ? status.split(',').map((s) => s.trim()) : status;
    }
    const documents = projectService.getProjectDocuments(projectId, { status: statusFilter });
    res.json(documents);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/documents
 * Creates a document request. Validates required fields: name, documentType, dueDate.
 */
router.post('/projects/:projectId/documents', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { name, description, priority, dueDate, documentType, isDraft } = req.body;

    const missing = [];
    if (!name || !name.trim()) missing.push('name');
    if (!documentType || !documentType.trim()) missing.push('documentType');
    if (!dueDate || !dueDate.trim()) missing.push('dueDate');

    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    const doc = projectService.createDocumentRequest(projectId, {
      name, description, priority, dueDate, documentType, isDraft,
    });
    res.status(201).json(doc);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/documents/check-duplicate
 * Checks for duplicate document requests. Requires documentType in body.
 */
router.post('/projects/:projectId/documents/check-duplicate', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { documentType } = req.body;

    if (!documentType) {
      return res.status(400).json({ error: 'Missing required field: documentType' });
    }

    const result = projectService.checkDuplicate(projectId, documentType);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
