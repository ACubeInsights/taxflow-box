/**
 * UploadService — Standard and chunked file uploads to Box.
 *
 * - upload: Routes to standard or chunked based on 50MB threshold
 * - chunkedUpload: Session-based upload with 8MB chunks, SHA-1 commit, retry logic
 *
 * Requirements: 36.1, 36.2, 36.3, 36.4, 36.5
 */

import crypto from 'crypto';
import boxService from './boxService.js';
import { config } from '../config.js';
import { retryWithBackoff } from '../utils/retryWithBackoff.js';

const CHUNKED_THRESHOLD_BYTES = (config.chunkedUploadThresholdMb || 50) * 1024 * 1024;
const CHUNK_SIZE_BYTES = (config.chunkSizeMb || 8) * 1024 * 1024;
const MAX_CHUNK_RETRIES = 3;

export class UploadService {
  /**
   * Uploads a file, routing to standard or chunked based on 50MB threshold. (Req 36.1)
   *
   * @param {string} folderId - Target Box folder ID
   * @param {string} fileName - File name
   * @param {Buffer} fileBuffer - File content
   * @param {number} fileSize - Total file size in bytes
   * @returns {Promise<{ fileId: string, fileName: string, size: number, sha1: string }>}
   */
  async upload(folderId, fileName, fileBuffer, fileSize) {
    if (fileSize >= CHUNKED_THRESHOLD_BYTES) {
      return this.chunkedUpload(folderId, fileName, fileBuffer, fileSize);
    }
    return this._standardUpload(folderId, fileName, fileBuffer);
  }

  /**
   * Standard upload for files under the chunked threshold.
   * @param {string} folderId
   * @param {string} fileName
   * @param {Buffer} fileBuffer
   * @returns {Promise<{ fileId: string, fileName: string, size: number, sha1: string }>}
   */
  async _standardUpload(folderId, fileName, fileBuffer) {
    const client = boxService.getBoxClient();
    const { Readable } = await import('stream');
    const fileStream = Readable.from(fileBuffer);

    const result = await client.uploads.uploadFile({
      attributes: {
        name: fileName,
        parent: { id: folderId },
      },
      file: fileStream,
    });

    const file = result.entries[0];
    return {
      fileId: file.id,
      fileName: file.name,
      size: file.size,
      sha1: file.sha1 || '',
    };
  }

  /**
   * Chunked upload: create session, upload 8MB chunks with Content-Range, commit with SHA-1.
   * Retries failed chunks up to 3 times. Aborts session on persistent failure. (Reqs 36.2-36.5)
   *
   * @param {string} folderId - Target Box folder ID
   * @param {string} fileName - File name
   * @param {Buffer} fileBuffer - File content
   * @param {number} fileSize - Total file size in bytes
   * @returns {Promise<{ fileId: string, fileName: string, size: number, sha1: string }>}
   */
  async chunkedUpload(folderId, fileName, fileBuffer, fileSize) {
    const client = boxService.getBoxClient();

    // Create upload session (Req 36.2)
    const session = await client.chunkedUploads.createFileUploadSession({
      folder_id: folderId,
      file_name: fileName,
      file_size: fileSize,
    });

    const sessionId = session.id;
    const partSize = session.part_size || CHUNK_SIZE_BYTES;
    const totalParts = Math.ceil(fileSize / partSize);
    const uploadedParts = [];

    // Compute the SHA-1 digest of the entire file content before chunking.
    // Box's chunked upload API requires this whole-file SHA-1 at commit time
    // to verify that all uploaded parts reassemble into the original file.
    // This is a data-integrity check, not a security hash — Box uses SHA-1
    // because its chunked upload protocol (RFC 3230 digest header) predates
    // the deprecation of SHA-1 for cryptographic purposes. (Req 36.3)
    const sha1Hash = crypto.createHash('sha1').update(fileBuffer).digest('base64');

    try {
      // Upload chunks (Req 36.2)
      for (let partIndex = 0; partIndex < totalParts; partIndex++) {
        const offset = partIndex * partSize;
        const end = Math.min(offset + partSize, fileSize);
        const chunk = fileBuffer.subarray(offset, end);
        const contentRange = `bytes ${offset}-${end - 1}/${fileSize}`;

        const part = await this._uploadChunkWithRetry(
          client, sessionId, chunk, contentRange, MAX_CHUNK_RETRIES
        );
        uploadedParts.push(part);
      }

      // Commit the upload session by sending all part descriptors and the
      // whole-file SHA-1 digest. Box reassembles the parts in order and
      // compares the resulting file's SHA-1 against our digest. If they
      // don't match, the commit fails — protecting against corrupted or
      // missing chunks. (Req 36.3)
      const commitResult = await client.chunkedUploads.createFileUploadSessionCommit(
        sessionId,
        {
          parts: uploadedParts,
        },
        sha1Hash
      );

      const file = commitResult.entries[0];
      return {
        fileId: file.id,
        fileName: file.name,
        size: file.size,
        sha1: file.sha1 || sha1Hash,
      };
    } catch (err) {
      // Abort session on persistent failure (Req 36.5)
      try {
        await client.chunkedUploads.deleteFileUploadSessionById(sessionId);
      } catch (abortErr) {
        console.error(`Failed to abort upload session ${sessionId}:`, abortErr.message);
      }
      throw err;
    }
  }

  /**
   * Uploads a single chunk with retry logic. (Req 36.4)
   *
   * @param {object} client - Box SDK client
   * @param {string} sessionId - Upload session ID
   * @param {Buffer} chunk - Chunk data
   * @param {string} contentRange - Content-Range header value
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<object>} Uploaded part descriptor
   */
  async _uploadChunkWithRetry(client, sessionId, chunk, contentRange, maxRetries) {
    return retryWithBackoff(
      async () => {
        // Per-chunk SHA-1 digest sent in the "digest" header so Box can verify
        // each individual part's integrity on receipt, independent of the
        // whole-file SHA-1 used at commit time.
        const sha1 = crypto.createHash('sha1').update(chunk).digest('base64');

        const part = await client.chunkedUploads.uploadFilePartByUrl(
          sessionId,
          chunk,
          {
            digest: `sha=${sha1}`,
            contentRange,
          }
        );

        return part.part || part;
      },
      { maxRetries, baseDelayMs: 1000 }
    );
  }
}

// Singleton instance
const uploadService = new UploadService();
export default uploadService;
