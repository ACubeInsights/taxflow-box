/**
 * Document-request ProjectService methods (project detail, document CRUD, status updates).
 * Mixed into ProjectService.prototype — methods rely on `this` for instance state.
 * Extracted from ProjectService with no logic changes.
 */

import notificationService from '../notificationService.js';
import boxDocumentStatusService from '../boxDocumentStatusService.js';
import boxEntityService from '../boxEntityService.js';
import boxDocumentRequestService from '../boxDocumentRequestService.js';
import { createHttpError } from '../../utils/httpError.js';
import cacheLayer from '../cacheLayer.js';
import { logger } from '../../utils/logger.js';

export const documentOperations = {
  /**
   * Returns project detail with document list.
   */
  async getProjectDetail(projectId, { statusFilter, clientId: clientIdParam } = {}) {
    if (this._useMinimalBox()) {
      const ctx = await boxEntityService.resolveProjectContext(projectId);
      const clientId = clientIdParam || ctx.clientId;
      const documents = clientId
        ? await boxDocumentRequestService.listByProject(clientId, projectId, { status: statusFilter })
        : [];
      const stats = clientId
        ? await boxEntityService._computeProjectStats(clientId, projectId)
        : { documentCount: 0, progressPercentage: 0 };
      const year = new Date().getFullYear().toString();
      return {
        id: projectId,
        clientId,
        name: `${year} Tax Return`,
        description: '',
        status: 'Active',
        ...stats,
        documents,
      };
    }
    if (this._projectRepo) {
      const project = await this._projectRepo.findById(projectId);
      if (!project) return null;

      const documents = await this.getProjectDocuments(projectId, { status: statusFilter });
      const stats = await this._computeProjectStatsAsync(projectId);

      return {
        ...this._mapProjectFromDb(project),
        ...stats,
        documents,
      };
    }

    const project = this._projects.get(projectId);
    if (!project) return null;

    const documents = await this.getProjectDocuments(projectId, { status: statusFilter });
    const stats = this._computeProjectStats(projectId);

    return {
      ...project,
      ...stats,
      documents,
    };
  },

  /**
   * Returns documents for a project. Status is resolved from Box metadata when available;
   * optional status filter is applied after merge (not at DB query level).
   */
  async getProjectDocuments(projectId, { status, clientId: clientIdParam } = {}) {
    if (this._useMinimalBox()) {
      const ctx = await boxEntityService.resolveProjectContext(projectId);
      const clientId = clientIdParam || ctx.clientId;
      if (!clientId) return [];
      return boxDocumentRequestService.listByProject(clientId, projectId, { status });
    }
    if (this._docRepo) {
      const docs = await this._docRepo.findByProjectId(projectId);
      const mapped = docs.map((d) => this._mapDocFromDb(d));
      return this._filterByStatus(
        await this._mergeDocumentsWithBox(mapped),
        status
      );
    }

    let docs = [];
    for (const d of this._documents.values()) {
      if (d.projectId === projectId) {
        docs.push({ ...d });
      }
    }

    return this._filterByStatus(docs, status);
  },

  /**
   * Creates a document request within a project.
   */
  async createDocumentRequest(projectId, { name, description, priority, dueDate, documentType, isDraft }) {
    // Validate required fields
    if (!name || !name.trim()) {
      throw createHttpError('Missing required field: name', 400);
    }
    if (!documentType || !documentType.trim()) {
      throw createHttpError('Missing required field: documentType', 400);
    }
    if (!dueDate || !dueDate.trim()) {
      throw createHttpError('Missing required field: dueDate', 400);
    }

    if (this._useMinimalBox()) {
      const ctx = await boxEntityService.resolveProjectContext(projectId);
      if (!ctx.clientId) {
        throw createHttpError('Project not found', 404);
      }
      return boxDocumentRequestService.createRequest(projectId, {
        clientId: ctx.clientId,
        name,
        description,
        priority,
        dueDate,
        documentType,
        isDraft,
      });
    }

    if (this._docRepo) {
      const project = await this._projectRepo.findById(projectId);
      if (!project) {
        throw createHttpError('Project not found', 404);
      }

      const now = new Date().toISOString();
      const doc = await this._docRepo.create({
        project_id: projectId,
        client_id: project.client_id,
        name: name.trim(),
        description: (description || '').trim(),
        document_type: documentType.trim(),
        due_date: dueDate,
        priority: priority || 'Medium',
        status: 'Not_Requested',
        version: 1,
        is_draft: isDraft !== undefined ? isDraft : false,
        created_by: 'employee-1',
      });

      // Record activity
      const client = await this._clientRepo.findById(project.client_id);
      await this._activityRepo.insert({
        type: 'request_created',
        actor_id: doc.created_by,
        actor_name: 'Employee',
        document_id: doc.id,
        document_name: doc.name,
        client_id: project.client_id,
        client_name: client?.name || '',
        description: `Created document request for ${doc.name}`,
        timestamp: now,
      });

      // Send email notification to client when publishing (not draft)
      if (!doc.is_draft) {
        if (client && client.email) {
          notificationService.notifyClient(
            { clientId: project.client_id, email: client.email },
            'request_published',
            {
              fileId: doc.id,
              fileName: doc.name,
              clientId: project.client_id,
            }
          ).catch((err) => {
            logger.error(`Publish notification failed for document ${doc.id}:`, err.message);
          });
        }
      }

      cacheLayer.invalidate(`portal:client:${project.client_id}`).catch(() => {});
      cacheLayer.invalidate('portal:employee:').catch(() => {});

      return this._mapDocFromDb(doc);
    }

    // In-memory fallback
    const project = this._projects.get(projectId);
    if (!project) {
      throw createHttpError('Project not found', 404);
    }

    const now = new Date().toISOString();
    const id = `d${++this._documentIdCounter}`;

    const doc = {
      id,
      name: name.trim(),
      description: (description || '').trim(),
      dueDate,
      priority: priority || 'Medium',
      status: 'Not_Requested',
      revisionComments: null,
      uploadedFileName: null,
      fileId: null,
      clientId: project.clientId,
      projectId,
      documentType: documentType.trim(),
      version: 1,
      isDraft: isDraft !== undefined ? isDraft : false,
      createdAt: now,
      updatedAt: now,
      createdBy: 'employee-1',
    };

    this._documents.set(id, doc);

    this._addActivity({
      type: 'request_created',
      actorId: doc.createdBy,
      actorName: 'Employee',
      documentId: id,
      documentName: doc.name,
      clientId: project.clientId,
      clientName: this._clients.get(project.clientId)?.name || '',
      description: `Created document request for ${doc.name}`,
    });

    if (!doc.isDraft) {
      const client = this._clients.get(project.clientId);
      if (client && client.email) {
        notificationService.notifyClient(
          { clientId: project.clientId, email: client.email },
          'request_published',
          {
            fileId: id,
            fileName: doc.name,
            clientId: project.clientId,
          }
        ).catch((err) => {
          logger.error(`Publish notification failed for document ${id}:`, err.message);
        });
      }
    }

    cacheLayer.invalidate(`portal:client:${project.clientId}`).catch(() => {});
    cacheLayer.invalidate('portal:employee:').catch(() => {});

    return { ...doc };
  },

  /**
   * Checks for duplicate document requests in a project.
   */
  async checkDuplicate(projectId, documentType) {
    if (this._useMinimalBox()) {
      const ctx = await boxEntityService.resolveProjectContext(projectId);
      if (!ctx.clientId) return { isDuplicate: false };
      return boxDocumentRequestService.checkDuplicate(projectId, documentType, ctx.clientId);
    }
    if (this._docRepo) {
      const result = await this._docRepo.checkDuplicate(projectId, documentType);
      if (result.isDuplicate && result.existingDocument) {
        return { isDuplicate: true, existingDocument: this._mapDocFromDb(result.existingDocument) };
      }
      return { isDuplicate: false };
    }

    for (const d of this._documents.values()) {
      if (d.projectId === projectId && d.documentType === documentType) {
        return { isDuplicate: true, existingDocument: { ...d } };
      }
    }
    return { isDuplicate: false };
  },

  /**
   * Returns a single document by ID, or null if not found.
   */
  async getDocument(documentId) {
    if (this._useMinimalBox()) {
      const clients = await this._userRepo.findByRole('client');
      for (const user of clients) {
        const doc = await boxDocumentRequestService.getDocument(documentId, user.id);
        if (doc) return doc;
      }
      return null;
    }
    if (this._docRepo) {
      const doc = await this._docRepo.findById(documentId);
      if (!doc) return null;
      const mapped = this._mapDocFromDb(doc);
      return boxDocumentStatusService.enrichDocument(mapped);
    }

    const doc = this._documents.get(documentId);
    if (!doc) return null;
    return boxDocumentStatusService.enrichDocument({ ...doc });
  },

  /**
   * Updates a document's status with optimistic concurrency control.
   */
  async updateDocumentStatus(documentId, status, version, extra) {
    if (this._useMinimalBox()) {
      const doc = await this.getDocument(documentId);
      if (!doc) throw createHttpError('Document not found', 404);
      return boxDocumentRequestService.updateStatus(documentId, status, version, {
        ...extra,
        clientId: doc.clientId,
      });
    }
    if (this._docRepo) {
      const dbExtra = {};
      if (extra) {
        if (extra.revisionComments !== undefined) dbExtra.revision_comments = extra.revisionComments;
        if (extra.uploadedFileName !== undefined) dbExtra.uploaded_file_name = extra.uploadedFileName;
        if (extra.fileId !== undefined) dbExtra.box_file_id = extra.fileId;
      }

      try {
        const updated = await this._docRepo.updateStatus(documentId, status, version, dbExtra);
        return this._mapDocFromDb(updated);
      } catch (err) {
        if (err.status === 409 || err.code === 'VERSION_CONFLICT') {
          throw createHttpError('Version conflict: document has been modified by another user', 409);
        }
        throw err;
      }
    }

    // In-memory fallback
    const doc = this._documents.get(documentId);
    if (!doc) {
      throw createHttpError('Document not found', 404);
    }

    if (version !== undefined && version !== doc.version) {
      throw createHttpError('Version conflict: document has been modified by another user', 409);
    }

    doc.status = status;
    doc.version = (doc.version || 1) + 1;
    doc.updatedAt = new Date().toISOString();

    if (extra) {
      Object.assign(doc, extra);
    }

    return { ...doc };
  },

  /** Enrich documents with Box metadata (batch merge when clientId is known) */
  async _mergeDocumentsWithBox(docs) {
    if (!docs.length) return docs;
    const clientId = docs[0]?.clientId;
    if (clientId) {
      return boxDocumentStatusService.mergeWithBoxMetadata(docs, clientId);
    }
    return Promise.all(docs.map((doc) => boxDocumentStatusService.enrichDocument(doc)));
  },

  /** Project stats from Box-resolved document statuses */
  async _computeProjectStatsAsync(projectId) {
    const docs = await this.getProjectDocuments(projectId);
    const documentCount = docs.length;
    const completedCount = docs.filter((d) => ['Approved', 'Waived'].includes(d.status)).length;
    const progressPercentage = documentCount > 0
      ? Math.round((completedCount / documentCount) * 100)
      : 0;
    return { documentCount, progressPercentage };
  },

  /** Pending actions for a client using Box-resolved statuses */
  async _countPendingActionsAsync(clientId) {
    if (!this._docRepo) return this._countPendingActions(clientId);

    const dbDocs = await this._docRepo.findByClientId(clientId);
    const mapped = dbDocs.map((d) => this._mapDocFromDb(d));
    const docs = await boxDocumentStatusService.mergeWithBoxMetadata(mapped, clientId);

    return docs.filter(
      (d) => !d.isDraft && !['Approved', 'Waived'].includes(d.status)
    ).length;
  },
};
