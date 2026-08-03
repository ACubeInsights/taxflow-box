import { apiRequest } from './http.js';

export const notificationApi = {
  async getNotifications(recipientId) {
    return apiRequest(`/notifications/${recipientId}`);
  },
};

/**
 * Project API — Client → Project → Document hierarchy
 */
