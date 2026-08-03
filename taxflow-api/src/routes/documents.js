import express from 'express';
import multer from 'multer';
import boxService from '../services/boxService.js';
import { BoxService } from '../services/boxService.js';
import { getDb } from '../db/db.js';
import { requireAuth, requireRole, permissionCheck, validateFolderOwnership, validateUploadFolder } from '../middleware/authMiddleware.js';
import { config } from '../config.js';
import cacheLayer from '../services/cacheLayer.js';
import projectService from '../services/projectService.js';
import boxDocumentStatusService from '../services/boxDocumentStatusService.js';
import boxDocumentRequestService from '../services/boxDocumentRequestService.js';
import { isBoxFirstSchema } from '../db/schemaMode.js';
import vaultResourceGuard from '../services/vaultResourceGuard.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { Readable } from 'stream';

const router = express.Router();

/** Staff must only touch files inside known client vaults */
async function assertStaffVaultFile(req, res, next) {
  try {
    if (['employee', 'superadmin'].includes(req.user?.role)) {
      await vaultResourceGuard.assertKnownVaultFile(req.params.fileId);
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Upload temp directory
const UPLOAD_TEMP_DIR = path.join(os.tmpdir(), 'taxflow-uploads');
if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
  fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

/**
 * Safe disk filename: UUID + optional sanitized extension from original name.
 * Never uses path segments from client-supplied originalname.
 */
function safeUploadFilename(originalname) {
  const ext = path.extname(originalname || '').replace(/[^\w.]/g, '').slice(0, 16);
  const base = crypto.randomUUID();
  return ext ? `${base}${ext}` : base;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_TEMP_DIR),
  filename: (req, file, cb) => {
    const safeName = safeUploadFilename(file.originalname);
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB (Box Enterprise limit)
  },
});

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

    // Link upload to document request: Box metadata is source of truth for status
    if (docRequest) {
      try {
          await boxDocumentStatusService.applyUploadMetadata(file.id, {
            requestId: docRequest.id,
            clientId: docRequest.clientId,
            documentType: docRequest.documentType,
            financialYear: new Date().getFullYear().toString(),
            priority: docRequest.priority,
          });

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
        console.error('Failed to update document request after upload:', dbErr.message);
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

/**
 * GET /api/documents/:fileId/edit-url
 * Returns an embed URL for editing. Staff-only.
 * Uses collaborators-scoped shared links (not company-wide) to avoid enterprise-wide edit exposure.
 */
router.get('/:fileId/edit-url', requireAuth, requireRole('employee', 'superadmin'), assertStaffVaultFile, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const client = boxService.getBoxClient();


    // Get auth token for raw API call
    const token = await client.auth.retrieveToken();

    // Collaborators-only editable link — never company-wide
    const boxResp = await fetch(`https://api.box.com/2.0/files/${fileId}?fields=shared_link,name,extension`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shared_link: {
          access: 'collaborators',
          permissions: { can_edit: true, can_download: true, can_preview: true }
        }
      }),
    });

    if (!boxResp.ok) {
      const errData = await boxResp.json().catch(() => ({}));
      if (boxResp.status === 404) {
        return res.status(404).json({ error: 'File not found' });
      }
      // Fall through to expiring embed if shared link creation fails
      console.warn('Shared link creation failed, falling back to embed', errData.message || errData.code);
    }

    const data = boxResp.ok ? await boxResp.json() : {};
    const sharedLink = data.shared_link;

    if (sharedLink && sharedLink.url) {
      const hash = sharedLink.url.split('/s/')[1];
      const embedUrl = `https://app.box.com/embed/s/${hash}?showAnnotations=true&showDownload=true`;
      const officeOnlineUrl = `https://app.box.com/integrations/officeonline/openOfficeOnline?fileId=${fileId}&sharedAccessCode=${encodeURIComponent(hash)}`;

      return res.json({
        embedUrl,
        officeOnlineUrl,
        sharedLinkUrl: sharedLink.url,
        directEditUrl: `https://app.box.com/file/${fileId}`,
        fileId,
        fileName: data.name,
        extension: data.extension,
        method: 'editable_shared_link',
        permissions: { canEdit: true, canDownload: true, canPreview: true },
        boxEditAccount: config.boxEditAccountEmail,
      });
    }

    // Fallback: expiring embed link (read-only but better than nothing)
    try {
      const file = await client.files.getFileById(fileId, {
        queryParams: { fields: ['expiring_embed_link', 'name', 'extension'] },
      });
      const embedLink = file.expiringEmbedLink?.url || file.rawData?.expiring_embed_link?.url;
      if (embedLink) {
        return res.json({
          embedUrl: embedLink,
          fileId,
          fileName: file.name || data.name,
          extension: file.extension || data.extension,
          method: 'expiring_embed_link',
          permissions: { canEdit: false, canDownload: true, canPreview: true },
        });
      }
    } catch { /* fall through */ }

    return res.status(200).json({
      embedUrl: null,
      fileId,
      fileName: data.name,
      method: 'none',
      message: 'Embed not available. Use download + re-upload flow.',
      permissions: { canEdit: false, canDownload: true, canPreview: false },
    });
  } catch (error) {
    next(error);
  }
});

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

/**
 * POST /api/documents/:fileId/edit-session
 * Records that an employee opened a document for editing.
 * Body: { action: 'open_editor' | 'open_in_box' | 'upload_version', fileName?, clientId? }
 */
router.post('/:fileId/edit-session', requireAuth, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { action, fileName, clientId } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Missing required field: action' });
    }

    const validActions = ['open_editor', 'open_in_box', 'upload_version'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
    }

    const db = getDb();
    const { randomUUID } = await import('crypto');
    const id = randomUUID();
    const now = new Date().toISOString();

    await db('edit_sessions').insert({
      id,
      file_id: fileId,
      file_name: fileName || '',
      employee_id: req.user.userId,
      employee_name: req.user.name || '',
      client_id: clientId || '',
      action,
      created_at: now,
    });

    res.status(201).json({ id, fileId, action, employeeId: req.user.userId, createdAt: now });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/documents/:fileId/edit-sessions
 * Returns edit session history for a file, sorted by most recent first.
 */
router.get('/:fileId/edit-sessions', requireAuth, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const db = getDb();

    const sessions = await db('edit_sessions')
      .where('file_id', fileId)
      .orderBy('created_at', 'desc')
      .limit(50);

    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

export default router;
