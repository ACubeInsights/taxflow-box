import express from 'express';
import multer from 'multer';
import boxService from '../services/boxService.js';
import { BoxService } from '../services/boxService.js';
import { initDatabase } from '../db/db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import cacheLayer from '../services/cacheLayer.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';

const router = express.Router();

// Upload temp directory
const UPLOAD_TEMP_DIR = path.join(os.tmpdir(), 'taxflow-uploads');
if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
  fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

// Configure multer: memory for small files, disk for large files
// Use disk storage to handle files up to 5GB without memory pressure
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_TEMP_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
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
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  let tempFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { folderId, requestId } = req.body;

    if (!folderId) {
      return res.status(400).json({ error: 'Missing folderId' });
    }

    tempFilePath = req.file.path;
    const fileSize = req.file.size;

    // Read file into buffer for upload
    const fileBuffer = fs.readFileSync(tempFilePath);

    // Upload to Box (routes to direct or chunked based on size)
    const file = await boxService.uploadFile(
      folderId,
      req.file.originalname,
      fileBuffer
    );

    // Clean up temp file
    try { fs.unlinkSync(tempFilePath); } catch { /* best effort */ }
    tempFilePath = null;

    // If this upload is linked to a document request, update the DB
    if (requestId) {
      try {
        const db = await initDatabase();
        await db('document_requests')
          .where('id', requestId)
          .update({
            status: 'Uploaded',
            box_file_id: file.id,
            uploaded_file_name: file.name,
            version: db.raw('version + 1'),
            updated_at: new Date().toISOString(),
          });
      } catch (dbErr) {
        console.error('Failed to update document request after upload:', dbErr.message);
        // Don't fail the upload response — file is already on Box
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
router.get('/:folderId', async (req, res, next) => {
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
 * Token is file-specific and cached for 50 minutes.
 */
router.get('/:fileId/preview-token', requireAuth, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const cacheKey = `doc:preview-token:${fileId}`;

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
 * Returns an expiring embed URL for the file with edit capabilities.
 * Uses Box's expiring_embed_link which works with the Service Account token.
 * Alternative approach since shared link creation may require additional app scopes.
 */
router.get('/:fileId/edit-url', requireAuth, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const client = boxService.getBoxClient();

    // Get expiring embed link (works without shared link scopes)
    let file;
    try {
      file = await client.files.getFileById(fileId, {
        queryParams: { fields: ['expiring_embed_link', 'name', 'id', 'shared_link'] },
      });
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('404')) {
        return res.status(404).json({ error: 'File not found' });
      }
      throw err;
    }

    // Try expiring embed link first
    const embedLink = file.expiringEmbedLink?.url || file.rawData?.expiring_embed_link?.url;

    if (embedLink) {
      // Append edit/annotation parameters
      const separator = embedLink.includes('?') ? '&' : '?';
      const editUrl = `${embedLink}${separator}showAnnotations=true&showDownload=true`;

      return res.json({
        embedUrl: editUrl,
        fileId,
        fileName: file.name || file.rawData?.name,
        method: 'expiring_embed_link',
        permissions: { canEdit: true, canDownload: true, canPreview: true },
      });
    }

    // Fallback: try shared link approach
    try {
      const result = await client.sharedLinksFiles.addShareLinkToFile(fileId, {
        shared_link: { access: 'open' },
      }, { fields: 'shared_link' });

      const sharedLinkUrl = result.rawData?.shared_link?.url;
      if (sharedLinkUrl) {
        const hash = sharedLinkUrl.split('/s/')[1];
        return res.json({
          embedUrl: `https://app.box.com/embed/s/${hash}?showAnnotations=true&showDownload=true`,
          sharedLinkUrl,
          fileId,
          fileName: file.name || file.rawData?.name,
          method: 'shared_link',
          permissions: { canEdit: true, canDownload: true, canPreview: true },
        });
      }
    } catch {
      // Shared link not available — fall through
    }

    // Last fallback: just provide the download URL
    return res.status(200).json({
      embedUrl: null,
      fileId,
      fileName: file.name || file.rawData?.name,
      method: 'none',
      message: 'Embed not available for this file. Use download + re-upload flow.',
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
router.post('/:fileId/upload-version', requireAuth, upload.single('file'), async (req, res, next) => {
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

export default router;
