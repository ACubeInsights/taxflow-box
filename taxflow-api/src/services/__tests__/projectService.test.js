import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectService } from '../projectService.js';

describe('ProjectService', () => {
  /** @type {ProjectService} */
  let service;

  beforeEach(() => {
    service = new ProjectService(); // fresh seeded instance
  });

  // ─── getEmployeeClients ─────────────────────────────────────────────

  describe('getEmployeeClients', () => {
    it('returns only clients assigned to the given employee', () => {
      const clients = service.getEmployeeClients('emp1');
      expect(clients).toHaveLength(5);
      expect(clients.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    });

    it('returns empty array for unknown employee', () => {
      expect(service.getEmployeeClients('unknown')).toEqual([]);
    });

    it('filters by search query (name, case-insensitive)', () => {
      const results = service.getEmployeeClients('emp1', { search: 'acme' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Acme Industries');
    });

    it('filters by search query (email)', () => {
      const results = service.getEmployeeClients('emp1', { search: 'jane.smith' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Jane Smith');
    });

    it('filters by engagement status', () => {
      const results = service.getEmployeeClients('emp1', { status: 'On_Hold' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Greenfield Trust');
    });

    it('filters by entity type', () => {
      const results = service.getEmployeeClients('emp1', { entityType: 'Individual' });
      expect(results).toHaveLength(2);
      const names = results.map(r => r.name).sort();
      expect(names).toEqual(['Jane Smith', 'Ray Kowalski']);
    });

    it('combines search and filters', () => {
      const results = service.getEmployeeClients('emp1', { search: 'green', status: 'On_Hold' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('c3');
    });

    it('returns empty when filters match nothing', () => {
      const results = service.getEmployeeClients('emp1', { entityType: 'Partnership' });
      expect(results).toEqual([]);
    });

    it('computes activeProjects and pendingActions dynamically', () => {
      const clients = service.getEmployeeClients('emp1');
      const acme = clients.find((c) => c.id === 'c1');
      expect(acme.activeProjects).toBe(2);
      expect(acme.pendingActions).toBeGreaterThanOrEqual(0);
    });

    it('emp2 only sees assigned clients c3, c6, c7', () => {
      const clients = service.getEmployeeClients('emp2');
      expect(clients).toHaveLength(3);
      expect(clients.map((c) => c.id).sort()).toEqual(['c3', 'c6', 'c7']);
    });
  });

  // ─── getClientProjects ──────────────────────────────────────────────

  describe('getClientProjects', () => {
    it('returns projects for a client with progress', () => {
      const projects = service.getClientProjects('c1');
      expect(projects).toHaveLength(2);
      for (const p of projects) {
        expect(p).toHaveProperty('progressPercentage');
        expect(p).toHaveProperty('documentCount');
        expect(p.clientId).toBe('c1');
      }
    });

    it('returns empty for unknown client', () => {
      expect(service.getClientProjects('unknown')).toEqual([]);
    });

    it('computes progress as (Approved + Waived) / total', () => {
      const projects = service.getClientProjects('c1');
      const p1 = projects.find((p) => p.id === 'p1');
      // p1 has d1 (Approved), d2 (Uploaded), d3 (Revision_Requested), d4 (Not_Requested)
      // 1 completed out of 4 = 25%
      expect(p1.progressPercentage).toBe(25);
      expect(p1.documentCount).toBe(4);
    });
  });

  // ─── getProjectDetail ───────────────────────────────────────────────

  describe('getProjectDetail', () => {
    it('returns project with documents', () => {
      const detail = service.getProjectDetail('p1');
      expect(detail).not.toBeNull();
      expect(detail.id).toBe('p1');
      expect(detail.documents).toHaveLength(4);
      expect(detail.documentCount).toBe(4);
    });

    it('returns null for unknown project', () => {
      expect(service.getProjectDetail('unknown')).toBeNull();
    });

    it('applies status filter to documents', () => {
      const detail = service.getProjectDetail('p1', { statusFilter: 'Approved' });
      expect(detail.documents).toHaveLength(1);
      expect(detail.documents[0].status).toBe('Approved');
    });
  });

  // ─── getProjectDocuments ────────────────────────────────────────────

  describe('getProjectDocuments', () => {
    it('returns all documents for a project', () => {
      const docs = service.getProjectDocuments('p1');
      expect(docs).toHaveLength(4);
    });

    it('filters by single status', () => {
      const docs = service.getProjectDocuments('p1', { status: 'Uploaded' });
      expect(docs).toHaveLength(1);
      expect(docs[0].status).toBe('Uploaded');
    });

    it('filters by multiple statuses', () => {
      const docs = service.getProjectDocuments('p1', { status: ['Uploaded', 'Approved'] });
      expect(docs).toHaveLength(2);
    });

    it('returns empty for unknown project', () => {
      expect(service.getProjectDocuments('unknown')).toEqual([]);
    });
  });

  // ─── createDocumentRequest ──────────────────────────────────────────

  describe('createDocumentRequest', () => {
    it('creates a document request with correct defaults', () => {
      const doc = service.createDocumentRequest('p1', {
        name: 'Test Doc',
        description: 'A test document',
        priority: 'High',
        dueDate: '2025-06-01',
        documentType: 'W-2',
        isDraft: false,
      });

      expect(doc.id).toBeDefined();
      expect(doc.name).toBe('Test Doc');
      expect(doc.status).toBe('Not_Requested');
      expect(doc.version).toBe(1);
      expect(doc.projectId).toBe('p1');
      expect(doc.clientId).toBe('c1');
      expect(doc.createdAt).toBeDefined();
      expect(doc.updatedAt).toBeDefined();
    });

    it('throws 404 for unknown project', () => {
      expect(() =>
        service.createDocumentRequest('unknown', {
          name: 'Test', documentType: 'W-2', dueDate: '2025-06-01',
        })
      ).toThrow('Project not found');
    });

    it('throws 400 for missing name', () => {
      expect(() =>
        service.createDocumentRequest('p1', {
          name: '', documentType: 'W-2', dueDate: '2025-06-01',
        })
      ).toThrow('Missing required field: name');
    });

    it('throws 400 for missing documentType', () => {
      expect(() =>
        service.createDocumentRequest('p1', {
          name: 'Test', documentType: '', dueDate: '2025-06-01',
        })
      ).toThrow('Missing required field: documentType');
    });

    it('throws 400 for missing dueDate', () => {
      expect(() =>
        service.createDocumentRequest('p1', {
          name: 'Test', documentType: 'W-2', dueDate: '',
        })
      ).toThrow('Missing required field: dueDate');
    });

    it('records an activity entry on creation', () => {
      const before = service.getEmployeeActivity('emp1').length;
      service.createDocumentRequest('p1', {
        name: 'New Doc', documentType: 'W-2', dueDate: '2025-06-01',
      });
      const after = service.getEmployeeActivity('emp1').length;
      expect(after).toBe(before + 1);
    });

    it('defaults isDraft to false', () => {
      const doc = service.createDocumentRequest('p1', {
        name: 'Test', documentType: 'W-2', dueDate: '2025-06-01',
      });
      expect(doc.isDraft).toBe(false);
    });

    it('defaults priority to Medium', () => {
      const doc = service.createDocumentRequest('p1', {
        name: 'Test', documentType: 'W-2', dueDate: '2025-06-01',
      });
      expect(doc.priority).toBe('Medium');
    });
  });

  // ─── checkDuplicate ─────────────────────────────────────────────────

  describe('checkDuplicate', () => {
    it('detects duplicate by projectId + documentType', () => {
      const result = service.checkDuplicate('p1', 'W-2');
      expect(result.isDuplicate).toBe(true);
      expect(result.existingDocument).toBeDefined();
      expect(result.existingDocument.documentType).toBe('W-2');
    });

    it('returns false for non-duplicate', () => {
      const result = service.checkDuplicate('p1', 'NonExistent_Type');
      expect(result.isDuplicate).toBe(false);
      expect(result.existingDocument).toBeUndefined();
    });
  });

  // ─── getEmployeeActivity ────────────────────────────────────────────

  describe('getEmployeeActivity', () => {
    it('returns activities sorted descending by timestamp', () => {
      const activities = service.getEmployeeActivity('emp1');
      for (let i = 1; i < activities.length; i++) {
        expect(new Date(activities[i - 1].timestamp).getTime())
          .toBeGreaterThanOrEqual(new Date(activities[i].timestamp).getTime());
      }
    });

    it('respects the limit parameter', () => {
      const activities = service.getEmployeeActivity('emp1', 2);
      expect(activities).toHaveLength(2);
    });

    it('defaults to 10 items', () => {
      const activities = service.getEmployeeActivity('emp1');
      expect(activities.length).toBeLessThanOrEqual(10);
    });

    it('returns only activities for assigned clients', () => {
      const activities = service.getEmployeeActivity('emp2');
      // emp2 is assigned to c3, c6, c7 — c6 and c7 have activities (a10, a11)
      expect(activities.length).toBeGreaterThanOrEqual(2);
      for (const a of activities) {
        expect(['c3', 'c6', 'c7']).toContain(a.clientId);
      }
    });

    it('each activity has required fields', () => {
      const activities = service.getEmployeeActivity('emp1');
      for (const a of activities) {
        expect(a).toHaveProperty('id');
        expect(a).toHaveProperty('type');
        expect(a).toHaveProperty('actorId');
        expect(a).toHaveProperty('actorName');
        expect(a).toHaveProperty('documentId');
        expect(a).toHaveProperty('documentName');
        expect(a).toHaveProperty('clientId');
        expect(a).toHaveProperty('clientName');
        expect(a).toHaveProperty('description');
        expect(a).toHaveProperty('timestamp');
      }
    });
  });

  // ─── getEmployeeSummary ─────────────────────────────────────────────

  describe('getEmployeeSummary', () => {
    it('returns summary with all four metrics', () => {
      const summary = service.getEmployeeSummary('emp1');
      expect(summary).toHaveProperty('activeClients');
      expect(summary).toHaveProperty('pendingReviews');
      expect(summary).toHaveProperty('overdueDocuments');
      expect(summary).toHaveProperty('awaitingClientAction');
    });

    it('counts active clients correctly', () => {
      const summary = service.getEmployeeSummary('emp1');
      // c1 Active, c2 Active, c3 On_Hold, c4 Active, c5 Active → 4 active
      expect(summary.activeClients).toBe(4);
    });

    it('counts pending reviews (Uploaded + Under_Review)', () => {
      const summary = service.getEmployeeSummary('emp1');
      // d2 Uploaded, d6 Under_Review, d7 Uploaded, d12 Uploaded, d13 Under_Review, d15 Uploaded → 6
      expect(summary.pendingReviews).toBe(6);
    });

    it('returns zeros for unknown employee', () => {
      const summary = service.getEmployeeSummary('unknown');
      expect(summary.activeClients).toBe(0);
      expect(summary.pendingReviews).toBe(0);
      expect(summary.overdueDocuments).toBe(0);
      expect(summary.awaitingClientAction).toBe(0);
    });
  });
});
