import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectService } from '../projectService.js';

describe('ProjectService', () => {
  /** @type {ProjectService} */
  let service;

  beforeEach(() => {
    service = new ProjectService(); // fresh seeded instance
  });

  // ─── getAllClients ───────────────────────────────────────────────────

  describe('getAllClients', () => {
    it('returns all clients in the system', async () => {
      const clients = await service.getAllClients();
      expect(clients).toHaveLength(7);
    });

    it('filters by search query (name, case-insensitive)', async () => {
      const results = await service.getAllClients({ search: 'acme' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Acme Industries');
    });

    it('filters by search query (email)', async () => {
      const results = await service.getAllClients({ search: 'jane' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Jane Smith');
    });

    it('filters by engagement status', async () => {
      const results = await service.getAllClients({ status: 'On_Hold' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Greenfield Trust');
    });

    it('filters by entity type', async () => {
      const results = await service.getAllClients({ entityType: 'Individual' });
      expect(results).toHaveLength(3);
    });

    it('combines search and filters', async () => {
      const results = await service.getAllClients({ search: 'green', status: 'On_Hold' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('c3');
    });

    it('returns empty when filters match nothing', async () => {
      const results = await service.getAllClients({ entityType: 'LLC' });
      expect(results).toEqual([]);
    });

    it('computes activeProjects and pendingActions dynamically', async () => {
      const clients = await service.getAllClients();
      const acme = clients.find((c) => c.id === 'c1');
      expect(acme.activeProjects).toBe(2);
      expect(acme.pendingActions).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── getClientProjects ──────────────────────────────────────────────

  describe('getClientProjects', () => {
    it('returns projects for a client with progress', async () => {
      const projects = await service.getClientProjects('c1');
      expect(projects).toHaveLength(2);
      for (const p of projects) {
        expect(p).toHaveProperty('progressPercentage');
        expect(p).toHaveProperty('documentCount');
        expect(p.clientId).toBe('c1');
      }
    });

    it('returns empty for unknown client', async () => {
      expect(await service.getClientProjects('unknown')).toEqual([]);
    });

    it('computes progress as (Approved + Waived) / total', async () => {
      const projects = await service.getClientProjects('c1');
      const p1 = projects.find((p) => p.id === 'p1');
      // p1 has d1 (Approved), d2 (Uploaded), d3 (Revision_Requested), d4 (Not_Requested)
      // 1 completed out of 4 = 25%
      expect(p1.progressPercentage).toBe(25);
      expect(p1.documentCount).toBe(4);
    });
  });

  // ─── getProjectDetail ───────────────────────────────────────────────

  describe('getProjectDetail', () => {
    it('returns project with documents', async () => {
      const detail = await service.getProjectDetail('p1');
      expect(detail).not.toBeNull();
      expect(detail.id).toBe('p1');
      expect(detail.documents).toHaveLength(4);
      expect(detail.documentCount).toBe(4);
    });

    it('returns null for unknown project', async () => {
      expect(await service.getProjectDetail('unknown')).toBeNull();
    });

    it('applies status filter to documents', async () => {
      const detail = await service.getProjectDetail('p1', { statusFilter: 'Approved' });
      expect(detail.documents).toHaveLength(1);
      expect(detail.documents[0].status).toBe('Approved');
    });
  });

  // ─── getProjectDocuments ────────────────────────────────────────────

  describe('getProjectDocuments', () => {
    it('returns all documents for a project', async () => {
      const docs = await service.getProjectDocuments('p1');
      expect(docs).toHaveLength(4);
    });

    it('filters by single status', async () => {
      const docs = await service.getProjectDocuments('p1', { status: 'Uploaded' });
      expect(docs).toHaveLength(1);
      expect(docs[0].status).toBe('Uploaded');
    });

    it('filters by multiple statuses', async () => {
      const docs = await service.getProjectDocuments('p1', { status: ['Uploaded', 'Approved'] });
      expect(docs).toHaveLength(2);
    });

    it('returns empty for unknown project', async () => {
      expect(await service.getProjectDocuments('unknown')).toEqual([]);
    });
  });

  // ─── createDocumentRequest ──────────────────────────────────────────

  describe('createDocumentRequest', () => {
    it('creates a document request with correct defaults', async () => {
      const doc = await service.createDocumentRequest('p1', {
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

    it('throws 404 for unknown project', async () => {
      await expect(
        service.createDocumentRequest('unknown', {
          name: 'Test', documentType: 'W-2', dueDate: '2025-06-01',
        })
      ).rejects.toThrow('Project not found');
    });

    it('throws 400 for missing name', async () => {
      await expect(
        service.createDocumentRequest('p1', {
          name: '', documentType: 'W-2', dueDate: '2025-06-01',
        })
      ).rejects.toThrow('Missing required field: name');
    });

    it('throws 400 for missing documentType', async () => {
      await expect(
        service.createDocumentRequest('p1', {
          name: 'Test', documentType: '', dueDate: '2025-06-01',
        })
      ).rejects.toThrow('Missing required field: documentType');
    });

    it('throws 400 for missing dueDate', async () => {
      await expect(
        service.createDocumentRequest('p1', {
          name: 'Test', documentType: 'W-2', dueDate: '',
        })
      ).rejects.toThrow('Missing required field: dueDate');
    });

    it('records an activity entry on creation', async () => {
      const before = (await service.getEmployeeActivity('employee-1', 100)).length;
      await service.createDocumentRequest('p1', {
        name: 'New Doc', documentType: 'W-2', dueDate: '2025-06-01',
      });
      const after = (await service.getEmployeeActivity('employee-1', 100)).length;
      expect(after).toBe(before + 1);
    });

    it('defaults isDraft to false', async () => {
      const doc = await service.createDocumentRequest('p1', {
        name: 'Test', documentType: 'W-2', dueDate: '2025-06-01',
      });
      expect(doc.isDraft).toBe(false);
    });

    it('defaults priority to Medium', async () => {
      const doc = await service.createDocumentRequest('p1', {
        name: 'Test', documentType: 'W-2', dueDate: '2025-06-01',
      });
      expect(doc.priority).toBe('Medium');
    });
  });

  // ─── checkDuplicate ─────────────────────────────────────────────────

  describe('checkDuplicate', () => {
    it('detects duplicate by projectId + documentType', async () => {
      const result = await service.checkDuplicate('p1', 'W-2');
      expect(result.isDuplicate).toBe(true);
      expect(result.existingDocument).toBeDefined();
      expect(result.existingDocument.documentType).toBe('W-2');
    });

    it('returns false for non-duplicate', async () => {
      const result = await service.checkDuplicate('p1', 'NonExistent_Type');
      expect(result.isDuplicate).toBe(false);
      expect(result.existingDocument).toBeUndefined();
    });
  });

  // ─── getEmployeeActivity ────────────────────────────────────────────

  describe('getEmployeeActivity', () => {
    it('returns activities sorted descending by timestamp', async () => {
      const activities = await service.getEmployeeActivity('employee-1');
      for (let i = 1; i < activities.length; i++) {
        expect(new Date(activities[i - 1].timestamp).getTime())
          .toBeGreaterThanOrEqual(new Date(activities[i].timestamp).getTime());
      }
    });

    it('respects the limit parameter', async () => {
      const activities = await service.getEmployeeActivity('employee-1', 2);
      expect(activities).toHaveLength(2);
    });

    it('defaults to 10 items', async () => {
      const activities = await service.getEmployeeActivity('employee-1');
      expect(activities.length).toBeLessThanOrEqual(10);
    });

    it('returns activities from all clients (global)', async () => {
      const activities = await service.getEmployeeActivity('employee-1', 20);
      // Should include activities from c6 and c7 (previously only employee-2)
      const clientIds = [...new Set(activities.map(a => a.clientId))];
      expect(clientIds.length).toBeGreaterThan(2);
    });

    it('each activity has required fields', async () => {
      const activities = await service.getEmployeeActivity('employee-1');
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
    it('returns summary with all four metrics', async () => {
      const summary = await service.getEmployeeSummary('employee-1');
      expect(summary).toHaveProperty('activeClients');
      expect(summary).toHaveProperty('pendingReviews');
      expect(summary).toHaveProperty('overdueDocuments');
      expect(summary).toHaveProperty('awaitingClientAction');
    });

    it('counts active clients across all clients', async () => {
      const summary = await service.getEmployeeSummary('employee-1');
      // c1 Active, c2 Active, c3 On_Hold, c4 Active, c5 Active, c6 Active, c7 Complete → 5 active
      expect(summary.activeClients).toBe(5);
    });

    it('counts pending reviews (Uploaded + Under_Review) across all clients', async () => {
      const summary = await service.getEmployeeSummary('employee-1');
      // d2 Uploaded, d6 Under_Review, d7 Uploaded, d12 Uploaded, d13 Under_Review, d15 Uploaded, d18 Uploaded → 7
      expect(summary.pendingReviews).toBe(7);
    });

    it('returns same metrics regardless of employeeId', async () => {
      const summary1 = await service.getEmployeeSummary('employee-1');
      const summary2 = await service.getEmployeeSummary('employee-2');
      expect(summary1).toEqual(summary2);
    });
  });
});
