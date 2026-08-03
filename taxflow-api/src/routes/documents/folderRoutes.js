/**
 * Document routes — folder.
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
 * GET /api/documents/:folderId
 * Get all documents in a folder (alias for vaults route)
 */
router.get('/:folderId', requireAuth, validateFolderOwnership, async (req, res, next) => {
  try {
    const { folderId } = req.params;

    const files = await boxService.listFiles(folderId);

    res.json({
      documents: files.map(file => ({
        id: file.id,
        name: file.name,
        size: file.size,
        createdAt: file.created_at,
        modifiedAt: file.modified_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ─── DOCUMENT EDITING ENDPOINTS ──────────────────────────────────────

export default router;
