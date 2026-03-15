// Feature: box-wrapper-service, Property 1: Singleton client identity
// **Validates: Requirements 1.4**

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Mock fs before importing the module under test
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
    })
  ),
}));

const mockBoxClientInstance = { id: 'mock-box-client' };

vi.mock('box-node-sdk', () => ({
  JwtConfig: {
    fromConfigJsonString: vi.fn(() => ({ configData: 'mock-jwt-config' })),
  },
  BoxJwtAuth: vi.fn(() => ({ authData: 'mock-auth' })),
  BoxClient: vi.fn(() => mockBoxClientInstance),
}));

import { JWTAuthModule } from '../../src/auth/JWTAuthModule.js';

describe('Property 1: Singleton client identity', () => {
  let authModule: JWTAuthModule;

  beforeEach(() => {
    vi.clearAllMocks();
    authModule = new JWTAuthModule();
    authModule.initialize('/fake/path/box_config.json');
  });

  it('getClient() returns the same instance for any number of calls (2–50)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 50 }), (callCount) => {
        // Create a fresh module per run to ensure isolation
        vi.clearAllMocks();
        const module = new JWTAuthModule();
        module.initialize('/fake/path/box_config.json');

        const firstClient = module.getClient();
        for (let i = 1; i < callCount; i++) {
          const client = module.getClient();
          expect(client).toBe(firstClient);
        }
      }),
      { numRuns: 100 },
    );
  });
});
