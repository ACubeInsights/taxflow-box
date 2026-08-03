/**
 * Document routes — edit.
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
      logger.warn('Shared link creation failed, falling back to embed', {
        error: errData.message || errData.code,
      });
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
