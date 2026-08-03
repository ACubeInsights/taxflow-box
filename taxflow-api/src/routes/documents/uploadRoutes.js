/**
 * Document routes — upload.
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
 * POST /api/documents/upload
 * Upload a document to a client's vault.
 * Files < 20MB: direct upload. Files >= 20MB: chunked upload.
 * Body (multipart/form-data): { file, folderId, requestId? }
 * Multer must run before validateUploadFolder so folderId is available from multipart body.
 */
router.post('/upload', requireAuth, upload.single('file'), validateUploadFolder, async (req, res, next) => {
  let tempFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { folderId, requestId } = req.body;

    if (!folderId) {
      return res.status(400).json({ error: 'Missing folderId' });
    }

    let docRequest = null;
    if (requestId) {
      docRequest = await projectService.getDocument(requestId);
      if (!docRequest) {
        return res.status(404).json({ error: 'Document request not found' });
      }
      if (req.user.role === 'client' && req.clientId && docRequest.clientId !== req.clientId) {
        return res.status(404).json({ error: 'Resource not found' });
      }
    }

    tempFilePath = req.file.path;
    const fileSize = req.file.size;

    // Read file into buffer for upload
    const fileBuffer = fs.readFileSync(tempFilePath);

    // Upload to Box (routes to direct or chunked based on size)
    const file = await boxService.uploadFile(
      folderId,
      path.basename(req.file.originalname || 'upload'),
      fileBuffer
    );

    // Clean up temp file
    try { fs.unlinkSync(tempFilePath); } catch { /* best effort */ }
    tempFilePath = null;

    // Link upload to document request: Box metadata is source of truth for status,
    // but DB index must update even if metadata write fails (invalid enum, etc.).
    if (docRequest) {
      try {
        await boxDocumentStatusService.applyUploadMetadata(file.id, {
          requestId: docRequest.id,
          clientId: docRequest.clientId,
          documentType: docRequest.documentType,
          financialYear: new Date().getFullYear().toString(),
          priority: docRequest.priority,
        });
      } catch (metaErr) {
        logger.error('Failed to write Box upload metadata:', metaErr.message);
      }

      try {
        if (isBoxFirstSchema()) {
          await boxDocumentRequestService.updateStatus(
            requestId,
            'Uploaded',
            docRequest.version || 1,
            {
              clientId: docRequest.clientId,
              uploadedFileName: file.name,
              fileId: String(file.id),
            }
          );
        } else {
          const db = getDb();
          await db('document_requests')
            .where('id', requestId)
            .update({
              status: 'Uploaded',
              box_file_id: file.id,
              uploaded_file_name: file.name,
              version: db.raw('version + 1'),
              updated_at: new Date().toISOString(),
            });
        }
      } catch (dbErr) {
        logger.error('Failed to update document request after upload:', dbErr.message);
      }
    }

    // In-app staff alert for client uploads (does not depend on Box webhooks)
    if (req.user?.role === 'client') {
      try {
        const clientId = docRequest?.clientId || req.clientId;
        let clientName = 'Client';
        try {
          const repos = getRepositories();
          if (clientId && repos.clientRepo) {
            const client = await repos.clientRepo.findById(clientId);
            if (client?.name) clientName = client.name;
          }
        } catch { /* ignore */ }

        const recipients = await resolveStaffUploadRecipients(clientId, docRequest?.createdBy);
        const documentName = file.name || 'Document';
        await Promise.all(
          recipients.map((employeeId) =>
            notificationService.dispatchUploadNotification(employeeId, clientName, documentName)
          )
        );
      } catch (notifyErr) {
        logger.warn('Staff upload notification failed', { error: notifyErr.message });
      }
    }

    res.status(201).json({
      message: 'Document uploaded successfully',
      file: {
        id: file.id,
        name: file.name,
        size: file.size || fileSize,
        createdAt: file.created_at,
      },
      uploadMethod: fileSize >= BoxService.CHUNKED_THRESHOLD ? 'chunked' : 'direct',
      requestId,
    });
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath) {
      try { fs.unlinkSync(tempFilePath); } catch { /* best effort */ }
    }
    next(error);
  }
});

export default router;
