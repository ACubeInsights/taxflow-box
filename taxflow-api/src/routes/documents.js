import express from 'express';
import multer from 'multer';
import boxService from '../services/boxService.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * POST /api/documents/upload
 * Upload a document to a client's vault
 * Body (multipart/form-data): { file, folderId, requestId? }
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { folderId, requestId } = req.body;

    if (!folderId) {
      return res.status(400).json({ error: 'Missing folderId' });
    }

    // Upload to Box
    const file = await boxService.uploadFile(
      folderId,
      req.file.originalname,
      req.file.buffer
    );

    res.status(201).json({
      message: 'Document uploaded successfully',
      file: {
        id: file.id,
        name: file.name,
        size: file.size,
        createdAt: file.created_at,
      },
      requestId, // Pass through for frontend state update
    });
  } catch (error) {
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

export default router;
