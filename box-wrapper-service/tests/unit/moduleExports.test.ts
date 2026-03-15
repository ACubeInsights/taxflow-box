// Unit tests for module exports
// Requirements: 5.1, 5.2

import { describe, it, expect, vi } from 'vitest';

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

vi.mock('box-node-sdk', () => ({
  JwtConfig: {
    fromConfigJsonString: vi.fn(() => ({ configData: 'mock-jwt-config' })),
  },
  BoxJwtAuth: vi.fn(() => ({ authData: 'mock-auth' })),
  BoxClient: vi.fn(() => ({})),
}));

import boxWrapperService, { BoxWrapperService } from '../../src/index.js';

describe('Module exports', () => {
  it('default export is an instance of BoxWrapperService (Req 5.1)', () => {
    expect(boxWrapperService).toBeInstanceOf(BoxWrapperService);
  });

  it('exported instance has all four public methods (Req 5.2)', () => {
    expect(typeof boxWrapperService.getBoxClient).toBe('function');
    expect(typeof boxWrapperService.syncMetadataSchema).toBe('function');
    expect(typeof boxWrapperService.createAutomatedVault).toBe('function');
    expect(typeof boxWrapperService.findVaultByExternalId).toBe('function');
  });

  it('importing module twice returns the same singleton instance (Req 5.1)', async () => {
    const { default: secondImport } = await import('../../src/index.js');
    expect(secondImport).toBe(boxWrapperService);
  });
});
