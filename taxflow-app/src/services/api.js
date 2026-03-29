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
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

/**
 * Client API
 */
export const clientApi = {
  /**
   * Create a new client vault
   */
  async createVault(name, externalId, email) {
    return apiRequest('/clients', {
      method: 'POST',
      body: JSON.stringify({ name, externalId, email }),
    });
  },

  /**
   * Get client vault by external ID
   */
  async getVault(externalId) {
    return apiRequest(`/clients/${externalId}/vault`);
  },
};

/**
 * Document API
 */
export const documentApi = {
  /**
   * Upload a document to a vault
   */
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
  async onboardClient(clientName, externalId, email, employeeEmail, financialYear) {
    return apiRequest('/onboarding', {
      method: 'POST',
      body: JSON.stringify({ clientName, externalId, email, employeeEmail, financialYear }),
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
