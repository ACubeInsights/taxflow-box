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
import boxService from '../services/boxService.js';
import { extractOriginalEmail, extractRole } from '../utils/authUtils.js';

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
    // Resolve the target employee from the employeeEmail field (selected in the onboarding form).
    // This is the employee the client should be assigned to — not necessarily the logged-in user.
    let registeredClient = null;
    let targetEmployeeId = 'employee-1'; // fallback

    console.log(`[Onboarding] Resolving employee for email: "${employeeEmail}"`);
    try {
      const repos = getRepositories();
      const hasRepos = !!(repos && repos.userRepo);
      console.log(`[Onboarding] Repos available: ${hasRepos}`);

      if (hasRepos && employeeEmail) {
        // Find the employee by email in the users table
        let empUser = await repos.userRepo.findByEmail(employeeEmail);
        console.log(`[Onboarding] DB lookup result: ${empUser ? `found ${empUser.id} (${empUser.name})` : 'NOT FOUND'}`);

        // Auto-sync: if the employee exists in Box but not in the local DB
        // (e.g., they were created but never logged in), create a local record
        // so the FK constraint on employee_clients is satisfied.
        if (!empUser) {
          console.log('[Onboarding] Employee not in DB, attempting Box auto-sync...');
          try {
            const boxClient = boxService.getBoxClient();
            const allUsers = await boxClient.users.getUsers({
              userType: 'all',
              fields: ['id', 'name', 'external_app_user_id'],
            });
            const normalizedEmail = employeeEmail.toLowerCase();
            console.log(`[Onboarding] Box returned ${allUsers.entries?.length || 0} users, searching for "${normalizedEmail}"`);
            const boxUser = (allUsers.entries || []).find((u) => {
              const extId = u.externalAppUserId || '';
              const em = extractOriginalEmail(extId);
              return em && em.toLowerCase() === normalizedEmail;
            });
            if (boxUser) {
              const extId = boxUser.externalAppUserId || '';
              const role = extractRole(extId);
              console.log(`[Onboarding] Found Box user: ${boxUser.id} ${boxUser.name}, role=${role}`);
              empUser = await repos.userRepo.create({
                box_user_id: boxUser.id,
                email: normalizedEmail,
                name: boxUser.name,
                role,
                password_hash: extId,
              });
              console.log(`[Onboarding] Auto-synced employee ${normalizedEmail} to local DB (${empUser.id})`);
            } else {
              console.warn(`[Onboarding] Employee "${normalizedEmail}" NOT found in Box either!`);
            }
          } catch (syncErr) {
            console.warn(`[Onboarding] Auto-sync error: ${syncErr.message}`);
            // If auto-sync fails (e.g., UNIQUE constraint), try finding again
            if (syncErr.message?.includes('UNIQUE constraint')) {
              empUser = await repos.userRepo.findByEmail(employeeEmail);
              console.log(`[Onboarding] Re-lookup after UNIQUE: ${empUser ? empUser.id : 'still not found'}`);
            }
          }
        }

        if (empUser) {
          targetEmployeeId = empUser.id;
          console.log(`[Onboarding] ✅ Resolved targetEmployeeId = ${targetEmployeeId}`);
        } else {
          console.warn(`[Onboarding] ⚠️ Could not resolve employee, using fallback: ${targetEmployeeId}`);
        }
      }
    } catch (outerErr) {
      console.error(`[Onboarding] ❌ Employee resolution FAILED: ${outerErr.message}`, outerErr.stack);
      // Still use fallback
    }
    console.log(`[Onboarding] Final targetEmployeeId = ${targetEmployeeId}`);

    // Also determine the logged-in user's ID for secondary assignment
    let loggedInEmployeeId = req.user?.userId;
    console.log(`[Onboarding] Logged-in user: ${loggedInEmployeeId}, targetEmployee: ${targetEmployeeId}`);
    if (!loggedInEmployeeId || loggedInEmployeeId.startsWith('demo-')) {
      loggedInEmployeeId = null; // don't try to assign to demo users
    }

    try {
      console.log(`[Onboarding] Calling registerOnboardedClient with targetEmployeeId=${targetEmployeeId}`);
      registeredClient = await projectService.registerOnboardedClient(
        {
          name: clientName,
          email,
          externalId,
          boxFolderId: result.folders?.root || '',
          boxUserId: result.appUser?.userId || '',
          employeeEmail,
        },
        targetEmployeeId
      );

      // Also assign to the logged-in employee if they're different from the target
      if (loggedInEmployeeId && loggedInEmployeeId !== targetEmployeeId) {
        try {
          const repos = getRepositories();
          if (repos && repos.employeeClientRepo) {
            await repos.employeeClientRepo.assign(loggedInEmployeeId, registeredClient.id);
          }
        } catch (assignErr) {
          if (!assignErr.message?.includes('UNIQUE constraint')) {
            console.warn('Secondary employee assignment failed:', assignErr.message);
          }
        }
      }

      // Also assign to employee-1 (seed data) if neither target nor logged-in is employee-1
      if (targetEmployeeId !== 'employee-1' && loggedInEmployeeId !== 'employee-1') {
        try {
          const repos = getRepositories();
          if (repos && repos.employeeClientRepo) {
            await repos.employeeClientRepo.assign('employee-1', registeredClient.id);
          }
        } catch (assignErr) {
          if (!assignErr.message?.includes('UNIQUE constraint')) {
            console.warn('employee-1 assignment failed:', assignErr.message);
          }
        }
      }
    } catch (regErr) {
      console.error('Project service registration failed:', regErr.message, regErr.stack);
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
