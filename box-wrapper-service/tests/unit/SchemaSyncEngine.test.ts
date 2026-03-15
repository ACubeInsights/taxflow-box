import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BoxClient } from 'box-node-sdk';
import { SchemaSyncEngine } from '../../src/schema/SchemaSyncEngine.js';

function createMockClient(overrides?: Partial<{
  getMetadataTemplate: (...args: unknown[]) => Promise<unknown>;
  createMetadataTemplate: (...args: unknown[]) => Promise<unknown>;
}>) {
  return {
    metadataTemplates: {
      getMetadataTemplate: overrides?.getMetadataTemplate ?? vi.fn().mockResolvedValue({}),
      createMetadataTemplate: overrides?.createMetadataTemplate ?? vi.fn().mockResolvedValue({}),
    },
  } as unknown as BoxClient;
}

function apiError(statusCode: number): Error & { status: number } {
  const err = new Error(`API error ${statusCode}`) as Error & { status: number };
  err.status = statusCode;
  return err;
}

describe('SchemaSyncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Req 2.1: calls metadata templates API on sync
  it('calls metadata templates API to check if template exists', async () => {
    const getMetadataTemplate = vi.fn().mockResolvedValue({});
    const client = createMockClient({ getMetadataTemplate });
    const engine = new SchemaSyncEngine(client);

    await engine.sync();

    expect(getMetadataTemplate).toHaveBeenCalledWith('enterprise', 'taxFlowClientProfile');
  });

  // Req 2.2: creates template with exactly 5 fields when missing
  it('creates template with exactly 5 fields when template does not exist', async () => {
    const getMetadataTemplate = vi.fn().mockRejectedValue(apiError(404));
    const createMetadataTemplate = vi.fn().mockResolvedValue({});
    const client = createMockClient({ getMetadataTemplate, createMetadataTemplate });
    const engine = new SchemaSyncEngine(client);

    await engine.sync();

    expect(createMetadataTemplate).toHaveBeenCalledTimes(1);
    const callArgs = createMetadataTemplate.mock.calls[0][0];
    expect(callArgs.fields).toHaveLength(5);
    expect(callArgs.scope).toBe('enterprise');
    expect(callArgs.templateKey).toBe('taxFlowClientProfile');
    expect(callArgs.fields.map((f: { key: string }) => f.key)).toEqual([
      'client_external_id',
      'client_email',
      'tax_year_current',
      'vault_status',
      'firm_id',
    ]);
  });

  // Req 2.3: succeeds silently on 409 conflict
  it('succeeds silently when template creation returns 409 conflict', async () => {
    const getMetadataTemplate = vi.fn().mockRejectedValue(apiError(404));
    const createMetadataTemplate = vi.fn().mockRejectedValue(apiError(409));
    const client = createMockClient({ getMetadataTemplate, createMetadataTemplate });
    const engine = new SchemaSyncEngine(client);

    await expect(engine.sync()).resolves.toBeUndefined();
  });
});
