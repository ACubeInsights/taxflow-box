/**
 * Token routes — Preview token generation for Box Content Preview.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4
 */

import express from 'express';
import tokenService from '../services/tokenService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/tokens/preview
 * Generate a downscoped preview token for Box Content Preview embedding.
 * Body: { fileId: string, userId: string }
 * Response: TokenResult (200) | 400 | 401 | 403 | 404 | 500
 */
router.post('/preview', requireAuth, async (req, res, next) => {
  try {
    const { fileId, userId } = req.body;

    if (!fileId || !userId) {
      return res.status(400).json({
        error: 'fileId and userId are required',
      });
    }

    const tokenResult = await tokenService.getPreviewToken(fileId, userId);
    res.json(tokenResult);
  } catch (error) {
    const statusCode = error.statusCode ?? error.status;

    if (statusCode === 404) {
      return res.status(404).json({ error: 'File not found' });
    }
    if (statusCode === 403) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next(error);
  }
});

export default router;
