/**
 * BoxDocumentStatusService — Box metadata as the source of truth for document status.
 *
 * Maps between API statuses (PascalCase) and Box taxflow_document metadata (snake_case).
 * When a document has a box_file_id and enterprise tier is active, status reads/writes
 * go through Box metadata. The local DB row is kept as an index only (request metadata,
 * due dates, project linkage) and synced after Box updates.
 *
 * Requirements: Phase 2a — single source of truth for document workflow status
 */

import boxService from './boxService.js';
import { config } from '../config.js';
import { createHttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';

const METADATA_SCOPE = 'enterprise';
const METADATA_TEMPLATE = 'taxflow_document';

/** API (app/DB) status → Box metadata enum value */
export const API_TO_BOX_STATUS = {
  Not_Requested: 'pending_upload',
  Uploaded: 'uploaded',
  Under_Review: 'under_review',
  Revision_Requested: 'revision_requested',
  Approved: 'approved',
  Waived: 'waived',
};

/** Box metadata enum → API status */
export const BOX_TO_API_STATUS = {
  pending_upload: 'Not_Requested',
  uploaded: 'Uploaded',
  under_review: 'Under_Review',
  revision_requested: 'Revision_Requested',
  approved: 'Approved',
  waived: 'Waived',
  signed: 'Approved',
};

export function toBoxStatus(apiStatus) {
  const mapped = API_TO_BOX_STATUS[apiStatus];
  if (!mapped) {
    throw createHttpError(`Unknown API status: ${apiStatus}`, 400);
  }
  return mapped;
}

export function toApiStatus(boxStatus) {
  if (!boxStatus) return null;
  return BOX_TO_API_STATUS[boxStatus] || null;
}

function isBoxNotFoundError(err) {
  const status = err?.statusCode ?? err?.status ?? err?.responseInfo?.statusCode;
  if (status === 404) return true;
  const message = String(err?.message || '');
  return message.includes('404') && (
    message.includes('not_found') || message.includes('instance_not_found')
  );
}

export class BoxDocumentStatusService {
  _canUseBoxMetadata() {
    return boxService.getTier() === 'enterprise';
  }

  /**
   * Reads workflow status from Box file metadata.
   * @param {string} boxFileId
   * @returns {Promise<string|null>} API status or null if unavailable
   */
  async getFileStatus(boxFileId) {
    if (!boxFileId || !this._canUseBoxMetadata()) return null;

    try {
      const client = boxService.getBoxClient();
      const meta = await client.fileMetadata.getFileMetadataById(
        boxFileId,
        METADATA_SCOPE,
        METADATA_TEMPLATE
      );
      return toApiStatus(meta.status);
    } catch (err) {
      if (err.statusCode === 404 || err.status === 404) return null;
      logger.warn('Failed to read Box metadata status', { boxFileId, error: err.message });
      return null;
    }
  }

  /**
   * Reads full taxflow_document metadata for a file.
   * @param {string} boxFileId
   * @returns {Promise<object|null>}
   */
  async getFileMetadata(boxFileId) {
    if (!boxFileId || !this._canUseBoxMetadata()) return null;

    try {
      const client = boxService.getBoxClient();
      return await client.fileMetadata.getFileMetadataById(
        boxFileId,
        METADATA_SCOPE,
        METADATA_TEMPLATE
      );
    } catch (err) {
      if (err.statusCode === 404 || err.status === 404) return null;
      throw err;
    }
  }

  /**
   * Creates or updates Box metadata status and optional review fields.
   * @param {string} boxFileId
   * @param {string} apiStatus
   * @param {{ reviewer?: string, reviewComments?: string, reviewedAt?: string, requestId?: string, clientId?: string, documentType?: string, financialYear?: string, priority?: string }} [fields]
   */
  async setFileStatus(boxFileId, apiStatus, fields = {}) {
    if (!boxFileId) return false;
    if (!this._canUseBoxMetadata()) return false;

    const client = boxService.getBoxClient();
    const boxStatus = toBoxStatus(apiStatus);
    const payload = { status: boxStatus };

    if (fields.requestId) payload.request_id = fields.requestId;
    if (fields.clientId) payload.client_id = fields.clientId;
    if (fields.documentType) payload.document_type = fields.documentType;
    if (fields.financialYear) payload.financial_year = fields.financialYear;
    if (fields.priority) payload.priority = fields.priority;
    if (fields.engagementId) payload.engagement_id = fields.engagementId;
    if (fields.requestName) payload.request_name = fields.requestName;
    if (fields.dueDate) payload.due_date = fields.dueDate;
    if (fields.description !== undefined) payload.description = fields.description;
    if (fields.reviewer !== undefined) payload.reviewer = fields.reviewer;
    if (fields.reviewComments !== undefined) payload.review_comments = fields.reviewComments;
    if (fields.reviewedAt !== undefined) payload.reviewed_at = fields.reviewedAt;

    try {
      await client.fileMetadata.updateFileMetadataById(
        boxFileId,
        METADATA_SCOPE,
        METADATA_TEMPLATE,
        Object.entries(payload).map(([key, value]) => ({
          op: 'replace',
          path: `/${key}`,
          value,
        }))
      );
      return true;
    } catch (err) {
      if (!isBoxNotFoundError(err)) throw err;

      await client.fileMetadata.createFileMetadataById(
        boxFileId,
        METADATA_SCOPE,
        METADATA_TEMPLATE,
        payload
      );
      return true;
    }
  }

  /**
   * Applies metadata when a client upload is linked to a document request.
   */
  async applyUploadMetadata(boxFileId, {
    requestId,
    clientId,
    documentType,
    financialYear,
    priority = 'normal',
  }) {
    return this.setFileStatus(boxFileId, 'Uploaded', {
      requestId,
      clientId,
      documentType,
      financialYear,
      priority: priority?.toLowerCase?.() || 'normal',
    });
  }

  /**
   * Resolves authoritative status: Box metadata when available, else DB status.
   * @param {{ fileId?: string, box_file_id?: string, status: string }} doc
   * @returns {Promise<string>}
   */
  async resolveStatus(doc) {
    const boxFileId = doc.fileId || doc.box_file_id;
    if (!boxFileId) return doc.status;

    const boxStatus = await this.getFileStatus(boxFileId);
    return boxStatus ?? doc.status;
  }

  /**
   * Queries all taxflow_document metadata entries for a client (enterprise tier).
   * @param {string} clientId
   * @returns {Promise<Array<object>>}
   */
  async queryDocumentsByClientId(clientId) {
    if (!clientId || !this._canUseBoxMetadata()) return [];

    try {
      const client = boxService.getBoxClient();
      const queryResult = await client.metadataQueries?.executeRead?.({
        from: `${METADATA_SCOPE}_${METADATA_TEMPLATE}`,
        query: 'client_id = :clientId',
        queryParams: { clientId },
        ancestorFolderId: config.boxRootFolderId,
        fields: [
          'id',
          'name',
          'created_at',
          'metadata.enterprise.taxflow_document.request_id',
          'metadata.enterprise.taxflow_document.engagement_id',
          'metadata.enterprise.taxflow_document.document_type',
          'metadata.enterprise.taxflow_document.status',
          'metadata.enterprise.taxflow_document.priority',
          'metadata.enterprise.taxflow_document.reviewer',
          'metadata.enterprise.taxflow_document.reviewed_at',
          'metadata.enterprise.taxflow_document.review_comments',
          'metadata.enterprise.taxflow_document.financial_year',
          'metadata.enterprise.taxflow_document.request_name',
          'metadata.enterprise.taxflow_document.due_date',
          'metadata.enterprise.taxflow_document.description',
        ],
      }) || { entries: [] };

      return (queryResult.entries || []).map((entry) => this._mapQueryEntry(entry));
    } catch (err) {
      logger.warn('Box metadata query failed for client', { clientId, error: err.message });
      return [];
    }
  }

  /**
   * Maps a Box metadata query entry to a normalized shape with API status.
   * @param {object} entry
   * @returns {object}
   */
  _mapQueryEntry(entry) {
    const meta = entry.metadata?.enterprise?.taxflow_document || {};
    return {
      fileId: entry.id,
      fileName: entry.name,
      requestId: meta.request_id || null,
      documentType: meta.document_type || '',
      boxStatus: meta.status || '',
      apiStatus: toApiStatus(meta.status),
      priority: meta.priority || 'normal',
      reviewer: meta.reviewer || '',
      reviewedAt: meta.reviewed_at || null,
      reviewComments: meta.review_comments || '',
      uploadedAt: entry.created_at || null,
      engagementId: meta.engagement_id || null,
      requestName: meta.request_name || '',
      dueDate: meta.due_date || null,
      description: meta.description || '',
    };
  }

  /**
   * Merges DB document request rows with Box metadata query results.
   * Box status wins when a matching file or request_id is found.
   * @param {object[]} dbDocs - App-level document objects from projectService
   * @param {string} clientId
   * @returns {Promise<object[]>}
   */
  async mergeWithBoxMetadata(dbDocs, clientId) {
    if (!dbDocs.length) return dbDocs;

    const boxEntries = await this.queryDocumentsByClientId(clientId);
    if (!boxEntries.length) {
      return dbDocs.map((doc) => ({ ...doc, statusSource: 'db' }));
    }

    const byFileId = new Map();
    const byRequestId = new Map();
    for (const entry of boxEntries) {
      byFileId.set(entry.fileId, entry);
      if (entry.requestId) byRequestId.set(entry.requestId, entry);
    }

    return dbDocs.map((doc) => {
      const boxEntry =
        (doc.fileId && byFileId.get(doc.fileId)) ||
        byRequestId.get(doc.id) ||
        null;

      if (!boxEntry) {
        return { ...doc, statusSource: 'db' };
      }

      return {
        ...doc,
        fileId: boxEntry.fileId || doc.fileId,
        uploadedFileName: boxEntry.fileName || doc.uploadedFileName,
        status: boxEntry.apiStatus ?? doc.status,
        revisionComments: boxEntry.reviewComments || doc.revisionComments,
        statusSource: 'box',
        boxMetadata: {
          status: boxEntry.boxStatus,
          reviewer: boxEntry.reviewer,
          reviewedAt: boxEntry.reviewedAt,
          requestId: boxEntry.requestId,
        },
      };
    });
  }

  /**
   * Builds a unified client document list: Box files + DB requests without uploads.
   * Used by portal progress views.
   * @param {string} clientId
   * @param {object[]} dbDocs - Raw DB rows or mapped docs
   * @param {(row: object) => object} [mapFn]
   */
  async buildClientDocumentList(clientId, dbDocs, mapFn = (d) => d) {
    const mapped = dbDocs.map(mapFn).filter((d) => !d.isDraft);
    const merged = await this.mergeWithBoxMetadata(mapped, clientId);

    const coveredRequestIds = new Set(
      merged.filter((d) => d.fileId || d.status !== 'Not_Requested').map((d) => d.id)
    );

    // Include draft=false Not_Requested rows not yet linked to Box
    const pending = mapped.filter(
      (d) => !d.isDraft && d.status === 'Not_Requested' && !coveredRequestIds.has(d.id)
    );

    const combined = [...merged];
    for (const p of pending) {
      if (!combined.some((c) => c.id === p.id)) {
        combined.push({ ...p, statusSource: 'db' });
      }
    }

    return combined;
  }

  /**
   * Enriches an app-level document object with Box-authoritative status fields.
   * Prefer mergeWithBoxMetadata for batch reads.
   * @param {object} doc - Mapped document from projectService
   * @returns {Promise<object>}
   */
  async enrichDocument(doc) {
    if (!doc.clientId) {
      const boxFileId = doc.fileId;
      if (!boxFileId || !this._canUseBoxMetadata()) {
        return { ...doc, statusSource: 'db' };
      }
      const meta = await this.getFileMetadata(boxFileId);
      if (!meta) return { ...doc, statusSource: 'db' };
      return {
        ...doc,
        status: toApiStatus(meta.status) ?? doc.status,
        revisionComments: meta.review_comments ?? doc.revisionComments,
        statusSource: 'box',
        boxMetadata: {
          status: meta.status,
          reviewer: meta.reviewer,
          reviewedAt: meta.reviewed_at,
          requestId: meta.request_id,
        },
      };
    }

    const [merged] = await this.mergeWithBoxMetadata([doc], doc.clientId);
    return merged;
  }
}

const boxDocumentStatusService = new BoxDocumentStatusService();
export default boxDocumentStatusService;
