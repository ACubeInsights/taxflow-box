import { apiRequest } from './http.js';

export const inviteApi = {
  async createInvite(data) {
    return apiRequest('/invites', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async validateToken(token) {
    return apiRequest(`/invites/validate?token=${encodeURIComponent(token)}`);
  },
  async completeSignup(token, password, clientName, externalId, email) {
    return apiRequest('/invites/signup', {
      method: 'POST',
      body: JSON.stringify({ token, password, clientName, externalId, email }),
    });
  },
  async resendInvite(inviteId) {
    return apiRequest(`/invites/${inviteId}/resend`, { method: 'POST' });
  },
  async listInvites(status) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const qs = params.toString();
    return apiRequest(`/invites${qs ? `?${qs}` : ''}`);
  },
};

/**
 * Collaboration API — Manage Box Editor collaborations for employees
 */
