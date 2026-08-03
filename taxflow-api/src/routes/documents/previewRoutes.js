/**
 * Document routes — preview.
 */

import express from 'express';
import {
  requireAuth,
  requireRole,
  permissionCheck,
  validateFolderOwnership,
  validateUploadFolder,
  boxService,
  BoxService,
  getDb,
  config,
  cacheLayer,
  projectService,
  boxDocumentStatusService,
  boxDocumentRequestService,
  isBoxFirstSchema,
  vaultResourceGuard,
  notificationService,
  getRepositories,
  logger,
  fs,
  path,
  crypto,
  Readable,
  upload,
  resolveStaffUploadRecipients,
  assertStaffVaultFile,
} from './shared.js';

const router = express.Router();

/**
 * GET /api/documents/:fileId/preview-token
 * Generates a downscoped access token for Box Content Preview with annotations.
 * Scopes: base_preview, annotation_view_all, annotation_edit, item_download
 * Token is file-specific and cached per user for 50 minutes.
 */
router.get('/:fileId/preview-token', requireAuth, permissionCheck('viewer'), assertStaffVaultFile, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const cacheKey = `doc:preview-token:${req.user.userId}:${fileId}`;


    // Check cache first
    const cached = await cacheLayer.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const client = boxService.getBoxClient();

    // Verify file exists
    try {
      await client.files.getFileById(fileId);
    } catch (err) {
      const status = err.statusCode || err.status || (err.message?.includes('404') ? 404 : 500);
      if (status === 404) {
        return res.status(404).json({ error: 'File not found' });
      }
      throw err;
    }

    // Downscope token for preview + annotations
    const resourceUrl = `https://api.box.com/2.0/files/${fileId}`;
    const scopes = ['base_preview', 'annotation_view_all', 'annotation_edit', 'item_download'];

    const tokenInfo = await client.auth.downscopeToken(scopes, resourceUrl);

    const accessToken = tokenInfo.accessToken ?? tokenInfo.access_token;
    const expiresIn = tokenInfo.expiresIn ?? tokenInfo.expires_in ?? 3600;

    const result = {
      accessToken,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      tokenType: 'bearer',
      permissions: scopes,
    };

    // Cache for 50 minutes (of 60-minute token TTL)
    await cacheLayer.set(cacheKey, result, 3000);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
