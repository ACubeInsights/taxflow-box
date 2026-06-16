import express from 'express';
import boxService from '../services/boxService.js';
import permissionService from '../services/permissionService.js';
import { requireAuth, requireRole, validateFolderOwnership, permissionCheck } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/vaults/:folderId/files
 * List all files in a vault folder.
 * Auth: requireAuth → requireRole('client') → validateFolderOwnership
 */
router.get('/:folderId/files', requireAuth, requireRole('client', 'employee', 'superadmin'), validateFolderOwnership, async (req, res, next) => {
  try {
    const { folderId } = req.params;
    const files = await boxService.listFiles(folderId);

    // For client role: filter files by their granular permissions
    if (req.user.role === 'client' && req.clientId) {
      const fileIds = files.map(f => f.id);
      const accessMap = await permissionService.getAccessibleResources(req.clientId, fileIds);

      const filtered = files
        .filter(f => accessMap[f.id]) // Only files with explicit permission
        .map(f => ({ ...f, accessLevel: accessMap[f.id] }));

      return res.json({ folderId, files: filtered, count: filtered.length });
    }

    // Employees/superadmins see everything with full access
    const enriched = files.map(f => ({ ...f, accessLevel: 'delete' }));
    res.json({ folderId, files: enriched, count: enriched.length });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/vaults/files/:fileId/download
 * Get download URL for a file.
 * Auth: requireAuth → requireRole('client')
 */
router.get('/files/:fileId/download', requireAuth, requireRole('client', 'employee', 'superadmin'), permissionCheck('commenter'), async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const downloadUrl = await boxService.getFileDownloadUrl(fileId);

    res.json({ downloadUrl });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/vaults/files/:fileId/embed
 * Get an expiring embed URL for inline file preview (Box iframe).
 * Auth: requireAuth
 */
router.get('/files/:fileId/embed', requireAuth, requireRole('client', 'employee', 'superadmin'), permissionCheck('viewer'), async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const client = boxService.getBoxClient();

    const file = await client.files.getFileById(fileId, {
      queryParams: { fields: ['expiring_embed_link', 'name', 'extension'] },
    });

    const embedUrl = file.expiringEmbedLink?.url;
    if (!embedUrl) {
      return res.status(404).json({ error: 'Preview not available for this file' });
    }

    res.json({ embedUrl, fileName: file.name, extension: file.extension });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'File not found' });
    }
    next(error);
  }
});

/**
 * DELETE /api/vaults/files/:fileId
 * Delete a file from a vault
 */
router.delete('/files/:fileId', requireAuth, permissionCheck('delete'), async (req, res, next) => {
  try {
    const { fileId } = req.params;

    await boxService.deleteFile(fileId);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
