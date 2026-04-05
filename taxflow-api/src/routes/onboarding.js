/**
 * Onboarding routes — Client onboarding with Box App User provisioning.
 *
 * Requirements: 1.1, 2.1
 */

import express from 'express';
import onboardingService from '../services/onboardingService.js';
import projectService from '../services/projectService.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/onboarding
 * Onboard a new client: creates App User, folder hierarchy, locks, collaborations, webhook.
 * Body: { clientName, externalId, email, employeeEmail, financialYear? }
 * Response: OnboardingResult (201) | 400 | 500
 */
router.post('/', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { clientName, externalId, email, employeeEmail, financialYear, password } = req.body;

    const missing = [];
    if (!clientName) missing.push('clientName');
    if (!externalId) missing.push('externalId');
    if (!email) missing.push('email');
    if (!employeeEmail) missing.push('employeeEmail');
    if (!password) missing.push('password');

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // Wrap in a timeout to prevent hanging requests
    const timeoutMs = 60000; // 60 seconds
    const onboardPromise = onboardingService.onboardClient(
      clientName,
      externalId,
      email,
      employeeEmail,
      financialYear,
      password
    );

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Onboarding timed out after 60 seconds. Check Box API connectivity and JWT configuration.')), timeoutMs)
    );

    const result = await Promise.race([onboardPromise, timeoutPromise]);

    // Register the new client in the project service so it appears in dashboards.
    // Always assign to 'employee-1' (demo employee the frontend queries),
    // plus the actual requesting user if they're a real employee.
    let registeredClient = null;
    try {
      registeredClient = projectService.registerOnboardedClient(
        {
          name: clientName,
          email,
          externalId,
          boxFolderId: result.folders?.root || '',
          boxUserId: result.appUser?.userId || '',
          employeeEmail,
        },
        'employee-1'
      );
    } catch (regErr) {
      console.warn('Project service registration failed:', regErr.message);
    }

    res.status(201).json({
      ...result,
      clientId: registeredClient?.id || null,
      projectId: registeredClient?.projectId || null,
    });
  } catch (error) {
    console.error('Onboarding error:', error.message || error);
    next(error);
  }
});

export default router;
