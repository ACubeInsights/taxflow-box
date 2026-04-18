/**
 * StatusTransitionService — Document status transitions with optimistic
 * concurrency control, audit trail, and undo support.
 *
 * Supports two modes:
 *   1. DB-backed: Uses ApprovalUndoRepository, wraps multi-step ops in transactions
 *   2. In-memory fallback: Uses Map (for tests or when DB is not initialized)
 *
 * Requirements: 16.6, 16.7, 17.1, 17.2, 5.6, 6.2-6.4, 9.1, 9.4-9.6
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
   */
  constructor(deps = {}) {
    /** @type {Map<string, number>} documentId → approvedAt timestamp (ms) for undo window tracking */
    this._approvedAtMap = new Map();
    this._projectService = deps.projectService || projectService;
    this._commentService = deps.commentService || commentService;
    this._notificationService = deps.notificationService || notificationService;

    /** @type {import('../db/repositories/ApprovalUndoRepository.js').ApprovalUndoRepository | null} */
    this._approvalUndoRepo = null;
  }

  /**
   * Injects repository dependencies. Called after DB initialization.
   * @param {{ approvalUndoRepo?: object }} repos
   */
  setRepositories({ approvalUndoRepo } = {}) {
    if (approvalUndoRepo) this._approvalUndoRepo = approvalUndoRepo;
  }

  /**
   * Transitions a document status with optimistic concurrency control.
   */
  async transitionStatus(documentId, { fromStatus, toStatus, employeeId, version, comment }) {
    const doc = await this._projectService.getDocument(documentId);
    if (!doc) {
      throw createHttpError('Document not found', 404);
    }

    // Validate transition against state machine
    const allowed = VALID_TRANSITIONS[doc.status];
    if (!allowed || !allowed.includes(toStatus)) {
      throw createHttpError(`Invalid transition from ${doc.status} to ${toStatus}`, 400);
    }

    // Revision_Requested requires a comment between 10-1000 chars
    if (toStatus === 'Revision_Requested') {
      if (!comment || comment.trim().length < 10 || comment.trim().length > 1000) {
        throw createHttpError('Revision comment must be between 10 and 1000 characters', 400);
      }
    }

    const previousStatus = doc.status;
    const extra = {};
    if (toStatus === 'Revision_Requested' && comment) {
      extra.revisionComments = comment.trim();
    }
    const updated = await this._projectService.updateDocumentStatus(documentId, toStatus, version, extra);

    // Record approval timestamp for undo window
    if (toStatus === 'Approved') {
      if (this._approvalUndoRepo) {
        await this._approvalUndoRepo.upsert(documentId, new Date().toISOString());
      } else {
        this._approvedAtMap.set(documentId, Date.now());
      }
    }

    // Record audit trail entry
    const auditEntry = {
      actor: employeeId,
      action: `${previousStatus} → ${toStatus}`,
      timestamp: updated.updatedAt,
    };

    const client = await this._projectService.getClient(doc.clientId);
    await this._projectService.addActivity({
      type: 'status_change',
      actorId: employeeId,
      actorName: 'Employee',
      documentId,
      documentName: doc.name,
      clientId: doc.clientId,
      clientName: client?.name || '',
      description: `Status changed from ${previousStatus} to ${toStatus}`,
    });

    // Generate system comment
    await this._commentService.addSystemComment(documentId, {
      action: 'status_change',
      actorId: employeeId,
      actorName: 'Employee',
      fromStatus: previousStatus,
      toStatus,
    });

    // Dispatch revision email if toStatus is Revision_Requested
    if (toStatus === 'Revision_Requested') {
      if (client && client.email) {
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
   */
  async undoApproval(fileId, employeeId, version) {
    const doc = await this._projectService.getDocument(fileId);
    if (!doc) {
      throw createHttpError('Document not found', 404);
    }

    if (doc.status !== 'Approved') {
      throw createHttpError('Document is not in Approved status', 400);
    }

    let approvedAt;

    if (this._approvalUndoRepo) {
      const record = await this._approvalUndoRepo.findByDocumentId(fileId);
      if (!record) {
        throw createHttpError('No approval timestamp found for undo', 400);
      }
      approvedAt = new Date(record.approved_at).getTime();
    } else {
      approvedAt = this._approvedAtMap.get(fileId);
      if (!approvedAt) {
        throw createHttpError('No approval timestamp found for undo', 400);
      }
    }

    const elapsed = Date.now() - approvedAt;
    if (elapsed > UNDO_WINDOW_MS) {
      throw createHttpError('Undo window has expired (10 minutes)', 422);
    }

    const updated = await this._projectService.updateDocumentStatus(fileId, 'Under_Review', version);

    // Remove approvedAt entry
    if (this._approvalUndoRepo) {
      await this._approvalUndoRepo.deleteByDocumentId(fileId);
    } else {
      this._approvedAtMap.delete(fileId);
    }

    // Record audit trail
    const client = await this._projectService.getClient(doc.clientId);
    await this._projectService.addActivity({
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
    await this._commentService.addSystemComment(fileId, {
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
   */
  async bulkTransition(documentIds, { toStatus, employeeId }) {
    const results = { total: documentIds.length, succeeded: 0, failed: 0, skipped: 0 };

    for (const docId of documentIds) {
      const doc = await this._projectService.getDocument(docId);
      if (!doc) {
        results.failed++;
        continue;
      }

      if (doc.status !== 'Uploaded') {
        results.skipped++;
        continue;
      }

      try {
        await this.transitionStatus(docId, {
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
