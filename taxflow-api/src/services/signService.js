/**
 * SignService — Box Sign integration for e-signature workflows.
 *
 * - createSignRequest: POST /sign_requests with source files, signers, parent folder
 * - handleSignEvent: Process SIGN_REQUEST.COMPLETED, DECLINED, EXPIRED events
 *
 * Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 26.1, 26.2, 26.3, 26.4, 26.5
 */

import boxService from './boxService.js';
import { config } from '../config.js';

const METADATA_SCOPE = 'enterprise';
const METADATA_TEMPLATE = 'taxflow_document';

class SignService {
  /**
   * Creates a Box Sign request with signer config and redirect URLs.
   * Updates file metadata status to "pending_signature". (Reqs 25.1-25.6)
   *
   * @param {string} fileId - Box file ID to sign
   * @param {string} signerEmail - Signer's email address
   * @param {string} signedDocsFolderId - SignedDocuments folder ID for signed copies
   * @param {object} [options]
   * @param {boolean} [options.isEmbedded] - Return embed_url for in-app signing
   * @param {string} [options.redirectUrl] - Custom redirect URL after signing
   * @param {string} [options.declinedRedirectUrl] - Custom redirect URL on decline
   * @returns {Promise<{ signRequestId: string, embedUrl?: string, status: string }>}
   */
  async createSignRequest(fileId, signerEmail, signedDocsFolderId, options = {}) {
    const client = boxService.getBoxClient();

    const requestBody = {
      source_files: [{ type: 'file', id: fileId }],
      signers: [{ email: signerEmail, role: 'signer' }],
      parent_folder: { type: 'folder', id: signedDocsFolderId },
      redirect_url: options.redirectUrl || config.signRedirectUrl,
      declined_redirect_url: options.declinedRedirectUrl || config.signDeclinedRedirectUrl,
    };

    if (options.isEmbedded) {
      requestBody.is_document_preparation_needed = false;
    }

    let signRequest;
    try {
      signRequest = await client.signRequests.createSignRequest(requestBody);
    } catch (error) {
      // Req 25.6 — descriptive error
      const msg = `Sign request failed for file ${fileId}, signer ${signerEmail}: ${error.message}`;
      console.error(msg);
      const err = new Error(msg);
      err.statusCode = error.statusCode || 500;
      throw err;
    }

    // Update metadata status to "pending_signature" (Req 25.5)
    try {
      await client.fileMetadata.updateFileMetadataById(
        fileId,
        METADATA_SCOPE,
        METADATA_TEMPLATE,
        [{ op: 'replace', path: '/status', value: 'pending_signature' }]
      );
    } catch (err) {
      console.error(`Metadata update to pending_signature failed for file ${fileId}:`, err.message);
    }

    const result = {
      signRequestId: signRequest.id,
      status: signRequest.status || 'created',
    };

    // Return embed_url when isEmbedded (Req 25.4)
    if (options.isEmbedded && signRequest.signers) {
      const signerEntry = signRequest.signers.find((s) => s.email === signerEmail);
      if (signerEntry?.embed_url) {
        result.embedUrl = signerEntry.embed_url;
      }
    }

    return result;
  }

  /**
   * Processes sign webhook events: COMPLETED, DECLINED, EXPIRED.
   * Updates metadata and dispatches notifications. (Reqs 26.1-26.5)
   *
   * @param {object} event - Webhook event payload
   */
  async handleSignEvent(event) {
    const eventType = event.trigger || event.type || '';
    const client = boxService.getBoxClient();

    // Extract file ID from the sign request source
    const fileId = event.source?.id
      || event.additional_info?.sign_request?.source_files?.[0]?.id
      || '';

    if (!fileId) {
      console.warn('Sign event missing file ID:', JSON.stringify(event));
      return;
    }

    if (eventType === 'SIGN_REQUEST.COMPLETED') {
      await this._handleCompleted(client, fileId, event);
    } else if (eventType === 'SIGN_REQUEST.DECLINED') {
      await this._handleDeclined(client, fileId);
    } else if (eventType === 'SIGN_REQUEST.EXPIRED') {
      await this._handleExpired(client, fileId);
    } else {
      console.log(`Unhandled sign event type: ${eventType}`);
    }
  }

  /**
   * SIGN_REQUEST.COMPLETED: status→signed, copy to SignedDocuments. (Reqs 26.1, 26.2)
   */
  async _handleCompleted(client, fileId, event) {
    const completedAt = event.created_at || new Date().toISOString();

    try {
      await client.fileMetadata.updateFileMetadataById(
        fileId,
        METADATA_SCOPE,
        METADATA_TEMPLATE,
        [
          { op: 'replace', path: '/status', value: 'signed' },
          { op: 'replace', path: '/reviewed_at', value: completedAt },
        ]
      );
    } catch (err) {
      console.error(`Metadata update to signed failed for file ${fileId}:`, err.message);
    }

    // Copy signed document to SignedDocuments folder if parent_folder is available (Req 26.2)
    const signedDocsFolderId = event.additional_info?.sign_request?.parent_folder?.id;
    if (signedDocsFolderId) {
      try {
        await client.files.copyFile(fileId, {
          parent: { id: signedDocsFolderId },
        });
      } catch (err) {
        // 409 means file already exists in destination — acceptable
        if (err.statusCode !== 409 && err.status !== 409) {
          console.error(`Copy to SignedDocuments failed for file ${fileId}:`, err.message);
        }
      }
    }
  }

  /**
   * SIGN_REQUEST.DECLINED: status→revision_requested. (Req 26.3)
   */
  async _handleDeclined(client, fileId) {
    try {
      await client.fileMetadata.updateFileMetadataById(
        fileId,
        METADATA_SCOPE,
        METADATA_TEMPLATE,
        [
          { op: 'replace', path: '/status', value: 'revision_requested' },
          { op: 'replace', path: '/review_comments', value: 'Signature declined by signer' },
        ]
      );
    } catch (err) {
      console.error(`Metadata update to revision_requested failed for file ${fileId}:`, err.message);
    }
  }

  /**
   * SIGN_REQUEST.EXPIRED: status→pending_upload, notify. (Req 26.4)
   */
  async _handleExpired(client, fileId) {
    try {
      await client.fileMetadata.updateFileMetadataById(
        fileId,
        METADATA_SCOPE,
        METADATA_TEMPLATE,
        [{ op: 'replace', path: '/status', value: 'pending_upload' }]
      );
    } catch (err) {
      console.error(`Metadata update to pending_upload failed for file ${fileId}:`, err.message);
    }
  }
}

// Singleton instance
const signService = new SignService();
export { SignService };
export default signService;
