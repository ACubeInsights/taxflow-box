import { BoxWrapperService } from '../../../box-wrapper-service/dist/index.js';
import { config } from '../config.js';

export class BoxService {
  constructor() {
    this.service = new BoxWrapperService({
      configPath: config.boxConfigPath,
      rootFolderId: config.boxRootFolderId,
    });
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    // Metadata schema sync skipped for free developer accounts
    this.initialized = true;
  }

  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Box service not initialized. Call initialize() first.');
    }
  }

  async createClientVault(clientName, externalId, email) {
    this.ensureInitialized();
    return await this.service.createAutomatedVault(clientName, externalId, email);
  }

  async findVaultByExternalId(externalId) {
    this.ensureInitialized();
    return await this.service.findVaultByExternalId(externalId);
  }

  getBoxClient() {
    this.ensureInitialized();
    return this.service.getBoxClient();
  }

  async uploadFile(folderId, fileName, fileBuffer) {
    this.ensureInitialized();
    const client = this.getBoxClient();
    const { Readable } = await import('stream');
    const fileStream = Readable.from(fileBuffer);
    const result = await client.uploads.uploadFile({
      attributes: {
        name: fileName,
        parent: { id: folderId },
      },
      file: fileStream,
    });
    return result.entries[0];
  }

  async listFiles(folderId) {
    this.ensureInitialized();
    const client = this.getBoxClient();
    const items = await client.folders.getFolderItems(folderId);
    return items.entries || [];
  }

  async getFileDownloadUrl(fileId) {
    this.ensureInitialized();
    const client = this.getBoxClient();
    return await client.downloads.getDownloadFileUrl(fileId);
  }

  async addCollaborator(folderId, email, role = 'editor') {
    this.ensureInitialized();
    const client = this.getBoxClient();
    try {
      await client.userCollaborations.createCollaboration({
        item: { type: 'folder', id: folderId },
        accessibleBy: { type: 'user', login: email },
        role,
      });
    } catch (error) {
      if (error.statusCode === 409) return; // already exists
      throw error;
    }
  }

  async deleteFile(fileId) {
    this.ensureInitialized();
    const client = this.getBoxClient();
    await client.files.deleteFileById(fileId);
  }
}

// Singleton instance
const boxService = new BoxService();
export default boxService;
