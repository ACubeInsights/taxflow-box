/**
 * Review routes — Document approval, rejection, waive, bulk approve, and internal notes.
 *
 * Requirements: 12.1, 13.1, 14.1, 15.1, 17.1
 */

import express from 'express';
import reviewService from '../services/reviewService.js';

const router = express.Router();

/**
 * POST /api/reviews/:fileId/approve
 * Approve a document: updates metadata and completes task.
 */
router.post('/:fileId/approve', async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Missing required field: employeeId' });
    }

    const result = await reviewService.approveDocument(fileId, employeeId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reviews/:fileId/reject
 * Reject a document: updates metadata with comments, creates file comment.
 * Requires non-empty reason.
 */
router.post('/:fileId/reject', async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { employeeId, reason } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Missing required field: employeeId' });
    }
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const result = await reviewService.rejectDocument(fileId, employeeId, reason);
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
 * Waive a document requirement: updates metadata and completes task.
 */
router.post('/:fileId/waive', async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { employeeId, reason } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Missing required field: employeeId' });
    }

    const result = await reviewService.waiveDocument(fileId, employeeId, reason || '');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reviews/bulk-approve
 * Bulk approve documents with max concurrency of 5.
 */
router.post('/bulk-approve', async (req, res, next) => {
  try {
    const { fileIds, employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Missing required field: employeeId' });
    }
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
 * POST /api/reviews/:clientFolderId/notes
 * Create an internal note in the InternalNotes subfolder.
 */
router.post('/:clientFolderId/notes', async (req, res, next) => {
  try {
    const { clientFolderId } = req.params;
    const { author, subject, content } = req.body;

    const missing = [];
    if (!author) missing.push('author');
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
 * List internal notes sorted by creation date descending.
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
