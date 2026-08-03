import { apiRequest } from './http.js';

export const clientApi = {
  async createVault(name, externalId, email) {
    return apiRequest('/clients', {
      method: 'POST',
      body: JSON.stringify({ name, externalId, email }),
    });
  },

  async getVault(externalId) {
    return apiRequest(`/clients/${externalId}/vault`);
  },
};

/**
 * Document API
 */
