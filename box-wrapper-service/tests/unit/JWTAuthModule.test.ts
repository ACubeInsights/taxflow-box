import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

// Mock fs before importing the module under test
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
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

const VALID_CONFIG_JSON = JSON.stringify({
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
});

describe('JWTAuthModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Req 1.1, 1.2: loads valid config and returns a client
  it('loads valid config and initializes without error', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(VALID_CONFIG_JSON);

    const authModule = new JWTAuthModule();
    expect(() => authModule.initialize('/path/to/box_config.json')).not.toThrow();
  });

  // Req 1.6: throws when config file is missing
  it('throws a descriptive error when config file is missing', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const authModule = new JWTAuthModule();
    expect(() => authModule.initialize('/missing/box_config.json')).toThrowError(
      'JWT configuration file not found at /missing/box_config.json',
    );
  });

  // Req 1.6: throws when config JSON is malformed
  it('throws a descriptive error when config JSON is malformed', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{ not valid json !!!');

    const authModule = new JWTAuthModule();
    expect(() => authModule.initialize('/path/to/box_config.json')).toThrowError(
      'JWT configuration file contains invalid JSON',
    );
  });

  // Req 1.3: getClient() returns a BoxClient
  it('getClient() returns a BoxClient after initialization', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(VALID_CONFIG_JSON);

    const authModule = new JWTAuthModule();
    authModule.initialize('/path/to/box_config.json');

    const client = authModule.getClient();
    expect(client).toBe(mockBoxClientInstance);
  });

  it('getClient() throws if initialize() has not been called', () => {
    const authModule = new JWTAuthModule();
    expect(() => authModule.getClient()).toThrowError(/not been initialized/);
  });
});
