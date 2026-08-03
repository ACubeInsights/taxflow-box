/**
 * ProjectService — Client → Project → Document hierarchy.
 *
 * Supports two modes:
 *   1. DB-backed: Uses ClientRepository, ProjectRepository, DocumentRequestRepository,
 *      ActivityLogRepository, EmployeeClientRepository
 *   2. In-memory fallback: Uses Maps/Arrays (for tests or when DB is not initialized)
 *
 * Domain methods live in ./project/* and are mixed onto the prototype (no logic changes).
 */

import { isBoxFirstSchema } from '../db/schemaMode.js';
import {
  clients as seedClients,
  projects as seedProjects,
  documents as seedDocuments,
  activities as seedActivities,
} from '../fixtures/seedData.js';
import { DOCUMENT_STATUSES } from './project/constants.js';
import {
  mapClientFromDb,
  mapProjectFromDb,
  mapDocFromDb,
  mapActivityFromDb,
  filterByStatus,
} from './project/mappers.js';
import {
  countActiveProjects,
  countPendingActions,
  computeProjectStats,
} from './project/memoryHelpers.js';
import { clientOperations } from './project/clientOperations.js';
import { documentOperations } from './project/documentOperations.js';
import { activityOperations } from './project/activityOperations.js';

export { DOCUMENT_STATUSES };

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

    this._clientRepo = null;
    this._projectRepo = null;
    this._docRepo = null;
    this._activityRepo = null;
    this._userRepo = null;
    this._minimalMode = false;

    this._seed();
  }

  /**
   * Injects repository dependencies. Called after DB initialization.
   * @param {{ clientRepo?: object, projectRepo?: object, docRequestRepo?: object, activityRepo?: object }} repos
   */
  setRepositories({ clientRepo, projectRepo, docRequestRepo, activityRepo, userRepo, minimalMode } = {}) {
    this._minimalMode = minimalMode ?? isBoxFirstSchema();
    if (userRepo) this._userRepo = userRepo;
    if (clientRepo) this._clientRepo = clientRepo;
    if (projectRepo) this._projectRepo = projectRepo;
    if (docRequestRepo) this._docRepo = docRequestRepo;
    if (activityRepo) this._activityRepo = activityRepo;
  }

  _useMinimalBox() {
    return this._minimalMode && this._userRepo;
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

  _mapClientFromDb(c, activeProjects = 0, pendingActions = 0) {
    return mapClientFromDb(c, activeProjects, pendingActions);
  }

  _mapProjectFromDb(p) {
    return mapProjectFromDb(p);
  }

  _mapDocFromDb(d) {
    return mapDocFromDb(d);
  }

  _mapActivityFromDb(a) {
    return mapActivityFromDb(a);
  }

  _filterByStatus(docs, status) {
    return filterByStatus(docs, status);
  }

  _addActivity(entry) {
    this._activityIdCounter += 1;
    this._activities.push({
      id: `act-${this._activityIdCounter}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
  }

  _countActiveProjects(clientId) {
    return countActiveProjects(this._projects, clientId);
  }

  _countPendingActions(clientId) {
    return countPendingActions(this._documents, clientId);
  }

  _computeProjectStats(projectId) {
    return computeProjectStats(this._documents, projectId);
  }
}

Object.assign(ProjectService.prototype, clientOperations, documentOperations, activityOperations);

const projectService = new ProjectService();
export default projectService;
