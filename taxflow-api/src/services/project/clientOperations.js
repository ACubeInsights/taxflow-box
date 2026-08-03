/**
 * Client-facing ProjectService methods (client registration, listing, project summaries).
 * Mixed into ProjectService.prototype — methods rely on `this` for instance state.
 * Extracted from ProjectService with no logic changes.
 */

import boxEntityService from '../boxEntityService.js';

export const clientOperations = {
  /**
   * Registers a newly onboarded client into the project service.
   * Called after Box onboarding completes.
   */
  async registerOnboardedClient(data, employeeId) {
    if (this._useMinimalBox()) {
      return boxEntityService.registerOnboardedClient(data, employeeId);
    }
    if (this._clientRepo) {
      return this._registerOnboardedClientDb(data, employeeId);
    }
    return this._registerOnboardedClientMem(data, employeeId);
  },

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
  },

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
  },

  /**
   * Returns ALL clients with optional filters.
   */
  async getAllClients({ search, status, entityType } = {}) {
    if (this._useMinimalBox()) {
      return boxEntityService.listClients({ search, status, entityType });
    }
    if (this._clientRepo) {
      const filters = { search, status, entityType };
      const hasFilters = search || status || entityType;
      const clients = hasFilters
        ? await this._clientRepo.findByFilters(filters)
        : await this._clientRepo.findAll();
      const results = [];
      for (const c of clients) {
        const activeProjects = await this._projectRepo.countActiveByClientId(c.id);
        const pendingActions = await this._countPendingActionsAsync(c.id);
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
  },

  /**
   * Returns projects for a client with computed progress percentages.
   */
  async getClientProjects(clientId) {
    if (this._useMinimalBox()) {
      return boxEntityService.getClientProjects(clientId);
    }
    if (this._projectRepo) {
      const projects = await this._projectRepo.findByClientId(clientId);
      const results = [];
      for (const p of projects) {
        const stats = await this._computeProjectStatsAsync(p.id);
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
  },

  /**
   * Returns a single client by ID, or null if not found.
   */
  async getClient(clientId) {
    if (this._useMinimalBox()) {
      return boxEntityService.getClient(clientId);
    }
    if (this._clientRepo) {
      const client = await this._clientRepo.findById(clientId);
      return client ? this._mapClientFromDb(client) : null;
    }

    const client = this._clients.get(clientId);
    return client ? { ...client } : null;
  },
};
