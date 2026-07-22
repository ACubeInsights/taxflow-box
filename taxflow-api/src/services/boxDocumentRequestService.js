/**
 * BoxDocumentRequestService — Document requests stored as Box marker files + metadata.
 * Phase 2e: replaces document_requests table in minimal schema mode.
 */

import crypto from 'crypto';
import boxService from './boxService.js';
import vaultDiscoveryService from './vaultDiscoveryService.js';
import boxDocumentStatusService from './boxDocumentStatusService.js';
import { logger } from '../utils/logger.js';

export class BoxDocumentRequestService {
  constructor() {
    this._userRepo = null;
  }

  setRepositories({ userRepo } = {}) {
    if (userRepo) this._userRepo = userRepo;
  }

  async listByProject(clientId, projectId, { status } = {}) {
    const entries = await boxDocumentStatusService.queryDocumentsByClientId(clientId);
    let docs = entries
      .filter((e) => !e.engagementId || e.engagementId === projectId)
      .map((e) => this._mapEntryToDocument(e, clientId, projectId));

    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      docs = docs.filter((d) => statuses.includes(d.status));
    }
    return docs;
  }

  async getDocument(documentId, clientId) {
    const entries = await boxDocumentStatusService.queryDocumentsByClientId(clientId);
    const entry = entries.find(
      (e) => e.requestId === documentId || e.fileId === documentId
    );
    if (!entry) return null;
    return this._mapEntryToDocument(entry, clientId, entry.engagementId);
  }

  async createRequest(projectId, {
    clientId,
    name,
    description,
    priority,
    dueDate,
    documentType,
    isDraft,
  }) {
    const vault = await vaultDiscoveryService.getVaultForClient(clientId);
    const uploadsFolderId = vault?.uploads || vault?.root;
    if (!uploadsFolderId) {
      throw new Error('Client vault uploads folder not found');
    }

    const requestId = crypto.randomUUID();
    const fileName = `.taxflow-request-${requestId}.json`;
    const payload = Buffer.from(JSON.stringify({
      requestId,
      name,
      description: description || '',
      dueDate,
      documentType,
      isDraft: !!isDraft,
    }));

    const file = await boxService.uploadFile(uploadsFolderId, fileName, payload);

    await boxDocumentStatusService.setFileStatus(file.id, isDraft ? 'Not_Requested' : 'Not_Requested', {
      requestId,
      clientId,
      documentType,
      engagementId: projectId,
      priority: priority?.toLowerCase?.() || 'normal',
      requestName: name,
      dueDate,
      description: description || '',
    });

    return {
      id: requestId,
      name,
      description: description || '',
      dueDate,
      priority: priority || 'Medium',
      status: 'Not_Requested',
      revisionComments: null,
      uploadedFileName: null,
      fileId: file.id,
      clientId,
      projectId,
      documentType,
      version: 1,
      isDraft: !!isDraft,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusSource: 'box',
    };
  }

  async checkDuplicate(projectId, documentType, clientId) {
    const docs = await this.listByProject(clientId, projectId);
    const existing = docs.find((d) => d.documentType === documentType);
    return existing
      ? { isDuplicate: true, existingDocument: existing }
      : { isDuplicate: false };
  }

  async updateStatus(documentId, status, _version, extra = {}) {
    const clientId = extra.clientId;
    if (!clientId) throw new Error('clientId required for minimal schema status update');

    const doc = await this.getDocument(documentId, clientId);
    if (!doc?.fileId) throw new Error('Document not found');

    await boxDocumentStatusService.setFileStatus(doc.fileId, status, {
      requestId: doc.id,
      clientId,
      documentType: doc.documentType,
      engagementId: doc.projectId,
      reviewComments: extra.revisionComments,
    });

    return {
      ...doc,
      status,
      revisionComments: extra.revisionComments ?? doc.revisionComments,
      uploadedFileName: extra.uploadedFileName ?? doc.uploadedFileName,
      fileId: extra.fileId ?? doc.fileId,
      version: (doc.version || 1) + 1,
      updatedAt: new Date().toISOString(),
      statusSource: 'box',
    };
  }

  _mapEntryToDocument(entry, clientId, projectId) {
    return {
      id: entry.requestId || entry.fileId,
      name: entry.requestName || entry.fileName?.replace(/^\.taxflow-request-.*\.json$/, '') || entry.fileName,
      description: entry.description || '',
      dueDate: entry.dueDate || null,
      priority: entry.priority || 'Medium',
      status: entry.apiStatus || 'Not_Requested',
      revisionComments: entry.reviewComments || '',
      uploadedFileName: entry.fileName?.startsWith('.taxflow-request-') ? null : entry.fileName,
      fileId: entry.fileId,
      clientId,
      projectId: entry.engagementId || projectId,
      documentType: entry.documentType || '',
      version: 1,
      isDraft: false,
      statusSource: 'box',
    };
  }
}

const boxDocumentRequestService = new BoxDocumentRequestService();
export default boxDocumentRequestService;
