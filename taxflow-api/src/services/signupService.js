/**
 * SignupService — Orchestrates client self-signup (token validation + Box onboarding + session).
 */

import deepLinkTokenService from './deepLinkTokenService.js';
import onboardingService from './onboardingService.js';
import authService from './authService.js';
import projectService from './projectService.js';
import { createHttpError } from '../utils/httpError.js';
import { getRepositories } from '../db/repositories/index.js';
import { buildExternalId } from '../utils/authUtils.js';

class SignupService {
  constructor() {
    this._inviteRepo = null;
  }

  setRepositories({ inviteRepo }) {
    this._inviteRepo = inviteRepo;
  }

  get inviteRepo() {
    if (!this._inviteRepo) throw new Error('SignupService: repositories not injected');
    return this._inviteRepo;
  }

  /**
   * Validate an invite token. Returns client info if valid.
   */
  async validateToken(token) {
    let payload;
    try {
      payload = deepLinkTokenService.verifyDeepLinkToken(token);
    } catch (err) {
      if (err.message?.includes('expired')) {
        throw createHttpError('This invitation link has expired. Please contact your tax preparer for a new invitation.', 410);
      }
      throw createHttpError('Invalid invitation link', 401);
    }

    const record = await this.inviteRepo.findById(payload.inviteId);
    if (!record) throw createHttpError('Invitation not found', 404);

    if (record.status === 'accepted') {
      throw createHttpError('This invitation has already been used. Your account is already created.', 409);
    }

    if (record.status === 'expired') {
      throw createHttpError('This invitation link has expired. Please contact your tax preparer for a new invitation.', 410);
    }

    return {
      valid: true,
      clientName: record.client_name,
      email: record.email,
      inviteId: record.id,
    };
  }

  /**
   * Complete signup: verify token, run Box onboarding, create user, create session.
   */
  async completeSignup(token, password, clientName, externalId, email) {
    if (!password || password.length < 6) {
      throw createHttpError('Password must be at least 6 characters', 400);
    }

    // Verify token
    let payload;
    try {
      payload = deepLinkTokenService.verifyDeepLinkToken(token);
    } catch (err) {
      if (err.message?.includes('expired')) {
        throw createHttpError('This invitation link has expired.', 410);
      }
      throw createHttpError('Invalid invitation link', 401);
    }

    const record = await this.inviteRepo.findById(payload.inviteId);
    if (!record) throw createHttpError('Invitation not found', 404);
    if (record.status === 'accepted') {
      throw createHttpError('This invitation has already been used.', 409);
    }

    // Use clientName/externalId/email from signup form, fall back to invite record values
    const finalClientName = (clientName || '').trim() || record.client_name || record.email.split('@')[0];
    const finalExternalId = (externalId || '').trim() || record.external_id || `CL-${Date.now()}`;
    const finalEmail = (email || '').trim() || record.email;

    // Run existing onboarding pipeline (same as before — creates Box App User, folders, etc.)
    let onboardingResult;
    try {
      onboardingResult = await onboardingService.onboardClient(
        finalClientName,
        finalExternalId,
        finalEmail,
        record.employee_email,
        record.financial_year,
        password
      );
    } catch (err) {
      console.error('[SignupService] Box onboarding failed:', err.message);
      if (err.message && err.message.includes('already registered')) {
        throw createHttpError('An account with this email already exists. Please log in instead.', 409);
      }
      throw createHttpError('Account setup failed. Please try again.', 500);
    }

    // Register client in project service (same logic as onboarding route)
    let registeredClient;
    try {
      const repos = getRepositories();

      // Find employee ID
      let targetEmployeeId = 'employee-1';
      if (repos.userRepo) {
        const empUser = await repos.userRepo.findByEmail(record.employee_email);
        if (empUser) targetEmployeeId = empUser.id;
      }

      registeredClient = await projectService.registerOnboardedClient(
        {
          name: finalClientName,
          email: finalEmail,
          externalId: finalExternalId,
          boxFolderId: onboardingResult.folders?.root || '',
          boxUserId: onboardingResult.appUser?.userId || '',
          employeeEmail: record.employee_email,
        },
        targetEmployeeId
      );

      // Persist vault
      if (repos.clientVaultRepo && onboardingResult.folders) {
        await repos.clientVaultRepo.create({
          client_id: registeredClient.id,
          financial_year: record.financial_year,
          root_folder_id: onboardingResult.folders.root,
          year_folder_id: onboardingResult.folders.year,
          projects_folder_id: onboardingResult.folders.projects,
          tax_folder_id: onboardingResult.folders.tax,
          uploads_folder_id: onboardingResult.folders.uploads,
          supporting_docs_folder_id: onboardingResult.folders.supportingDocs,
          signed_documents_folder_id: onboardingResult.folders.signedDocuments,
          internal_notes_folder_id: onboardingResult.folders.internalNotes,
        });

        if (repos.clientRepo) {
          await repos.clientRepo.update(registeredClient.id, {
            box_folder_id: onboardingResult.folders.root,
          });
        }
      }
    } catch (err) {
      console.error('[SignupService] Client registration failed:', err.message);
      if (err.message && (err.message.includes('already') || err.message.includes('UNIQUE constraint'))) {
        throw createHttpError('An account with this email already exists. Please log in instead.', 409);
      }
      throw createHttpError('Account setup failed. Please try again.', 500);
    }

    // Mark invite as accepted
    await this.inviteRepo.updateStatus(payload.inviteId, 'accepted');

    // Create user record in local DB (needed for session/auth)
    const repos = getRepositories();
    let userRecord = await repos.userRepo.findByEmail(finalEmail);
    if (!userRecord) {
      try {
        userRecord = await repos.userRepo.create({
          box_user_id: onboardingResult.appUser?.userId || '',
          email: finalEmail,
          name: finalClientName,
          role: 'client',
          password_hash: buildExternalId(password, finalEmail, 'client'),
        });
      } catch (createErr) {
        // If UNIQUE constraint, the user was created by a race — try finding again
        if (createErr.message?.includes('UNIQUE constraint')) {
          userRecord = await repos.userRepo.findByEmail(finalEmail);
        }
        if (!userRecord) {
          throw createHttpError('Account creation failed — could not create user record', 500);
        }
      }
    }

    const session = await authService.createSession({
      userId: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
    });

    // Build vault response
    let vault = null;
    if (repos.clientVaultRepo) {
      try {
        const vaultRecord = await repos.clientVaultRepo.findByClientId(registeredClient.id);
        if (vaultRecord) {
          vault = {
            clientId: registeredClient.id,
            financialYear: vaultRecord.financial_year,
            root: vaultRecord.root_folder_id,
            year: vaultRecord.year_folder_id,
            projects: vaultRecord.projects_folder_id,
            tax: vaultRecord.tax_folder_id,
            uploads: vaultRecord.uploads_folder_id,
            supportingDocs: vaultRecord.supporting_docs_folder_id,
            signedDocuments: vaultRecord.signed_documents_folder_id,
            internalNotes: vaultRecord.internal_notes_folder_id,
          };
        }
      } catch { /* vault lookup non-fatal */ }
    }

    return {
      sessionToken: session.sessionToken,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name,
        role: userRecord.role,
        externalId: record.external_id,
      },
      expiresAt: session.expiresAt,
      vault,
    };
  }
}

const signupService = new SignupService();
export default signupService;
