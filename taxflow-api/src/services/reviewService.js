/**
 * ReviewService — Document approval, rejection, waive, bulk approve, internal notes,
 * undo approval, version-based status transitions, and bulk transitions.
 *
 * Existing (Box SDK):
 * - approveDocument: PATCH metadata + complete task
 * - rejectDocument: PATCH metadata + file comment (task stays open)
 * - waiveDocument: PATCH metadata + complete task
 * - bulkApprove: Concurrent approval with max 5 parallel ops
 * - createInternalNote: Upload to InternalNotes subfolder
 * - listInternalNotes: Return notes sorted by creation date descending
 *
 * New (in-memory projectService):
 * - transitionStatus: Validate transition, optimistic concurrency, audit trail, system comment
 * - undoApproval: Revert Approved → Under_Review within 10-min window
 * - bulkTransition: Batch transition Uploaded → Under_Review
 *
 * Requirements: 5.6, 6.2, 6.3, 6.4, 9.1, 9.4, 9.5, 9.6, 12.1-12.5, 13.1-13.5,
 *               14.1-14.3, 15.1-15.4, 15.7, 17.1-17.5
 */

import boxService from './boxService.js';
import complianceService from './complianceService.js';
import projectService from './projectService.js';
import commentService from './commentService.js';
import notificationService from './notificationService.js';

const METADATA_SCOPE = 'enterprise';
const METADATA_TEMPLATE = 'taxflow_document';
const BULK_CONCURRENCY = 5;

/** 10-minute undo window in milliseconds */
const UNDO_WINDOW_MS = 10 * 60 * 1000;

/** Valid status transitions for the 6-status document lifecycle (Req 6.2) */
const VALID_TRANSITIONS = {
  Not_Requested:      ['Uploaded'],
  Uploaded:           ['Under_Review'],
  Under_Review:       ['Approved', 'Revision_Requested', 'Waived'],
  Revision_Requested: ['Uploaded'],
  Approved:           ['Under_Review'],  // undo within 10-min window only
  Waived:             [],                // terminal
};

class ReviewService {
  constructor() {
    /** @type {Map<string, number>} documentId → approvedAt timestamp (ms) for undo window tracking */
    this._approvedAtMap = new Map();
  }

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
      const err = new Error('Rejection reason is required');
      err.statusCode = 400;
      throw err;
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

  // ─── New methods (in-memory projectService data store) ──────────────

  /**
   * Transitions a document status with optimistic concurrency control.
   * Validates against VALID_TRANSITIONS, checks version, records audit trail,
   * generates system comment, dispatches revision email if needed. (Reqs 6.2, 6.3, 6.4, 9.1, 14.1-14.3, 15.7)
   *
   * @param {string} documentId
   * @param {{ fromStatus: string, toStatus: string, employeeId: string, version: number, comment?: string }} options
   * @returns {{ documentId: string, status: string, version: number, auditEntry: object }}
   */
  transitionStatus(documentId, { fromStatus, toStatus, employeeId, version, comment }) {
    // Get document from projectService
    const doc = projectService._documents.get(documentId);
    if (!doc) {
      const err = new Error('Document not found');
      err.statusCode = 404;
      throw err;
    }

    // Validate transition against state machine (Req 6.2, 6.3)
    const allowed = VALID_TRANSITIONS[doc.status];
    if (!allowed || !allowed.includes(toStatus)) {
      const err = new Error(`Invalid transition from ${doc.status} to ${toStatus}`);
      err.statusCode = 400;
      throw err;
    }

    // Optimistic concurrency check (Req 14.1, 14.2, 14.3)
    if (version !== undefined && version !== doc.version) {
      const err = new Error('Version conflict: document has been modified by another user');
      err.statusCode = 409;
      throw err;
    }

    // Revision_Requested requires a comment between 10-1000 chars (Req 9.7)
    if (toStatus === 'Revision_Requested') {
      if (!comment || comment.trim().length < 10 || comment.trim().length > 1000) {
        const err = new Error('Revision comment must be between 10 and 1000 characters');
        err.statusCode = 400;
        throw err;
      }
    }

    // Perform the transition
    const previousStatus = doc.status;
    doc.status = toStatus;
    doc.version = (doc.version || 1) + 1;
    doc.updatedAt = new Date().toISOString();

    if (toStatus === 'Revision_Requested' && comment) {
      doc.revisionComments = comment.trim();
    }

    // Store approvedAt timestamp for undo tracking (Req 9.4)
    if (toStatus === 'Approved') {
      this._approvedAtMap.set(documentId, Date.now());
    }

    // Record audit trail entry (Req 6.4, 15.7)
    const auditEntry = {
      actor: employeeId,
      action: `${previousStatus} → ${toStatus}`,
      timestamp: doc.updatedAt,
    };

    projectService._addActivity({
      type: 'status_change',
      actorId: employeeId,
      actorName: 'Employee',
      documentId,
      documentName: doc.name,
      clientId: doc.clientId,
      clientName: projectService._clients.get(doc.clientId)?.name || '',
      description: `Status changed from ${previousStatus} to ${toStatus}`,
    });

    // Generate system comment (Req 10.4)
    commentService.addSystemComment(documentId, {
      action: 'status_change',
      actorId: employeeId,
      actorName: 'Employee',
      fromStatus: previousStatus,
      toStatus,
    });

    // Dispatch revision email if toStatus is Revision_Requested (Req 11.1, 11.2)
    if (toStatus === 'Revision_Requested') {
      const client = projectService._clients.get(doc.clientId);
      if (client && client.email) {
        // Fire-and-forget: use dispatchRevisionEmail for 7-day token
        notificationService.dispatchRevisionEmail(client.email, documentId, comment).catch((err) => {
          console.error(`Revision email dispatch failed for document ${documentId}:`, err.message);
        });
      }
    }

    return {
      documentId,
      status: toStatus,
      version: doc.version,
      auditEntry,
    };
  }

  /**
   * Undoes an approval within the 10-minute window.
   * Reverts status from Approved to Under_Review, increments version,
   * generates system comment. (Reqs 9.4, 9.5, 9.6)
   *
   * @param {string} fileId - Document ID
   * @param {string} employeeId
   * @param {number} version - Expected version for optimistic concurrency
   * @returns {{ documentId: string, status: string, version: number }}
   */
  undoApproval(fileId, employeeId, version) {
    const doc = projectService._documents.get(fileId);
    if (!doc) {
      const err = new Error('Document not found');
      err.statusCode = 404;
      throw err;
    }

    if (doc.status !== 'Approved') {
      const err = new Error('Document is not in Approved status');
      err.statusCode = 400;
      throw err;
    }

    // Check undo window (Req 9.5)
    const approvedAt = this._approvedAtMap.get(fileId);
    if (!approvedAt) {
      const err = new Error('No approval timestamp found for undo');
      err.statusCode = 400;
      throw err;
    }

    const elapsed = Date.now() - approvedAt;
    if (elapsed > UNDO_WINDOW_MS) {
      const err = new Error('Undo window has expired (10 minutes)');
      err.statusCode = 422;
      throw err;
    }

    // Optimistic concurrency check
    if (version !== undefined && version !== doc.version) {
      const err = new Error('Version conflict: document has been modified by another user');
      err.statusCode = 409;
      throw err;
    }

    // Revert status
    doc.status = 'Under_Review';
    doc.version = (doc.version || 1) + 1;
    doc.updatedAt = new Date().toISOString();

    // Remove approvedAt entry
    this._approvedAtMap.delete(fileId);

    // Record audit trail
    projectService._addActivity({
      type: 'status_change',
      actorId: employeeId,
      actorName: 'Employee',
      documentId: fileId,
      documentName: doc.name,
      clientId: doc.clientId,
      clientName: projectService._clients.get(doc.clientId)?.name || '',
      description: 'Undid approval, reverted to Under_Review',
    });

    // Generate system comment
    commentService.addSystemComment(fileId, {
      action: 'undo_approval',
      actorId: employeeId,
      actorName: 'Employee',
      fromStatus: 'Approved',
      toStatus: 'Under_Review',
    });

    return {
      documentId: fileId,
      status: 'Under_Review',
      version: doc.version,
    };
  }

  /**
   * Bulk transitions documents from Uploaded to Under_Review.
   * Skips documents not in Uploaded status. (Req 5.6)
   *
   * @param {string[]} documentIds
   * @param {{ toStatus: string, employeeId: string }} options
   * @returns {{ total: number, succeeded: number, failed: number, skipped: number }}
   */
  bulkTransition(documentIds, { toStatus, employeeId }) {
    const results = { total: documentIds.length, succeeded: 0, failed: 0, skipped: 0 };

    for (const docId of documentIds) {
      const doc = projectService._documents.get(docId);
      if (!doc) {
        results.failed++;
        continue;
      }

      // Only transition Uploaded documents (Req 5.6)
      if (doc.status !== 'Uploaded') {
        results.skipped++;
        continue;
      }

      try {
        this.transitionStatus(docId, {
          fromStatus: doc.status,
          toStatus: 'Under_Review',
          employeeId,
          version: doc.version,
        });
        results.succeeded++;
      } catch {
        results.failed++;
      }
    }

    return results;
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
export { ReviewService, VALID_TRANSITIONS, UNDO_WINDOW_MS };
export default reviewService;
