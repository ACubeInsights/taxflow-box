import { apiRequest } from './http.js';

export const permissionApi = {
  async setPermission(clientId, resourceId, resourceType, accessLevel, resourceName) {
    return apiRequest('/permissions', {
      method: 'POST',
      body: JSON.stringify({ clientId, resourceId, resourceType, accessLevel, resourceName }),
    });
  },
  async getClientPermissions(clientId) {
    return apiRequest(`/permissions/${clientId}`);
  },
  async getPermission(clientId, resourceId) {
    return apiRequest(`/permissions/${clientId}/${resourceId}`);
  },
};

/**
 * Invite API — Client invitation and self-signup
 */
