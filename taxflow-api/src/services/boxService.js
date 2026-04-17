import { BoxWrapperService } from '../../../box-wrapper-service/dist/index.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export class BoxService {
  constructor() {
    this.service = new BoxWrapperService({
      configPath: config.boxConfigPath,
      rootFolderId: config.boxRootFolderId,
      enterpriseId: config.boxEnterpriseId,
    });
    this.initialized = false;
    this.tier = 'free';
    this.tierDetectionResult = null;
  }

  async initialize() {
    if (this.initialized) return;

    // Step 1: Get the Box client
    const client = this.service.getBoxClient();

    // Step 2: Detect tier via probe
    const enterpriseId = config.boxEnterpriseId;
    const detectionResult = await BoxWrapperService.detectTier(client, enterpriseId);
    this.tier = detectionResult.tier;
    this.tierDetectionResult = detectionResult;

    logger.info('Box tier detected', {
      tier: this.tier,
      enterpriseId: detectionResult.enterpriseId,
      detectedAt: detectionResult.detectedAt,
    });

    // Step 3: Sync metadata schema (tier-conditional error handling)
    if (this.tier === 'enterprise') {
      // Enterprise tier: require successful schema sync (let errors propagate)
      await this.service.syncMetadataSchema(this.tier);
    } else {
      // Free tier: attempt schema sync but treat failure as non-fatal
      try {
        await this.service.syncMetadataSchema(this.tier);
      } catch (error) {
        logger.warn('Schema sync failed on free tier, continuing initialization', {
          error: error.message || String(error),
          tier: this.tier,
        });
      }
    }

    // Step 4: Mark as initialized
    this.initialized = true;
  }

  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Box service not initialized. Call initialize() first.');
    }
  }

  /**
   * Returns the detected Box tier ('enterprise' or 'free').
   * @returns {string}
   */
  getTier() {
    return this.tier;
  }

  /**
   * Returns the full tier detection result object.
   * @returns {{ tier: string, enterpriseId: string, detectedAt: string } | null}
   */
  getTierDetectionResult() {
    return this.tierDetectionResult;
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
