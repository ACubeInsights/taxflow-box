import { apiRequest } from './http.js';

export const portalApi = {
  async getClientProgress(clientId) {
    return apiRequest(`/portal/client/${clientId}/progress`);
  },
  async getEmployeeDashboard(employeeId) {
    return apiRequest(`/portal/employee/${employeeId}/dashboard`);
  },
};
