/**
 * Compliance routes — Retention policies, legal holds, and security classifications.
 *
 * Requirements: 29.3, 30.1, 30.4, 31.1
 */

import express from 'express';
import complianceService from '../services/complianceService.js';

const router = express.Router();

/**
 * POST /api/compliance/retention/assign
 * Assign retention policy to a file.
 */
router.post('/retention/assign', async (req, res, next) => {
  try {
    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'Missing required field: fileId' });
    }

    const result = await complianceService.assignRetentionPolicy(fileId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/compliance/legal-hold
 * Create a legal hold on a file or folder.
 */
router.post('/legal-hold', async (req, res, next) => {
  try {
    const { policyName, description, targetId, targetType } = req.body;

    const missing = [];
    if (!policyName) missing.push('policyName');
    if (!targetId) missing.push('targetId');
    if (!targetType) missing.push('targetType');

    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!['file', 'folder'].includes(targetType)) {
      return res.status(400).json({ error: 'targetType must be "file" or "folder"' });
    }

    const result = await complianceService.createLegalHold(
      policyName,
      description || '',
      targetId,
      targetType
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/compliance/legal-hold/:assignmentId
 * Release a legal hold by deleting the assignment.
 */
router.delete('/legal-hold/:assignmentId', async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    await complianceService.releaseLegalHold(assignmentId);
    res.json({ success: true, message: `Legal hold assignment ${assignmentId} released` });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/compliance/classify/:fileId
 * Apply security classification to a file.
 */
router.post('/classify/:fileId', async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { level } = req.body;

    if (!level) {
      return res.status(400).json({ error: 'Missing required field: level' });
    }

    await complianceService.applyClassification(fileId, level);
    res.json({ success: true, fileId, level });
  } catch (error) {
    if (error.message?.includes('Invalid classification level')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

export default router;
