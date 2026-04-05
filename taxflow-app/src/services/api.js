const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Module-level auth token
let _authToken = null;

export function setAuthToken(token) {
  _authToken = token;
}

export function getAuthToken() {
  return _authToken;
}

/**
 * Generic API request handler
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Default 90-second timeout for API calls
  const timeoutMs = options.timeout || 90000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (_authToken) {
      headers['Authorization'] = `Bearer ${_authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      // Dispatch auth-error event on 401 so AuthContext can trigger logout
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('auth-unauthorized'))
      }
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`API Timeout (${endpoint}): Request timed out after ${timeoutMs}ms`);
      throw new Error('Request timed out. The server may be busy — please try again.');
    }
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Employee API — super admin creates employees
 */
export const employeeApi = {
  async createEmployee(name, email, role, password) {
    return apiRequest('/employees', {
      method: 'POST',
      body: JSON.stringify({ name, email, role, password }),
    });
  },
};

/**
 * Auth API — login, logout, session validation
 */
export const authApi = {
  async login(email, password) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  // Backward compatibility
  async loginClient(email, password) { return this.login(email, password); },
  async loginStaff(email, password) { return this.login(email, password); },
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
export const documentApi = {
  async upload(file, folderId, requestId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderId', folderId);
    if (requestId) {
      formData.append('requestId', requestId);
    }

    const url = `${API_BASE_URL}/documents/upload`;
    const headers = {};
    if (_authToken) {
      headers['Authorization'] = `Bearer ${_authToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  },
};

/**
 * Vault API
 */
export const vaultApi = {
  async listFiles(folderId) {
    return apiRequest(`/vaults/${folderId}/files`);
  },
};

export const onboardingApi = {
  async onboardClient(clientName, externalId, email, employeeEmail, financialYear, password) {
    return apiRequest('/onboarding', {
      method: 'POST',
      body: JSON.stringify({ clientName, externalId, email, employeeEmail, financialYear, password }),
    });
  },
};

export const portalApi = {
  async getClientProgress(clientId) {
    return apiRequest(`/portal/client/${clientId}/progress`);
  },
  async getEmployeeDashboard(employeeId) {
    return apiRequest(`/portal/employee/${employeeId}/dashboard`);
  },
  async getCXOPortfolio(cursor, limit) {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit !== undefined && limit !== null) params.set('limit', String(limit));
    const qs = params.toString();
    return apiRequest(`/portal/cxo/portfolio${qs ? `?${qs}` : ''}`);
  },
  async getInactiveClients(thresholdDays) {
    const params = new URLSearchParams();
    if (thresholdDays !== undefined && thresholdDays !== null) params.set('thresholdDays', String(thresholdDays));
    const qs = params.toString();
    return apiRequest(`/portal/inactive-clients${qs ? `?${qs}` : ''}`);
  },
  async getFileVersions(fileId) {
    return apiRequest(`/portal/files/${fileId}/versions`);
  },
  async createZipDownload(fileIds) {
    return apiRequest('/portal/zip-download', {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
    });
  },
  async getEmployeeSummary(employeeId) {
    return apiRequest(`/portal/employee/${employeeId}/summary`);
  },
  async getEmployeeActivity(employeeId, limit) {
    const params = new URLSearchParams();
    if (limit !== undefined && limit !== null) params.set('limit', String(limit));
    const qs = params.toString();
    return apiRequest(`/portal/employee/${employeeId}/activity${qs ? `?${qs}` : ''}`);
  },
};

export const reviewApi = {
  async approve(fileId, employeeId) {
    return apiRequest(`/reviews/${fileId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    });
  },
  async reject(fileId, employeeId, reason) {
    return apiRequest(`/reviews/${fileId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ employeeId, reason }),
    });
  },
  async waive(fileId, employeeId, reason) {
    return apiRequest(`/reviews/${fileId}/waive`, {
      method: 'POST',
      body: JSON.stringify({ employeeId, reason }),
    });
  },
  async bulkApprove(fileIds, employeeId) {
    return apiRequest('/reviews/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ fileIds, employeeId }),
    });
  },
  async createNote(clientFolderId, author, subject, content) {
    return apiRequest(`/reviews/${clientFolderId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ author, subject, content }),
    });
  },
  async listNotes(clientFolderId) {
    return apiRequest(`/reviews/${clientFolderId}/notes`);
  },
  async undoApprove(fileId, employeeId, version) {
    return apiRequest(`/reviews/${fileId}/undo-approve`, {
      method: 'POST',
      body: JSON.stringify({ employeeId, version }),
    });
  },
  async transitionStatus(documentId, data) {
    return apiRequest(`/documents/${documentId}/transition`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async bulkTransition(documentIds, data) {
    return apiRequest('/documents/bulk-transition', {
      method: 'POST',
      body: JSON.stringify({ documentIds, ...data }),
    });
  },
};

export const tokenApi = {
  async getPreviewToken(fileId, userId) {
    return apiRequest('/tokens/preview', {
      method: 'POST',
      body: JSON.stringify({ fileId, userId }),
    });
  },
};

export const signApi = {
  async createSignRequest(fileId, signerEmail, signedDocsFolderId, isEmbedded) {
    return apiRequest('/sign/request', {
      method: 'POST',
      body: JSON.stringify({ fileId, signerEmail, signedDocsFolderId, isEmbedded }),
    });
  },
};

export const notificationApi = {
  async getNotifications(recipientId) {
    return apiRequest(`/notifications/${recipientId}`);
  },
};

export const complianceApi = {
  async classify(fileId, level) {
    return apiRequest(`/compliance/classify/${fileId}`, {
      method: 'POST',
      body: JSON.stringify({ level }),
    });
  },
};

/**
 * Project API — Client → Project → Document hierarchy
 */
export const projectApi = {
  async getAllClients() {
    return apiRequest('/admin/clients');
  },
  async getEmployeeClients(employeeId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.entityType) params.set('entityType', filters.entityType);
    const qs = params.toString();
    return apiRequest(`/employee/${employeeId}/clients${qs ? `?${qs}` : ''}`);
  },
  async getClientProjects(clientId) {
    return apiRequest(`/clients/${clientId}/projects`);
  },
  async getProjectDetail(projectId) {
    return apiRequest(`/projects/${projectId}`);
  },
  async getProjectDocuments(projectId, statusFilter) {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const qs = params.toString();
    return apiRequest(`/projects/${projectId}/documents${qs ? `?${qs}` : ''}`);
  },
  async createDocumentRequest(projectId, data) {
    return apiRequest(`/projects/${projectId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async checkDuplicate(projectId, documentType) {
    return apiRequest(`/projects/${projectId}/documents/check-duplicate`, {
      method: 'POST',
      body: JSON.stringify({ documentType }),
    });
  },
};

/**
 * Comment API — threaded comments on documents
 */
export const commentApi = {
  async getComments(documentId) {
    return apiRequest(`/documents/${documentId}/comments`);
  },
  async addComment(documentId, data) {
    return apiRequest(`/documents/${documentId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async editComment(commentId, data) {
    return apiRequest(`/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async searchEmployees(prefix) {
    const params = new URLSearchParams();
    if (prefix) params.set('prefix', prefix);
    const qs = params.toString();
    return apiRequest(`/employees/search${qs ? `?${qs}` : ''}`);
  },
};

/**
 * Document Type API — document type catalog
 */
export const documentTypeApi = {
  async getDocumentTypes(projectType) {
    const params = new URLSearchParams();
    if (projectType) params.set('projectType', projectType);
    const qs = params.toString();
    return apiRequest(`/document-types${qs ? `?${qs}` : ''}`);
  },
  async getDocumentType(typeId) {
    return apiRequest(`/document-types/${typeId}`);
  },
};
