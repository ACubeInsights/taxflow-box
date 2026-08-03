import { apiRequest } from './http.js';

export const authApi = {
  async login(email, password) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  async getMe() {
    return apiRequest('/auth/me');
  },
  async logout() {
    return apiRequest('/auth/logout', { method: 'POST' });
  },
  async refreshSession() {
    return apiRequest('/auth/refresh', { method: 'POST' });
  },
  async changePassword(currentPassword, newPassword) {
    return apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
  async forgotPassword(email) {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  async resetPassword(token, newPassword) {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },
};

/**
 * Client API
 */
