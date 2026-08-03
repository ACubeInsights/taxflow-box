/**
 * Activity feed and employee summary ProjectService methods.
 * Mixed into ProjectService.prototype — methods rely on `this` for instance state.
 * Extracted from ProjectService with no logic changes.
 */

import boxDocumentStatusService from '../boxDocumentStatusService.js';
import boxEntityService from '../boxEntityService.js';

export const activityOperations = {
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
  },

  /**
   * Returns employee summary metrics (computed across all clients).
   */
  async getEmployeeSummary(employeeId) {
    if (this._useMinimalBox()) {
      const clients = await boxEntityService.listClients({});
      let activeClients = 0;
      let pendingReviews = 0;
      let overdueDocuments = 0;
      let awaitingClientAction = 0;
      const now = new Date();

      for (const client of clients) {
        if (client.engagementStatus === 'Active') activeClients++;
        const entries = await boxDocumentStatusService.queryDocumentsByClientId(client.id);
        for (const entry of entries) {
          const status = entry.apiStatus;
          if (status === 'Uploaded' || status === 'Under_Review') pendingReviews++;
          if (entry.dueDate && status !== 'Approved' && status !== 'Waived') {
            if (new Date(entry.dueDate) < now) overdueDocuments++;
          }
          if (status === 'Revision_Requested' || status === 'Not_Requested') {
            awaitingClientAction++;
          }
        }
      }

      return { activeClients, pendingReviews, overdueDocuments, awaitingClientAction };
    }
    if (this._clientRepo && this._docRepo) {
      const clients = await this._clientRepo.findAll();

      let activeClients = 0;
      let pendingReviews = 0;
      let overdueDocuments = 0;
      let awaitingClientAction = 0;
      const now = new Date();

      for (const client of clients) {
        if (client.engagement_status === 'Active') activeClients++;

        const dbDocs = await this._docRepo.findByClientId(client.id);
        const mapped = dbDocs.map((d) => this._mapDocFromDb(d));
        const docs = await boxDocumentStatusService.mergeWithBoxMetadata(mapped, client.id);

        for (const doc of docs) {
          if (doc.isDraft) continue;
          if (doc.status === 'Uploaded' || doc.status === 'Under_Review') {
            pendingReviews++;
          }
          if (doc.dueDate && doc.status !== 'Approved' && doc.status !== 'Waived') {
            const due = new Date(doc.dueDate);
            if (due < now) overdueDocuments++;
          }
          if (doc.status === 'Revision_Requested' || doc.status === 'Not_Requested') {
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
  },

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
  },
};
