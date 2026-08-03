import { apiRequest } from './http.js';

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

  async getEditUrl(fileId) {
    return apiRequest(`/documents/${fileId}/edit-url`);
  },
};

/**
 * Vault API
 */
