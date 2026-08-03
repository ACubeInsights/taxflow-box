import { apiRequest } from './http.js';

export const onboardingApi = {
  async onboardClient(clientName, externalId, email, employeeEmail, financialYear, password) {
    return apiRequest('/onboarding', {
      method: 'POST',
      body: JSON.stringify({ clientName, externalId, email, employeeEmail, financialYear, password }),
    });
  },
};
