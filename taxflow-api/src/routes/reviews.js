/**
 * Review routes — Document approval, rejection, waive, bulk approve, and internal notes.
 *
 * Requirements: 12.1, 13.1, 14.1, 15.1, 17.1
 */

import express from 'express';
import reviewService from '../services/reviewService.js';
import statusTransitionService from '../services/statusTransitionService.js';
import { requireStaff } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(...requireStaff);

/**
 * POST /api/reviews/documents/bulk-transition
 * Bulk status change.
 */
router.post('/documents/bulk-transition', async (req, res, next) => {
  try {
    const { documentIds, toStatus } = req.body;
    const employeeId = req.user.userId;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'documentIds must be a non-empty array' });
    }
    if (!toStatus) {
      return res.status(400).json({ error: 'Missing required field: toStatus' });
    }

    const result = await statusTransitionService.bulkTransition(documentIds, { toStatus, employeeId });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reviews/documents/:documentId/transition
 * Status transition with optimistic concurrency.
 */
router.post('/documents/:documentId/transition', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { toStatus, version, comment } = req.body;
    const employeeId = req.user.userId;

    if (!toStatus) {
      return res.status(400).json({ error: 'Missing required field: toStatus' });
    }
    if (version === undefined || version === null) {
      return res.status(400).json({ error: 'Missing required field: version' });
    }

    const result = await statusTransitionService.transitionStatus(documentId, {
      toStatus, employeeId, version, comment,
    });
    res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /api/reviews/bulk-approve
 * Bulk approve documents with max concurrency of 5.
 */
router.post('/bulk-approve', async (req, res, next) => {
  try {
    const { fileIds } = req.body;
    const employeeId = req.user.userId;

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'fileIds must be a non-empty array' });
    }

    const result = await reviewService.bulkApprove(fileIds, employeeId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reviews/:fileId/approve
 */
router.post('/:fileId/approve', async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const result = await reviewService.approveDocument(fileId, req.user.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reviews/:fileId/reject
 */
router.post('/:fileId/reject', async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const result = await reviewService.rejectDocument(fileId, req.user.userId, reason);
    res.json(result);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /api/reviews/:fileId/waive
 */
router.post('/:fileId/waive', async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { reason } = req.body;
    const result = await reviewService.waiveDocument(fileId, req.user.userId, reason || '');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reviews/:fileId/undo-approve
 */
router.post('/:fileId/undo-approve', async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { version } = req.body;

    if (version === undefined || version === null) {
      return res.status(400).json({ error: 'Missing required field: version' });
    }

    const result = await statusTransitionService.undoApproval(fileId, req.user.userId, version);
    res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /api/reviews/:clientFolderId/notes
 */
router.post('/:clientFolderId/notes', async (req, res, next) => {
  try {
    const { clientFolderId } = req.params;
    const { subject, content } = req.body;
    const author = req.user.name || req.user.email;

    const missing = [];
    if (!subject) missing.push('subject');
    if (!content) missing.push('content');

    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    const result = await reviewService.createInternalNote(clientFolderId, author, subject, content);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reviews/:clientFolderId/notes
 */
router.get('/:clientFolderId/notes', async (req, res, next) => {
  try {
    const { clientFolderId } = req.params;
    const notes = await reviewService.listInternalNotes(clientFolderId);
    res.json(notes);
  } catch (error) {
    next(error);
  }
});

export default router;
