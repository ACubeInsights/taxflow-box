/**
 * Project routes — Client → Project → Document hierarchy endpoints.
 */

import express from 'express';
import crypto from 'crypto';
import projectService from '../services/projectService.js';
import { getDb } from '../db/db.js';
import { hashPassword } from '../utils/authUtils.js';
import { requireAuth, requireRole, requireStaff } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/admin/clients/fix-missing
 * Superadmin-only recovery utility for orphaned signups.
 */
router.post(
  '/admin/clients/fix-missing',
  requireAuth,
  requireRole('superadmin'),
  async (req, res, next) => {
    try {
      const { email, name } = req.body;
      if (!email) return res.status(400).json({ error: 'email required' });

      const db = getDb();

      const existing = await db('clients').where('email', email).first();
      if (existing) return res.json({ message: 'Client already exists', client: existing });

      let user = await db('users').where('email', email).first();
      if (!user) {
        const userId = crypto.randomUUID();
        const clientName = name || email.split('@')[0];
        const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
        await db('users').insert({
          id: userId,
          email,
          name: clientName,
          role: 'client',
          password_hash: passwordHash,
          box_user_id: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        user = await db('users').where('id', userId).first();
      }

      const clientId = crypto.randomUUID();
      const clientName = name || user.name || email.split('@')[0];
      await db('clients').insert({
        id: clientId,
        name: clientName,
        email,
        entity_type: 'Individual',
        engagement_status: 'Active',
        box_folder_id: '',
        box_user_id: user.box_user_id || '',
        external_id: `CL-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const projectId = crypto.randomUUID();
      await db('projects').insert({
        id: projectId,
        client_id: clientId,
        name: `${new Date().getFullYear()} Tax Return`,
        description: `Tax filing for ${clientName}`,
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      res.status(201).json({ message: 'Client record created', clientId, projectId, userId: user.id });
    } catch (error) {
      next(error);
    }
  }
);

router.use(...requireStaff);

/**
 * GET /api/admin/clients
 */
router.get('/admin/clients', async (req, res, next) => {
  try {
    const { search, status, entityType } = req.query;
    const clients = await projectService.getAllClients({ search, status, entityType });
    res.json(clients);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/clients/:clientId/projects
 */
router.get('/clients/:clientId/projects', async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const projects = await projectService.getClientProjects(clientId);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:projectId
 */
router.get('/projects/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = await projectService.getProjectDetail(projectId);
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
 */
router.get('/projects/:projectId/documents', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { status } = req.query;
    let statusFilter;
    if (status) {
      statusFilter = status.includes(',') ? status.split(',').map((s) => s.trim()) : status;
    }
    const documents = await projectService.getProjectDocuments(projectId, { status: statusFilter });
    res.json(documents);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/documents
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

    const doc = await projectService.createDocumentRequest(projectId, {
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
 */
router.post('/projects/:projectId/documents/check-duplicate', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { documentType } = req.body;

    if (!documentType) {
      return res.status(400).json({ error: 'Missing required field: documentType' });
    }

    const result = await projectService.checkDuplicate(projectId, documentType);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
