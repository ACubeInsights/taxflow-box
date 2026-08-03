/**
 * API client barrel — stable imports from services/api.
 */

export { setAuthToken, getAuthToken, apiRequest } from './api/http.js';
export { employeeApi } from './api/employees.js';
export { authApi } from './api/auth.js';
export { vaultApi } from './api/vault.js';
export { documentApi } from './api/documents.js';
export { clientApi } from './api/clients.js';
export { inviteApi } from './api/invites.js';
export { onboardingApi } from './api/onboarding.js';
export { portalApi } from './api/portal.js';
export { reviewApi } from './api/reviews.js';
export { notificationApi } from './api/notifications.js';
export { projectApi } from './api/projects.js';
export { commentApi } from './api/comments.js';
export { documentTypeApi } from './api/documentTypes.js';
export { collaborationApi } from './api/collaborations.js';
export { permissionApi } from './api/permissions.js';
