/**
 * Onboarding routes — Client onboarding with Box App User provisioning.
 *
 * Requirements: 1.1, 2.1
 */

import express from 'express';
import onboardingService from '../services/onboardingService.js';

const router = express.Router();

/**
 * POST /api/onboarding
 * Onboard a new client: creates App User, folder hierarchy, locks, collaborations, webhook.
 * Body: { clientName, externalId, email, employeeEmail, financialYear? }
 * Response: OnboardingResult (201) | 400 | 500
 */
router.post('/', async (req, res, next) => {
  try {
    const { clientName, externalId, email, employeeEmail, financialYear } = req.body;

    const missing = [];
    if (!clientName) missing.push('clientName');
    if (!externalId) missing.push('externalId');
    if (!email) missing.push('email');
    if (!employeeEmail) missing.push('employeeEmail');

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    const result = await onboardingService.onboardClient(
      clientName,
      externalId,
      email,
      employeeEmail,
      financialYear
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
