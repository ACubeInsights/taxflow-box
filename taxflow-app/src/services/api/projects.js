import { apiRequest } from './http.js';

export const projectApi = {
  async getAllClients(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.entityType) params.set('entityType', filters.entityType);
    const qs = params.toString();
    return apiRequest(`/admin/clients${qs ? `?${qs}` : ''}`);
  },
  async getClientProjects(clientId) {
    return apiRequest(`/clients/${clientId}/projects`);
  },
  async getProjectDetail(projectId) {
    return apiRequest(`/projects/${projectId}`);
  },
  async getProjectDocuments(projectId, statusFilter) {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const qs = params.toString();
    return apiRequest(`/projects/${projectId}/documents${qs ? `?${qs}` : ''}`);
  },
  async createDocumentRequest(projectId, data) {
    return apiRequest(`/projects/${projectId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async checkDuplicate(projectId, documentType) {
    return apiRequest(`/projects/${projectId}/documents/check-duplicate`, {
      method: 'POST',
      body: JSON.stringify({ documentType }),
    });
  },
};

/**
 * Comment API — threaded comments on documents
 */
