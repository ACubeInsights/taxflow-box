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
import { logger } from '../utils/logger.js';

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

    logger.info('Resolving employee for onboarding', { employeeEmail });
    try {
      const repos = getRepositories();
      const hasRepos = !!(repos && repos.userRepo);

      if (hasRepos && employeeEmail) {
        // Find the employee by email in the users table
        let empUser = await repos.userRepo.findByEmail(employeeEmail);

        // Auto-sync: if the employee exists in Box but not in the local DB
        // (e.g., they were created but never logged in), create a local record
        // so the FK constraint on employee_clients is satisfied.
        if (!empUser) {
          logger.info('Employee not in DB, attempting Box auto-sync', { employeeEmail });
          try {
            const boxClient = boxService.getBoxClient();
            const allUsers = await boxClient.users.getUsers({
              userType: 'all',
              fields: ['id', 'name', 'external_app_user_id'],
            });
            const normalizedEmail = employeeEmail.toLowerCase();
            const boxUser = (allUsers.entries || []).find((u) => {
              const extId = u.externalAppUserId || '';
              const em = extractOriginalEmail(extId);
              return em && em.toLowerCase() === normalizedEmail;
            });
            if (boxUser) {
              const extId = boxUser.externalAppUserId || '';
              const role = extractRole(extId);
              empUser = await repos.userRepo.create({
                box_user_id: boxUser.id,
                email: normalizedEmail,
                name: boxUser.name,
                role,
                password_hash: extId,
              });
              logger.info('Auto-synced employee to local DB', { email: normalizedEmail, userId: empUser.id });
            } else {
              logger.warn('Employee not found in Box either', { employeeEmail: normalizedEmail });
            }
          } catch (syncErr) {
            logger.warn('Auto-sync error', { error: syncErr.message });
            // If auto-sync fails (e.g., UNIQUE constraint), try finding again
            if (syncErr.message?.includes('UNIQUE constraint')) {
              empUser = await repos.userRepo.findByEmail(employeeEmail);
            }
          }
        }

        if (empUser) {
          targetEmployeeId = empUser.id;
          logger.info('Resolved target employee', { targetEmployeeId });
        } else {
          logger.warn('Could not resolve employee, using fallback', { targetEmployeeId });
        }
      }
    } catch (outerErr) {
      logger.error('Employee resolution failed', { error: outerErr.message });
      // Still use fallback
    }
    logger.info('Onboarding employee resolved', { targetEmployeeId });

    // Also determine the logged-in user's ID for secondary assignment
    let loggedInEmployeeId = req.user?.userId;
    if (!loggedInEmployeeId || loggedInEmployeeId.startsWith('demo-')) {
      loggedInEmployeeId = null; // don't try to assign to demo users
    }

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
            logger.warn('Secondary employee assignment failed', { error: assignErr.message });
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
            logger.warn('employee-1 assignment failed', { error: assignErr.message });
          }
        }
      }
    } catch (regErr) {
      logger.error('Project service registration failed', { error: regErr.message });
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
          logger.error('Vault persistence failed during onboarding', { error: vaultErr.message });
          throw vaultErr;
        }
      }
    }

    // Grant default resource_permissions so the client can access their own vault folders
    if (registeredClient && result.folders) {
      try {
        const repos = getRepositories();
        if (repos) {
          const { randomUUID } = await import('crypto');
          const db = repos.clientRepo?.db || (await import('../db/db.js')).initDatabase();
          const resolvedDb = typeof db === 'function' ? await db() : db;
          const now = new Date().toISOString();
          const clientId = registeredClient.id;

          const folderPermissions = [
            { id: result.folders.uploads, name: 'Uploads', level: 'writer' },
            { id: result.folders.tax, name: 'Tax', level: 'viewer' },
            { id: result.folders.signedDocuments, name: 'Signed Documents', level: 'viewer' },
            { id: result.folders.supportingDocs, name: 'Supporting Docs', level: 'viewer' },
            { id: result.folders.root, name: 'Root', level: 'viewer' },
          ].filter(f => f.id);

          for (const folder of folderPermissions) {
            try {
              await resolvedDb('resource_permissions').insert({
                id: randomUUID(),
                client_id: clientId,
                resource_id: folder.id,
                resource_type: 'folder',
                access_level: folder.level,
                resource_name: folder.name,
                granted_by: 'system',
                is_cascaded: '0',
                created_at: now,
                updated_at: now,
              });
            } catch (permErr) {
              // Ignore duplicate key errors (idempotent)
              if (!permErr.message?.includes('UNIQUE constraint')) {
                logger.warn('Permission grant failed for folder', { folder: folder.name, error: permErr.message });
              }
            }
          }
        }
      } catch (permErr) {
        logger.warn('Resource permissions setup failed (non-fatal)', { error: permErr.message });
      }
    }

    res.status(201).json({
      ...result,
      clientId: registeredClient?.id || null,
      projectId: registeredClient?.projectId || null,
    });
  } catch (error) {
    logger.error('Onboarding error', { error: error.message });
    next(error);
  }
});

export default router;
