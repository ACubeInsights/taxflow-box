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

    // For client role: use folder-level access as baseline, override with explicit file permissions
    if (req.user.role === 'client' && req.clientId) {
      const fileIds = files.map(f => f.id);
      const accessMap = await permissionService.getAccessibleResources(req.clientId, fileIds);

      // Get the folder's own access level as the inherited baseline
      const folderPerm = await permissionService.getPermission(req.clientId, folderId);
      const folderLevel = folderPerm?.accessLevel || 'viewer'; // Default to viewer if folder is accessible

      const enriched = files.map(f => ({
        ...f,
        accessLevel: accessMap[f.id] || folderLevel, // Explicit file perm wins, else inherit from folder
      }));

      return res.json({ folderId, files: enriched, count: enriched.length });
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

// ─── Folder Management (Employee/Superadmin only) ────────────────────────────

/**
 * POST /api/vaults/:parentFolderId/folders
 * Create a subfolder inside the given parent folder.
 * Auth: requireAuth → requireRole('employee', 'superadmin')
 * Body: { name: string }
 */
router.post('/:parentFolderId/folders', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { parentFolderId } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const trimmedName = name.trim();

    // Box folder name constraints: max 255 chars, no leading/trailing spaces,
    // cannot be "." or ".."
    if (trimmedName.length > 255) {
      return res.status(400).json({ error: 'Folder name must be 255 characters or fewer' });
    }
    if (trimmedName === '.' || trimmedName === '..') {
      return res.status(400).json({ error: 'Invalid folder name' });
    }

    const client = boxService.getBoxClient();
    const folder = await client.folders.createFolder({
      name: trimmedName,
      parent: { id: parentFolderId },
    });

    res.status(201).json({
      id: folder.id,
      name: folder.name,
      type: 'folder',
      createdAt: folder.createdAt || folder.created_at || new Date().toISOString(),
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'Parent folder not found' });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({ error: 'A folder with this name already exists in the target location' });
    }
    if (error.statusCode === 403) {
      return res.status(403).json({ error: 'Insufficient permissions to create folder here' });
    }
    next(error);
  }
});

/**
 * PUT /api/vaults/folders/:folderId
 * Rename a folder.
 * Auth: requireAuth → requireRole('employee', 'superadmin')
 * Body: { name: string }
 */
router.put('/folders/:folderId', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { folderId } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'New folder name is required' });
    }

    const trimmedName = name.trim();

    if (trimmedName.length > 255) {
      return res.status(400).json({ error: 'Folder name must be 255 characters or fewer' });
    }
    if (trimmedName === '.' || trimmedName === '..') {
      return res.status(400).json({ error: 'Invalid folder name' });
    }

    const client = boxService.getBoxClient();
    const folder = await client.folders.updateFolderById(folderId, {
      requestBody: { name: trimmedName },
    });

    res.json({
      id: folder.id,
      name: folder.name,
      type: 'folder',
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({ error: 'A folder with this name already exists in the target location' });
    }
    if (error.statusCode === 403) {
      return res.status(403).json({ error: 'Insufficient permissions to rename this folder' });
    }
    next(error);
  }
});

/**
 * DELETE /api/vaults/folders/:folderId
 * Delete a folder (recursively deletes contents).
 * Auth: requireAuth → requireRole('employee', 'superadmin')
 */
router.delete('/folders/:folderId', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { folderId } = req.params;

    // Safety: prevent deletion of the root folder (Box root = '0')
    if (folderId === '0') {
      return res.status(400).json({ error: 'Cannot delete root folder' });
    }

    const client = boxService.getBoxClient();
    await client.folders.deleteFolderById(folderId, { queryParams: { recursive: true } });

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    if (error.statusCode === 403) {
      return res.status(403).json({ error: 'Insufficient permissions to delete this folder' });
    }
    next(error);
  }
});

/**
 * GET /api/vaults/:folderId/contents
 * List all items (files AND folders) in a vault folder.
 * Used by the employee dashboard to browse the full folder tree.
 * Auth: requireAuth → requireRole('employee', 'superadmin')
 */
router.get('/:folderId/contents', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { folderId } = req.params;
    const client = boxService.getBoxClient();
    const items = await client.folders.getFolderItems(folderId, {
      queryParams: { fields: ['id', 'name', 'type', 'size', 'created_at', 'modified_at'] },
    });

    const entries = (items.entries || []).map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      size: item.size || null,
      createdAt: item.createdAt || item.created_at || null,
      modifiedAt: item.modifiedAt || item.modified_at || null,
    }));

    res.json({ folderId, items: entries, count: entries.length });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    next(error);
  }
});

export default router;
