/**
 * VaultDiscoveryService — Discovers client vault folder structure from Box.
 * Phase 2d: Box is the source of truth; client_vaults DB is an optional write-through cache.
 */

import boxService from './boxService.js';
import cacheLayer from './cacheLayer.js';
import { logger } from '../utils/logger.js';

/** Expected subfolder names under Projects → DB/API keys */
export const SUBFOLDER_MAP = {
  Tax: 'tax',
  Uploads: 'uploads',
  SupportingDocs: 'supportingDocs',
  SignedDocuments: 'signedDocuments',
  InternalNotes: 'internalNotes',
};

const SUBFOLDER_DB_KEYS = {
  Tax: 'tax_folder_id',
  Uploads: 'uploads_folder_id',
  SupportingDocs: 'supporting_docs_folder_id',
  SignedDocuments: 'signed_documents_folder_id',
  InternalNotes: 'internal_notes_folder_id',
};

/**
 * Maps a vault manifest (DB row or discovered object) to the API response shape.
 * @param {object|null} row
 * @returns {object|null}
 */
export function mapVaultManifest(row) {
  if (!row) return null;
  return {
    clientId: row.client_id || row.clientId,
    financialYear: row.financial_year || row.financialYear,
    root: row.root_folder_id || row.root,
    year: row.year_folder_id || row.year,
    projects: row.projects_folder_id || row.projects,
    tax: row.tax_folder_id || row.tax,
    uploads: row.uploads_folder_id || row.uploads,
    supportingDocs: row.supporting_docs_folder_id || row.supportingDocs,
    signedDocuments: row.signed_documents_folder_id || row.signedDocuments,
    internalNotes: row.internal_notes_folder_id || row.internalNotes,
    source: row.source || 'box',
  };
}

export class VaultDiscoveryService {
  constructor() {
    this._clientRepo = null;
    this._clientVaultRepo = null;
    this._userRepo = null;
  }

  setRepositories({ clientRepo, clientVaultRepo, userRepo } = {}) {
    if (clientRepo) this._clientRepo = clientRepo;
    if (clientVaultRepo) this._clientVaultRepo = clientVaultRepo;
    if (userRepo) this._userRepo = userRepo;
  }

  /**
   * Returns the vault folder manifest for a client, discovering from Box when needed.
   * @param {string} clientId - Client UUID or external_id
   * @returns {Promise<object|null>} API vault shape
   */
  async getVaultForClient(clientId) {
    const cacheKey = `vault:client:${clientId}`;
    return cacheLayer.getOrFetch(cacheKey, 120, () => this._discoverVault(clientId));
  }

  /**
   * Returns all known vault folder IDs for access checks and collaboration setup.
   * @param {string} clientId
   * @returns {Promise<Array<{ id: string, name: string }>>}
   */
  async getVaultFolderIds(clientId) {
    const vault = await this.getVaultForClient(clientId);
    if (!vault) return [];

    return [
      { id: vault.root, name: 'Root' },
      { id: vault.uploads, name: 'Uploads' },
      { id: vault.tax, name: 'Tax' },
      { id: vault.signedDocuments, name: 'Signed Documents' },
      { id: vault.supportingDocs, name: 'Supporting Docs' },
      { id: vault.projects, name: 'Projects' },
      { id: vault.year, name: 'Year' },
      { id: vault.internalNotes, name: 'Internal Notes' },
    ].filter((f) => f.id);
  }

  /**
   * Invalidates cached vault data after onboarding or folder changes.
   * @param {string} clientId
   */
  async invalidate(clientId) {
    await cacheLayer.invalidate(`vault:client:${clientId}`);
  }

  async _discoverVault(clientId) {
    const clientRecord = await this._resolveClient(clientId);
    const resolvedClientId = clientRecord?.id || clientId;

    // Optional DB cache read (fast path)
    if (this._clientVaultRepo) {
      let vaultRow = await this._clientVaultRepo.findByClientId(resolvedClientId);
      if (!vaultRow && clientRecord?.external_id) {
        vaultRow = await this._clientVaultRepo.findByExternalId(clientRecord.external_id);
      }
      if (vaultRow?.root_folder_id) {
        return mapVaultManifest({ ...vaultRow, source: 'db' });
      }
    }

    const searchExternalId = clientRecord?.external_id || clientId;
    let rootFolder = null;

    // clients.box_folder_id is a lightweight index when present
    if (clientRecord?.box_folder_id) {
      rootFolder = { id: clientRecord.box_folder_id };
    }

    if (!rootFolder) {
      try {
        rootFolder = await boxService.findVaultByExternalId(searchExternalId);
      } catch (err) {
        logger.warn('Box vault search failed', { clientId, error: err.message });
      }
    }

    if (!rootFolder?.id) return null;

    const manifest = await this._enumerateVaultStructure(
      rootFolder.id,
      resolvedClientId,
      searchExternalId
    );

    await this._persistCache(manifest);
    return mapVaultManifest({ ...manifest, source: 'box' });
  }

  async _resolveClient(clientId) {
    if (this._clientRepo) {
      let client = await this._clientRepo.findById(clientId);
      if (!client) client = await this._clientRepo.findByExternalId(clientId);
      return client;
    }
    if (this._userRepo) {
      let user = await this._userRepo.findById(clientId);
      if (!user) user = await this._userRepo.findByExternalId(clientId);
      if (user?.role === 'client') {
        return {
          id: user.id,
          external_id: user.external_id,
          box_folder_id: user.box_folder_id,
        };
      }
    }
    return null;
  }

  async _enumerateVaultStructure(rootFolderId, clientId, externalId) {
    const financialYear = new Date().getFullYear().toString();
    const subfolderIds = {};
    let yearFolderId = null;
    let projectsFolderId = null;

    try {
      const rootChildren = await boxService.listFiles(rootFolderId);
      const yearFolder = rootChildren.find((item) => item.type === 'folder');
      if (yearFolder) {
        yearFolderId = yearFolder.id;

        const yearChildren = await boxService.listFiles(yearFolderId);
        const projectsFolder = yearChildren.find(
          (item) => item.type === 'folder' && item.name === 'Projects'
        );

        if (projectsFolder) {
          projectsFolderId = projectsFolder.id;
          const projectsChildren = await boxService.listFiles(projectsFolderId);

          for (const [name, dbKey] of Object.entries(SUBFOLDER_DB_KEYS)) {
            const match = projectsChildren.find(
              (item) => item.type === 'folder' && item.name === name
            );
            if (match) subfolderIds[dbKey] = match.id;
          }
        }
      }
    } catch (err) {
      logger.warn('Vault subfolder enumeration failed', { rootFolderId, error: err.message });
    }

    return {
      client_id: clientId,
      financial_year: financialYear,
      root_folder_id: rootFolderId,
      year_folder_id: yearFolderId || rootFolderId,
      projects_folder_id: projectsFolderId || null,
      tax_folder_id: subfolderIds.tax_folder_id || null,
      uploads_folder_id: subfolderIds.uploads_folder_id || rootFolderId,
      supporting_docs_folder_id: subfolderIds.supporting_docs_folder_id || null,
      signed_documents_folder_id: subfolderIds.signed_documents_folder_id || null,
      internal_notes_folder_id: subfolderIds.internal_notes_folder_id || null,
      external_id: externalId,
    };
  }

  async _persistCache(manifest) {
    if (!this._clientVaultRepo || !manifest.client_id) return;
    try {
      await this._clientVaultRepo.upsert(manifest);
    } catch (err) {
      logger.warn('Vault cache persist failed (non-fatal)', { error: err.message });
    }
  }
}

const vaultDiscoveryService = new VaultDiscoveryService();
export default vaultDiscoveryService;
