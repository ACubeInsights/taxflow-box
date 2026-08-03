import { apiRequest } from './http.js';

export const employeeApi = {
  async createEmployee(name, email, role, password) {
    return apiRequest('/employees', {
      method: 'POST',
      body: JSON.stringify({ name, email, role, password }),
    });
  },
  async listEmployees() {
    return apiRequest('/employees');
  },
};

/**
 * Auth API — login, logout, session validation
 */
