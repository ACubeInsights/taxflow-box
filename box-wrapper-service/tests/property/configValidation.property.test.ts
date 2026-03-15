// Feature: box-wrapper-service, Property 2: Malformed configuration produces descriptive errors
// **Validates: Requirements 1.6**

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('box-node-sdk', () => ({
  JwtConfig: {
    fromConfigJsonString: vi.fn(() => ({ configData: 'mock-jwt-config' })),
  },
  BoxJwtAuth: vi.fn(() => ({ authData: 'mock-auth' })),
  BoxClient: vi.fn(() => ({ id: 'mock-box-client' })),
}));

import { JWTAuthModule } from '../../src/auth/JWTAuthModule.js';

/**
 * A valid config object used as a base. We selectively remove fields
 * to generate malformed configs.
 */
const VALID_CONFIG = {
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
};

/** All required fields and how to remove them from a valid config */
const REQUIRED_FIELDS = [
  {
    name: 'boxAppSettings',
    remove: (config: Record<string, unknown>) => {
      delete config.boxAppSettings;
    },
  },
  {
    name: 'enterpriseID',
    remove: (config: Record<string, unknown>) => {
      delete config.enterpriseID;
    },
  },
  {
    name: 'clientID',
    remove: (config: Record<string, unknown>) => {
      const appSettings = config.boxAppSettings as Record<string, unknown>;
      delete appSettings.clientID;
    },
  },
  {
    name: 'clientSecret',
    remove: (config: Record<string, unknown>) => {
      const appSettings = config.boxAppSettings as Record<string, unknown>;
      delete appSettings.clientSecret;
    },
  },
  {
    name: 'appAuth',
    remove: (config: Record<string, unknown>) => {
      const appSettings = config.boxAppSettings as Record<string, unknown>;
      delete appSettings.appAuth;
    },
  },
] as const;

describe('Property 2: Malformed configuration produces descriptive errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('missing any required field causes initialize() to throw with the field name in the message', () => {
    fc.assert(
      fc.property(
        // Pick a random required field to remove
        fc.integer({ min: 0, max: REQUIRED_FIELDS.length - 1 }),
        // Generate random extra keys to add noise to the config
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 10 }).filter(
            (s) => !['boxAppSettings', 'enterpriseID'].includes(s),
          ),
          fc.jsonValue(),
          { minKeys: 0, maxKeys: 5 },
        ),
        (fieldIndex, extraKeys) => {
          const field = REQUIRED_FIELDS[fieldIndex];

          // Deep clone the valid config and add noise
          const config = JSON.parse(JSON.stringify(VALID_CONFIG));
          Object.assign(config, extraKeys);

          // Remove the chosen required field
          field.remove(config);

          // Mock fs.readFileSync to return this malformed config
          vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

          const authModule = new JWTAuthModule();

          expect(() => authModule.initialize('/fake/box_config.json')).toThrowError(
            new RegExp(field.name),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('setting a required field to null causes initialize() to throw with the field name', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: REQUIRED_FIELDS.length - 1 }),
        (fieldIndex) => {
          const field = REQUIRED_FIELDS[fieldIndex];

          // Deep clone and set the field to null instead of removing it
          const config = JSON.parse(JSON.stringify(VALID_CONFIG)) as Record<string, unknown>;

          if (field.name === 'boxAppSettings' || field.name === 'enterpriseID') {
            config[field.name] = null;
          } else {
            const appSettings = config.boxAppSettings as Record<string, unknown>;
            appSettings[field.name] = null;
          }

          vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

          const authModule = new JWTAuthModule();

          expect(() => authModule.initialize('/fake/box_config.json')).toThrowError(
            new RegExp(field.name),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
