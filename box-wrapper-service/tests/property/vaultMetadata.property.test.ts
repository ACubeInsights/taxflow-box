// Feature: box-wrapper-service, Property 6: Vault metadata contains provided values
// **Validates: Requirements 3.2**

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

describe('Property 6: Vault metadata contains provided values', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createAutomatedVault applies metadata with client_external_id === externalId and client_email === email', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.emailAddress(),
        async (externalId, email) => {
          vi.clearAllMocks();

          const folderId = `folder-${Math.random().toString(36).slice(2)}`;

          mockGetMetadataTemplate.mockResolvedValue({ templateKey: 'taxFlowClientProfile' });
          mockCreateFolder.mockResolvedValue({ id: folderId, name: `TestClient (${externalId})`, type: 'folder' });
          mockCreateFolderMetadata.mockResolvedValue({});
          mockCreateCascadePolicy.mockResolvedValue({ id: 'cascade-policy-id' });

          const service = new BoxWrapperService();
          await service.syncMetadataSchema();
          await service.createAutomatedVault('TestClient', externalId, email);

          // Verify metadata API was called once
          expect(mockCreateFolderMetadata).toHaveBeenCalledOnce();

          // Verify the metadata payload contains the correct values
          const [calledFolderId, scope, templateKey, metadata] = mockCreateFolderMetadata.mock.calls[0];
          expect(calledFolderId).toBe(folderId);
          expect(scope).toBe('enterprise');
          expect(templateKey).toBe('taxFlowClientProfile');
          expect(metadata.client_external_id).toBe(externalId);
          expect(metadata.client_email).toBe(email);
        },
      ),
      { numRuns: 100 },
    );
  });
});
