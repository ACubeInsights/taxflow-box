import { apiRequest } from './http.js';

export const commentApi = {
  async getComments(documentId) {
    return apiRequest(`/documents/${documentId}/comments`);
  },
  async addComment(documentId, data) {
    return apiRequest(`/documents/${documentId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async editComment(commentId, data) {
    return apiRequest(`/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async searchEmployees(prefix) {
    const params = new URLSearchParams();
    if (prefix) params.set('prefix', prefix);
    const qs = params.toString();
    return apiRequest(`/employees/search${qs ? `?${qs}` : ''}`);
  },
};

/**
 * Document Type API — document type catalog
 */
