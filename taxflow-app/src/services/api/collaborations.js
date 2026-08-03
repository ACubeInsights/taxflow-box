import { apiRequest } from './http.js';

export const collaborationApi = {
  async setBoxEmail(employeeId, boxLoginEmail) {
    return apiRequest(`/employees/${employeeId}/box-email`, {
      method: 'PUT',
      body: JSON.stringify({ boxLoginEmail }),
    });
  },
  async getBoxEmail(employeeId) {
    return apiRequest(`/employees/${employeeId}/box-email`);
  },
  async addCollaborator(clientId, employeeId) {
    return apiRequest(`/clients/${clientId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    });
  },
  async removeCollaborator(clientId, employeeId) {
    return apiRequest(`/clients/${clientId}/collaborators/${employeeId}`, {
      method: 'DELETE',
    });
  },
  async listCollaborators(clientId) {
    return apiRequest(`/clients/${clientId}/collaborators`);
  },
  async syncCollaborations(employeeId) {
    return apiRequest(`/employees/${employeeId}/sync-collaborations`, {
      method: 'POST',
    });
  },
};
