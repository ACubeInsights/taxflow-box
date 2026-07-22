/**
 * Comment routes — Document comments and employee search for @mentions.
 */

import express from 'express';
import commentService from '../services/commentService.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/documents/:documentId/comments
 */
router.get('/documents/:documentId/comments', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const comments = await commentService.getComments(documentId);
    res.json(comments);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/documents/:documentId/comments
 */
router.post('/documents/:documentId/comments', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { type, text, mentions } = req.body;

    if (!type || (type !== 'review' && type !== 'internal')) {
      return res.status(400).json({ error: 'Comment type must be "review" or "internal"' });
    }
    if (type === 'internal' && !['employee', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const comment = await commentService.addComment(documentId, {
      type,
      authorId: req.user.userId,
      authorName: req.user.name || req.user.email,
      text,
      mentions,
    });
    res.status(201).json(comment);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * PUT /api/comments/:commentId
 */
router.put('/comments/:commentId', async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const comment = await commentService.editComment(commentId, {
      text,
      requesterId: req.user.userId,
    });
    res.json(comment);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * GET /api/employees/search
 */
router.get('/employees/search', requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { prefix } = req.query;
    const employees = commentService.searchEmployees(prefix || '');
    res.json(employees);
  } catch (error) {
    next(error);
  }
});

export default router;
