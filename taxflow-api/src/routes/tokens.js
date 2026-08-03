/**
 * Token routes — Preview token generation for Box Content Preview.
 */

import express from 'express';
import tokenService from '../services/tokenService.js';
import { requireAuth, permissionCheck, bindBodyResourceParam } from '../middleware/authMiddleware.js';
import vaultResourceGuard from '../services/vaultResourceGuard.js';

const router = express.Router();

/**
 * POST /api/tokens/preview
 * Body: { fileId: string }
 */
router.post(
  '/preview',
  requireAuth,
  bindBodyResourceParam('fileId', 'fileId'),
  permissionCheck('viewer'),
  async (req, res, next) => {
    try {
      const { fileId } = req.body;
      const userId = req.user.userId;

      if (['employee', 'superadmin'].includes(req.user.role)) {
        await vaultResourceGuard.assertKnownVaultFile(String(fileId));
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
  }
);

export default router;
