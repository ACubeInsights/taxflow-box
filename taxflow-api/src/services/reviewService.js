/**
 * ReviewService — Document approval, rejection, waive, bulk approve, and internal notes
 * via Box SDK operations.
 *
 * Box SDK operations:
 * - approveDocument: PATCH metadata + complete task
 * - rejectDocument: PATCH metadata + file comment (task stays open)
 * - waiveDocument: PATCH metadata + complete task
 * - bulkApprove: Concurrent approval with max 5 parallel ops
 * - createInternalNote: Upload to InternalNotes subfolder
 * - listInternalNotes: Return notes sorted by creation date descending
 *
 * In-memory status transitions (transitionStatus, undoApproval, bulkTransition) have been
 * extracted to statusTransitionService.js (Requirement 4.4).
 *
 * Requirements: 12.1-12.5, 13.1-13.5, 14.1-14.3, 15.1-15.4, 17.1-17.5
 */

import boxService from './boxService.js';
import complianceService from './complianceService.js';
import { createHttpError } from '../utils/httpError.js';

const METADATA_SCOPE = 'enterprise';
const METADATA_TEMPLATE = 'taxflow_document';
const BULK_CONCURRENCY = 5;

export class ReviewService {
  /**
   * Approves a document: PATCH metadata, complete task assignment.
   * Uses JSON Patch ops. If metadata PATCH fails, task is NOT completed. (Reqs 12.1-12.5)
   *
   * @param {string} fileId
   * @param {string} employeeId
   * @returns {Promise<{ fileId: string, status: string, reviewer: string, reviewedAt: string, taskCompleted: boolean }>}
   */
  async approveDocument(fileId, employeeId) {
    const client = boxService.getBoxClient();
    const reviewedAt = new Date().toISOString();

    // PATCH metadata with JSON Patch ops (Req 12.1, 12.4)
    await client.fileMetadata.updateFileMetadataById(
      fileId,
      METADATA_SCOPE,
      METADATA_TEMPLATE,
      [
        { op: 'replace', path: '/status', value: 'approved' },
        { op: 'replace', path: '/reviewer', value: employeeId },
        { op: 'replace', path: '/reviewed_at', value: reviewedAt },
        { op: 'replace', path: '/review_comments', value: '' },
      ]
    );

    // Fire-and-forget retention policy assignment after approval (Req 29.3)
    complianceService.assignRetentionPolicy(fileId).catch((err) => {
      console.error(`Retention policy assignment failed for file ${fileId}:`, err.message);
    });

    // Complete task assignment (Req 12.2)
    let taskCompleted = false;
    try {
      await this._completeTaskForFile(client, fileId);
      taskCompleted = true;
    } catch (err) {
      console.error(`Task completion failed for file ${fileId}:`, err.message);
    }

    return { fileId, status: 'approved', reviewer: employeeId, reviewedAt, taskCompleted };
  }

  /**
   * Rejects a document: PATCH metadata with comments, create file comment with tagged client.
   * Task remains open. Returns 400 if reason is empty. (Reqs 13.1-13.5)
   *
   * @param {string} fileId
   * @param {string} employeeId
   * @param {string} rejectionReason
   * @returns {Promise<{ fileId: string, status: string, reviewer: string, reviewedAt: string, taskCompleted: boolean }>}
   */
  async rejectDocument(fileId, employeeId, rejectionReason) {
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw createHttpError('Rejection reason is required', 400);
    }

    const client = boxService.getBoxClient();
    const reviewedAt = new Date().toISOString();

    // PATCH metadata (Req 13.1)
    await client.fileMetadata.updateFileMetadataById(
      fileId,
      METADATA_SCOPE,
      METADATA_TEMPLATE,
      [
        { op: 'replace', path: '/status', value: 'revision_requested' },
        { op: 'replace', path: '/reviewer', value: employeeId },
        { op: 'replace', path: '/reviewed_at', value: reviewedAt },
        { op: 'replace', path: '/review_comments', value: rejectionReason },
      ]
    );

    // Create file comment with tagged client (Req 13.2)
    try {
      await client.comments.createComment({
        item: { type: 'file', id: fileId },
        tagged_message: rejectionReason,
        message: rejectionReason,
      });
    } catch (err) {
      console.error(`Comment creation failed for file ${fileId}:`, err.message);
    }

    // Task NOT completed on rejection (Req 13.4)
    return { fileId, status: 'revision_requested', reviewer: employeeId, reviewedAt, taskCompleted: false };
  }

  /**
   * Waives a document requirement: PATCH metadata, complete task. (Reqs 14.1-14.3)
   *
   * @param {string} fileId
   * @param {string} employeeId
   * @param {string} waiveReason
   * @returns {Promise<{ fileId: string, status: string, reviewer: string, reviewedAt: string, taskCompleted: boolean }>}
   */
  async waiveDocument(fileId, employeeId, waiveReason) {
    const client = boxService.getBoxClient();
    const reviewedAt = new Date().toISOString();

    // PATCH metadata (Req 14.1)
    await client.fileMetadata.updateFileMetadataById(
      fileId,
      METADATA_SCOPE,
      METADATA_TEMPLATE,
      [
        { op: 'replace', path: '/status', value: 'waived' },
        { op: 'replace', path: '/reviewer', value: employeeId },
        { op: 'replace', path: '/reviewed_at', value: reviewedAt },
        { op: 'replace', path: '/review_comments', value: waiveReason || '' },
      ]
    );

    // Complete task (Req 14.2)
    let taskCompleted = false;
    try {
      await this._completeTaskForFile(client, fileId);
      taskCompleted = true;
    } catch (err) {
      console.error(`Task completion failed for waived file ${fileId}:`, err.message);
    }

    return { fileId, status: 'waived', reviewer: employeeId, reviewedAt, taskCompleted };
  }

  /**
   * Bulk approves documents with max concurrency of 5.
   * Continues on individual failures. (Reqs 15.1-15.4)
   *
   * @param {string[]} fileIds
   * @param {string} employeeId
   * @returns {Promise<{ total: number, succeeded: number, failed: Array<{ fileId: string, error: string }> }>}
   */
  async bulkApprove(fileIds, employeeId) {
    const results = { total: fileIds.length, succeeded: 0, failed: [] };

    // Process in batches of BULK_CONCURRENCY (Req 15.2)
    for (let i = 0; i < fileIds.length; i += BULK_CONCURRENCY) {
      const batch = fileIds.slice(i, i + BULK_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((fileId) => this.approveDocument(fileId, employeeId))
      );

      for (let j = 0; j < settled.length; j++) {
        if (settled[j].status === 'fulfilled') {
          results.succeeded++;
        } else {
          results.failed.push({
            fileId: batch[j],
            error: settled[j].reason?.message || 'Unknown error',
          });
        }
      }
    }

    return results;
  }

  /**
   * Creates an internal note in the InternalNotes subfolder.
   * Named: {timestamp}_{author}_{subject}.txt (Reqs 17.1-17.3)
   *
   * @param {string} clientFolderId - The client's InternalNotes folder ID
   * @param {string} author
   * @param {string} subject
   * @param {string} content
   * @returns {Promise<{ fileId: string, fileName: string, author: string, subject: string, createdAt: string, documentType: string }>}
   */
  async createInternalNote(clientFolderId, author, subject, content) {
    const client = boxService.getBoxClient();
    const timestamp = Date.now();
    const sanitizedAuthor = author.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedSubject = subject.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${timestamp}_${sanitizedAuthor}_${sanitizedSubject}.txt`;

    // Upload note content as a file (Req 17.1)
    const { Readable } = await import('stream');
    const fileStream = Readable.from(Buffer.from(content, 'utf-8'));

    const uploadResult = await client.uploads.uploadFile({
      attributes: {
        name: fileName,
        parent: { id: clientFolderId },
      },
      file: fileStream,
    });

    const file = uploadResult.entries[0];
    const createdAt = new Date().toISOString();

    // Apply metadata with document_type: "internal_note" (Req 17.3)
    try {
      await client.fileMetadata.createFileMetadataById(
        file.id,
        METADATA_SCOPE,
        METADATA_TEMPLATE,
        {
          document_type: 'internal_note',
          status: 'approved',
        }
      );
    } catch (err) {
      console.error(`Metadata application failed for internal note ${file.id}:`, err.message);
    }

    return {
      fileId: file.id,
      fileName,
      author,
      subject,
      createdAt,
      documentType: 'internal_note',
    };
  }

  /**
   * Lists internal notes sorted by creation date descending. (Req 17.5)
   *
   * @param {string} clientFolderId - The client's InternalNotes folder ID
   * @returns {Promise<Array<{ fileId: string, fileName: string, author: string, subject: string, createdAt: string, documentType: string }>>}
   */
  async listInternalNotes(clientFolderId) {
    const client = boxService.getBoxClient();

    const items = await client.folders.getFolderItems(clientFolderId, {
      fields: ['id', 'name', 'created_at'],
    });

    const notes = (items.entries || [])
      .filter((item) => item.type === 'file' && item.name.endsWith('.txt'))
      .map((item) => {
        // Parse filename: {timestamp}_{author}_{subject}.txt
        const baseName = item.name.replace(/\.txt$/, '');
        const parts = baseName.split('_');
        const timestamp = parts[0] || '';
        const author = parts[1] || '';
        const subject = parts.slice(2).join('_') || '';

        return {
          fileId: item.id,
          fileName: item.name,
          author,
          subject,
          createdAt: item.created_at || '',
          documentType: 'internal_note',
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return notes;
  }

  /**
   * Finds and completes the task assignment for a file.
   * @param {object} client - Box SDK client
   * @param {string} fileId
   */
  async _completeTaskForFile(client, fileId) {
    // Get tasks for the file
    const tasks = await client.tasks.getFileTasks(fileId);
    const entries = tasks.entries || [];

    for (const task of entries) {
      // Get assignments for this task
      const assignments = await client.tasks.getTaskAssignments(task.id);
      const assignmentEntries = assignments.entries || [];

      for (const assignment of assignmentEntries) {
        if (assignment.status !== 'completed') {
          await client.tasks.updateTaskAssignmentById(assignment.id, {
            status: 'completed',
          });
        }
      }
    }
  }
}

// Singleton instance
const reviewService = new ReviewService();
export default reviewService;
