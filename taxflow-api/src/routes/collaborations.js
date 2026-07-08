/**
 * Collaboration routes — Manage Box Editor collaborations for employees on client vaults.
 *
 * Employees are added as external collaborators (free) on Box Enterprise,
 * giving them full editing access to client documents via Office Online.
 */

import express from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { initDatabase } from '../db/db.js';
import boxService from '../services/boxService.js';
import { randomUUID } from 'crypto';

const router = express.Router();

/**
 * PUT /api/employees/:id/box-email
 * Set or update an employee's Box login email (their free Box account).
 */
router.put('/employees/:id/box-email', requireAuth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { boxLoginEmail } = req.body;

    if (!boxLoginEmail || !boxLoginEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid boxLoginEmail is required' });
    }

    const db = await initDatabase();
    const user = await db('users').where('id', id).first();

    if (!user) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (user.role === 'client') {
      return res.status(400).json({ error: 'Cannot set Box email for client users' });
    }

    await db('users').where('id', id).update({
      box_login_email: boxLoginEmail.trim().toLowerCase(),
      updated_at: new Date().toISOString(),
    });

    res.json({ userId: id, boxLoginEmail: boxLoginEmail.trim().toLowerCase() });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/employees/:id/box-email
 * Get an employee's Box login email.
 */
router.get('/employees/:id/box-email', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = await initDatabase();
    const user = await db('users').where('id', id).select('id', 'name', 'email', 'box_login_email').first();

    if (!user) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ userId: user.id, name: user.name, email: user.email, boxLoginEmail: user.box_login_email || null });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/clients/:clientId/collaborators
 * Add an employee as Editor collaborator on a client's Box vault.
 */
router.post('/clients/:clientId/collaborators', requireAuth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Missing required field: employeeId' });
    }

    const db = await initDatabase();

    // Look up employee's Box email
    const employee = await db('users').where('id', employeeId).first();
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const boxEmail = employee.box_login_email || employee.email;
    if (!boxEmail) {
      return res.status(400).json({ error: 'Employee does not have a Box login email configured' });
    }

    // Look up client's vault root folder
    const vault = await db('client_vaults').where('client_id', clientId).first();
    if (!vault) {
      return res.status(404).json({ error: 'Client vault not found' });
    }

    const folderId = vault.root_folder_id;

    // Check if collaboration already exists locally
    const existing = await db('box_collaborations')
      .where({ employee_id: employeeId, client_id: clientId, status: 'active' })
      .first();

    if (existing) {
      return res.json({
        collaborationId: existing.id,
        boxCollaborationId: existing.box_collaboration_id,
        employeeId,
        clientId,
        folderId,
        role: existing.role,
        status: 'active',
        message: 'Collaboration already exists',
      });
    }

    // Check if a revoked collaboration exists (re-activate it)
    const revoked = await db('box_collaborations')
      .where({ employee_id: employeeId, client_id: clientId, status: 'revoked' })
      .first();

    // Add collaborator via Box API
    const boxCollabId = await boxService.addCollaboratorWithId(folderId, boxEmail, 'editor');

    if (revoked) {
      // Reactivate the existing record
      await db('box_collaborations').where('id', revoked.id).update({
        box_collaboration_id: boxCollabId || revoked.box_collaboration_id,
        employee_email: boxEmail,
        status: 'active',
        revoked_at: null,
        created_at: new Date().toISOString(),
      });

      return res.status(201).json({
        collaborationId: revoked.id,
        boxCollaborationId: boxCollabId,
        employeeId,
        clientId,
        folderId,
        role: 'editor',
        status: 'active',
      });
    }

    // Store new collaboration locally
    const id = randomUUID();
    const now = new Date().toISOString();

    await db('box_collaborations').insert({
      id,
      employee_id: employeeId,
      client_id: clientId,
      folder_id: folderId,
      box_collaboration_id: boxCollabId || null,
      employee_email: boxEmail,
      role: 'editor',
      status: 'active',
      created_at: now,
    });

    res.status(201).json({
      collaborationId: id,
      boxCollaborationId: boxCollabId,
      employeeId,
      clientId,
      folderId,
      role: 'editor',
      status: 'active',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/clients/:clientId/collaborators/:employeeId
 * Remove an employee's collaboration on a client's vault.
 */
router.delete('/clients/:clientId/collaborators/:employeeId', requireAuth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { clientId, employeeId } = req.params;
    const db = await initDatabase();

    const collab = await db('box_collaborations')
      .where({ employee_id: employeeId, client_id: clientId, status: 'active' })
      .first();

    if (!collab) {
      return res.status(404).json({ error: 'Active collaboration not found' });
    }

    // Remove from Box
    if (collab.box_collaboration_id) {
      try {
        const client = boxService.getBoxClient();
        await client.userCollaborations.deleteCollaborationById(collab.box_collaboration_id);
      } catch (err) {
        // If Box says 404 (already gone), proceed with local cleanup
        if (err.statusCode !== 404) {
          console.error('Box collaboration delete failed:', err.message);
        }
      }
    }

    // Mark as revoked locally
    await db('box_collaborations')
      .where('id', collab.id)
      .update({ status: 'revoked', revoked_at: new Date().toISOString() });

    res.json({ message: 'Collaboration revoked', employeeId, clientId });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/clients/:clientId/collaborators
 * List active collaborators on a client's vault.
 */
router.get('/clients/:clientId/collaborators', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const db = await initDatabase();

    const collabs = await db('box_collaborations')
      .join('users', 'users.id', 'box_collaborations.employee_id')
      .where({ 'box_collaborations.client_id': clientId, 'box_collaborations.status': 'active' })
      .select(
        'box_collaborations.id as collaborationId',
        'box_collaborations.employee_id as employeeId',
        'users.name as employeeName',
        'box_collaborations.employee_email as boxEmail',
        'box_collaborations.role',
        'box_collaborations.status',
        'box_collaborations.created_at as addedAt'
      );

    res.json({ clientId, collaborators: collabs });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/employees/:id/sync-collaborations
 * Bulk-add employee as collaborator on all their assigned clients.
 */
router.post('/employees/:id/sync-collaborations', requireAuth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = await initDatabase();

    // Get employee's Box email
    const employee = await db('users').where('id', id).first();
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const boxEmail = employee.box_login_email || employee.email;
    if (!boxEmail) {
      return res.status(400).json({ error: 'Employee does not have a Box login email configured' });
    }

    // Find all clients assigned to this employee via projects
    const projects = await db('projects').where('created_by', id).select('client_id').distinct();
    const clientIds = projects.map(p => p.client_id).filter(Boolean);

    if (clientIds.length === 0) {
      return res.json({ employeeId: id, totalClients: 0, succeeded: 0, alreadyExists: 0, failed: 0 });
    }

    // Get vault folders for these clients
    const vaults = await db('client_vaults').whereIn('client_id', clientIds).select('client_id', 'root_folder_id');
    const vaultMap = Object.fromEntries(vaults.map(v => [v.client_id, v.root_folder_id]));

    const results = { totalClients: clientIds.length, succeeded: 0, alreadyExists: 0, failed: 0 };

    for (const clientId of clientIds) {
      const folderId = vaultMap[clientId];
      if (!folderId) { results.failed++; continue; }

      // Check if already exists
      const existing = await db('box_collaborations')
        .where({ employee_id: id, client_id: clientId, status: 'active' })
        .first();

      if (existing) { results.alreadyExists++; continue; }

      try {
        const boxCollabId = await boxService.addCollaboratorWithId(folderId, boxEmail, 'editor');
        const collabId = randomUUID();

        await db('box_collaborations').insert({
          id: collabId,
          employee_id: id,
          client_id: clientId,
          folder_id: folderId,
          box_collaboration_id: boxCollabId || null,
          employee_email: boxEmail,
          role: 'editor',
          status: 'active',
          created_at: new Date().toISOString(),
        });

        results.succeeded++;
      } catch (err) {
        console.error(`Collaboration sync failed for client ${clientId}:`, err.message);
        results.failed++;
      }
    }

    res.json({ employeeId: id, ...results });
  } catch (error) {
    next(error);
  }
});

export default router;
