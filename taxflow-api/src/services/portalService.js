/**
 * PortalService — Client progress, employee dashboard, CXO portfolio,
 * inactive client detection, file versions, and zip downloads.
 *
 * - getClientProgress: Metadata query by client_id, group by status, cache 60s
 * - getEmployeeDashboard: Metadata query by reviewer + status, sort by priority, cache 30s
 * - getCXOPortfolio: Cross-client aggregation with pagination, cache 120s
 * - getInactiveClients: Events API with admin_logs, compare timestamps
 * - getFileVersions: GET /files/{id}/versions, sorted descending
 * - createZipDownload: POST /zip_downloads, poll status, max 100 files
 *
 * Requirements: 19.1-19.5, 20.1-20.5, 21.1-21.5, 22.1-22.5, 23.1-23.4, 24.1-24.5
 */

import boxService from './boxService.js';
import cacheLayer from './cacheLayer.js';
import paginationHelper from './paginationHelper.js';
import { config } from '../config.js';

const METADATA_SCOPE = 'enterprise';
const METADATA_TEMPLATE = 'taxflow_document';
const MAX_ZIP_FILES = 100;
const ZIP_POLL_INTERVAL_MS = 1000;
const ZIP_MAX_POLL_ATTEMPTS = 60;

export class PortalService {
  /**
   * Client progress via metadata query, cached 60s. (Reqs 19.1-19.5)
   *
   * @param {string} clientId
   * @returns {Promise<{ clientId: string, documents: Array, statusCounts: object }>}
   */
  async getClientProgress(clientId) {
    const cacheKey = `portal:client:${clientId}`;

    return cacheLayer.getOrFetch(cacheKey, 60, async () => {
      const client = boxService.getBoxClient();

      // Metadata query filtering by client_id (Req 19.1)
      const queryResult = await client.metadataQueries?.executeRead?.({
        from: `${METADATA_SCOPE}_${METADATA_TEMPLATE}`,
        query: 'client_id = :clientId',
        queryParams: { clientId },
        ancestorFolderId: config.boxRootFolderId,
        fields: [
          'id', 'name', 'metadata.enterprise.taxflow_document.document_type',
          'metadata.enterprise.taxflow_document.status',
          'metadata.enterprise.taxflow_document.priority',
          'metadata.enterprise.taxflow_document.reviewed_at',
          'metadata.enterprise.taxflow_document.review_comments',
        ],
      }) || { entries: [] };

      const entries = queryResult.entries || [];
      const documents = entries.map((entry) => {
        const meta = entry.metadata?.enterprise?.taxflow_document || {};
        return {
          fileId: entry.id,
          fileName: entry.name,
          documentType: meta.document_type || '',
          status: meta.status || '',
          priority: meta.priority || 'normal',
          reviewedAt: meta.reviewed_at || undefined,
          reviewComments: meta.status === 'revision_requested' ? (meta.review_comments || undefined) : undefined,
        };
      });

      // Group by status (Req 19.2)
      const statusCounts = {};
      for (const doc of documents) {
        statusCounts[doc.status] = (statusCounts[doc.status] || 0) + 1;
      }

      return { clientId, documents, statusCounts };
    });
  }

  /**
   * Employee dashboard: pending reviews sorted by priority, flag overdue, cache 30s. (Reqs 20.1-20.5)
   *
   * @param {string} employeeId
   * @returns {Promise<{ pendingReviews: Array, clientChecklists: Array }>}
   */
  async getEmployeeDashboard(employeeId) {
    const cacheKey = `portal:employee:${employeeId}`;

    return cacheLayer.getOrFetch(cacheKey, 30, async () => {
      const client = boxService.getBoxClient();

      // Metadata query by reviewer + status (Req 20.1)
      const queryResult = await client.metadataQueries?.executeRead?.({
        from: `${METADATA_SCOPE}_${METADATA_TEMPLATE}`,
        query: 'reviewer = :reviewer AND status = :status',
        queryParams: { reviewer: employeeId, status: 'uploaded' },
        ancestorFolderId: config.boxRootFolderId,
        fields: [
          'id', 'name', 'created_at',
          'metadata.enterprise.taxflow_document.client_id',
          'metadata.enterprise.taxflow_document.priority',
          'metadata.enterprise.taxflow_document.status',
        ],
      }) || { entries: [] };

      const entries = queryResult.entries || [];
      const now = new Date();

      // Sort by priority then upload date (Req 20.2)
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };

      const pendingReviews = entries
        .map((entry) => {
          const meta = entry.metadata?.enterprise?.taxflow_document || {};
          const uploadedAt = entry.created_at || '';
          return {
            fileId: entry.id,
            fileName: entry.name,
            clientName: meta.client_id || '',
            priority: meta.priority || 'normal',
            uploadedAt,
            isOverdue: uploadedAt ? (now - new Date(uploadedAt)) > 7 * 24 * 60 * 60 * 1000 : false,
          };
        })
        .sort((a, b) => {
          const pa = priorityOrder[a.priority] ?? 2;
          const pb = priorityOrder[b.priority] ?? 2;
          if (pa !== pb) return pa - pb;
          return new Date(a.uploadedAt) - new Date(b.uploadedAt);
        });

      // Build client checklists (Req 20.4)
      const clientMap = new Map();
      for (const entry of entries) {
        const meta = entry.metadata?.enterprise?.taxflow_document || {};
        const cid = meta.client_id || 'unknown';
        if (!clientMap.has(cid)) {
          clientMap.set(cid, { clientId: cid, clientName: cid, totalRequired: 0, submitted: 0, approved: 0, pending: 0 });
        }
        const cl = clientMap.get(cid);
        cl.totalRequired++;
        cl.submitted++;
        const status = meta.status || '';
        if (status === 'approved') cl.approved++;
        else cl.pending++;
      }

      return {
        pendingReviews,
        clientChecklists: Array.from(clientMap.values()),
      };
    });
  }

  /**
   * CXO portfolio: cross-client aggregation with pagination, cache 120s. (Reqs 21.1-21.5)
   *
   * @param {string} [cursor]
   * @param {number} [limit]
   * @returns {Promise<{ data: { clients: Array, firmTotals: object }, nextCursor?: string, limit: number }>}
   */
  async getCXOPortfolio(cursor, limit = 50) {
    const cacheKey = `portal:cxo:${cursor || 'start'}:${limit}`;

    return cacheLayer.getOrFetch(cacheKey, 120, async () => {
      const client = boxService.getBoxClient();

      // Cross-client metadata query with pagination (Reqs 21.1, 21.4)
      const page = await paginationHelper.paginate(
        async (marker, pageLimit) => {
          const result = await client.metadataQueries?.executeRead?.({
            from: `${METADATA_SCOPE}_${METADATA_TEMPLATE}`,
            ancestorFolderId: config.boxRootFolderId,
            query: '',
            queryParams: {},
            marker,
            limit: pageLimit,
            fields: [
              'id', 'name',
              'metadata.enterprise.taxflow_document.client_id',
              'metadata.enterprise.taxflow_document.status',
            ],
          }) || { entries: [], next_marker: undefined };
          return result;
        },
        { marker: cursor, limit }
      );

      // Aggregate per client (Req 21.2)
      const clientAgg = new Map();
      for (const entry of page.entries) {
        const meta = entry.metadata?.enterprise?.taxflow_document || {};
        const cid = meta.client_id || 'unknown';
        if (!clientAgg.has(cid)) {
          clientAgg.set(cid, { clientName: cid, totalDocuments: 0, approved: 0, pending: 0, revisions: 0, completionPercentage: 0 });
        }
        const agg = clientAgg.get(cid);
        agg.totalDocuments++;
        const status = meta.status || '';
        if (status === 'approved' || status === 'signed') agg.approved++;
        else if (status === 'revision_requested') agg.revisions++;
        else agg.pending++;
      }

      const clients = Array.from(clientAgg.values()).map((c) => ({
        ...c,
        completionPercentage: c.totalDocuments > 0 ? Math.round((c.approved / c.totalDocuments) * 100) : 0,
      }));

      // Firm-wide totals (Req 21.3)
      const totalDocuments = clients.reduce((s, c) => s + c.totalDocuments, 0);
      const totalApproved = clients.reduce((s, c) => s + c.approved, 0);
      const overdueClients = clients.filter((c) => c.pending > 0 || c.revisions > 0).length;

      const firmTotals = {
        totalClients: clients.length,
        totalDocuments,
        complianceRate: totalDocuments > 0 ? Math.round((totalApproved / totalDocuments) * 100) : 0,
        overdueClients,
      };

      return {
        data: { clients, firmTotals },
        nextCursor: page.nextMarker,
        limit: page.limit,
      };
    });
  }

  /**
   * Detects clients with no activity within threshold. (Reqs 22.1-22.5)
   *
   * @param {number} [thresholdDays] - Inactivity threshold in days (default from config)
   * @returns {Promise<Array<{ clientId: string, clientName: string, lastActivity: string }>>}
   */
  async getInactiveClients(thresholdDays) {
    const threshold = thresholdDays || config.inactiveThresholdDays || 30;
    const client = boxService.getBoxClient();
    const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000);

    // Query Events API with admin_logs (Reqs 22.1, 22.5)
    const clientActivity = new Map();
    let streamPosition = '0';
    let hasMore = true;

    while (hasMore) {
      const events = await client.events.getEvents({
        stream_type: 'admin_logs',
        event_type: 'UPLOAD,PREVIEW,DOWNLOAD',
        stream_position: streamPosition,
        limit: 500,
      });

      const entries = events.entries || [];
      for (const event of entries) {
        const source = event.source || {};
        // Try to extract client context from the event source path
        const parentId = source.parent?.id || source.item?.parent?.id || '';
        const createdAt = event.created_at || '';

        if (parentId && createdAt) {
          const existing = clientActivity.get(parentId);
          if (!existing || new Date(createdAt) > new Date(existing)) {
            clientActivity.set(parentId, createdAt);
          }
        }
      }

      streamPosition = events.next_stream_position || '';
      hasMore = entries.length > 0 && streamPosition && streamPosition !== '0';
    }

    // Compare timestamps against threshold (Req 22.2)
    const inactive = [];
    for (const [clientId, lastActivity] of clientActivity) {
      if (new Date(lastActivity) < cutoff) {
        inactive.push({
          clientId,
          clientName: clientId,
          lastActivity,
        });
      }
    }

    return inactive;
  }

  /**
   * File version history sorted by version number descending. (Reqs 23.1-23.4)
   *
   * @param {string} fileId
   * @returns {Promise<Array<{ versionId: string, name: string, size: number, modifiedBy: string, modifiedAt: string, versionNumber: number }>>}
   */
  async getFileVersions(fileId) {
    const client = boxService.getBoxClient();

    let versions = [];
    try {
      const result = await client.fileVersions.getFileVersions(fileId);
      versions = result.entries || [];
    } catch (err) {
      // If no versions endpoint or single-version file (Req 23.4)
      if (err.statusCode === 404 || err.status === 404) {
        versions = [];
      } else {
        throw err;
      }
    }

    // If no previous versions, return current file info as the only entry
    if (versions.length === 0) {
      try {
        const file = await client.files.getFileById(fileId, {
          fields: ['id', 'name', 'size', 'modified_by', 'modified_at'],
        });
        return [{
          versionId: file.id,
          name: file.name,
          size: file.size || 0,
          modifiedBy: file.modified_by?.name || file.modified_by?.login || '',
          modifiedAt: file.modified_at || '',
          versionNumber: 1,
        }];
      } catch (err) {
        throw err;
      }
    }

    // Sort by version number descending (Req 23.3)
    return versions
      .map((v, idx) => ({
        versionId: v.id,
        name: v.name || '',
        size: v.size || 0,
        modifiedBy: v.modified_by?.name || v.modified_by?.login || '',
        modifiedAt: v.modified_at || v.created_at || '',
        versionNumber: parseInt(v.version_number, 10) || (versions.length - idx),
      }))
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }

  /**
   * Creates zip download and returns download URL. Max 100 files. (Reqs 24.1-24.5)
   *
   * @param {string[]} fileIds
   * @returns {Promise<{ downloadUrl: string }>}
   */
  async createZipDownload(fileIds) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      const err = new Error('fileIds must be a non-empty array');
      err.statusCode = 400;
      throw err;
    }

    if (fileIds.length > MAX_ZIP_FILES) {
      const err = new Error(`Maximum ${MAX_ZIP_FILES} files per zip download`);
      err.statusCode = 400;
      throw err;
    }

    const client = boxService.getBoxClient();

    // POST /zip_downloads (Req 24.1)
    const items = fileIds.map((id) => ({ type: 'file', id }));
    const zipDownload = await client.zipDownloads.createZipDownload({
      items,
      download_file_name: 'taxflow_export.zip',
    });

    // If download_url is immediately available
    if (zipDownload.download_url) {
      return { downloadUrl: zipDownload.download_url };
    }

    // Poll status_url (Req 24.2)
    const statusUrl = zipDownload.status_url;
    if (!statusUrl) {
      throw new Error('Zip download did not return a status URL');
    }

    for (let attempt = 0; attempt < ZIP_MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, ZIP_POLL_INTERVAL_MS));

      const status = await client.zipDownloads.getZipDownloadStatus(statusUrl);

      if (status.state === 'succeeded' || status.state === 'success') {
        return { downloadUrl: status.download_url };
      }

      if (status.state === 'failed') {
        throw new Error(`Zip download failed: ${status.error?.message || 'Unknown error'}`);
      }
    }

    throw new Error('Zip download timed out waiting for completion');
  }
}

// Singleton instance
const portalService = new PortalService();
export default portalService;
