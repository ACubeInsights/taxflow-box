import { describe, it, expect } from 'vitest';
import { mapVaultManifest, SUBFOLDER_MAP } from '../vaultDiscoveryService.js';

describe('vaultDiscoveryService', () => {
  it('maps DB row shape to API vault manifest', () => {
    const mapped = mapVaultManifest({
      client_id: 'client-1',
      financial_year: '2026',
      root_folder_id: 'root-1',
      year_folder_id: 'year-1',
      projects_folder_id: 'proj-1',
      tax_folder_id: 'tax-1',
      uploads_folder_id: 'uploads-1',
      supporting_docs_folder_id: 'support-1',
      signed_documents_folder_id: 'signed-1',
      internal_notes_folder_id: 'notes-1',
    });

    expect(mapped).toEqual({
      clientId: 'client-1',
      financialYear: '2026',
      root: 'root-1',
      year: 'year-1',
      projects: 'proj-1',
      tax: 'tax-1',
      uploads: 'uploads-1',
      supportingDocs: 'support-1',
      signedDocuments: 'signed-1',
      internalNotes: 'notes-1',
      source: 'box',
    });
  });

  it('maps discovered Box manifest shape', () => {
    const mapped = mapVaultManifest({
      clientId: 'client-2',
      financialYear: '2026',
      root: 'root-2',
      uploads: 'uploads-2',
      source: 'box',
    });

    expect(mapped.root).toBe('root-2');
    expect(mapped.uploads).toBe('uploads-2');
    expect(mapped.source).toBe('box');
  });

  it('defines standard subfolder names', () => {
    expect(Object.keys(SUBFOLDER_MAP)).toContain('Uploads');
    expect(SUBFOLDER_MAP.Uploads).toBe('uploads');
  });
});
