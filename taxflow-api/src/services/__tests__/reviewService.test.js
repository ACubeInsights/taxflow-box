import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusTransitionService, VALID_TRANSITIONS, UNDO_WINDOW_MS } from '../statusTransitionService.js';
import { ProjectService } from '../projectService.js';
import { CommentService } from '../commentService.js';
import { NotificationService } from '../notificationService.js';
import { InAppNotificationStore } from '../inAppNotificationStore.js';

/**
 * Tests for the status transition methods (extracted from reviewService):
 * - transitionStatus
 * - undoApproval
 * - bulkTransition
 *
 * Each test gets fresh service instances via constructor injection,
 * ensuring full test isolation without singleton state pollution.
 */

describe('StatusTransitionService', () => {
  /** @type {StatusTransitionService} */
  let service;
  /** @type {ProjectService} */
  let projService;
  /** @type {CommentService} */
  let cmtService;
  /** @type {NotificationService} */
  let notifService;

  beforeEach(() => {
    projService = new ProjectService();
    cmtService = new CommentService();
    notifService = new NotificationService(new InAppNotificationStore());

    service = new StatusTransitionService({
      projectService: projService,
      commentService: cmtService,
      notificationService: notifService,
    });
  });

  // ─── VALID_TRANSITIONS constant ─────────────────────────────────────

  describe('VALID_TRANSITIONS', () => {
    it('defines transitions for all 6 statuses', () => {
      const statuses = ['Not_Requested', 'Uploaded', 'Under_Review', 'Revision_Requested', 'Approved', 'Waived'];
      for (const s of statuses) {
        expect(VALID_TRANSITIONS).toHaveProperty(s);
        expect(Array.isArray(VALID_TRANSITIONS[s])).toBe(true);
      }
    });

    it('Waived is terminal (no transitions)', () => {
      expect(VALID_TRANSITIONS.Waived).toEqual([]);
    });

    it('Under_Review can transition to Approved, Revision_Requested, Waived', () => {
      expect(VALID_TRANSITIONS.Under_Review).toEqual(['Approved', 'Revision_Requested', 'Waived']);
    });
  });

  // ─── transitionStatus ───────────────────────────────────────────────

  describe('transitionStatus', () => {
    it('transitions Uploaded → Under_Review successfully', () => {
      // d2 is Uploaded, version 1
      const result = service.transitionStatus('d2', {
        fromStatus: 'Uploaded',
        toStatus: 'Under_Review',
        employeeId: 'emp1',
        version: 1,
      });

      expect(result.documentId).toBe('d2');
      expect(result.status).toBe('Under_Review');
      expect(result.version).toBe(2);
      expect(result.auditEntry).toBeDefined();
      expect(result.auditEntry.actor).toBe('emp1');
    });

    it('transitions Under_Review → Approved and stores approvedAt', () => {
      // d6 is Under_Review, version 1
      const result = service.transitionStatus('d6', {
        fromStatus: 'Under_Review',
        toStatus: 'Approved',
        employeeId: 'emp1',
        version: 1,
      });

      expect(result.status).toBe('Approved');
      expect(service._approvedAtMap.has('d6')).toBe(true);
    });

    it('transitions Under_Review → Revision_Requested with valid comment', () => {
      const result = service.transitionStatus('d6', {
        fromStatus: 'Under_Review',
        toStatus: 'Revision_Requested',
        employeeId: 'emp1',
        version: 1,
        comment: 'Please fix the amounts on page 2, they do not match.',
      });

      expect(result.status).toBe('Revision_Requested');
      const doc = projService.getDocument('d6');
      expect(doc.revisionComments).toBe('Please fix the amounts on page 2, they do not match.');
    });

    it('transitions Under_Review → Waived', () => {
      const result = service.transitionStatus('d6', {
        fromStatus: 'Under_Review',
        toStatus: 'Waived',
        employeeId: 'emp1',
        version: 1,
      });

      expect(result.status).toBe('Waived');
    });

    it('throws 404 for non-existent document', () => {
      expect(() =>
        service.transitionStatus('nonexistent', {
          fromStatus: 'Uploaded', toStatus: 'Under_Review', employeeId: 'emp1', version: 1,
        })
      ).toThrow('Document not found');

      try {
        service.transitionStatus('nonexistent', {
          fromStatus: 'Uploaded', toStatus: 'Under_Review', employeeId: 'emp1', version: 1,
        });
      } catch (err) {
        expect(err.statusCode).toBe(404);
      }
    });

    it('throws 400 for invalid transition (Uploaded → Approved)', () => {
      expect(() =>
        service.transitionStatus('d2', {
          fromStatus: 'Uploaded', toStatus: 'Approved', employeeId: 'emp1', version: 1,
        })
      ).toThrow('Invalid transition');

      try {
        service.transitionStatus('d2', {
          fromStatus: 'Uploaded', toStatus: 'Approved', employeeId: 'emp1', version: 1,
        });
      } catch (err) {
        expect(err.statusCode).toBe(400);
      }
    });

    it('throws 400 for transition from terminal Waived status', () => {
      // d9 is Waived
      expect(() =>
        service.transitionStatus('d9', {
          fromStatus: 'Waived', toStatus: 'Under_Review', employeeId: 'emp1', version: 2,
        })
      ).toThrow('Invalid transition');
    });

    it('throws 409 on version mismatch', () => {
      expect(() =>
        service.transitionStatus('d2', {
          fromStatus: 'Uploaded', toStatus: 'Under_Review', employeeId: 'emp1', version: 99,
        })
      ).toThrow('Version conflict');

      try {
        service.transitionStatus('d2', {
          fromStatus: 'Uploaded', toStatus: 'Under_Review', employeeId: 'emp1', version: 99,
        });
      } catch (err) {
        expect(err.statusCode).toBe(409);
      }
    });

    it('throws 400 for Revision_Requested without comment', () => {
      expect(() =>
        service.transitionStatus('d6', {
          fromStatus: 'Under_Review', toStatus: 'Revision_Requested', employeeId: 'emp1', version: 1,
        })
      ).toThrow('Revision comment must be between 10 and 1000 characters');
    });

    it('throws 400 for Revision_Requested with too-short comment', () => {
      expect(() =>
        service.transitionStatus('d6', {
          fromStatus: 'Under_Review', toStatus: 'Revision_Requested', employeeId: 'emp1', version: 1, comment: 'short',
        })
      ).toThrow('Revision comment must be between 10 and 1000 characters');
    });

    it('increments version on successful transition', () => {
      const docBefore = projService.getDocument('d2');
      const versionBefore = docBefore.version;

      service.transitionStatus('d2', {
        fromStatus: 'Uploaded', toStatus: 'Under_Review', employeeId: 'emp1', version: versionBefore,
      });

      expect(projService.getDocument('d2').version).toBe(versionBefore + 1);
    });

    it('records activity entry on transition', () => {
      const activitiesBefore = projService.getEmployeeActivity('employee-1', 100).length;

      service.transitionStatus('d2', {
        fromStatus: 'Uploaded', toStatus: 'Under_Review', employeeId: 'emp1', version: 1,
      });

      const activitiesAfter = projService.getEmployeeActivity('employee-1', 100);
      expect(activitiesAfter.length).toBe(activitiesBefore + 1);
      const lastActivity = activitiesAfter[0]; // sorted descending by timestamp
      expect(lastActivity.type).toBe('status_change');
      expect(lastActivity.documentId).toBe('d2');
    });

    it('generates system comment on transition', () => {
      service.transitionStatus('d2', {
        fromStatus: 'Uploaded', toStatus: 'Under_Review', employeeId: 'emp1', version: 1,
      });

      const comments = cmtService.getComments('d2');
      expect(comments.length).toBeGreaterThanOrEqual(1);
      const systemComment = comments.find((c) => c.type === 'system');
      expect(systemComment).toBeDefined();
      expect(systemComment.text).toContain('Uploaded');
      expect(systemComment.text).toContain('Under_Review');
    });
  });

  // ─── undoApproval ───────────────────────────────────────────────────

  describe('undoApproval', () => {
    it('reverts Approved → Under_Review within undo window', () => {
      // First approve d6 (Under_Review → Approved)
      service.transitionStatus('d6', {
        fromStatus: 'Under_Review', toStatus: 'Approved', employeeId: 'emp1', version: 1,
      });

      const approvedDoc = projService.getDocument('d6');
      expect(approvedDoc.status).toBe('Approved');
      const versionAfterApprove = approvedDoc.version;

      // Now undo
      const result = service.undoApproval('d6', 'emp1', versionAfterApprove);

      expect(result.status).toBe('Under_Review');
      expect(result.version).toBe(versionAfterApprove + 1);
      expect(projService.getDocument('d6').status).toBe('Under_Review');
    });

    it('clears approvedAt entry after undo', () => {
      service.transitionStatus('d6', {
        fromStatus: 'Under_Review', toStatus: 'Approved', employeeId: 'emp1', version: 1,
      });
      expect(service._approvedAtMap.has('d6')).toBe(true);

      const doc = projService.getDocument('d6');
      service.undoApproval('d6', 'emp1', doc.version);
      expect(service._approvedAtMap.has('d6')).toBe(false);
    });

    it('throws 404 for non-existent document', () => {
      expect(() => service.undoApproval('nonexistent', 'emp1', 1)).toThrow('Document not found');
    });

    it('throws 400 if document is not Approved', () => {
      // d2 is Uploaded
      expect(() => service.undoApproval('d2', 'emp1', 1)).toThrow('Document is not in Approved status');
    });

    it('throws 400 if no approval timestamp exists', () => {
      // d1 is Approved in seed data but has no _approvedAtMap entry
      expect(() => service.undoApproval('d1', 'emp1', 2)).toThrow('No approval timestamp found');
    });

    it('throws 422 if undo window has expired', () => {
      service.transitionStatus('d6', {
        fromStatus: 'Under_Review', toStatus: 'Approved', employeeId: 'emp1', version: 1,
      });

      // Manually set approvedAt to 11 minutes ago
      service._approvedAtMap.set('d6', Date.now() - 11 * 60 * 1000);

      const doc = projService.getDocument('d6');
      expect(() => service.undoApproval('d6', 'emp1', doc.version)).toThrow('Undo window has expired');

      try {
        service.undoApproval('d6', 'emp1', doc.version);
      } catch (err) {
        expect(err.statusCode).toBe(422);
      }
    });

    it('throws 409 on version mismatch', () => {
      service.transitionStatus('d6', {
        fromStatus: 'Under_Review', toStatus: 'Approved', employeeId: 'emp1', version: 1,
      });

      expect(() => service.undoApproval('d6', 'emp1', 999)).toThrow('Version conflict');
    });

    it('generates system comment on undo', () => {
      service.transitionStatus('d6', {
        fromStatus: 'Under_Review', toStatus: 'Approved', employeeId: 'emp1', version: 1,
      });

      const doc = projService.getDocument('d6');
      service.undoApproval('d6', 'emp1', doc.version);

      const comments = cmtService.getComments('d6');
      const undoComment = comments.find((c) => c.type === 'system' && c.text.includes('Approved') && c.text.includes('Under_Review'));
      expect(undoComment).toBeDefined();
    });
  });

  // ─── bulkTransition ─────────────────────────────────────────────────

  describe('bulkTransition', () => {
    it('transitions only Uploaded documents to Under_Review', () => {
      // d2 (Uploaded), d7 (Uploaded), d1 (Approved), d6 (Under_Review)
      const result = service.bulkTransition(['d2', 'd7', 'd1', 'd6'], {
        toStatus: 'Under_Review',
        employeeId: 'emp1',
      });

      expect(result.total).toBe(4);
      expect(result.succeeded).toBe(2); // d2 and d7
      expect(result.skipped).toBe(2);   // d1 (Approved) and d6 (Under_Review)
      expect(result.failed).toBe(0);

      expect(projService.getDocument('d2').status).toBe('Under_Review');
      expect(projService.getDocument('d7').status).toBe('Under_Review');
      expect(projService.getDocument('d1').status).toBe('Approved');   // unchanged
      expect(projService.getDocument('d6').status).toBe('Under_Review'); // was already Under_Review
    });

    it('returns failed count for non-existent documents', () => {
      const result = service.bulkTransition(['nonexistent1', 'nonexistent2'], {
        toStatus: 'Under_Review',
        employeeId: 'emp1',
      });

      expect(result.total).toBe(2);
      expect(result.failed).toBe(2);
      expect(result.succeeded).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('handles empty array', () => {
      const result = service.bulkTransition([], {
        toStatus: 'Under_Review',
        employeeId: 'emp1',
      });

      expect(result.total).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('skips Not_Requested, Revision_Requested, Approved, Waived documents', () => {
      // d4 (Not_Requested), d3 (Revision_Requested), d1 (Approved), d9 (Waived)
      const result = service.bulkTransition(['d4', 'd3', 'd1', 'd9'], {
        toStatus: 'Under_Review',
        employeeId: 'emp1',
      });

      expect(result.succeeded).toBe(0);
      expect(result.skipped).toBe(4);
    });

    it('increments version for each transitioned document', () => {
      const v2Before = projService.getDocument('d2').version;
      const v7Before = projService.getDocument('d7').version;

      service.bulkTransition(['d2', 'd7'], {
        toStatus: 'Under_Review',
        employeeId: 'emp1',
      });

      expect(projService.getDocument('d2').version).toBe(v2Before + 1);
      expect(projService.getDocument('d7').version).toBe(v7Before + 1);
    });
  });

  // ─── UNDO_WINDOW_MS constant ───────────────────────────────────────

  describe('UNDO_WINDOW_MS', () => {
    it('is 10 minutes in milliseconds', () => {
      expect(UNDO_WINDOW_MS).toBe(10 * 60 * 1000);
    });
  });
});
