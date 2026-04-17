// Feature: box-wrapper-service, Property 3: Non-409 schema sync errors propagate
// **Validates: Requirements 2.3, 2.4, 2.5**

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

  it('non-409 error status codes during template creation cause sync() to throw with scope, template key, and status', async () => {
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

          const engine = new SchemaSyncEngine(mockClient, 'enterprise');

          try {
            await engine.sync();
            expect.fail('Expected sync() to throw');
          } catch (e: unknown) {
            const msg = (e as Error).message;
            expect(msg).toContain('enterprise');
            expect(msg).toContain('taxFlowClientProfile');
            expect(msg).toContain(String(statusCode));
          }
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

          const engine = new SchemaSyncEngine(mockClient, 'enterprise');

          // 409 should be treated as success — no error thrown
          await expect(engine.sync()).resolves.toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('non-404 error status codes during template check cause sync() to throw with scope, template key, and status', async () => {
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

          const engine = new SchemaSyncEngine(mockClient, 'enterprise');

          try {
            await engine.sync();
            expect.fail('Expected sync() to throw');
          } catch (e: unknown) {
            const msg = (e as Error).message;
            expect(msg).toContain('enterprise');
            expect(msg).toContain('taxFlowClientProfile');
            expect(msg).toContain(String(statusCode));
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('error messages include scope when using a custom scope', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        fc.integer({ min: 400, max: 599 }).filter((code) => code !== 404),
        async (scope, statusCode) => {
          const mockClient = createMockClient({
            getMetadataTemplate: vi.fn().mockRejectedValue(apiError(statusCode)),
          });

          const engine = new SchemaSyncEngine(mockClient, scope);

          try {
            await engine.sync();
            expect.fail('Expected sync() to throw');
          } catch (e: unknown) {
            const msg = (e as Error).message;
            expect(msg).toContain(scope);
            expect(msg).toContain('taxFlowClientProfile');
            expect(msg).toContain(String(statusCode));
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
