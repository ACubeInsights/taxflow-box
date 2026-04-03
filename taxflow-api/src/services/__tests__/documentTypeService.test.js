import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentTypeService, DOCUMENT_TYPE_CATALOG } from '../documentTypeService.js';

describe('DocumentTypeService', () => {
  /** @type {DocumentTypeService} */
  let service;

  beforeEach(() => {
    service = new DocumentTypeService();
  });

  // ─── getDocumentTypes ───────────────────────────────────────────────

  describe('getDocumentTypes', () => {
    it('returns all document types when no filter is provided', () => {
      const types = service.getDocumentTypes();
      expect(types).toHaveLength(DOCUMENT_TYPE_CATALOG.length);
      expect(types.length).toBeGreaterThanOrEqual(10);
    });

    it('returns all document types when projectType is undefined', () => {
      const types = service.getDocumentTypes(undefined);
      expect(types).toHaveLength(DOCUMENT_TYPE_CATALOG.length);
    });

    it('returns all document types when projectType is empty string', () => {
      const types = service.getDocumentTypes('');
      expect(types).toHaveLength(DOCUMENT_TYPE_CATALOG.length);
    });

    it('returns all document types when projectType is whitespace', () => {
      const types = service.getDocumentTypes('   ');
      expect(types).toHaveLength(DOCUMENT_TYPE_CATALOG.length);
    });

    it('filters by Individual entity type', () => {
      const types = service.getDocumentTypes('Individual');
      expect(types.length).toBeGreaterThan(0);
      for (const t of types) {
        expect(t.applicableEntityTypes).toContain('Individual');
      }
    });

    it('filters by Business entity type', () => {
      const types = service.getDocumentTypes('Business');
      expect(types.length).toBeGreaterThan(0);
      for (const t of types) {
        expect(t.applicableEntityTypes).toContain('Business');
      }
    });

    it('filters by Trust entity type', () => {
      const types = service.getDocumentTypes('Trust');
      expect(types.length).toBeGreaterThan(0);
      for (const t of types) {
        expect(t.applicableEntityTypes).toContain('Trust');
      }
    });

    it('filters by S-Corp entity type', () => {
      const types = service.getDocumentTypes('S-Corp');
      expect(types.length).toBeGreaterThan(0);
      for (const t of types) {
        expect(t.applicableEntityTypes).toContain('S-Corp');
      }
    });

    it('filters by Partnership entity type', () => {
      const types = service.getDocumentTypes('Partnership');
      expect(types.length).toBeGreaterThan(0);
      for (const t of types) {
        expect(t.applicableEntityTypes).toContain('Partnership');
      }
    });

    it('filtering is case-insensitive', () => {
      const lower = service.getDocumentTypes('individual');
      const upper = service.getDocumentTypes('INDIVIDUAL');
      const mixed = service.getDocumentTypes('Individual');
      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixed);
    });

    it('returns empty array for non-existent entity type', () => {
      const types = service.getDocumentTypes('NonExistent');
      expect(types).toEqual([]);
    });

    it('each returned type has all required fields', () => {
      const types = service.getDocumentTypes();
      for (const t of types) {
        expect(t).toHaveProperty('id');
        expect(t).toHaveProperty('name');
        expect(t).toHaveProperty('category');
        expect(t).toHaveProperty('description');
        expect(t).toHaveProperty('instructions');
        expect(t).toHaveProperty('applicableEntityTypes');
        expect(typeof t.id).toBe('string');
        expect(typeof t.name).toBe('string');
        expect(typeof t.category).toBe('string');
        expect(typeof t.description).toBe('string');
        expect(typeof t.instructions).toBe('string');
        expect(Array.isArray(t.applicableEntityTypes)).toBe(true);
      }
    });

    it('returns copies, not references to internal catalog', () => {
      const types = service.getDocumentTypes();
      types[0].name = 'MUTATED';
      const fresh = service.getDocumentTypes();
      expect(fresh[0].name).not.toBe('MUTATED');
    });
  });

  // ─── getDocumentType ────────────────────────────────────────────────

  describe('getDocumentType', () => {
    it('returns W-2 document type by id', () => {
      const type = service.getDocumentType('w-2');
      expect(type).not.toBeNull();
      expect(type.id).toBe('w-2');
      expect(type.name).toBe('W-2 Form');
      expect(type.category).toBe('Income');
      expect(type.description).toBeTruthy();
      expect(type.instructions).toBeTruthy();
      expect(type.applicableEntityTypes).toContain('Individual');
    });

    it('returns 1099-DIV document type by id', () => {
      const type = service.getDocumentType('1099-div');
      expect(type).not.toBeNull();
      expect(type.id).toBe('1099-div');
      expect(type.name).toBe('1099-DIV');
    });

    it('returns 1098 document type by id', () => {
      const type = service.getDocumentType('1098');
      expect(type).not.toBeNull();
      expect(type.id).toBe('1098');
      expect(type.category).toBe('Deductions');
    });

    it('returns Schedule C document type by id', () => {
      const type = service.getDocumentType('schedule-c');
      expect(type).not.toBeNull();
      expect(type.id).toBe('schedule-c');
      expect(type.category).toBe('Business');
    });

    it('returns Schedule K-1 document type by id', () => {
      const type = service.getDocumentType('schedule-k1');
      expect(type).not.toBeNull();
      expect(type.id).toBe('schedule-k1');
    });

    it('returns trust agreement document type by id', () => {
      const type = service.getDocumentType('trust-agreement');
      expect(type).not.toBeNull();
      expect(type.category).toBe('Trust');
      expect(type.applicableEntityTypes).toContain('Trust');
    });

    it('returns null for non-existent type id', () => {
      const type = service.getDocumentType('nonexistent');
      expect(type).toBeNull();
    });

    it('returns null for null type id', () => {
      const type = service.getDocumentType(null);
      expect(type).toBeNull();
    });

    it('returns null for undefined type id', () => {
      const type = service.getDocumentType(undefined);
      expect(type).toBeNull();
    });

    it('returns null for empty string type id', () => {
      const type = service.getDocumentType('');
      expect(type).toBeNull();
    });

    it('returns a copy, not a reference to internal catalog', () => {
      const type = service.getDocumentType('w-2');
      type.name = 'MUTATED';
      const fresh = service.getDocumentType('w-2');
      expect(fresh.name).toBe('W-2 Form');
    });

    it('returned type has full description and instructions', () => {
      const type = service.getDocumentType('w-2');
      expect(type.description.length).toBeGreaterThan(10);
      expect(type.instructions.length).toBeGreaterThan(10);
    });
  });

  // ─── Catalog coverage ──────────────────────────────────────────────

  describe('catalog coverage', () => {
    it('contains at least 10 document types', () => {
      expect(DOCUMENT_TYPE_CATALOG.length).toBeGreaterThanOrEqual(10);
    });

    it('has unique IDs across all document types', () => {
      const ids = DOCUMENT_TYPE_CATALOG.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('covers Income category', () => {
      const income = DOCUMENT_TYPE_CATALOG.filter((t) => t.category === 'Income');
      expect(income.length).toBeGreaterThan(0);
    });

    it('covers Deductions category', () => {
      const deductions = DOCUMENT_TYPE_CATALOG.filter((t) => t.category === 'Deductions');
      expect(deductions.length).toBeGreaterThan(0);
    });

    it('covers Business category', () => {
      const business = DOCUMENT_TYPE_CATALOG.filter((t) => t.category === 'Business');
      expect(business.length).toBeGreaterThan(0);
    });

    it('covers Trust category', () => {
      const trust = DOCUMENT_TYPE_CATALOG.filter((t) => t.category === 'Trust');
      expect(trust.length).toBeGreaterThan(0);
    });

    it('every document type has non-empty applicableEntityTypes', () => {
      for (const t of DOCUMENT_TYPE_CATALOG) {
        expect(t.applicableEntityTypes.length).toBeGreaterThan(0);
      }
    });
  });

  // ─── Singleton export ──────────────────────────────────────────────

  describe('singleton export', () => {
    it('default export is a DocumentTypeService instance', async () => {
      const mod = await import('../documentTypeService.js');
      expect(mod.default).toBeInstanceOf(DocumentTypeService);
    });

    it('named export class can create new instances', () => {
      const instance = new DocumentTypeService();
      expect(instance.getDocumentTypes()).toHaveLength(DOCUMENT_TYPE_CATALOG.length);
    });
  });
});
