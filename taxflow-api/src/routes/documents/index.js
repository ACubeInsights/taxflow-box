/**
 * Document routes — composed sub-routers (stable mount at /api/documents).
 */

import express from 'express';
import uploadRoutes from './uploadRoutes.js';
import folderRoutes from './folderRoutes.js';
import previewRoutes from './previewRoutes.js';
import editRoutes from './editRoutes.js';
import versionRoutes from './versionRoutes.js';

const router = express.Router();

router.use(uploadRoutes);
router.use(folderRoutes);
router.use(previewRoutes);
router.use(editRoutes);
router.use(versionRoutes);

export default router;
