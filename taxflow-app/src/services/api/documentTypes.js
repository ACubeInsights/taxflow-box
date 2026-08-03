import { apiRequest } from './http.js';

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

/**
 * Permission API — Granular file/folder access control
 */
