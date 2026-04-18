/**
 * Onboarding routes — Client onboarding with Box App User provisioning.
 *
 * Requirements: 1.1, 2.1
 */

import express from 'express';
import onboardingService from '../services/onboardingService.js';
import projectService from '../services/projectService.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { getRepositories } from '../db/repositories/index.js';

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
    // Assign to the logged-in employee (from auth session) and also to 'employee-1'
    // (demo employee) so the seed-data dashboard works too.
    let registeredClient = null;
    const loggedInEmployeeId = req.user?.userId || 'employee-1';
    try {
      registeredClient = await projectService.registerOnboardedClient(
        {
          name: clientName,
          email,
          externalId,
          boxFolderId: result.folders?.root || '',
          boxUserId: result.appUser?.userId || '',
          employeeEmail,
        },
        loggedInEmployeeId
      );

      // Also assign to 'employee-1' if the logged-in user is different,
      // so the demo dashboard always shows the client.
      if (loggedInEmployeeId !== 'employee-1') {
        try {
          const repos = getRepositories();
          if (repos && repos.employeeClientRepo) {
            await repos.employeeClientRepo.assign('employee-1', registeredClient.id);
          }
        } catch (assignErr) {
          // Non-critical — ignore duplicate or missing employee-1
          if (!assignErr.message?.includes('UNIQUE constraint')) {
            console.warn('Secondary employee assignment failed:', assignErr.message);
          }
        }
      }
    } catch (regErr) {
      console.error('Project service registration failed:', regErr.message, regErr.stack);
      // Don't swallow — propagate so the user knows onboarding partially failed
      throw new Error(`Client onboarding succeeded in Box but failed to register locally: ${regErr.message}`);
    }

    // Persist vault manifest in client_vaults table
    if (registeredClient && result.folders) {
      let repos;
      try {
        repos = getRepositories();
      } catch {
        // Repositories not initialized (e.g., test environment) — skip vault persistence
        repos = null;
      }

      if (repos && repos.clientVaultRepo) {
        try {
          const year = financialYear || new Date().getFullYear().toString();

          await repos.clientVaultRepo.create({
            client_id: registeredClient.id,
            financial_year: year,
            root_folder_id: result.folders.root,
            year_folder_id: result.folders.year,
            projects_folder_id: result.folders.projects,
            tax_folder_id: result.folders.tax,
            uploads_folder_id: result.folders.uploads,
            supporting_docs_folder_id: result.folders.supportingDocs,
            signed_documents_folder_id: result.folders.signedDocuments,
            internal_notes_folder_id: result.folders.internalNotes,
          });

          // Also update the client's box_folder_id with the root folder
          if (repos.clientRepo) {
            await repos.clientRepo.update(registeredClient.id, {
              box_folder_id: result.folders.root,
            });
          }
        } catch (vaultErr) {
          console.error('Vault persistence failed during onboarding:', vaultErr.message);
          throw vaultErr;
        }
      }
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
