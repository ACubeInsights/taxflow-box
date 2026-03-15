// Feature: box-wrapper-service, Property 5: Vault folder naming format
// **Validates: Requirements 3.1, 3.5**

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

const mockCreateFolder = vi.fn();
const mockCreateFolderMetadata = vi.fn();
const mockCreateCascadePolicy = vi.fn();
const mockGetMetadataTemplate = vi.fn();

vi.mock('box-node-sdk', () => ({
  JwtConfig: {
    fromConfigJsonString: vi.fn(() => ({ configData: 'mock-jwt-config' })),
  },
  BoxJwtAuth: vi.fn(() => ({ authData: 'mock-auth' })),
  BoxClient: vi.fn(() => ({
    folders: { createFolder: mockCreateFolder },
    folderMetadata: { createFolderMetadataById: mockCreateFolderMetadata },
    metadataCascadePolicies: { createMetadataCascadePolicy: mockCreateCascadePolicy },
    metadataTemplates: { getMetadataTemplate: mockGetMetadataTemplate },
    search: { searchByMetadataQuery: vi.fn() },
  })),
}));

import { BoxWrapperService } from '../../src/services/BoxWrapperService.js';

describe('Property 5: Vault folder naming format', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createAutomatedVault creates folder named "{clientName} ({externalId})" and returns a folder ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.emailAddress(),
        async (clientName, externalId, email) => {
          vi.clearAllMocks();

          const expectedName = `${clientName} (${externalId})`;
          const folderId = `folder-${Math.random().toString(36).slice(2)}`;

          mockGetMetadataTemplate.mockResolvedValue({ templateKey: 'taxFlowClientProfile' });
          mockCreateFolder.mockResolvedValue({ id: folderId, name: expectedName, type: 'folder' });
          mockCreateFolderMetadata.mockResolvedValue({});
          mockCreateCascadePolicy.mockResolvedValue({ id: 'cascade-policy-id' });

          const service = new BoxWrapperService();
          await service.syncMetadataSchema();
          const result = await service.createAutomatedVault(clientName, externalId, email);

          // Verify folder was created with correct naming format
          expect(mockCreateFolder).toHaveBeenCalledOnce();
          const createFolderArg = mockCreateFolder.mock.calls[0][0];
          expect(createFolderArg.name).toBe(expectedName);

          // Verify result contains a folder ID
          expect(result.folder.id).toBe(folderId);
          expect(typeof result.folder.id).toBe('string');
          expect(result.folder.id.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
