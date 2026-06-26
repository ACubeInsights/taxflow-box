/**
 * Tests for StatusTransitionService — DB-backed status transitions with optimistic concurrency.
 *
 * Verifies:
 * - Valid transitions succeed and increment version
 * - Invalid transitions rejected by state machine
 * - Optimistic concurrency (version conflict → 409)
 * - Undo within 10 minutes succeeds
 * - Undo after 10 minutes rejected (422)
 * - Revision requires comment 10-1000 chars
 * - Bulk transition processes all documents
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusTransitionService, VALID_TRANSITIONS, UNDO_WINDOW_MS } from '../statusTransitionService.js';

describe('StatusTransitionService', () => {
  let service;
  let mockProjectService;
  let mockCommentService;
  let mockNotificationService;
  let mockApprovalUndoRepo;
  let documents;

  beforeEach(() => {
    documents = new Map();
    documents.set('doc-1', {
      id: 'doc-1',
      name: 'W-2 Form',
      status: 'Uploaded',
      version: 1,
      clientId: 'client-1',
      updatedAt: new Date().toISOString(),
    });
    documents.set('doc-2', {
      id: 'doc-2',
      name: '1099-INT',
      status: 'Under_Review',
      version: 3,
      clientId: 'client-1',
      updatedAt: new Date().toISOString(),
    });
    documents.set('doc-3', {
      id: 'doc-3',
      name: 'Schedule K-1',
      status: 'Approved',
      version: 5,
      clientId: 'client-2',
      updatedAt: new Date().toISOString(),
    });

    mockProjectService = {
      getDocument: vi.fn().mockImplementation(async (id) => {
        const doc = documents.get(id);
        return doc ? { ...doc } : null;
      }),
      updateDocumentStatus: vi.fn().mockImplementation(async (id, status, version, extra) => {
        const doc = documents.get(id);
        if (!doc) throw Object.assign(new Error('Not found'), { statusCode: 404 });
        if (version !== undefined && version !== doc.version) {
          const err = new Error('Version conflict');
          err.statusCode = 409;
          throw err;
        }
        doc.status = status;
        doc.version = (doc.version || 1) + 1;
        doc.updatedAt = new Date().toISOString();
        if (extra?.revisionComments) doc.revisionComments = extra.revisionComments;
        return { ...doc };
      }),
      getClient: vi.fn().mockResolvedValue({ id: 'client-1', name: 'Test Client', email: 'client@test.com' }),
      addActivity: vi.fn().mockResolvedValue(undefined),
    };

    mockCommentService = {
      addSystemComment: vi.fn().mockResolvedValue(undefined),
    };

    mockNotificationService = {
      dispatchRevisionEmail: vi.fn().mockResolvedValue(undefined),
    };

    mockApprovalUndoRepo = {
      upsert: vi.fn().mockResolvedValue(undefined),
      findByDocumentId: vi.fn().mockResolvedValue(null),
      deleteByDocumentId: vi.fn().mockResolvedValue(undefined),
    };

    service = new StatusTransitionService({
      projectService: mockProjectService,
      commentService: mockCommentService,
      notificationService: mockNotificationService,
    });
    service.setRepositories({ approvalUndoRepo: mockApprovalUndoRepo });
  });

  describe('transitionStatus', () => {
    it('transitions Uploaded → Under_Review and increments version', async () => {
      const result = await service.transitionStatus('doc-1', {
        toStatus: 'Under_Review',
        employeeId: 'emp-1',
        version: 1,
      });

      expect(result.status).toBe('Under_Review');
      expect(result.version).toBe(2);
      expect(mockProjectService.updateDocumentStatus).toHaveBeenCalledWith('doc-1', 'Under_Review', 1, {});
    });

    it('transitions Under_Review → Approved and records approval timestamp', async () => {
      const result = await service.transitionStatus('doc-2', {
        toStatus: 'Approved',
        employeeId: 'emp-1',
        version: 3,
      });

      expect(result.status).toBe('Approved');
      expect(mockApprovalUndoRepo.upsert).toHaveBeenCalledWith('doc-2', expect.any(String));
    });

    it('transitions Under_Review → Revision_Requested with valid comment', async () => {
      const result = await service.transitionStatus('doc-2', {
        toStatus: 'Revision_Requested',
        employeeId: 'emp-1',
        version: 3,
        comment: 'Please provide the corrected W-2 with updated SSN',
      });

      expect(result.status).toBe('Revision_Requested');
      expect(mockNotificationService.dispatchRevisionEmail).toHaveBeenCalled();
    });

    it('rejects invalid transition (Uploaded → Approved)', async () => {
      await expect(
        service.transitionStatus('doc-1', {
          toStatus: 'Approved',
          employeeId: 'emp-1',
          version: 1,
        })
      ).rejects.toThrow(/Invalid transition/);
    });

    it('rejects Revision_Requested without comment', async () => {
      await expect(
        service.transitionStatus('doc-2', {
          toStatus: 'Revision_Requested',
          employeeId: 'emp-1',
          version: 3,
        })
      ).rejects.toThrow(/Revision comment/);
    });

    it('rejects Revision_Requested with comment too short (<10 chars)', async () => {
      await expect(
        service.transitionStatus('doc-2', {
          toStatus: 'Revision_Requested',
          employeeId: 'emp-1',
          version: 3,
          comment: 'Too short',
        })
      ).rejects.toThrow(/Revision comment/);
    });

    it('rejects when version conflicts (optimistic concurrency)', async () => {
      await expect(
        service.transitionStatus('doc-1', {
          toStatus: 'Under_Review',
          employeeId: 'emp-1',
          version: 999, // wrong version
        })
      ).rejects.toThrow(/conflict/i);
    });

    it('rejects when document not found (404)', async () => {
      await expect(
        service.transitionStatus('nonexistent', {
          toStatus: 'Uploaded',
          employeeId: 'emp-1',
          version: 1,
        })
      ).rejects.toThrow(/not found/i);
    });

    it('logs activity on successful transition', async () => {
      await service.transitionStatus('doc-1', {
        toStatus: 'Under_Review',
        employeeId: 'emp-1',
        version: 1,
      });

      expect(mockProjectService.addActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status_change',
          actorId: 'emp-1',
          documentId: 'doc-1',
        })
      );
    });

    it('adds system comment on successful transition', async () => {
      await service.transitionStatus('doc-1', {
        toStatus: 'Under_Review',
        employeeId: 'emp-1',
        version: 1,
      });

      expect(mockCommentService.addSystemComment).toHaveBeenCalledWith(
        'doc-1',
        expect.objectContaining({
          action: 'status_change',
          fromStatus: 'Uploaded',
          toStatus: 'Under_Review',
        })
      );
    });
  });

  describe('undoApproval', () => {
    it('reverts Approved → Under_Review within 10-minute window', async () => {
      mockApprovalUndoRepo.findByDocumentId.mockResolvedValue({
        document_id: 'doc-3',
        approved_at: new Date().toISOString(), // just now
      });

      const result = await service.undoApproval('doc-3', 'emp-1', 5);

      expect(result.status).toBe('Under_Review');
      expect(mockApprovalUndoRepo.deleteByDocumentId).toHaveBeenCalledWith('doc-3');
    });

    it('rejects undo after 10-minute window expires', async () => {
      mockApprovalUndoRepo.findByDocumentId.mockResolvedValue({
        document_id: 'doc-3',
        approved_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(), // 11 min ago
      });

      await expect(
        service.undoApproval('doc-3', 'emp-1', 5)
      ).rejects.toThrow(/expired/i);
    });

    it('rejects undo when document is not in Approved status', async () => {
      await expect(
        service.undoApproval('doc-1', 'emp-1', 1) // doc-1 is Uploaded
      ).rejects.toThrow(/not in Approved/i);
    });

    it('rejects undo when no approval timestamp found', async () => {
      mockApprovalUndoRepo.findByDocumentId.mockResolvedValue(null);

      await expect(
        service.undoApproval('doc-3', 'emp-1', 5)
      ).rejects.toThrow(/No approval timestamp/i);
    });
  });

  describe('bulkTransition', () => {
    it('transitions multiple Uploaded documents to Under_Review', async () => {
      documents.set('doc-4', { id: 'doc-4', name: 'Doc4', status: 'Uploaded', version: 1, clientId: 'client-1' });
      documents.set('doc-5', { id: 'doc-5', name: 'Doc5', status: 'Uploaded', version: 1, clientId: 'client-1' });

      const result = await service.bulkTransition(['doc-1', 'doc-4', 'doc-5'], {
        toStatus: 'Under_Review',
        employeeId: 'emp-1',
      });

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('skips documents not in Uploaded status', async () => {
      const result = await service.bulkTransition(['doc-1', 'doc-2'], {
        toStatus: 'Under_Review',
        employeeId: 'emp-1',
      });

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(1); // doc-1 (Uploaded)
      expect(result.skipped).toBe(1);   // doc-2 (Under_Review)
    });

    it('reports failures for non-existent documents', async () => {
      const result = await service.bulkTransition(['doc-1', 'nonexistent'], {
        toStatus: 'Under_Review',
        employeeId: 'emp-1',
      });

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('state machine validation', () => {
    it('VALID_TRANSITIONS defines correct allowed transitions', () => {
      expect(VALID_TRANSITIONS.Not_Requested).toEqual(['Uploaded']);
      expect(VALID_TRANSITIONS.Uploaded).toEqual(['Under_Review']);
      expect(VALID_TRANSITIONS.Under_Review).toEqual(['Approved', 'Revision_Requested', 'Waived']);
      expect(VALID_TRANSITIONS.Revision_Requested).toEqual(['Uploaded']);
      expect(VALID_TRANSITIONS.Approved).toEqual(['Under_Review']);
      expect(VALID_TRANSITIONS.Waived).toEqual([]);
    });

    it('UNDO_WINDOW_MS is 10 minutes', () => {
      expect(UNDO_WINDOW_MS).toBe(10 * 60 * 1000);
    });
  });
});
