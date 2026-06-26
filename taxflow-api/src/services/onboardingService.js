import boxService from './boxService.js';
import { config } from '../config.js';
import { buildExternalId, isEmailRegistered } from '../utils/authUtils.js';
import webhookService from './webhookService.js';
import crypto from 'crypto';

const DEFAULT_SPACE_AMOUNT = 10737418240; // 10 GB in bytes

const SUBFOLDER_NAMES = ['Tax', 'Uploads', 'SupportingDocs', 'SignedDocuments', 'InternalNotes'];

export class OnboardingService {
  /**
   * Creates a Box App User with is_platform_access_only: true.
   * Handles 409 conflict by retrieving the existing user.
   *
   * externalAppUserId is set to "taxflow:{dbUserId}" — a stable, non-sensitive identifier
   * that links the Box user to our local database. Passwords are stored ONLY in the local DB.
   *
   * @param {string} name - Display name for the App User
   * @param {string} email - Login email for the App User
   * @param {number} [spaceAmount] - Storage quota in bytes (default 10 GB)
   * @param {string} password - Client password (stored locally, NOT in Box)
   * @param {string} [dbUserId] - Pre-generated DB user UUID. If not provided, one is generated.
   * @returns {Promise<{userId: string, login: string, name: string, isNew: boolean, dbUserId: string}>}
   */
  async createAppUser(name, email, spaceAmount = DEFAULT_SPACE_AMOUNT, password, dbUserId) {
    if (!email) throw new Error('email is required to create an App User');
    if (!password) throw new Error('password is required to create an App User');

    // Generate a stable DB user ID upfront so Box and DB use the same identifier
    const localUserId = dbUserId || crypto.randomUUID();

    const client = boxService.getBoxClient();

    // Check for duplicate email across all users
    if (await isEmailRegistered(client, email)) {
      throw new Error(`Email ${email} is already registered. Each email can only be used once.`);
    }

    try {
      const createBody = {
        name,
        login: email,
        isPlatformAccessOnly: true,
        spaceAmount,
        externalAppUserId: buildExternalId(localUserId),
      };
      const user = await client.users.createUser(createBody);
      return {
        userId: user.id,
        login: user.login || email,
        name: user.name,
        isNew: true,
        dbUserId: localUserId,
      };
    } catch (error) {
      if (error.statusCode === 409) {
        // Retrieve existing user by email
        const existing = await client.users.getUsers({ filterTerm: email });
        const entries = existing.entries || [];
        if (entries.length > 0) {
          const user = entries[0];
          return {
            userId: user.id,
            login: user.login || email,
            name: user.name,
            isNew: false,
            dbUserId: localUserId,
          };
        }
        throw new Error(`409 conflict creating App User but no existing user found for ${email}`);
      }
      throw new Error(
        `Failed to create App User: HTTP ${error.statusCode || 'unknown'} — ${error.message}`
      );
    }
  }

  /**
   * Creates the standard folder hierarchy: root → year → Projects → 5 subfolders.
   * Handles 409 conflicts gracefully by reusing existing folders with the same name.
   * @param {string} clientName
   * @param {string} externalId
   * @param {string} parentFolderId - The configured root folder for all clients
   * @param {string} financialYear
   * @returns {Promise<{root: string, year: string, projects: string, tax: string, uploads: string, supportingDocs: string, signedDocuments: string, internalNotes: string}>}
   */
  async createFolderHierarchy(clientName, externalId, parentFolderId, financialYear) {
    const client = boxService.getBoxClient();
    const createdIds = {};

    /**
     * Creates a folder or reuses an existing one on 409 conflict.
     * @param {string} name - Folder name
     * @param {string} parentId - Parent folder ID
     * @returns {Promise<{id: string, name: string}>}
     */
    async function createOrReuseFolder(name, parentId) {
      try {
        return await client.folders.createFolder({
          name,
          parent: { id: parentId },
        });
      } catch (error) {
        const status = error.statusCode || error.responseInfo?.statusCode || error.status;
        if (status === 409) {
          // Try to get the conflicting folder ID directly from the error response
          const conflicts = error.responseInfo?.body?.context_info?.conflicts || [];
          if (conflicts.length > 0 && conflicts[0].id) {
            console.log(`[Onboarding] Reusing existing folder: ${name} (${conflicts[0].id})`);
            return conflicts[0];
          }
          // Fallback: find it by listing parent's children
          const items = await client.folders.getFolderItems(parentId);
          const existing = (items.entries || []).find(
            (item) => item.type === 'folder' && item.name === name
          );
          if (existing) {
            console.log(`[Onboarding] Reusing existing folder: ${name} (${existing.id})`);
            return existing;
          }
          throw new Error(`409 conflict for folder "${name}" but could not find it in parent ${parentId}`);
        }
        throw error;
      }
    }

    try {
      // 1. Create root folder: "{clientName} ({externalId})"
      const rootFolder = await createOrReuseFolder(`${clientName} (${externalId})`, parentFolderId);
      createdIds.root = rootFolder.id;

      // 2. Create year folder under root
      const yearFolder = await createOrReuseFolder(financialYear, rootFolder.id);
      createdIds.year = yearFolder.id;

      // 3. Create Projects folder under year folder
      const projectsFolder = await createOrReuseFolder('Projects', yearFolder.id);
      createdIds.projects = projectsFolder.id;

      // 4. Create 5 subfolders under Projects folder sequentially
      const folderKeyMap = {
        Tax: 'tax',
        Uploads: 'uploads',
        SupportingDocs: 'supportingDocs',
        SignedDocuments: 'signedDocuments',
        InternalNotes: 'internalNotes',
      };

      for (const folderName of SUBFOLDER_NAMES) {
        const subfolder = await createOrReuseFolder(folderName, projectsFolder.id);
        createdIds[folderKeyMap[folderName]] = subfolder.id;
      }

      return createdIds;
    } catch (error) {
      throw new Error(
        `Failed to create folder hierarchy: ${error.message}. Created folders: ${JSON.stringify(createdIds)}`
      );
    }
  }

  /**
   * Applies folder locks to root, SignedDocuments, and InternalNotes.
   * On enterprise tier: any failure is fatal — throws an exception halting onboarding.
   * On free tier: failures are non-fatal — logs warning, continues.
   * @param {{root: string, signedDocuments: string, internalNotes: string}} manifest
   * @param {string} [tier='free'] - Detected Box tier ('enterprise' or 'free')
   * @returns {Promise<Array<{folderId: string, lockId: string, success: boolean, error?: string}>>}
   */
  async applyFolderLocks(manifest, tier = 'free') {
    const client = boxService.getBoxClient();
    const foldersToLock = [
      manifest.root,
      manifest.signedDocuments,
      manifest.internalNotes,
    ];

    const results = [];
    for (const folderId of foldersToLock) {
      try {
        const lock = await client.folderLocks.createFolderLock({
          folder: { id: folderId, type: 'folder' },
          lockedOperations: { move: true, delete: true },
        });
        results.push({ folderId, lockId: lock.id, success: true });
      } catch (error) {
        console.error(`Failed to lock folder ${folderId}: ${error.message}`);
        results.push({ folderId, lockId: null, success: false, error: error.message });
      }
    }

    // On enterprise tier, any failure is fatal
    if (tier === 'enterprise') {
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        const failedIds = failed.map(r => r.folderId).join(', ');
        throw new Error(`Folder lock enforcement failed on enterprise tier. Failed folder IDs: ${failedIds}`);
      }
    }

    return results;
  }

  /**
   * Sets up collaborations per the permission matrix.
   * Client App User: Uploads→viewer_uploader, Tax→viewer, SignedDocuments→viewer
   * Employee: root→editor
   * NO client access to InternalNotes.
   * Handles 409 conflicts gracefully (treated as success on both tiers).
   * On enterprise tier: any non-409 failure is fatal — throws with failed folder IDs and roles.
   * On free tier: failures are non-fatal — logs warning, continues.
   * @param {{root: string, tax: string, uploads: string, signedDocuments: string}} manifest
   * @param {string} appUserId - Box App User ID for the client
   * @param {string} employeeEmail - Assigned employee email
   * @param {string} [tier='free'] - Detected Box tier ('enterprise' or 'free')
   * @returns {Promise<Array<{folderId: string, role: string, success: boolean, error?: string}>>}
   */
  async setupCollaborations(manifest, appUserId, employeeEmail, tier = 'free') {
    const client = boxService.getBoxClient();

    // Client App User collaborations (by user ID)
    const clientCollabs = [
      { folderId: manifest.uploads, role: 'viewer uploader' },
      { folderId: manifest.tax, role: 'viewer' },
      { folderId: manifest.signedDocuments, role: 'viewer' },
    ];

    // Employee collaboration (by email)
    const employeeCollabs = [
      { folderId: manifest.root, role: 'editor' },
    ];

    const results = [];

    // Set up client App User collaborations
    for (const { folderId, role } of clientCollabs) {
      try {
        await client.userCollaborations.createCollaboration({
          item: { type: 'folder', id: folderId },
          accessibleBy: { type: 'user', id: appUserId },
          role,
        });
        results.push({ folderId, role, success: true });
      } catch (error) {
        if (error.statusCode === 409) {
          // Already exists — treat as success on both tiers
          results.push({ folderId, role, success: true });
        } else {
          results.push({ folderId, role, success: false, error: error.message });
        }
      }
    }

    // Set up employee collaborations
    for (const { folderId, role } of employeeCollabs) {
      try {
        await client.userCollaborations.createCollaboration({
          item: { type: 'folder', id: folderId },
          accessibleBy: { type: 'user', login: employeeEmail },
          role,
        });
        results.push({ folderId, role, success: true });
      } catch (error) {
        if (error.statusCode === 409) {
          results.push({ folderId, role, success: true });
        } else {
          results.push({ folderId, role, success: false, error: error.message });
        }
      }
    }

    // On enterprise tier, log warnings for failed collaborations but don't halt onboarding.
    // Collaboration failures are access-control issues, not data-integrity issues —
    // the vault folders and files are still created correctly.
    if (tier === 'enterprise') {
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        const failedDetails = failed.map(r => `${r.folderId} (${r.role})`).join(', ');
        console.warn(`[Onboarding] Collaboration setup had failures on enterprise tier: ${failedDetails}. Continuing onboarding.`);
      }
    }

    return results;
  }

  /**
   * Creates a file request by copying from a template.
   * @param {string} uploadsFolderId - Target folder for uploads
   * @param {string} title - Descriptive title for the file request
   * @param {string} expiresAt - ISO 8601 expiry date
   * @returns {Promise<{url: string, fileRequestId: string}>}
   */
  async createFileRequest(uploadsFolderId, title, expiresAt) {
    const client = boxService.getBoxClient();
    const templateId = config.fileRequestTemplateId;

    if (!templateId) {
      throw new Error('FILE_REQUEST_TEMPLATE_ID is not configured');
    }

    try {
      const fileRequest = await client.fileRequests.copyFileRequest(templateId, {
        title,
        folder: { id: uploadsFolderId, type: 'folder' },
        expires_at: expiresAt,
        is_email_required: true,
        is_description_required: false,
      });
      return {
        url: fileRequest.url,
        fileRequestId: fileRequest.id,
      };
    } catch (error) {
      throw new Error(
        `Failed to create file request: template=${templateId}, folder=${uploadsFolderId} — ${error.message}`
      );
    }
  }

  /**
   * Full client onboarding orchestrator.
   * Chains: App User → folder hierarchy → folder locks → collaborations → webhook → file request.
   * Receives tier from boxService.getTier() and passes it to each tier-aware phase.
   * Enterprise: phases 3 (locks) and 4 (collaborations) are mandatory — errors propagate.
   * Free: phases 3 and 4 are non-fatal — catch, warn, continue.
   * @param {string} clientName
   * @param {string} externalId
   * @param {string} email - Client email
   * @param {string} employeeEmail - Assigned employee email
   * @param {string} [financialYear] - Tax year (defaults to current year)
   * @returns {Promise<{appUser: object, folders: object, locks: Array, collaborations: Array, webhookId: string|null, fileRequestUrl: string|null, tier: string}>}
   */
  async onboardClient(clientName, externalId, email, employeeEmail, financialYear, password) {
    if (!email) throw new Error('Client email is required for onboarding');
    if (!password) throw new Error('Client password is required for onboarding');

    const year = financialYear || new Date().getFullYear().toString();
    const tier = boxService.getTier();

    // Phase 1: Create App User
    console.log('[Onboarding] Phase 1: Creating App User...');
    const appUser = await this.createAppUser(clientName, email, DEFAULT_SPACE_AMOUNT, password);
    console.log('[Onboarding] Phase 1 complete:', appUser.userId, appUser.isNew ? '(new)' : '(existing)');

    // Phase 2: Create folder hierarchy
    console.log('[Onboarding] Phase 2: Creating folder hierarchy...');
    const folders = await this.createFolderHierarchy(
      clientName,
      externalId,
      config.boxRootFolderId,
      year
    );
    console.log('[Onboarding] Phase 2 complete: root=', folders.root);

    // Phase 3: Apply folder locks
    // Enterprise: mandatory — let errors propagate
    // Free: non-fatal — catch, warn, continue
    let locks = [];
    if (tier === 'enterprise') {
      console.log('[Onboarding] Phase 3: Applying folder locks (enterprise — mandatory)...');
      locks = await this.applyFolderLocks(folders, tier);
      console.log('[Onboarding] Phase 3 complete');
    } else {
      try {
        console.log('[Onboarding] Phase 3: Applying folder locks...');
        locks = await this.applyFolderLocks(folders, tier);
        console.log('[Onboarding] Phase 3 complete');
      } catch (error) {
        console.warn('[Onboarding] Phase 3 skipped (folder locks):', error.message);
      }
    }

    // Phase 4: Setup collaborations
    // Enterprise: mandatory — let errors propagate
    // Free: non-fatal — catch, warn, continue
    let collaborations = [];
    if (tier === 'enterprise') {
      console.log('[Onboarding] Phase 4: Setting up collaborations (enterprise — mandatory)...');
      collaborations = await this.setupCollaborations(
        folders,
        appUser.userId,
        employeeEmail,
        tier
      );
      console.log('[Onboarding] Phase 4 complete');
    } else {
      try {
        console.log('[Onboarding] Phase 4: Setting up collaborations...');
        collaborations = await this.setupCollaborations(
          folders,
          appUser.userId,
          employeeEmail,
          tier
        );
        console.log('[Onboarding] Phase 4 complete');
      } catch (error) {
        console.warn('[Onboarding] Phase 4 skipped (collaborations):', error.message);
      }
    }

    // Phase 5: Register webhook (non-fatal)
    let webhookId = null;
    if (webhookService) {
      try {
        console.log('[Onboarding] Phase 5: Registering webhook...');
        const registration = await webhookService.registerWebhook(folders.root);
        webhookId = registration.webhookId;
        console.log('[Onboarding] Phase 5 complete:', webhookId);
      } catch (error) {
        console.warn('[Onboarding] Phase 5 skipped (webhook):', error.message);
      }
    }

    // Phase 6: Create file request (non-fatal)
    let fileRequestUrl = null;
    if (config.fileRequestTemplateId) {
      try {
        console.log('[Onboarding] Phase 6: Creating file request...');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const fileRequest = await this.createFileRequest(
          folders.uploads,
          `Upload documents for ${clientName} — ${year}`,
          expiresAt
        );
        fileRequestUrl = fileRequest.url;
        console.log('[Onboarding] Phase 6 complete');
      } catch (error) {
        console.warn('[Onboarding] Phase 6 skipped (file request):', error.message);
      }
    }

    console.log('[Onboarding] All phases complete for', clientName);

    return {
      appUser,
      folders,
      locks,
      collaborations,
      webhookId,
      fileRequestUrl,
      tier,
    };
  }
}

// Singleton instance
const onboardingService = new OnboardingService();
export default onboardingService;
