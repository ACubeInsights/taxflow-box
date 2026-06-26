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

    // Step 2: Detect tier via probe (or use forced override for testing)
    const enterpriseId = config.boxEnterpriseId;
    const forcedTier = process.env.BOX_FORCE_TIER; // Optional override: 'enterprise' or 'free'

    if (forcedTier === 'enterprise' || forcedTier === 'free') {
      this.tier = forcedTier;
      this.tierDetectionResult = { tier: forcedTier, enterpriseId, detectedAt: new Date().toISOString() };
      logger.info('Box tier forced via BOX_FORCE_TIER', { tier: this.tier, enterpriseId });
    } else {
      const detectionResult = await BoxWrapperService.detectTier(client, enterpriseId);
      this.tier = detectionResult.tier;
      this.tierDetectionResult = detectionResult;
      logger.info('Box tier auto-detected', {
        tier: this.tier,
        enterpriseId: detectionResult.enterpriseId,
        detectedAt: detectionResult.detectedAt,
      });
    }

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

  /**
   * Chunked upload threshold: 20MB (per Box documentation).
   * Files >= this size use chunked upload sessions for resumability and integrity.
   * Reference: https://developer.box.com/guides/uploads/chunked/index.md
   */
  static CHUNKED_THRESHOLD = 20 * 1024 * 1024;

  /**
   * Chunk size for chunked uploads: 8MB.
   * Must be a multiple of the Box-required minimum part size.
   */
  static CHUNK_SIZE = 8 * 1024 * 1024;

  /**
   * Uploads a file to a Box folder. Routes to direct upload (< 20MB) or
   * chunked upload (>= 20MB) based on file size.
   *
   * @param {string} folderId - Target Box folder ID
   * @param {string} fileName - Name for the file in Box
   * @param {Buffer} fileBuffer - File content as a Buffer
   * @returns {Promise<{ id: string, name: string, size: number, created_at?: string }>}
   */
  async uploadFile(folderId, fileName, fileBuffer) {
    this.ensureInitialized();

    const fileSize = fileBuffer.length;

    if (fileSize >= BoxService.CHUNKED_THRESHOLD) {
      return this.chunkedUpload(folderId, fileName, fileBuffer, fileSize);
    }

    return this.directUpload(folderId, fileName, fileBuffer);
  }

  /**
   * Direct upload for files under 20MB.
   * Single-request upload via POST /files/content.
   *
   * @param {string} folderId
   * @param {string} fileName
   * @param {Buffer} fileBuffer
   * @returns {Promise<object>} Box file entry
   */
  async directUpload(folderId, fileName, fileBuffer) {
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

  /**
   * Chunked upload for files >= 20MB.
   * Creates an upload session, uploads parts in sequence, and commits with SHA-1 digest.
   *
   * Flow:
   * 1. Create upload session (specifies total file size)
   * 2. Upload parts (8MB chunks, sequentially)
   * 3. Commit session (SHA-1 digest of entire file + ordered part list)
   *
   * Reference: https://developer.box.com/guides/uploads/chunked/index.md
   *
   * @param {string} folderId - Target Box folder ID
   * @param {string} fileName - Name for the file in Box
   * @param {Buffer} fileBuffer - Complete file content
   * @param {number} totalSize - Total file size in bytes
   * @returns {Promise<object>} Box file entry
   */
  async chunkedUpload(folderId, fileName, fileBuffer, totalSize) {
    const client = this.getBoxClient();
    const crypto = await import('crypto');

    // Step 1: Create upload session
    let session;
    try {
      session = await client.chunkedUploads.createFileUploadSession({
        folderId,
        fileSize: totalSize,
        fileName,
      });
    } catch (error) {
      throw new Error(
        `Failed to create chunked upload session: ${error.statusCode || 'unknown'} — ${error.message}`
      );
    }

    const sessionId = session.id;
    const partSize = session.partSize || BoxService.CHUNK_SIZE;
    const parts = [];

    // Step 2: Upload parts sequentially
    let offset = 0;
    while (offset < totalSize) {
      const end = Math.min(offset + partSize, totalSize);
      const chunk = fileBuffer.slice(offset, end);
      const contentRange = `bytes ${offset}-${end - 1}/${totalSize}`;

      // Compute SHA-1 digest for this part
      const partDigest = crypto.createHash('sha1').update(chunk).digest('base64');

      try {
        const part = await client.chunkedUploads.uploadFilePart(sessionId, {
          chunk,
          offset,
          totalSize,
          partDigest,
        });
        parts.push(part.part || part);
      } catch (error) {
        // Abort session on failure to prevent orphaned sessions
        try {
          await client.chunkedUploads.deleteFileUploadSession(sessionId);
        } catch {
          // Best effort cleanup
        }
        throw new Error(
          `Chunked upload part failed at offset ${offset}: ${error.statusCode || 'unknown'} — ${error.message}`
        );
      }

      offset = end;
    }

    // Step 3: Compute whole-file SHA-1 digest and commit
    const fileDigest = crypto.createHash('sha1').update(fileBuffer).digest('base64');

    try {
      const result = await client.chunkedUploads.commit(sessionId, {
        parts,
        sha1: fileDigest,
      });
      // Result may be { entries: [...] } or the file object directly
      const entries = result.entries || [result];
      return entries[0];
    } catch (error) {
      throw new Error(
        `Chunked upload commit failed for session ${sessionId}: ${error.statusCode || 'unknown'} — ${error.message}`
      );
    }
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

  /**
   * Lightweight health check — verifies Box API connectivity.
   * Caches result for 60 seconds to avoid rate limit consumption.
   * @returns {Promise<{ connected: boolean, tier: string, enterpriseId: string, serviceAccount?: string, error?: string }>}
   */
  async healthCheck() {
    if (this._healthCache && Date.now() - this._healthCacheAt < 60000) {
      return this._healthCache;
    }

    try {
      this.ensureInitialized();
      const client = this.getBoxClient();
      const me = await client.users.getCurrentUser();
      const result = {
        connected: true,
        tier: this.tier,
        enterpriseId: this.tierDetectionResult?.enterpriseId || '',
        serviceAccount: me.name || me.login || '',
      };
      this._healthCache = result;
      this._healthCacheAt = Date.now();
      return result;
    } catch (err) {
      const result = {
        connected: false,
        tier: this.tier || 'unknown',
        enterpriseId: '',
        error: err.message,
      };
      this._healthCache = result;
      this._healthCacheAt = Date.now();
      return result;
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
