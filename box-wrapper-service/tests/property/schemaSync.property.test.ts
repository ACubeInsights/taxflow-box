// Feature: box-wrapper-service, Property 3: Non-409 schema sync errors propagate
// **Validates: Requirements 2.3, 2.4**

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { SchemaSyncEngine } from '../../src/schema/SchemaSyncEngine.js';

/**
 * Creates a mock BoxClient with controllable metadataTemplates methods.
 */
function createMockClient(overrides: {
  getMetadataTemplate?: (...args: unknown[]) => Promise<unknown>;
  createMetadataTemplate?: (...args: unknown[]) => Promise<unknown>;
}) {
  return {
    metadataTemplates: {
      getMetadataTemplate:
        overrides.getMetadataTemplate ?? vi.fn().mockResolvedValue({}),
      createMetadataTemplate:
        overrides.createMetadataTemplate ?? vi.fn().mockResolvedValue({}),
    },
  } as unknown as import('box-node-sdk').BoxClient;
}

/**
 * Creates an error object with a `status` property, mimicking Box API errors.
 */
function apiError(statusCode: number): Error & { status: number } {
  const err = new Error(`API error ${statusCode}`) as Error & { status: number };
  err.status = statusCode;
  return err;
}

describe('Property 3: Non-409 schema sync errors propagate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('non-409 error status codes during template creation cause sync() to throw', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate HTTP error status codes 400–599 excluding 409
        fc.integer({ min: 400, max: 599 }).filter((code) => code !== 409),
        async (statusCode) => {
          const mockClient = createMockClient({
            // Return 404 so sync() proceeds to the create path
            getMetadataTemplate: vi.fn().mockRejectedValue(apiError(404)),
            // Return the random non-409 error status
            createMetadataTemplate: vi.fn().mockRejectedValue(apiError(statusCode)),
          });

          const engine = new SchemaSyncEngine(mockClient);

          await expect(engine.sync()).rejects.toThrow('Schema sync failed');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('409 status code during template creation does NOT cause sync() to throw', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Use a constant arbitrary since we only need to verify 409 behavior,
        // but run it multiple times for confidence
        fc.constant(409),
        async (statusCode) => {
          const mockClient = createMockClient({
            // Return 404 so sync() proceeds to the create path
            getMetadataTemplate: vi.fn().mockRejectedValue(apiError(404)),
            // Return 409 Conflict
            createMetadataTemplate: vi.fn().mockRejectedValue(apiError(statusCode)),
          });

          const engine = new SchemaSyncEngine(mockClient);

          // 409 should be treated as success — no error thrown
          await expect(engine.sync()).resolves.toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('non-404 error status codes during template check also cause sync() to throw', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate HTTP error status codes 400–599 excluding 404
        // (since 404 means "template missing" and triggers creation)
        fc.integer({ min: 400, max: 599 }).filter((code) => code !== 404),
        async (statusCode) => {
          const mockClient = createMockClient({
            // Return a non-404 error during the initial template check
            getMetadataTemplate: vi.fn().mockRejectedValue(apiError(statusCode)),
          });

          const engine = new SchemaSyncEngine(mockClient);

          await expect(engine.sync()).rejects.toThrow('Schema sync failed');
        },
      ),
      { numRuns: 100 },
    );
  });
});
