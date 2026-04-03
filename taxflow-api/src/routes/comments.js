/**
 * Comment routes — Document comments and employee search for @mentions.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.5, 10.7, 10.8
 */

import express from 'express';
import commentService from '../services/commentService.js';

const router = express.Router();

/**
 * GET /api/documents/:documentId/comments
 * Returns comments for a document.
 */
router.get('/documents/:documentId/comments', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const comments = commentService.getComments(documentId);
    res.json(comments);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/documents/:documentId/comments
 * Adds a comment. Validates type (review|internal) and text required.
 */
router.post('/documents/:documentId/comments', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { type, authorId, authorName, text, mentions } = req.body;

    if (!type || (type !== 'review' && type !== 'internal')) {
      return res.status(400).json({ error: 'Comment type must be "review" or "internal"' });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const comment = commentService.addComment(documentId, { type, authorId, authorName, text, mentions });
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
 * Edits a comment. Validates text required and requesterId required.
 */
router.put('/comments/:commentId', async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { text, requesterId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    if (!requesterId) {
      return res.status(400).json({ error: 'Missing required field: requesterId' });
    }

    const comment = commentService.editComment(commentId, { text, requesterId });
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
 * Employee name search with ?prefix= query param for @mention autocomplete.
 */
router.get('/employees/search', async (req, res, next) => {
  try {
    const { prefix } = req.query;
    const employees = commentService.searchEmployees(prefix || '');
    res.json(employees);
  } catch (error) {
    next(error);
  }
});

export default router;
