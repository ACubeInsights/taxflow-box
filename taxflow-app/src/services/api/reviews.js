import { apiRequest } from './http.js';

export const reviewApi = {
  async undoApprove(fileId, employeeId, version) {
    return apiRequest(`/reviews/${fileId}/undo-approve`, {
      method: 'POST',
      body: JSON.stringify({ employeeId, version }),
    });
  },
  async transitionStatus(documentId, data) {
    return apiRequest(`/reviews/documents/${documentId}/transition`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async bulkTransition(documentIds, data) {
    return apiRequest('/reviews/documents/bulk-transition', {
      method: 'POST',
      body: JSON.stringify({ documentIds, ...data }),
    });
  },
};
