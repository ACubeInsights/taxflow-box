import express from 'express';
import boxService from '../services/boxService.js';

const router = express.Router();

/**
 * GET /api/vaults/:folderId/files
 * List all files in a vault folder
 */
router.get('/:folderId/files', async (req, res, next) => {
  try {
    const { folderId } = req.params;

    const files = await boxService.listFiles(folderId);

    res.json({
      folderId,
      files,
      count: files.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/vaults/files/:fileId/download
 * Get download URL for a file
 */
router.get('/files/:fileId/download', async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const downloadUrl = await boxService.getFileDownloadUrl(fileId);

    res.json({ downloadUrl });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/vaults/files/:fileId
 * Delete a file from a vault
 */
router.delete('/files/:fileId', async (req, res, next) => {
  try {
    const { fileId } = req.params;

    await boxService.deleteFile(fileId);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
