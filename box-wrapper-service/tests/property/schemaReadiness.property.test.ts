// Feature: box-wrapper-service, Property 4: Vault operations require schema readiness
// **Validates: Requirements 2.5**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { BoxWrapperService } from '../../src/services/BoxWrapperService.js';

const SCHEMA_NOT_READY_MSG = 'Service not ready: metadata schema has not been synchronized';

describe('Property 4: Vault operations require schema readiness', () => {
  it('createAutomatedVault() throws schema-not-ready error before sync completes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.emailAddress(),
        async (clientName, externalId, email) => {
          const service = new BoxWrapperService();
          await expect(
            service.createAutomatedVault(clientName, externalId, email),
          ).rejects.toThrow(SCHEMA_NOT_READY_MSG);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('findVaultByExternalId() throws schema-not-ready error before sync completes', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (externalId) => {
        const service = new BoxWrapperService();
        await expect(
          service.findVaultByExternalId(externalId),
        ).rejects.toThrow(SCHEMA_NOT_READY_MSG);
      }),
      { numRuns: 100 },
    );
  });
});
