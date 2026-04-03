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

class ProjectService {
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
   */
  _seed() {
    // --- Clients ---
    const clients = [
      {
        id: 'c1',
        name: 'Acme Industries',
        email: 'sageastral14@gmail.com',
        entityType: 'Business',
        engagementStatus: 'Active',
        activeProjects: 2,
        pendingActions: 3,
        boxFolderId: 'box-folder-c1',
      },
      {
        id: 'c2',
        name: 'Jane Smith',
        email: 'sageastral14@gmail.com',
        entityType: 'Individual',
        engagementStatus: 'Active',
        activeProjects: 1,
        pendingActions: 1,
        boxFolderId: 'box-folder-c2',
      },
      {
        id: 'c3',
        name: 'Greenfield Trust',
        email: 'sageastral14@gmail.com',
        entityType: 'Trust',
        engagementStatus: 'On_Hold',
        activeProjects: 1,
        pendingActions: 0,
        boxFolderId: 'box-folder-c3',
      },
      {
        id: 'c4',
        name: 'Stellare Software Inc.',
        email: 'sageastral14@gmail.com',
        entityType: 'S-Corp',
        engagementStatus: 'Active',
        activeProjects: 1,
        pendingActions: 2,
        boxFolderId: 'box-folder-c4',
      },
      {
        id: 'c5',
        name: 'Ray Kowalski',
        email: 'sageastral14@gmail.com',
        entityType: 'Individual',
        engagementStatus: 'Active',
        activeProjects: 1,
        pendingActions: 1,
        boxFolderId: 'box-folder-c5',
      },
      {
        id: 'c6',
        name: 'Blue Horizon Partners',
        email: 'sageastral14@gmail.com',
        entityType: 'Partnership',
        engagementStatus: 'Active',
        activeProjects: 1,
        pendingActions: 0,
        boxFolderId: 'box-folder-c6',
      },
      {
        id: 'c7',
        name: 'Maria & Carlos Reyes',
        email: 'sageastral14@gmail.com',
        entityType: 'Individual',
        engagementStatus: 'Complete',
        activeProjects: 0,
        pendingActions: 0,
        boxFolderId: 'box-folder-c7',
      },
    ];

    for (const c of clients) {
      this._clients.set(c.id, c);
    }
    this._clientIdCounter = 7;

    // Employee assignments — employee-1 gets 5 clients, employee-2 gets 3 (with overlap on c3)
    this._employeeClients.set('employee-1', ['c1', 'c2', 'c3', 'c4', 'c5']);
    this._employeeClients.set('employee-2', ['c3', 'c6', 'c7']);

    // --- Projects ---
    const projects = [
      {
        id: 'p1',
        clientId: 'c1',
        name: '2024 Corporate Tax Return',
        description: 'Annual corporate tax filing for Acme Industries',
        status: 'Active',
        documentCount: 4,
        progressPercentage: 25,
        createdAt: '2024-11-01T10:00:00.000Z',
      },
      {
        id: 'p2',
        clientId: 'c1',
        name: '2024 Quarterly Estimates',
        description: 'Q1-Q4 estimated tax payments',
        status: 'Active',
        documentCount: 2,
        progressPercentage: 50,
        createdAt: '2024-11-15T09:00:00.000Z',
      },
      {
        id: 'p3',
        clientId: 'c2',
        name: '2024 Individual Tax Return',
        description: 'Personal tax filing for Jane Smith',
        status: 'Active',
        documentCount: 3,
        progressPercentage: 33,
        createdAt: '2024-12-01T08:00:00.000Z',
      },
      {
        id: 'p4',
        clientId: 'c3',
        name: '2024 Trust Tax Return',
        description: 'Annual trust tax filing',
        status: 'On_Hold',
        documentCount: 2,
        progressPercentage: 0,
        createdAt: '2024-10-20T14:00:00.000Z',
      },
      {
        id: 'p5',
        clientId: 'c4',
        name: '2024 S-Corp Tax Return',
        description: 'Annual S-Corp filing for Stellare Software',
        status: 'Active',
        documentCount: 3,
        progressPercentage: 33,
        createdAt: '2024-11-10T10:00:00.000Z',
      },
      {
        id: 'p6',
        clientId: 'c5',
        name: '2024 Individual Tax Return',
        description: 'Personal tax filing for Ray Kowalski',
        status: 'Active',
        documentCount: 2,
        progressPercentage: 0,
        createdAt: '2024-12-15T09:00:00.000Z',
      },
      {
        id: 'p7',
        clientId: 'c6',
        name: '2024 Partnership Return',
        description: 'Annual partnership filing for Blue Horizon',
        status: 'Active',
        documentCount: 2,
        progressPercentage: 50,
        createdAt: '2024-11-05T11:00:00.000Z',
      },
      {
        id: 'p8',
        clientId: 'c7',
        name: '2024 Individual Tax Return',
        description: 'Personal tax filing for Reyes family',
        status: 'Complete',
        documentCount: 2,
        progressPercentage: 100,
        createdAt: '2024-10-01T08:00:00.000Z',
      },
    ];

    for (const p of projects) {
      this._projects.set(p.id, p);
    }
    this._projectIdCounter = 8;

    // --- Documents ---
    const now = new Date().toISOString();
    const documents = [
      // Project p1 (Acme Corporate Tax)
      {
        id: 'd1', name: 'W-2 Forms', description: 'Employee wage statements',
        dueDate: '2025-03-15', priority: 'High', status: 'Approved',
        revisionComments: null, uploadedFileName: 'w2-2024.pdf', fileId: 'box-file-d1',
        clientId: 'c1', projectId: 'p1', documentType: 'W-2',
        version: 2, isDraft: false, createdAt: '2024-11-02T10:00:00.000Z',
        updatedAt: '2025-01-10T14:30:00.000Z', createdBy: 'employee-1',
      },
      {
        id: 'd2', name: '1099-DIV Statements', description: 'Dividend income statements',
        dueDate: '2025-03-15', priority: 'Medium', status: 'Uploaded',
        revisionComments: null, uploadedFileName: '1099div-2024.pdf', fileId: 'box-file-d2',
        clientId: 'c1', projectId: 'p1', documentType: '1099-DIV',
        version: 1, isDraft: false, createdAt: '2024-11-05T11:00:00.000Z',
        updatedAt: '2025-01-12T09:00:00.000Z', createdBy: 'employee-1',
      },
      {
        id: 'd3', name: 'Schedule C - Business Income', description: 'Business profit/loss statement',
        dueDate: '2025-03-15', priority: 'High', status: 'Revision_Requested',
        revisionComments: 'Missing page 2 of the schedule. Please re-upload the complete document.',
        uploadedFileName: 'schedule-c-2024.pdf', fileId: 'box-file-d3',
        clientId: 'c1', projectId: 'p1', documentType: 'Schedule_C',
        version: 3, isDraft: false, createdAt: '2024-11-03T09:00:00.000Z',
        updatedAt: '2025-01-15T16:00:00.000Z', createdBy: 'employee-1',
      },
      {
        id: 'd4', name: 'Bank Statements', description: 'Year-end bank statements',
        dueDate: '2025-04-01', priority: 'Low', status: 'Not_Requested',
        revisionComments: null, uploadedFileName: null, fileId: null,
        clientId: 'c1', projectId: 'p1', documentType: 'Bank_Statement',
        version: 1, isDraft: true, createdAt: '2024-12-01T10:00:00.000Z',
        updatedAt: '2024-12-01T10:00:00.000Z', createdBy: 'employee-1',
      },
      // Project p2 (Acme Quarterly Estimates)
      {
        id: 'd5', name: 'Q1 Estimated Payment Receipt', description: 'Proof of Q1 estimated tax payment',
        dueDate: '2025-04-15', priority: 'Medium', status: 'Approved',
        revisionComments: null, uploadedFileName: 'q1-receipt.pdf', fileId: 'box-file-d5',
        clientId: 'c1', projectId: 'p2', documentType: 'Payment_Receipt',
        version: 2, isDraft: false, createdAt: '2024-11-20T10:00:00.000Z',
        updatedAt: '2025-01-05T11:00:00.000Z', createdBy: 'employee-1',
      },
      {
        id: 'd6', name: 'Q2 Estimated Payment Receipt', description: 'Proof of Q2 estimated tax payment',
        dueDate: '2025-06-15', priority: 'Medium', status: 'Under_Review',
        revisionComments: null, uploadedFileName: 'q2-receipt.pdf', fileId: 'box-file-d6',
        clientId: 'c1', projectId: 'p2', documentType: 'Payment_Receipt',
        version: 1, isDraft: false, createdAt: '2024-11-20T10:30:00.000Z',
        updatedAt: '2025-01-18T08:00:00.000Z', createdBy: 'employee-1',
      },
      // Project p3 (Jane Smith Individual)
      {
        id: 'd7', name: 'W-2 Form', description: 'Wage and tax statement',
        dueDate: '2025-04-15', priority: 'High', status: 'Uploaded',
        revisionComments: null, uploadedFileName: 'jane-w2.pdf', fileId: 'box-file-d7',
        clientId: 'c2', projectId: 'p3', documentType: 'W-2',
        version: 1, isDraft: false, createdAt: '2024-12-05T10:00:00.000Z',
        updatedAt: '2025-01-20T10:00:00.000Z', createdBy: 'employee-1',
      },
      {
        id: 'd8', name: '1098 Mortgage Interest', description: 'Mortgage interest statement',
        dueDate: '2025-04-15', priority: 'Medium', status: 'Not_Requested',
        revisionComments: null, uploadedFileName: null, fileId: null,
        clientId: 'c2', projectId: 'p3', documentType: '1098',
        version: 1, isDraft: false, createdAt: '2024-12-05T10:30:00.000Z',
        updatedAt: '2024-12-05T10:30:00.000Z', createdBy: 'employee-1',
      },
      {
        id: 'd9', name: 'Charitable Donation Receipts', description: 'Receipts for charitable contributions',
        dueDate: '2025-04-15', priority: 'Low', status: 'Waived',
        revisionComments: null, uploadedFileName: null, fileId: null,
        clientId: 'c2', projectId: 'p3', documentType: 'Donation_Receipt',
        version: 2, isDraft: false, createdAt: '2024-12-10T09:00:00.000Z',
        updatedAt: '2025-01-08T15:00:00.000Z', createdBy: 'employee-1',
      },
      // Project p4 (Greenfield Trust)
      {
        id: 'd10', name: 'Trust Agreement', description: 'Copy of the trust agreement',
        dueDate: '2025-03-01', priority: 'High', status: 'Not_Requested',
        revisionComments: null, uploadedFileName: null, fileId: null,
        clientId: 'c3', projectId: 'p4', documentType: 'Trust_Agreement',
        version: 1, isDraft: false, createdAt: '2024-10-25T10:00:00.000Z',
        updatedAt: '2024-10-25T10:00:00.000Z', createdBy: 'employee-1',
      },
      {
        id: 'd11', name: 'K-1 Schedule', description: 'Beneficiary income schedule',
        dueDate: '2025-03-01', priority: 'Medium', status: 'Not_Requested',
        revisionComments: null, uploadedFileName: null, fileId: null,
        clientId: 'c3', projectId: 'p4', documentType: 'K-1',
        version: 1, isDraft: false, createdAt: '2024-10-25T10:30:00.000Z',
        updatedAt: '2024-10-25T10:30:00.000Z', createdBy: 'employee-1',
      },
      // Project p5 (Stellare Software S-Corp)
      {
        id: 'd12', name: 'S-Corp Tax Return (1120S)', description: 'Federal S-Corp income tax return',
        dueDate: '2025-03-15', priority: 'High', status: 'Uploaded',
        revisionComments: null, uploadedFileName: '1120s-2024.pdf', fileId: 'box-file-d12',
        clientId: 'c4', projectId: 'p5', documentType: 'schedule-k1',
        version: 1, isDraft: false, createdAt: '2024-11-12T10:00:00.000Z',
        updatedAt: '2025-01-22T09:00:00.000Z', createdBy: 'employee-1',
      },
      {
        id: 'd13', name: 'Payroll Records', description: 'Annual payroll summary and W-3',
        dueDate: '2025-03-15', priority: 'Medium', status: 'Under_Review',
        revisionComments: null, uploadedFileName: 'payroll-2024.xlsx', fileId: 'box-file-d13',
        clientId: 'c4', projectId: 'p5', documentType: 'bank-statement',
        version: 1, isDraft: false, createdAt: '2024-11-12T10:30:00.000Z',
        updatedAt: '2025-01-25T14:00:00.000Z', createdBy: 'employee-1',
      },
      {
        id: 'd14', name: 'R&D Tax Credit Documentation', description: 'Qualifying research expense receipts',
        dueDate: '2025-04-15', priority: 'High', status: 'Not_Requested',
        revisionComments: null, uploadedFileName: null, fileId: null,
        clientId: 'c4', projectId: 'p5', documentType: 'schedule-c',
        version: 1, isDraft: false, createdAt: '2024-11-15T09:00:00.000Z',
        updatedAt: '2024-11-15T09:00:00.000Z', createdBy: 'employee-1',
      },
      // Project p6 (Ray Kowalski Individual)
      {
        id: 'd15', name: 'W-2 Form', description: 'Wage and tax statement from employer',
        dueDate: '2025-04-15', priority: 'High', status: 'Uploaded',
        revisionComments: null, uploadedFileName: 'ray-w2-2024.pdf', fileId: 'box-file-d15',
        clientId: 'c5', projectId: 'p6', documentType: 'W-2',
        version: 1, isDraft: false, createdAt: '2024-12-20T10:00:00.000Z',
        updatedAt: '2025-01-28T11:00:00.000Z', createdBy: 'employee-1',
      },
      {
        id: 'd16', name: '1099-NEC Freelance Income', description: 'Nonemployee compensation from gig work',
        dueDate: '2025-04-15', priority: 'Medium', status: 'Not_Requested',
        revisionComments: null, uploadedFileName: null, fileId: null,
        clientId: 'c5', projectId: 'p6', documentType: '1099-nec',
        version: 1, isDraft: false, createdAt: '2024-12-20T10:30:00.000Z',
        updatedAt: '2024-12-20T10:30:00.000Z', createdBy: 'employee-1',
      },
      // Project p7 (Blue Horizon Partnership — emp2)
      {
        id: 'd17', name: 'Partnership Agreement', description: 'Copy of the partnership agreement',
        dueDate: '2025-03-15', priority: 'High', status: 'Approved',
        revisionComments: null, uploadedFileName: 'partnership-agreement.pdf', fileId: 'box-file-d17',
        clientId: 'c6', projectId: 'p7', documentType: 'trust-agreement',
        version: 2, isDraft: false, createdAt: '2024-11-08T10:00:00.000Z',
        updatedAt: '2025-01-05T16:00:00.000Z', createdBy: 'employee-2',
      },
      {
        id: 'd18', name: 'K-1 Schedules for Partners', description: 'Income distribution schedules',
        dueDate: '2025-03-15', priority: 'Medium', status: 'Uploaded',
        revisionComments: null, uploadedFileName: 'k1-partners-2024.pdf', fileId: 'box-file-d18',
        clientId: 'c6', projectId: 'p7', documentType: 'schedule-k1',
        version: 1, isDraft: false, createdAt: '2024-11-08T10:30:00.000Z',
        updatedAt: '2025-01-20T09:00:00.000Z', createdBy: 'employee-2',
      },
      // Project p8 (Reyes family — emp2, Complete)
      {
        id: 'd19', name: 'W-2 Forms', description: 'Wage statements for both filers',
        dueDate: '2025-04-15', priority: 'High', status: 'Approved',
        revisionComments: null, uploadedFileName: 'reyes-w2-2024.pdf', fileId: 'box-file-d19',
        clientId: 'c7', projectId: 'p8', documentType: 'W-2',
        version: 2, isDraft: false, createdAt: '2024-10-05T10:00:00.000Z',
        updatedAt: '2024-12-15T14:00:00.000Z', createdBy: 'employee-2',
      },
      {
        id: 'd20', name: '1098 Mortgage Interest', description: 'Mortgage interest deduction',
        dueDate: '2025-04-15', priority: 'Medium', status: 'Approved',
        revisionComments: null, uploadedFileName: 'reyes-1098-2024.pdf', fileId: 'box-file-d20',
        clientId: 'c7', projectId: 'p8', documentType: '1098',
        version: 2, isDraft: false, createdAt: '2024-10-05T10:30:00.000Z',
        updatedAt: '2024-12-20T11:00:00.000Z', createdBy: 'employee-2',
      },
    ];

    for (const d of documents) {
      this._documents.set(d.id, d);
    }
    this._documentIdCounter = 20;

    // --- Activity entries ---
    this._activities = [
      {
        id: 'a1', type: 'status_change', actorId: 'employee-1', actorName: 'Alex Johnson',
        documentId: 'd1', documentName: 'W-2 Forms', clientId: 'c1', clientName: 'Acme Industries',
        description: 'Approved document W-2 Forms', timestamp: '2025-01-10T14:30:00.000Z',
      },
      {
        id: 'a2', type: 'upload', actorId: 'c1-user', actorName: 'Acme Industries',
        documentId: 'd2', documentName: '1099-DIV Statements', clientId: 'c1', clientName: 'Acme Industries',
        description: 'Client uploaded 1099-DIV Statements', timestamp: '2025-01-12T09:00:00.000Z',
      },
      {
        id: 'a3', type: 'status_change', actorId: 'employee-1', actorName: 'Alex Johnson',
        documentId: 'd3', documentName: 'Schedule C - Business Income', clientId: 'c1', clientName: 'Acme Industries',
        description: 'Requested revision for Schedule C - Business Income', timestamp: '2025-01-15T16:00:00.000Z',
      },
      {
        id: 'a4', type: 'comment', actorId: 'employee-1', actorName: 'Alex Johnson',
        documentId: 'd6', documentName: 'Q2 Estimated Payment Receipt', clientId: 'c1', clientName: 'Acme Industries',
        description: 'Added review comment on Q2 Estimated Payment Receipt', timestamp: '2025-01-18T08:00:00.000Z',
      },
      {
        id: 'a5', type: 'upload', actorId: 'c2-user', actorName: 'Jane Smith',
        documentId: 'd7', documentName: 'W-2 Form', clientId: 'c2', clientName: 'Jane Smith',
        description: 'Client uploaded W-2 Form', timestamp: '2025-01-20T10:00:00.000Z',
      },
      {
        id: 'a6', type: 'request_created', actorId: 'employee-1', actorName: 'Alex Johnson',
        documentId: 'd9', documentName: 'Charitable Donation Receipts', clientId: 'c2', clientName: 'Jane Smith',
        description: 'Created document request for Charitable Donation Receipts', timestamp: '2024-12-10T09:00:00.000Z',
      },
      {
        id: 'a7', type: 'upload', actorId: 'c4-user', actorName: 'Stellare Software Inc.',
        documentId: 'd12', documentName: 'S-Corp Tax Return (1120S)', clientId: 'c4', clientName: 'Stellare Software Inc.',
        description: 'Client uploaded S-Corp Tax Return', timestamp: '2025-01-22T09:00:00.000Z',
      },
      {
        id: 'a8', type: 'status_change', actorId: 'employee-1', actorName: 'Alex Johnson',
        documentId: 'd13', documentName: 'Payroll Records', clientId: 'c4', clientName: 'Stellare Software Inc.',
        description: 'Started review of Payroll Records', timestamp: '2025-01-25T14:00:00.000Z',
      },
      {
        id: 'a9', type: 'upload', actorId: 'c5-user', actorName: 'Ray Kowalski',
        documentId: 'd15', documentName: 'W-2 Form', clientId: 'c5', clientName: 'Ray Kowalski',
        description: 'Client uploaded W-2 Form', timestamp: '2025-01-28T11:00:00.000Z',
      },
      {
        id: 'a10', type: 'status_change', actorId: 'emp2', actorName: 'Maria Garcia',
        documentId: 'd17', documentName: 'Partnership Agreement', clientId: 'c6', clientName: 'Blue Horizon Partners',
        description: 'Approved Partnership Agreement', timestamp: '2025-01-05T16:00:00.000Z',
      },
      {
        id: 'a11', type: 'status_change', actorId: 'emp2', actorName: 'Maria Garcia',
        documentId: 'd19', documentName: 'W-2 Forms', clientId: 'c7', clientName: 'Maria & Carlos Reyes',
        description: 'Approved W-2 Forms', timestamp: '2024-12-15T14:00:00.000Z',
      },
    ];
    this._activityIdCounter = 11;
  }

  // ─── Public API ───────────────────────────────────────────────────────

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
      const err = new Error('Project not found');
      err.statusCode = 404;
      throw err;
    }

    // Validate required fields (Req 7.4)
    if (!name || !name.trim()) {
      const err = new Error('Missing required field: name');
      err.statusCode = 400;
      throw err;
    }
    if (!documentType || !documentType.trim()) {
      const err = new Error('Missing required field: documentType');
      err.statusCode = 400;
      throw err;
    }
    if (!dueDate || !dueDate.trim()) {
      const err = new Error('Missing required field: dueDate');
      err.statusCode = 400;
      throw err;
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
export { ProjectService, DOCUMENT_STATUSES };
export default projectService;
