/**
 * ProjectService — Client → Project → Document hierarchy.
 *
 * Supports two modes:
 *   1. DB-backed: Uses ClientRepository, ProjectRepository, DocumentRequestRepository,
 *      ActivityLogRepository, EmployeeClientRepository
 *   2. In-memory fallback: Uses Maps/Arrays (for tests or when DB is not initialized)
 *
 * Requirements: 16.3, 16.7
 */

const DOCUMENT_STATUSES = ['Not_Requested', 'Uploaded', 'Under_Review', 'Revision_Requested', 'Approved', 'Waived'];

import notificationService from './notificationService.js';
import { createHttpError } from '../utils/httpError.js';
import {
  clients as seedClients,
  projects as seedProjects,
  documents as seedDocuments,
  activities as seedActivities,
} from '../fixtures/seedData.js';

export class ProjectService {
  constructor() {
    /** @type {Map<string, object>} clientId → ClientSummary */
    this._clients = new Map();
    /** @type {Map<string, object>} projectId → Project */
    this._projects = new Map();
    /** @type {Map<string, object>} documentId → DocumentRequest */
    this._documents = new Map();
    /** @type {Array<object>} ActivityEntry[] */
    this._activities = [];

    this._clientIdCounter = 0;
    this._projectIdCounter = 0;
    this._documentIdCounter = 0;
    this._activityIdCounter = 0;

    // Repository references (null until setRepositories is called)
    this._clientRepo = null;
    this._projectRepo = null;
    this._docRepo = null;
    this._activityRepo = null;

    this._seed();
  }

  /**
   * Injects repository dependencies. Called after DB initialization.
   * @param {{ clientRepo?: object, projectRepo?: object, docRequestRepo?: object, activityRepo?: object }} repos
   */
  setRepositories({ clientRepo, projectRepo, docRequestRepo, activityRepo } = {}) {
    if (clientRepo) this._clientRepo = clientRepo;
    if (projectRepo) this._projectRepo = projectRepo;
    if (docRequestRepo) this._docRepo = docRequestRepo;
    if (activityRepo) this._activityRepo = activityRepo;
  }

  /**
   * Seeds the in-memory stores with realistic demo data.
   * Data is loaded from src/fixtures/seedData.js (Reqs 4.3, 8.3).
   */
  _seed() {
    for (const c of seedClients) {
      this._clients.set(c.id, { ...c });
    }
    this._clientIdCounter = seedClients.length;

    for (const p of seedProjects) {
      this._projects.set(p.id, { ...p });
    }
    this._projectIdCounter = seedProjects.length;

    for (const d of seedDocuments) {
      this._documents.set(d.id, { ...d });
    }
    this._documentIdCounter = seedDocuments.length;

    this._activities = seedActivities.map((a) => ({ ...a }));
    this._activityIdCounter = seedActivities.length;
  }

  // ─── Public API ───────────────────────────────────────────────────────

  /**
   * Registers a newly onboarded client into the project service.
   * Called after Box onboarding completes.
   */
  async registerOnboardedClient(data, employeeId) {
    if (this._clientRepo) {
      return this._registerOnboardedClientDb(data, employeeId);
    }
    return this._registerOnboardedClientMem(data, employeeId);
  }

  /** @private DB-backed registerOnboardedClient — wrapped in a transaction */
  async _registerOnboardedClientDb(data, employeeId) {
    // Use a transaction so client + project + activity are atomic
    const db = this._clientRepo.db;
    return db.transaction(async (trx) => {
      const client = await this._clientRepo.create({
        name: data.name,
        email: data.email,
        entity_type: data.entityType || 'Individual',
        engagement_status: 'Active',
        box_folder_id: data.boxFolderId,
        box_user_id: data.boxUserId,
        external_id: data.externalId,
      }, trx);

      // Create a default project for the new client
      const year = new Date().getFullYear();
      const project = await this._projectRepo.create({
        client_id: client.id,
        name: `${year} Tax Return`,
        description: `Tax filing for ${data.name}`,
        status: 'Active',
      }, trx);

      await this._activityRepo.insert({
        type: 'client_onboarded',
        actor_id: employeeId,
        actor_name: 'Employee',
        document_id: null,
        document_name: null,
        client_id: client.id,
        client_name: data.name,
        description: `Onboarded new client ${data.name}`,
        timestamp: new Date().toISOString(),
      }, trx);

      return {
        id: client.id,
        name: client.name,
        email: client.email,
        entityType: client.entity_type,
        engagementStatus: client.engagement_status,
        activeProjects: 0,
        pendingActions: 0,
        boxFolderId: client.box_folder_id,
        boxUserId: client.box_user_id,
        externalId: client.external_id,
        projectId: project.id,
      };
    });
  }

  /** @private In-memory registerOnboardedClient */
  _registerOnboardedClientMem(data, employeeId) {
    const id = `c${++this._clientIdCounter}`;
    const client = {
      id,
      name: data.name,
      email: data.email,
      entityType: data.entityType || 'Individual',
      engagementStatus: 'Active',
      activeProjects: 0,
      pendingActions: 0,
      boxFolderId: data.boxFolderId,
      boxUserId: data.boxUserId,
      externalId: data.externalId,
    };

    this._clients.set(id, client);

    const projectId = `p${++this._projectIdCounter}`;
    const year = new Date().getFullYear();
    this._projects.set(projectId, {
      id: projectId,
      clientId: id,
      name: `${year} Tax Return`,
      description: `Tax filing for ${data.name}`,
      status: 'Active',
      documentCount: 0,
      progressPercentage: 0,
      createdAt: new Date().toISOString(),
    });

    this._addActivity({
      type: 'client_onboarded',
      actorId: employeeId,
      actorName: 'Employee',
      documentId: null,
      documentName: null,
      clientId: id,
      clientName: data.name,
      description: `Onboarded new client ${data.name}`,
    });

    return { ...client, projectId };
  }

  /**
   * Returns ALL clients with optional filters.
   */
  async getAllClients({ search, status, entityType } = {}) {
    if (this._clientRepo) {
      const filters = { search, status, entityType };
      const hasFilters = search || status || entityType;
      const clients = hasFilters
        ? await this._clientRepo.findByFilters(filters)
        : await this._clientRepo.findAll();
      const results = [];
      for (const c of clients) {
        const activeProjects = await this._projectRepo.countActiveByClientId(c.id);
        const pendingActions = await this._docRepo.countPendingByClientId(c.id);
        results.push(this._mapClientFromDb(c, activeProjects, pendingActions));
      }
      return results;
    }

    let clients = Array.from(this._clients.values()).map((c) => ({
      ...c,
      activeProjects: this._countActiveProjects(c.id),
      pendingActions: this._countPendingActions(c.id),
    }));

    if (search) {
      const q = search.toLowerCase();
      clients = clients.filter(
        (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      );
    }
    if (status) {
      clients = clients.filter((c) => c.engagementStatus === status);
    }
    if (entityType) {
      clients = clients.filter((c) => c.entityType === entityType);
    }

    return clients;
  }

  /**
   * Returns projects for a client with computed progress percentages.
   */
  async getClientProjects(clientId) {
    if (this._projectRepo) {
      const projects = await this._projectRepo.findByClientId(clientId);
      const results = [];
      for (const p of projects) {
        const stats = await this._docRepo.computeProjectStats(p.id);
        results.push({
          ...this._mapProjectFromDb(p),
          ...stats,
        });
      }
      return results;
    }

    const projects = [];
    for (const p of this._projects.values()) {
      if (p.clientId === clientId) {
        projects.push({
          ...p,
          ...this._computeProjectStats(p.id),
        });
      }
    }
    return projects;
  }

  /**
   * Returns project detail with document list.
   */
  async getProjectDetail(projectId, { statusFilter } = {}) {
    if (this._projectRepo) {
      const project = await this._projectRepo.findById(projectId);
      if (!project) return null;

      const documents = await this.getProjectDocuments(projectId, { status: statusFilter });
      const stats = await this._docRepo.computeProjectStats(projectId);

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
  }

  /**
   * Returns documents for a project with optional status filter.
   */
  async getProjectDocuments(projectId, { status } = {}) {
    if (this._docRepo) {
      const docs = await this._docRepo.findByProjectId(projectId, { status });
      return docs.map((d) => this._mapDocFromDb(d));
    }

    let docs = [];
    for (const d of this._documents.values()) {
      if (d.projectId === projectId) {
        docs.push({ ...d });
      }
    }

    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      docs = docs.filter((d) => statuses.includes(d.status));
    }

    return docs;
  }

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
          notificationService.dispatch('request_published', client.email, {
            fileId: doc.id,
            fileName: doc.name,
            clientId: project.client_id,
          }).catch((err) => {
            console.error(`Publish notification failed for document ${doc.id}:`, err.message);
          });
        }
      }

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
        notificationService.dispatch('request_published', client.email, {
          fileId: id,
          fileName: doc.name,
          clientId: project.clientId,
        }).catch((err) => {
          console.error(`Publish notification failed for document ${id}:`, err.message);
        });
      }
    }

    return { ...doc };
  }

  /**
   * Checks for duplicate document requests in a project.
   */
  async checkDuplicate(projectId, documentType) {
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
  }

  /**
   * Returns activity feed, last N actions sorted descending (global, not employee-scoped).
   */
  async getEmployeeActivity(employeeId, limit = 10) {
    if (this._activityRepo) {
      const activities = await this._activityRepo.findRecent ? 
        await this._activityRepo.findRecent({ limit }) :
        await this._activityRepo.findByClientIds(null, { limit });
      return activities.map((a) => this._mapActivityFromDb(a));
    }

    // In-memory fallback — return all activities sorted desc
    const sorted = [...this._activities].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return sorted.slice(0, limit);
  }

  /**
   * Returns employee summary metrics (computed across all clients).
   */
  async getEmployeeSummary(employeeId) {
    if (this._clientRepo && this._docRepo) {
      const clients = await this._clientRepo.findAll();

      let activeClients = 0;
      for (const client of clients) {
        if (client.engagement_status === 'Active') activeClients++;
      }

      // Get all documents for all clients
      let pendingReviews = 0;
      let overdueDocuments = 0;
      let awaitingClientAction = 0;
      const now = new Date();

      for (const client of clients) {
        const docs = await this._docRepo.findByClientId(client.id);
        for (const doc of docs) {
          if (doc.status === 'Uploaded' || doc.status === 'Under_Review') {
            pendingReviews++;
          }
          if (doc.due_date && doc.status !== 'Approved' && doc.status !== 'Waived') {
            const due = new Date(doc.due_date);
            if (due < now) overdueDocuments++;
          }
          if (doc.status === 'Revision_Requested' || (doc.status === 'Not_Requested' && !doc.is_draft)) {
            awaitingClientAction++;
          }
        }
      }

      return { activeClients, pendingReviews, overdueDocuments, awaitingClientAction };
    }

    // In-memory fallback — compute across all clients
    let activeClients = 0;
    let pendingReviews = 0;
    let overdueDocuments = 0;
    let awaitingClientAction = 0;

    for (const client of this._clients.values()) {
      if (client.engagementStatus === 'Active') {
        activeClients++;
      }
    }

    const now = new Date();

    for (const doc of this._documents.values()) {
      if (doc.status === 'Uploaded' || doc.status === 'Under_Review') {
        pendingReviews++;
      }

      if (doc.dueDate && doc.status !== 'Approved' && doc.status !== 'Waived') {
        const due = new Date(doc.dueDate);
        if (due < now) {
          overdueDocuments++;
        }
      }

      if (doc.status === 'Revision_Requested' || (doc.status === 'Not_Requested' && !doc.isDraft)) {
        awaitingClientAction++;
      }
    }

    return { activeClients, pendingReviews, overdueDocuments, awaitingClientAction };
  }

  /**
   * Returns a single document by ID, or null if not found.
   */
  async getDocument(documentId) {
    if (this._docRepo) {
      const doc = await this._docRepo.findById(documentId);
      return doc ? this._mapDocFromDb(doc) : null;
    }

    const doc = this._documents.get(documentId);
    return doc ? { ...doc } : null;
  }

  /**
   * Updates a document's status with optimistic concurrency control.
   */
  async updateDocumentStatus(documentId, status, version, extra) {
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
  }

  /**
   * Returns a single client by ID, or null if not found.
   */
  async getClient(clientId) {
    if (this._clientRepo) {
      const client = await this._clientRepo.findById(clientId);
      return client ? this._mapClientFromDb(client) : null;
    }

    const client = this._clients.get(clientId);
    return client ? { ...client } : null;
  }

  /**
   * Records an activity entry. Public wrapper for internal _addActivity.
   */
  async addActivity(entry) {
    if (this._activityRepo) {
      await this._activityRepo.insert({
        type: entry.type,
        actor_id: entry.actorId,
        actor_name: entry.actorName,
        document_id: entry.documentId,
        document_name: entry.documentName,
        client_id: entry.clientId,
        client_name: entry.clientName,
        description: entry.description,
        timestamp: entry.timestamp || new Date().toISOString(),
      });
      return;
    }

    this._addActivity(entry);
  }

  // ─── DB → App mapping helpers ─────────────────────────────────────

  /** Maps a DB client row to the app-level client shape */
  _mapClientFromDb(c, activeProjects = 0, pendingActions = 0) {
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      entityType: c.entity_type,
      engagementStatus: c.engagement_status,
      activeProjects,
      pendingActions,
      boxFolderId: c.box_folder_id,
      boxUserId: c.box_user_id,
      externalId: c.external_id,
    };
  }

  /** Maps a DB project row to the app-level project shape */
  _mapProjectFromDb(p) {
    return {
      id: p.id,
      clientId: p.client_id,
      name: p.name,
      description: p.description,
      status: p.status,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  }

  /** Maps a DB document row to the app-level document shape */
  _mapDocFromDb(d) {
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      dueDate: d.due_date,
      priority: d.priority,
      status: d.status,
      revisionComments: d.revision_comments,
      uploadedFileName: d.uploaded_file_name,
      fileId: d.box_file_id,
      clientId: d.client_id,
      projectId: d.project_id,
      documentType: d.document_type,
      version: d.version,
      isDraft: d.is_draft,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      createdBy: d.created_by,
    };
  }

  /** Maps a DB activity row to the app-level activity shape */
  _mapActivityFromDb(a) {
    return {
      id: a.id,
      type: a.type,
      actorId: a.actor_id,
      actorName: a.actor_name,
      documentId: a.document_id,
      documentName: a.document_name,
      clientId: a.client_id,
      clientName: a.client_name,
      description: a.description,
      timestamp: a.timestamp,
    };
  }

  // ─── Internal helpers (in-memory fallback) ────────────────────────

  _addActivity(entry) {
    this._activities.push({
      id: `a${++this._activityIdCounter}`,
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    });
  }

  _countActiveProjects(clientId) {
    let count = 0;
    for (const p of this._projects.values()) {
      if (p.clientId === clientId && p.status === 'Active') count++;
    }
    return count;
  }

  _countPendingActions(clientId) {
    let count = 0;
    for (const d of this._documents.values()) {
      if (d.clientId === clientId && (d.status === 'Uploaded' || d.status === 'Under_Review')) {
        count++;
      }
    }
    return count;
  }

  _computeProjectStats(projectId) {
    let total = 0;
    let completed = 0;
    for (const d of this._documents.values()) {
      if (d.projectId === projectId) {
        total++;
        if (d.status === 'Approved' || d.status === 'Waived') {
          completed++;
        }
      }
    }
    return {
      documentCount: total,
      progressPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}

// Singleton instance
const projectService = new ProjectService();
export { DOCUMENT_STATUSES };
export default projectService;
