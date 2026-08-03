import { apiRequest } from './http.js';

export const vaultApi = {
  async listFiles(folderId) {
    return apiRequest(`/vaults/${folderId}/files`);
  },
  async listContents(folderId) {
    return apiRequest(`/vaults/${folderId}/contents`);
  },
  async getDownloadUrl(fileId) {
    return apiRequest(`/vaults/files/${fileId}/download`);
  },
  async getEmbedUrl(fileId) {
    return apiRequest(`/vaults/files/${fileId}/embed`);
  },
  async createFolder(parentFolderId, name) {
    return apiRequest(`/vaults/${parentFolderId}/folders`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  async renameFolder(folderId, name) {
    return apiRequest(`/vaults/folders/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },
  async deleteFolder(folderId) {
    return apiRequest(`/vaults/folders/${folderId}`, {
      method: 'DELETE',
    });
  },
};
