/**
 * BoxEntityService — Clients and projects from Box + users table (minimal schema).
 * Phase 2e: replaces clients/projects tables for production Postgres.
 */

import crypto from 'crypto';
import boxService from './boxService.js';
import vaultDiscoveryService from './vaultDiscoveryService.js';
import boxDocumentStatusService from './boxDocumentStatusService.js';
import { logger } from '../utils/logger.js';

export class BoxEntityService {
  constructor() {
    this._userRepo = null;
  }

  setRepositories({ userRepo } = {}) {
    if (userRepo) this._userRepo = userRepo;
  }

  mapUserAsClient(user, stats = {}) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      entityType: user.entity_type || 'Individual',
      engagementStatus: user.engagement_status || 'Active',
      activeProjects: stats.activeProjects ?? 0,
      pendingActions: stats.pendingActions ?? 0,
      boxFolderId: user.box_folder_id,
      boxUserId: user.box_user_id,
      externalId: user.external_id,
    };
  }

  async listClients({ search, status, entityType } = {}) {
    if (!this._userRepo) return [];
    let users = await this._userRepo.findByRole('client');

    if (search) {
      const q = search.toLowerCase();
      users = users.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }
    if (status) {
      users = users.filter((u) => (u.engagement_status || 'Active') === status);
    }
    if (entityType) {
      users = users.filter((u) => (u.entity_type || 'Individual') === entityType);
    }

    const results = [];
    for (const user of users) {
      const projects = await this.getClientProjects(user.id);
      const pending = await this._countPendingActions(user.id);
      results.push(this.mapUserAsClient(user, {
        activeProjects: projects.filter((p) => p.status === 'Active').length,
        pendingActions: pending,
      }));
    }
    return results;
  }

  async getClient(clientId) {
    if (!this._userRepo) return null;
    let user = await this._userRepo.findById(clientId);
    if (!user) user = await this._userRepo.findByExternalId(clientId);
    if (!user || user.role !== 'client') return null;

    const projects = await this.getClientProjects(user.id);
    const pending = await this._countPendingActions(user.id);
    return this.mapUserAsClient(user, {
      activeProjects: projects.filter((p) => p.status === 'Active').length,
      pendingActions: pending,
    });
  }

  async registerOnboardedClient(data, _employeeId) {
    if (!this._userRepo) {
      throw new Error('UserRepository required for minimal schema onboarding');
    }

    const existing = await this._userRepo.findByEmail(data.email);
    if (existing) {
      const projects = await this.getClientProjects(existing.id);
      return {
        ...this.mapUserAsClient(existing),
        projectId: projects[0]?.id || null,
      };
    }

    const user = await this._userRepo.create({
      box_user_id: data.boxUserId || `pending-${crypto.randomUUID()}`,
      email: data.email.toLowerCase(),
      name: data.name,
      role: 'client',
      password_hash: data.passwordHash || '$2b$12$minimal.placeholder.hash',
      external_id: data.externalId,
      entity_type: data.entityType || 'Individual',
      engagement_status: 'Active',
      box_folder_id: data.boxFolderId,
    });

    const projects = await this.getClientProjects(user.id);
    return {
      ...this.mapUserAsClient(user),
      projectId: projects[0]?.id || data.boxFolderId,
    };
  }

  /**
   * Projects are Box folder IDs under the client vault (Projects subfolder).
   */
  async getClientProjects(clientId) {
    const vault = await vaultDiscoveryService.getVaultForClient(clientId);
    if (!vault) return [];

    const projectFolderId = vault.projects || vault.year;
    if (!projectFolderId) return [];

    const year = vault.financialYear || new Date().getFullYear().toString();
    const stats = await this._computeProjectStats(clientId, projectFolderId);

    return [{
      id: projectFolderId,
      clientId,
      name: `${year} Tax Return`,
      description: `Tax filing project for ${year}`,
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...stats,
    }];
  }

  async getProject(projectId) {
    return {
      id: projectId,
      clientId: null,
      name: 'Tax Return',
      description: '',
      status: 'Active',
    };
  }

  async resolveProjectContext(projectId) {
    if (!this._userRepo) return { clientId: null, projectId };
    const clients = await this._userRepo.findByRole('client');
    for (const user of clients) {
      const vault = await vaultDiscoveryService.getVaultForClient(user.id);
      if (
        vault?.projects === projectId ||
        vault?.year === projectId ||
        vault?.root === projectId
      ) {
        return { clientId: user.id, projectId };
      }
    }
    return { clientId: null, projectId };
  }

  async _computeProjectStats(clientId, projectId) {
    const entries = await boxDocumentStatusService.queryDocumentsByClientId(clientId);
    const projectEntries = entries.filter(
      (e) => !e.engagementId || e.engagementId === projectId
    );
    const documentCount = projectEntries.length;
    const completedCount = projectEntries.filter(
      (e) => e.apiStatus === 'Approved' || e.apiStatus === 'Waived'
    ).length;
    const progressPercentage = documentCount > 0
      ? Math.round((completedCount / documentCount) * 100)
      : 0;
    return { documentCount, progressPercentage };
  }

  async _countPendingActions(clientId) {
    const entries = await boxDocumentStatusService.queryDocumentsByClientId(clientId);
    return entries.filter(
      (e) => e.apiStatus && !['Approved', 'Waived'].includes(e.apiStatus)
    ).length;
  }
}

const boxEntityService = new BoxEntityService();
export default boxEntityService;
