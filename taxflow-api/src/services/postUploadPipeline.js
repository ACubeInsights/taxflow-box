/**
 * PostUploadPipeline — Automates post-upload processing for Box webhook FILE.UPLOADED events.
 *
 * - processUpload: Detects new upload vs revision flow
 * - applyMetadata: Applies taxflow_document metadata template
 * - createReviewTask: Creates Box task with reviewer assignment
 * - handleRevision: Resets status, clears comments, re-assigns reviewer
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 18.1, 18.2, 18.3, 18.4
 */

import boxService from './boxService.js';
import rateLimiter from './rateLimiter.js';
import aiExtractionService from './aiExtractionService.js';

const METADATA_SCOPE = 'enterprise';
const METADATA_TEMPLATE = 'taxflow_document';

class PostUploadPipeline {
  /**
   * Processes a FILE.UPLOADED webhook event.
   * Detects whether this is a new upload or a revision (re-upload after rejection).
   *
   * @param {object} event - Webhook event payload
   * @returns {Promise<{ fileId: string, metadataApplied: boolean, taskId?: string, taskAssignmentId?: string, isRevision: boolean, notificationSent: boolean }>}
   */
  async processUpload(event) {
    const fileId = event.source?.id;
    if (!fileId) {
      throw new Error('Webhook event missing source file ID');
    }

    const client = boxService.getBoxClient();

    // Check if file already has metadata with revision_requested status (Req 18.1)
    let existingMetadata = null;
    try {
      existingMetadata = await client.fileMetadata.getFileMetadataById(
        fileId,
        METADATA_SCOPE,
        METADATA_TEMPLATE
      );
    } catch (err) {
      // 404 means no metadata yet — this is a new upload
      if (err.statusCode !== 404 && err.status !== 404) {
        console.error(`Error checking metadata for file ${fileId}:`, err.message);
      }
    }

    const isRevision =
      existingMetadata?.status === 'revision_requested';

    if (isRevision) {
      const originalReviewer = existingMetadata.reviewer || '';
      return this.handleRevision(fileId, originalReviewer);
    }

    // New upload flow
    return this._processNewUpload(event, fileId, client);
  }

  /**
   * Processes a new file upload: applies metadata, creates review task.
   * @param {object} event
   * @param {string} fileId
   * @param {object} client - Box SDK client
   * @returns {Promise<object>}
   */
  async _processNewUpload(event, fileId, client) {
    // Derive client_id and financial_year from folder hierarchy
    const { clientId, financialYear } = await this._extractContext(fileId, client);

    // Apply metadata (Req 9.1, 9.2)
    let metadataApplied = false;
    try {
      await this.applyMetadata(fileId, clientId, financialYear);
      metadataApplied = true;

      // Fire-and-forget AI extraction after successful metadata application (Req 32.1)
      aiExtractionService.extractStructuredData(fileId).catch((err) => {
        console.error(`AI extraction failed for file ${fileId}:`, err.message);
      });
    } catch (err) {
      // Queue for retry via rateLimiter on metadata failure (Req 9.6)
      console.error(`Metadata application failed for file ${fileId}:`, err.message);
      rateLimiter.enqueue(
        () => this.applyMetadata(fileId, clientId, financialYear),
        'high'
      ).catch((retryErr) => {
        console.error(`Metadata retry failed for file ${fileId}:`, retryErr.message);
      });

      return {
        fileId,
        metadataApplied: false,
        isRevision: false,
        notificationSent: false,
      };
    }

    // Create review task (Req 9.3, 9.4)
    let taskId;
    let taskAssignmentId;
    try {
      const reviewerEmail = event.created_by?.login || '';
      const taskResult = await this.createReviewTask(fileId, reviewerEmail);
      taskId = taskResult.taskId;
      taskAssignmentId = taskResult.assignmentId;
    } catch (err) {
      console.error(`Task creation failed for file ${fileId}:`, err.message);
    }

    return {
      fileId,
      metadataApplied,
      taskId,
      taskAssignmentId,
      isRevision: false,
      notificationSent: false,
    };
  }

  /**
   * Applies taxflow_document metadata template to a newly uploaded file.
   * Sets client_id, status: "uploaded", financial_year, priority: "normal". (Req 9.1, 9.2)
   *
   * @param {string} fileId - Box file ID
   * @param {string} clientId - Client identifier
   * @param {string} financialYear - Tax year
   */
  async applyMetadata(fileId, clientId, financialYear) {
    const client = boxService.getBoxClient();

    await client.fileMetadata.createFileMetadataById(
      fileId,
      METADATA_SCOPE,
      METADATA_TEMPLATE,
      {
        client_id: clientId,
        status: 'uploaded',
        financial_year: financialYear,
        priority: 'normal',
      }
    );
  }

  /**
   * Creates a review task and assigns it to the designated reviewer. (Req 9.3, 9.4)
   *
   * @param {string} fileId - Box file ID
   * @param {string} reviewerEmail - Email of the reviewer to assign
   * @returns {Promise<{ taskId: string, assignmentId: string }>}
   */
  async createReviewTask(fileId, reviewerEmail) {
    const client = boxService.getBoxClient();

    // Create task (Req 9.3)
    const task = await client.tasks.createTask({
      item: { type: 'file', id: fileId },
      action: 'review',
      message: 'Review uploaded document',
      completion_rule: 'all_assignees',
    });

    // Assign task to reviewer (Req 9.4)
    const assignment = await client.tasks.createTaskAssignment(task.id, {
      assign_to: { login: reviewerEmail },
    });

    return {
      taskId: task.id,
      assignmentId: assignment.id,
    };
  }

  /**
   * Handles re-upload after rejection: resets status, clears comments,
   * creates new task for original reviewer, adds re-upload comment. (Reqs 18.1-18.4)
   *
   * @param {string} fileId - Box file ID
   * @param {string} originalReviewer - Email of the original reviewer
   * @returns {Promise<object>}
   */
  async handleRevision(fileId, originalReviewer) {
    const client = boxService.getBoxClient();

    // Reset status to "uploaded" and clear review_comments (Req 18.1)
    try {
      await client.fileMetadata.updateFileMetadataById(
        fileId,
        METADATA_SCOPE,
        METADATA_TEMPLATE,
        [
          { op: 'replace', path: '/status', value: 'uploaded' },
          { op: 'replace', path: '/review_comments', value: '' },
        ]
      );
    } catch (err) {
      console.error(`Revision metadata reset failed for file ${fileId}:`, err.message);
      // Queue for retry
      rateLimiter.enqueue(
        () => this.handleRevision(fileId, originalReviewer),
        'high'
      ).catch((retryErr) => {
        console.error(`Revision retry failed for file ${fileId}:`, retryErr.message);
      });

      return {
        fileId,
        metadataApplied: false,
        isRevision: true,
        notificationSent: false,
      };
    }

    // Create new task for original reviewer (Req 18.2)
    let taskId;
    let taskAssignmentId;
    try {
      const taskResult = await this.createReviewTask(fileId, originalReviewer);
      taskId = taskResult.taskId;
      taskAssignmentId = taskResult.assignmentId;
    } catch (err) {
      console.error(`Revision task creation failed for file ${fileId}:`, err.message);
    }

    // Add re-upload comment (Req 18.4)
    try {
      await client.comments.createComment({
        item: { type: 'file', id: fileId },
        message: 'Re-uploaded by client — pending re-review',
      });
    } catch (err) {
      console.error(`Re-upload comment failed for file ${fileId}:`, err.message);
    }

    return {
      fileId,
      metadataApplied: true,
      taskId,
      taskAssignmentId,
      isRevision: true,
      notificationSent: false,
    };
  }

  /**
   * Extracts client_id and financial_year from the file's folder hierarchy.
   * Walks up the parent chain to find the year folder and client root.
   *
   * @param {string} fileId
   * @param {object} client - Box SDK client
   * @returns {Promise<{ clientId: string, financialYear: string }>}
   */
  async _extractContext(fileId, client) {
    let clientId = '';
    let financialYear = new Date().getFullYear().toString();

    try {
      const fileInfo = await client.files.getFileById(fileId, {
        fields: ['parent'],
      });

      const parentId = fileInfo.parent?.id;
      if (parentId) {
        // Get parent folder (should be a subfolder like "Uploads")
        const parentFolder = await client.folders.getFolderById(parentId, {
          fields: ['name', 'parent'],
        });

        // Parent of "Uploads" should be the year folder
        const yearFolderId = parentFolder.parent?.id;
        if (yearFolderId) {
          const yearFolder = await client.folders.getFolderById(yearFolderId, {
            fields: ['name', 'parent'],
          });
          financialYear = yearFolder.name || financialYear;

          // Parent of year folder is the client root
          const rootFolderId = yearFolder.parent?.id;
          if (rootFolderId) {
            const rootFolder = await client.folders.getFolderById(rootFolderId, {
              fields: ['name'],
            });
            // Extract externalId from "ClientName (externalId)" pattern
            const match = rootFolder.name?.match(/\(([^)]+)\)$/);
            clientId = match ? match[1] : rootFolder.name || '';
          }
        }
      }
    } catch (err) {
      console.error(`Context extraction failed for file ${fileId}:`, err.message);
    }

    return { clientId, financialYear };
  }
}

// Singleton instance
const postUploadPipeline = new PostUploadPipeline();
export { PostUploadPipeline };
export default postUploadPipeline;
