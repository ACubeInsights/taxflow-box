// Feature: box-wrapper-service, Property 7: Metadata query construction and result mapping
// **Validates: Requirements 4.1, 4.2, 4.5**

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Mock fs so JWTAuthModule can load config
vi.mock('fs', () => ({
  readFileSync: vi.fn(() =>
    JSON.stringify({
      boxAppSettings: {
        clientID: 'test-client-id',
        clientSecret: 'test-client-secret',
        appAuth: {
          publicKeyID: 'test-key-id',
          privateKey: 'test-private-key',
          passphrase: 'test-passphrase',
        },
      },
      enterpriseID: 'test-enterprise-id',
    }),
  ),
}));

const mockExecuteRead = vi.fn();
const mockGetMetadataTemplate = vi.fn();

vi.mock('box-node-sdk', () => ({
  JwtConfig: {
    fromConfigJsonString: vi.fn(() => ({ configData: 'mock-jwt-config' })),
  },
  BoxJwtAuth: vi.fn(() => ({ authData: 'mock-auth' })),
  BoxClient: vi.fn(() => ({
    folders: { createFolder: vi.fn() },
    folderMetadata: { createFolderMetadataById: vi.fn() },
    metadataCascadePolicies: { createMetadataCascadePolicy: vi.fn() },
    metadataTemplates: { getMetadataTemplate: mockGetMetadataTemplate },
    metadataQueries: { executeRead: mockExecuteRead },
    search: { searchByMetadataQuery: vi.fn() },
  })),
}));

import { BoxWrapperService } from '../../src/services/BoxWrapperService.js';

describe('Property 7: Metadata query construction and result mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findVaultByExternalId queries enterprise scope with correct parameters and maps result to VaultFolder', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (externalId, folderId, folderName) => {
          vi.clearAllMocks();

          mockGetMetadataTemplate.mockResolvedValue({ templateKey: 'taxFlowClientProfile' });
          mockExecuteRead.mockResolvedValue({
            entries: [{ id: folderId, name: folderName, type: 'folder' }],
          });

          const service = new BoxWrapperService();
          await service.syncMetadataSchema();
          const result = await service.findVaultByExternalId(externalId);

          // Verify executeRead was called with correct parameters
          expect(mockExecuteRead).toHaveBeenCalledOnce();
          const queryArg = mockExecuteRead.mock.calls[0][0];
          expect(queryArg.from).toBe('enterprise_taxFlowClientProfile');
          expect(queryArg.query).toBe('client_external_id = :id');
          expect(queryArg.queryParams).toEqual({ id: externalId });

          // Verify result maps to VaultFolder with matching id and name
          expect(result).not.toBeNull();
          expect(result).toEqual({
            id: folderId,
            name: folderName,
            type: 'folder',
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});
