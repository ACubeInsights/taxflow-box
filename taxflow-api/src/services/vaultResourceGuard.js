/**
 * Vault resource guard — ensures staff operations only touch Box files/folders
 * that belong to a known client vault (prevents arbitrary enterprise IDOR by fileId).
 */

import boxService from './boxService.js';
import { getRepositories } from '../db/repositories/index.js';
import { createHttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';
import { getDb } from '../db/db.js';

const VAULT_FOLDER_COLUMNS = [
  'root_folder_id',
  'year_folder_id',
  'projects_folder_id',
  'tax_folder_id',
  'uploads_folder_id',
  'supporting_docs_folder_id',
  'signed_documents_folder_id',
  'internal_notes_folder_id',
];

class VaultResourceGuard {
  /**
   * @returns {Promise<Set<string>>}
   */
  async getKnownVaultFolderIds() {
    const repos = getRepositories();
    const ids = new Set();

    if (repos.clientVaultRepo) {
      const rows = await repos.clientVaultRepo.query().select(VAULT_FOLDER_COLUMNS);
      for (const row of rows) {
        for (const col of VAULT_FOLDER_COLUMNS) {
          if (row[col]) ids.add(String(row[col]));
        }
      }
    }

    return ids;
  }

  /**
   * Walks Box parent chain for a file or folder.
   * @param {string} resourceId
   * @param {'file'|'folder'} resourceType
   * @returns {Promise<string[]>} parent folder IDs (nearest first)
   */
  async getParentFolderChain(resourceId, resourceType = 'file') {
    const client = boxService.getBoxClient();
    const chain = [];
    let parentId;

    try {
      if (resourceType === 'file') {
        const file = await client.files.getFileById(resourceId, {
          queryParams: { fields: ['parent'] },
        });
        parentId = file.parent?.id;
      } else {
        const folder = await client.folders.getFolderById(resourceId, {
          queryParams: { fields: ['parent'] },
        });
        parentId = folder.parent?.id;
        chain.push(String(resourceId));
      }
    } catch (err) {
      if (err.statusCode === 404 || err.status === 404) {
        throw createHttpError('Resource not found', 404, 'NOT_FOUND');
      }
      throw err;
    }

    let depth = 0;
    while (parentId && parentId !== '0' && depth < 40) {
      chain.push(String(parentId));
      try {
        const parent = await client.folders.getFolderById(parentId, {
          queryParams: { fields: ['parent'] },
        });
        parentId = parent.parent?.id;
      } catch {
        break;
      }
      depth += 1;
    }

    return chain;
  }

  /**
   * Fast path: file referenced by a document request row.
   * @param {string} fileId
   */
  async isTrackedDocumentFile(fileId) {
    try {
      const db = getDb();
      const row = await db('document_requests').where('box_file_id', String(fileId)).first();
      return Boolean(row);
    } catch {
      return false;
    }
  }

  /**
   * Asserts a Box file belongs to a known TaxFlow client vault.
   * @param {string} fileId
   */
  async assertKnownVaultFile(fileId) {
    if (!fileId) throw createHttpError('fileId is required', 400, 'VALIDATION_ERROR');

    if (await this.isTrackedDocumentFile(fileId)) {
      return true;
    }

    const known = await this.getKnownVaultFolderIds();
    if (known.size === 0) {
      // No vaults provisioned yet — deny rather than open the enterprise
      throw createHttpError('Resource not found', 404, 'NOT_FOUND');
    }

    const chain = await this.getParentFolderChain(fileId, 'file');
    const ok = chain.some((id) => known.has(String(id)));


    if (!ok) {
      logger.warn('Blocked staff access to non-vault file', { fileId });
      throw createHttpError('Resource not found', 404, 'NOT_FOUND');
    }
    return true;
  }

  /**
   * Asserts a Box folder is a known vault folder (or under one).
   * @param {string} folderId
   */
  async assertKnownVaultFolder(folderId) {
    if (!folderId) throw createHttpError('folderId is required', 400, 'VALIDATION_ERROR');
    if (folderId === '0') throw createHttpError('Resource not found', 404, 'NOT_FOUND');

    const known = await this.getKnownVaultFolderIds();
    if (known.has(String(folderId))) return true;

    const chain = await this.getParentFolderChain(folderId, 'folder');
    const ok = chain.some((id) => known.has(String(id)));
    if (!ok) {
      throw createHttpError('Resource not found', 404, 'NOT_FOUND');
    }
    return true;
  }

  /**
   * Filters a list of file IDs to those inside known vaults.
   * @param {string[]} fileIds
   * @returns {Promise<string[]>}
   */
  async filterKnownVaultFiles(fileIds) {
    const allowed = [];
    for (const id of fileIds) {
      try {
        await this.assertKnownVaultFile(id);
        allowed.push(id);
      } catch (err) {
        if (err.statusCode === 404) continue;
        throw err;
      }
    }
    return allowed;
  }
}

const vaultResourceGuard = new VaultResourceGuard();
export default vaultResourceGuard;
