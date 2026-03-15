const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Generic API request handler
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
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
    const response = await fetch(url, {
      method: 'POST',
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
  /**
   * List files in a vault
   */
  async listFiles(folderId) {
    return apiRequest(`/vaults/${folderId}/files`);
  },
};
