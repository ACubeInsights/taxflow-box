/**
 * Sign routes — Box Sign e-signature request creation.
 *
 * Requirements: 25.1
 */

import express from 'express';
import signService from '../services/signService.js';

const router = express.Router();

/**
 * POST /api/sign/request
 * Create a Box Sign request for a document.
 * Accepts fileId, signerEmail, signedDocsFolderId, isEmbedded.
 */
router.post('/request', async (req, res, next) => {
  try {
    const { fileId, signerEmail, signedDocsFolderId, isEmbedded } = req.body;

    const missing = [];
    if (!fileId) missing.push('fileId');
    if (!signerEmail) missing.push('signerEmail');
    if (!signedDocsFolderId) missing.push('signedDocsFolderId');

    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    const result = await signService.createSignRequest(fileId, signerEmail, signedDocsFolderId, {
      isEmbedded: !!isEmbedded,
    });

    res.json(result);
  } catch (error) {
    if (error.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});

export default router;
