/**
 * Document routes — version.
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
 * POST /api/documents/:fileId/upload-version
 * Upload an edited file as a new version to Box.
 * Preserves the original version in version history.
 */
router.post('/:fileId/upload-version', requireAuth, permissionCheck('writer'), assertStaffVaultFile, upload.single('file'), async (req, res, next) => {
  let tempFilePath = null;

  try {
    const { fileId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    tempFilePath = req.file.path;
    const client = boxService.getBoxClient();

    // Verify file exists
    let existingFile;
    try {
      existingFile = await client.files.getFileById(fileId);
    } catch (err) {
      const status = err.statusCode || err.status || (err.message?.includes('404') ? 404 : 500);
      if (status === 404) {
        return res.status(404).json({ error: 'File not found' });
      }
      throw err;
    }

    // Read file and upload as new version
    const fileBuffer = fs.readFileSync(tempFilePath);
    const fileStream = Readable.from(fileBuffer);

    const result = await client.uploads.uploadFileVersion(fileId, {
      attributes: { name: req.file.originalname || existingFile.name },
      file: fileStream,
    });

    // Clean up temp file
    try { fs.unlinkSync(tempFilePath); } catch { /* best effort */ }
    tempFilePath = null;

    const newVersion = result.entries?.[0] || result;

    // Invalidate relevant caches
    const parentId = existingFile.parent?.id;
    if (parentId) {
      cacheLayer.invalidate(`portal:client:`).catch(() => {});
    }

    res.status(201).json({
      fileId: newVersion.id || fileId,
      name: newVersion.name,
      size: newVersion.size,
      modifiedAt: newVersion.modified_at || new Date().toISOString(),
      message: 'New version uploaded successfully',
    });
  } catch (error) {
    if (tempFilePath) {
      try { fs.unlinkSync(tempFilePath); } catch { /* best effort */ }
    }
    next(error);
  }
});

// ─── EDIT SESSION AUDIT TRAIL ────────────────────────────────────────

export default router;
