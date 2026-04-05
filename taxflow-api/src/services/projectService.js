/**
 * ProjectService — Client → Project → Document hierarchy with in-memory stores.
 *
 * - getEmployeeClients: Assigned clients with search/filter
 * - getClientProjects: Projects for a client with progress percentages
 * - getProjectDetail: Project detail with document list
 * - getProjectDocuments: Documents for a project with optional status filter
 * - createDocumentRequest: Create document request with version tracking
 * - checkDuplicate: Duplicate detection by projectId + documentType
 * - getEmployeeActivity: Last N actions sorted descending
 * - getEmployeeSummary: Summary metrics (activeClients, pendingReviews, overdueDocuments, awaitingClientAction)
 *
 * Requirements: 2.1, 2.2, 2.5, 3.1, 3.2, 3.3, 3.4, 4.3, 4.4, 4.5, 5.1, 5.3, 7.1, 7.4, 7.5, 13.1
 */

const DOCUMENT_STATUSES = ['Not_Requested', 'Uploaded', 'Under_Review', 'Revision_Requested', 'Approved', 'Waived'];

import notificationService from './notificationService.js';
import { createHttpError } from '../utils/httpError.js';
import {
  clients as seedClients,
  projects as seedProjects,
  documents as seedDocuments,
  activities as seedActivities,
  employeeClients as seedEmployeeClients,
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
    /** @type {Map<string, string[]>} employeeId → clientId[] */
    this._employeeClients = new Map();

    this._clientIdCounter = 0;
    this._projectIdCounter = 0;
    this._documentIdCounter = 0;
    this._activityIdCounter = 0;

    this._seed();
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

    for (const [employeeId, clientIds] of Object.entries(seedEmployeeClients)) {
      this._employeeClients.set(employeeId, [...clientIds]);
    }

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
   *
   * @param {{ name: string, email: string, externalId: string, entityType?: string, boxFolderId: string, boxUserId: string }} data
   * @param {string} employeeId - The employee who onboarded this client
   * @returns {object} The created client record
   */
  registerOnboardedClient(data, employeeId) {
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

    // Assign to the employee
    const existing = this._employeeClients.get(employeeId) || [];
    if (!existing.includes(id)) {
      this._employeeClients.set(employeeId, [...existing, id]);
    }

    // Create a default project for the new client
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
   * Returns ALL clients (for super admin). No employee filter.
   *
   * @returns {object[]} ClientSummary[]
   */
  getAllClients() {
    return Array.from(this._clients.values()).map((c) => ({
      ...c,
      activeProjects: this._countActiveProjects(c.id),
      pendingActions: this._countPendingActions(c.id),
    }));
  }

  /**
   * Returns clients assigned to an employee with optional search/filter.
   * Only returns clients assigned to the given employee. (Reqs 3.1, 3.2, 3.4, 13.1)
   *
   * @param {string} employeeId
   * @param {{ search?: string, status?: string, entityType?: string }} [filters]
   * @returns {object[]} ClientSummary[]
   */
  getEmployeeClients(employeeId, { search, status, entityType } = {}) {
    const assignedIds = this._employeeClients.get(employeeId) || [];
    let clients = assignedIds
      .map((id) => this._clients.get(id))
      .filter(Boolean);

    // Recompute dynamic fields from current data
    clients = clients.map((c) => ({
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
   * Returns projects for a client with computed progress percentages. (Req 4.3)
   *
   * @param {string} clientId
   * @returns {object[]} Project[]
   */
  getClientProjects(clientId) {
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
   * Returns project detail with document list. (Req 4.3, 5.1)
   *
   * @param {string} projectId
   * @param {{ statusFilter?: string | string[] }} [options]
   * @returns {object | null} Project with documents, or null if not found
   */
  getProjectDetail(projectId, { statusFilter } = {}) {
    const project = this._projects.get(projectId);
    if (!project) return null;

    const documents = this.getProjectDocuments(projectId, { status: statusFilter });
    const stats = this._computeProjectStats(projectId);

    return {
      ...project,
      ...stats,
      documents,
    };
  }

  /**
   * Returns documents for a project with optional status filter. (Reqs 5.1, 5.3)
   *
   * @param {string} projectId
   * @param {{ status?: string | string[] }} [options]
   * @returns {object[]} DocumentRequest[]
   */
  getProjectDocuments(projectId, { status } = {}) {
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
   * Creates a document request within a project. (Reqs 7.1, 7.4, 7.5)
   *
   * @param {string} projectId
   * @param {{ name: string, description: string, priority: string, dueDate: string, documentType: string, isDraft: boolean }} data
   * @returns {object} Created DocumentRequest
   */
  createDocumentRequest(projectId, { name, description, priority, dueDate, documentType, isDraft }) {
    const project = this._projects.get(projectId);
    if (!project) {
      throw createHttpError('Project not found', 404);
    }

    // Validate required fields (Req 7.4)
    if (!name || !name.trim()) {
      throw createHttpError('Missing required field: name', 400);
    }
    if (!documentType || !documentType.trim()) {
      throw createHttpError('Missing required field: documentType', 400);
    }
    if (!dueDate || !dueDate.trim()) {
      throw createHttpError('Missing required field: dueDate', 400);
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
      createdBy: 'employee-1', // default; in real usage, passed from auth context
    };

    this._documents.set(id, doc);

    // Record activity (Req 15.7 — audit trail)
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

    // Send email notification to client when publishing (not draft) (Req 12.3)
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
   * Checks for duplicate document requests in a project. (Req 7.5)
   *
   * @param {string} projectId
   * @param {string} documentType
   * @returns {{ isDuplicate: boolean, existingDocument?: object }}
   */
  checkDuplicate(projectId, documentType) {
    for (const d of this._documents.values()) {
      if (d.projectId === projectId && d.documentType === documentType) {
        return { isDuplicate: true, existingDocument: { ...d } };
      }
    }
    return { isDuplicate: false };
  }

  /**
   * Returns employee activity feed, last N actions sorted descending. (Req 4.5)
   *
   * @param {string} employeeId
   * @param {number} [limit=10]
   * @returns {object[]} ActivityEntry[]
   */
  getEmployeeActivity(employeeId, limit = 10) {
    // Get client IDs assigned to this employee
    const assignedClientIds = new Set(this._employeeClients.get(employeeId) || []);

    // Filter activities to those related to assigned clients
    const relevant = this._activities.filter((a) => assignedClientIds.has(a.clientId));

    // Sort descending by timestamp
    relevant.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return relevant.slice(0, limit);
  }

  /**
   * Returns employee summary metrics. (Req 2.1, 2.5)
   *
   * @param {string} employeeId
   * @returns {{ activeClients: number, pendingReviews: number, overdueDocuments: number, awaitingClientAction: number }}
   */
  getEmployeeSummary(employeeId) {
    const assignedIds = this._employeeClients.get(employeeId) || [];
    const assignedSet = new Set(assignedIds);

    let activeClients = 0;
    let pendingReviews = 0;
    let overdueDocuments = 0;
    let awaitingClientAction = 0;

    // Count active clients
    for (const cid of assignedIds) {
      const client = this._clients.get(cid);
      if (client && client.engagementStatus === 'Active') {
        activeClients++;
      }
    }

    const now = new Date();

    // Iterate documents for assigned clients
    for (const doc of this._documents.values()) {
      if (!assignedSet.has(doc.clientId)) continue;

      // Pending reviews: documents in Uploaded or Under_Review status
      if (doc.status === 'Uploaded' || doc.status === 'Under_Review') {
        pendingReviews++;
      }

      // Overdue: documents past due date that are not Approved or Waived
      if (doc.dueDate && doc.status !== 'Approved' && doc.status !== 'Waived') {
        const due = new Date(doc.dueDate);
        if (due < now) {
          overdueDocuments++;
        }
      }

      // Awaiting client action: Revision_Requested or Not_Requested (published)
      if (doc.status === 'Revision_Requested' || (doc.status === 'Not_Requested' && !doc.isDraft)) {
        awaitingClientAction++;
      }
    }

    return { activeClients, pendingReviews, overdueDocuments, awaitingClientAction };
  }

  /**
   * Returns a single document by ID, or null if not found. (Req 12.1)
   *
   * @param {string} documentId
   * @returns {object|null} DocumentRequest or null
   */
  getDocument(documentId) {
    const doc = this._documents.get(documentId);
    return doc ? { ...doc } : null;
  }

  /**
   * Updates a document's status with optimistic concurrency control. (Req 12.1)
   * Increments version and sets updatedAt timestamp.
   *
   * @param {string} documentId
   * @param {string} status - New status value
   * @param {number} [version] - Expected version for concurrency check
   * @param {object} [extra] - Additional fields to set (e.g., revisionComments)
   * @returns {object} Updated document (copy)
   */
  updateDocumentStatus(documentId, status, version, extra) {
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
   * Returns a single client by ID, or null if not found. (Req 12.1)
   *
   * @param {string} clientId
   * @returns {object|null} ClientSummary or null
   */
  getClient(clientId) {
    const client = this._clients.get(clientId);
    return client ? { ...client } : null;
  }

  /**
   * Records an activity entry. Public wrapper for internal _addActivity. (Req 12.1)
   *
   * @param {object} entry - Partial ActivityEntry (without id/timestamp)
   * @returns {void}
   */
  addActivity(entry) {
    this._addActivity(entry);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────

  /**
   * Adds an activity entry with auto-generated ID and timestamp.
   * @param {object} entry - Partial ActivityEntry (without id/timestamp)
   */
  _addActivity(entry) {
    this._activities.push({
      id: `a${++this._activityIdCounter}`,
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    });
  }

  /**
   * Counts active projects for a client.
   * @param {string} clientId
   * @returns {number}
   */
  _countActiveProjects(clientId) {
    let count = 0;
    for (const p of this._projects.values()) {
      if (p.clientId === clientId && p.status === 'Active') count++;
    }
    return count;
  }

  /**
   * Counts pending actions for a client (documents needing employee attention).
   * @param {string} clientId
   * @returns {number}
   */
  _countPendingActions(clientId) {
    let count = 0;
    for (const d of this._documents.values()) {
      if (d.clientId === clientId && (d.status === 'Uploaded' || d.status === 'Under_Review')) {
        count++;
      }
    }
    return count;
  }

  /**
   * Computes document count and progress percentage for a project.
   * Progress = (Approved + Waived) / total * 100
   * @param {string} projectId
   * @returns {{ documentCount: number, progressPercentage: number }}
   */
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
