// Unit tests for BoxWrapperService
// Requirements: 3.3, 3.7, 4.3, 4.4

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
const mockExecuteRead = vi.fn();

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
    metadataQueries: { executeRead: mockExecuteRead },
    search: { searchByMetadataQuery: vi.fn() },
  })),
}));

import { BoxWrapperService } from '../../src/services/BoxWrapperService.js';

describe('BoxWrapperService', () => {
  let service: BoxWrapperService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetMetadataTemplate.mockResolvedValue({ templateKey: 'taxFlowClientProfile' });
    service = new BoxWrapperService();
    await service.syncMetadataSchema();
  });

  describe('createAutomatedVault() calls folders API, metadata API, and cascade policy API in order (Req 3.3)', () => {
    it('calls all three APIs in the correct sequence', async () => {
      const callOrder: string[] = [];

      mockCreateFolder.mockImplementation(async () => {
        callOrder.push('createFolder');
        return { id: 'folder-123', name: 'Test Client (ext-1)', type: 'folder' };
      });
      mockCreateFolderMetadata.mockImplementation(async () => {
        callOrder.push('createFolderMetadata');
        return {};
      });
      mockCreateCascadePolicy.mockImplementation(async () => {
        callOrder.push('createCascadePolicy');
        return { id: 'cascade-1' };
      });

      await service.createAutomatedVault('Test Client', 'ext-1', 'test@example.com');

      expect(callOrder).toEqual(['createFolder', 'createFolderMetadata', 'createCascadePolicy']);
      expect(mockCreateFolder).toHaveBeenCalledOnce();
      expect(mockCreateFolderMetadata).toHaveBeenCalledOnce();
      expect(mockCreateCascadePolicy).toHaveBeenCalledOnce();
    });
  });

  describe('error includes folder ID when cascade policy fails (Req 3.7)', () => {
    it('throws error containing the created folder ID when cascade policy creation fails', async () => {
      mockCreateFolder.mockResolvedValue({ id: 'folder-456', name: 'Client (ext-2)', type: 'folder' });
      mockCreateFolderMetadata.mockResolvedValue({});
      mockCreateCascadePolicy.mockRejectedValue(new Error('Cascade API error'));

      await expect(
        service.createAutomatedVault('Client', 'ext-2', 'client@example.com'),
      ).rejects.toThrow('Vault folder folder-456 created but cascade policy failed: Cascade API error. Manual remediation required.');
    });
  });

  describe('findVaultByExternalId() returns null when no results (Req 4.3)', () => {
    it('returns null when entries array is empty', async () => {
      mockExecuteRead.mockResolvedValue({ entries: [] });

      const result = await service.findVaultByExternalId('nonexistent-id');

      expect(result).toBeNull();
    });

    it('returns null when entries is undefined', async () => {
      mockExecuteRead.mockResolvedValue({});

      const result = await service.findVaultByExternalId('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findVaultByExternalId() throws descriptive error on API failure (Req 4.4)', () => {
    it('throws error containing the externalId on API failure', async () => {
      mockExecuteRead.mockRejectedValue(new Error('Network timeout'));

      await expect(
        service.findVaultByExternalId('ext-abc'),
      ).rejects.toThrow('Vault query failed for externalId ext-abc: Network timeout');
    });
  });
});
