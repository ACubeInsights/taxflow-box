/**
 * Document type routes — Document type catalog endpoints.
 *
 * Requirements: 7.1, 7.2
 */

import express from 'express';
import documentTypeService from '../services/documentTypeService.js';

const router = express.Router();

/**
 * GET /api/document-types
 * Lists all document types with optional ?projectType= filter.
 */
router.get('/document-types', async (req, res, next) => {
  try {
    const { projectType } = req.query;
    const types = documentTypeService.getDocumentTypes(projectType);
    res.json(types);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/document-types/:typeId
 * Returns a single document type. 404 if not found.
 */
router.get('/document-types/:typeId', async (req, res, next) => {
  try {
    const { typeId } = req.params;
    const docType = documentTypeService.getDocumentType(typeId);
    if (!docType) {
      return res.status(404).json({ error: 'Document type not found' });
    }
    res.json(docType);
  } catch (error) {
    next(error);
  }
});

export default router;
