/**
 * StatusTransitionService — In-memory document status transitions with optimistic
 * concurrency control, audit trail, and undo support.
 *
 * Extracted from reviewService.js to separate Box SDK operations from in-memory
 * projectService operations (Requirement 4.4).
 *
 * Public API:
 * - transitionStatus(documentId, options): Validate and execute a status transition
 * - undoApproval(fileId, employeeId, version): Revert Approved → Under_Review within 10-min window
 * - bulkTransition(documentIds, options): Batch transition Uploaded → Under_Review
 *
 * Requirements: 5.6, 6.2, 6.3, 6.4, 9.1, 9.4, 9.5, 9.6
 */

import projectService from './projectService.js';
import commentService from './commentService.js';
import notificationService from './notificationService.js';
import { createHttpError } from '../utils/httpError.js';

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

export class StatusTransitionService {
  /**
   * @param {{ projectService?: object, commentService?: object, notificationService?: object }} [deps]
   *   Optional dependency injection for testing. Falls back to module-level singletons.
   */
  constructor(deps = {}) {
    /** @type {Map<string, number>} documentId → approvedAt timestamp (ms) for undo window tracking */
    this._approvedAtMap = new Map();
    this._projectService = deps.projectService || projectService;
    this._commentService = deps.commentService || commentService;
    this._notificationService = deps.notificationService || notificationService;
  }

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
    // Get document via public API (Req 12.1)
    const doc = this._projectService.getDocument(documentId);
    if (!doc) {
      throw createHttpError('Document not found', 404);
    }

    // Validate transition against state machine (Req 6.2, 6.3)
    const allowed = VALID_TRANSITIONS[doc.status];
    if (!allowed || !allowed.includes(toStatus)) {
      throw createHttpError(`Invalid transition from ${doc.status} to ${toStatus}`, 400);
    }

    // Revision_Requested requires a comment between 10-1000 chars (Req 9.7)
    if (toStatus === 'Revision_Requested') {
      if (!comment || comment.trim().length < 10 || comment.trim().length > 1000) {
        throw createHttpError('Revision comment must be between 10 and 1000 characters', 400);
      }
    }

    // Perform the transition via public API with concurrency check (Req 12.1, 14.1-14.3)
    const previousStatus = doc.status;
    const extra = {};
    if (toStatus === 'Revision_Requested' && comment) {
      extra.revisionComments = comment.trim();
    }
    const updated = this._projectService.updateDocumentStatus(documentId, toStatus, version, extra);

    // Business rule: When a document is approved, record the wall-clock timestamp.
    // This starts a 10-minute undo window (UNDO_WINDOW_MS) during which the
    // reviewer can revert the approval back to Under_Review. After the window
    // elapses, the approval becomes permanent and undoApproval() will reject
    // with a 422 error. (Req 9.4)
    if (toStatus === 'Approved') {
      this._approvedAtMap.set(documentId, Date.now());
    }

    // Record audit trail entry (Req 6.4, 15.7)
    const auditEntry = {
      actor: employeeId,
      action: `${previousStatus} → ${toStatus}`,
      timestamp: updated.updatedAt,
    };

    const client = this._projectService.getClient(doc.clientId);
    this._projectService.addActivity({
      type: 'status_change',
      actorId: employeeId,
      actorName: 'Employee',
      documentId,
      documentName: doc.name,
      clientId: doc.clientId,
      clientName: client?.name || '',
      description: `Status changed from ${previousStatus} to ${toStatus}`,
    });

    // Generate system comment (Req 10.4)
    this._commentService.addSystemComment(documentId, {
      action: 'status_change',
      actorId: employeeId,
      actorName: 'Employee',
      fromStatus: previousStatus,
      toStatus,
    });

    // Dispatch revision email if toStatus is Revision_Requested (Req 11.1, 11.2)
    if (toStatus === 'Revision_Requested') {
      if (client && client.email) {
        // Fire-and-forget: use dispatchRevisionEmail for 7-day token
        this._notificationService.dispatchRevisionEmail(client.email, documentId, comment).catch((err) => {
          console.error(`Revision email dispatch failed for document ${documentId}:`, err.message);
        });
      }
    }

    return {
      documentId,
      status: toStatus,
      version: updated.version,
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
    // Get document via public API (Req 12.1)
    const doc = this._projectService.getDocument(fileId);
    if (!doc) {
      throw createHttpError('Document not found', 404);
    }

    if (doc.status !== 'Approved') {
      throw createHttpError('Document is not in Approved status', 400);
    }

    // Business rule: Approvals can only be undone within a 10-minute window
    // (UNDO_WINDOW_MS = 600 000 ms) from the moment the document was approved.
    // This prevents accidental approvals from becoming permanent immediately,
    // while still ensuring finality after a reasonable grace period.
    // If no timestamp exists (e.g., approval predates this service instance),
    // the undo is rejected to avoid reverting stale approvals. (Req 9.5)
    const approvedAt = this._approvedAtMap.get(fileId);
    if (!approvedAt) {
      throw createHttpError('No approval timestamp found for undo', 400);
    }

    const elapsed = Date.now() - approvedAt;
    if (elapsed > UNDO_WINDOW_MS) {
      throw createHttpError('Undo window has expired (10 minutes)', 422);
    }

    // Revert status via public API with concurrency check (Req 12.1)
    const updated = this._projectService.updateDocumentStatus(fileId, 'Under_Review', version);

    // Remove approvedAt entry
    this._approvedAtMap.delete(fileId);

    // Record audit trail
    const client = this._projectService.getClient(doc.clientId);
    this._projectService.addActivity({
      type: 'status_change',
      actorId: employeeId,
      actorName: 'Employee',
      documentId: fileId,
      documentName: doc.name,
      clientId: doc.clientId,
      clientName: client?.name || '',
      description: 'Undid approval, reverted to Under_Review',
    });

    // Generate system comment
    this._commentService.addSystemComment(fileId, {
      action: 'undo_approval',
      actorId: employeeId,
      actorName: 'Employee',
      fromStatus: 'Approved',
      toStatus: 'Under_Review',
    });

    return {
      documentId: fileId,
      status: 'Under_Review',
      version: updated.version,
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
      // Get document via public API (Req 12.1)
      const doc = this._projectService.getDocument(docId);
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
}

// Singleton instance
const statusTransitionService = new StatusTransitionService();
export { VALID_TRANSITIONS, UNDO_WINDOW_MS };
export default statusTransitionService;
