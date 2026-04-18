import express from 'express';
import boxService from '../services/boxService.js';
import { config } from '../config.js';
import { getRepositories } from '../db/repositories/index.js';

const router = express.Router();
const vaultCache = new Map();

/**
 * Maps a client_vaults DB row to the API response shape.
 * @param {object} row - Database row from client_vaults table
 * @returns {object|null}
 */
function mapVaultFromDb(row) {
  if (!row) return null;
  return {
    clientId: row.client_id,
    financialYear: row.financial_year,
    root: row.root_folder_id,
    year: row.year_folder_id,
    projects: row.projects_folder_id,
    tax: row.tax_folder_id,
    uploads: row.uploads_folder_id,
    supportingDocs: row.supporting_docs_folder_id,
    signedDocuments: row.signed_documents_folder_id,
    internalNotes: row.internal_notes_folder_id,
  };
}

/**
 * Subfolder name mapping: expected Box folder names → DB column keys.
 */
const SUBFOLDER_MAP = {
  'Tax': 'tax_folder_id',
  'Uploads': 'uploads_folder_id',
  'SupportingDocs': 'supporting_docs_folder_id',
  'SignedDocuments': 'signed_documents_folder_id',
  'InternalNotes': 'internal_notes_folder_id',
};

async function ensureAdminCollaborator(folderId) {
  if (!config.boxAdminEmail) return;
  try {
    await boxService.addCollaborator(folderId, config.boxAdminEmail, 'co-owner');
  } catch (err) {
    // Non-critical — log and continue
    console.warn('Collaborator add skipped:', err.message);
  }
}

router.post('/', async (req, res, next) => {
  try {
    const { name, externalId, email } = req.body;

    if (!name || !externalId || !email) {
      return res.status(400).json({ error: 'Missing required fields: name, externalId, email' });
    }

    if (vaultCache.has(externalId)) {
      const cached = vaultCache.get(externalId);
      await ensureAdminCollaborator(cached.id);
      return res.json({ vault: cached });
    }

    const existingVault = await boxService.findVaultByExternalId(externalId);
    if (existingVault) {
      vaultCache.set(externalId, existingVault);
      await ensureAdminCollaborator(existingVault.id);
      return res.json({ vault: existingVault });
    }

    const result = await boxService.createClientVault(name, externalId, email);
    await ensureAdminCollaborator(result.folder.id);
    vaultCache.set(externalId, result.folder);

    res.status(201).json({
      vault: result.folder,
      cascadePolicyId: result.metadataCascadePolicyId,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:clientId/vault', async (req, res, next) => {
  try {
    const { clientId } = req.params;
    let repos;
    try {
      repos = getRepositories();
    } catch {
      repos = null;
    }

    // Step 1: Try DB lookup by client_id (UUID), then by external_id
    if (repos && repos.clientVaultRepo) {
      let vaultRow = await repos.clientVaultRepo.findByClientId(clientId);
      if (!vaultRow) {
        vaultRow = await repos.clientVaultRepo.findByExternalId(clientId);
      }
      if (vaultRow) {
        return res.json({ vault: mapVaultFromDb(vaultRow) });
      }
    }

    // Step 2: Fallback — look up client record, then search Box
    let clientRecord = null;
    if (repos && repos.clientRepo) {
      clientRecord = await repos.clientRepo.findById(clientId);
      if (!clientRecord) {
        clientRecord = await repos.clientRepo.findByExternalId(clientId);
      }
    }

    // Try Box search using the external ID (or clientId as external ID)
    const searchExternalId = clientRecord?.external_id || clientId;
    let rootFolder = null;
    try {
      rootFolder = await boxService.findVaultByExternalId(searchExternalId);
    } catch (boxErr) {
      console.warn('Box vault search failed:', boxErr.message);
    }

    if (!rootFolder) {
      return res.status(404).json({ error: 'Client vault not found' });
    }

    // Step 3: Enumerate subfolders from Box
    const rootFolderId = rootFolder.id || rootFolder;
    let yearFolderId = null;
    const subfolderIds = {};
    const missingSubfolders = [];

    let projectsFolderId = null;

    try {
      // List root folder children to find the year folder
      const rootChildren = await boxService.listFiles(rootFolderId);
      const yearFolder = rootChildren.find(item => item.type === 'folder');
      if (yearFolder) {
        yearFolderId = yearFolder.id;

        // List year folder children to find the Projects folder
        const yearChildren = await boxService.listFiles(yearFolderId);
        const projectsFolder = yearChildren.find(
          item => item.type === 'folder' && item.name === 'Projects'
        );

        if (projectsFolder) {
          projectsFolderId = projectsFolder.id;

          // List Projects folder children to find the 5 subfolders
          const projectsChildren = await boxService.listFiles(projectsFolderId);
          for (const [name, dbKey] of Object.entries(SUBFOLDER_MAP)) {
            const match = projectsChildren.find(
              item => item.type === 'folder' && item.name === name
            );
            if (match) {
              subfolderIds[dbKey] = match.id;
            } else {
              missingSubfolders.push(name);
            }
          }
        } else {
          console.warn(`Vault for ${searchExternalId}: Projects folder not found`);
          missingSubfolders.push(...Object.keys(SUBFOLDER_MAP));
        }
      }
    } catch (listErr) {
      console.warn('Box subfolder enumeration failed:', listErr.message);
    }

    if (missingSubfolders.length > 0) {
      console.warn(`Vault for ${searchExternalId}: missing subfolders: ${missingSubfolders.join(', ')}`);
    }

    // Build the manifest
    const financialYear = new Date().getFullYear().toString();
    const manifest = {
      client_id: clientRecord?.id || clientId,
      financial_year: financialYear,
      root_folder_id: rootFolderId,
      year_folder_id: yearFolderId || rootFolderId,
      projects_folder_id: projectsFolderId || null,
      tax_folder_id: subfolderIds.tax_folder_id || null,
      uploads_folder_id: subfolderIds.uploads_folder_id || rootFolderId,
      supporting_docs_folder_id: subfolderIds.supporting_docs_folder_id || null,
      signed_documents_folder_id: subfolderIds.signed_documents_folder_id || null,
      internal_notes_folder_id: subfolderIds.internal_notes_folder_id || null,
    };

    // Persist the discovered manifest via upsert
    if (repos && repos.clientVaultRepo && clientRecord) {
      try {
        await repos.clientVaultRepo.upsert(manifest);
      } catch (upsertErr) {
        console.warn('Failed to persist discovered vault manifest:', upsertErr.message);
      }
    }

    await ensureAdminCollaborator(rootFolderId);
    res.json({ vault: mapVaultFromDb(manifest) });
  } catch (error) {
    next(error);
  }
});

export default router;
