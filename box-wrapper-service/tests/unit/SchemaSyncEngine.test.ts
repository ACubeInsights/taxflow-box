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

  // Req 2.3: constructor accepts scope parameter
  it('defaults scope to enterprise when not provided', async () => {
    const getMetadataTemplate = vi.fn().mockResolvedValue({});
    const client = createMockClient({ getMetadataTemplate });
    const engine = new SchemaSyncEngine(client);

    await engine.sync();

    expect(getMetadataTemplate).toHaveBeenCalledWith('enterprise', 'taxFlowClientProfile');
  });

  // Req 2.1: uses enterprise scope when constructed with it
  it('uses enterprise scope when constructed with enterprise', async () => {
    const getMetadataTemplate = vi.fn().mockResolvedValue({});
    const client = createMockClient({ getMetadataTemplate });
    const engine = new SchemaSyncEngine(client, 'enterprise');

    await engine.sync();

    expect(getMetadataTemplate).toHaveBeenCalledWith('enterprise', 'taxFlowClientProfile');
  });

  // Req 2.2: uses global scope when constructed with it
  it('uses global scope when constructed with global', async () => {
    const getMetadataTemplate = vi.fn().mockResolvedValue({});
    const client = createMockClient({ getMetadataTemplate });
    const engine = new SchemaSyncEngine(client, 'global');

    await engine.sync();

    expect(getMetadataTemplate).toHaveBeenCalledWith('global', 'taxFlowClientProfile');
  });

  // Req 2.2: creates template with exactly 5 fields when missing, using provided scope
  it('creates template with exactly 5 fields using the provided scope', async () => {
    const getMetadataTemplate = vi.fn().mockRejectedValue(apiError(404));
    const createMetadataTemplate = vi.fn().mockResolvedValue({});
    const client = createMockClient({ getMetadataTemplate, createMetadataTemplate });
    const engine = new SchemaSyncEngine(client, 'global');

    await engine.sync();

    expect(createMetadataTemplate).toHaveBeenCalledTimes(1);
    const callArgs = createMetadataTemplate.mock.calls[0][0];
    expect(callArgs.fields).toHaveLength(5);
    expect(callArgs.scope).toBe('global');
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
    const engine = new SchemaSyncEngine(client, 'enterprise');

    await expect(engine.sync()).resolves.toBeUndefined();
  });

  // Req 2.5: error messages include scope, template key, and HTTP status code
  it('throws error with scope, template key, and HTTP status on non-409 create failure', async () => {
    const getMetadataTemplate = vi.fn().mockRejectedValue(apiError(404));
    const createMetadataTemplate = vi.fn().mockRejectedValue(apiError(500));
    const client = createMockClient({ getMetadataTemplate, createMetadataTemplate });
    const engine = new SchemaSyncEngine(client, 'enterprise');

    await expect(engine.sync()).rejects.toThrow(/taxFlowClientProfile/);
    try {
      await engine.sync();
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).toContain('enterprise');
      expect(msg).toContain('taxFlowClientProfile');
      expect(msg).toContain('500');
    }
  });

  it('throws error with scope and status on non-404 GET failure', async () => {
    const getMetadataTemplate = vi.fn().mockRejectedValue(apiError(403));
    const client = createMockClient({ getMetadataTemplate });
    const engine = new SchemaSyncEngine(client, 'global');

    try {
      await engine.sync();
      expect.fail('Expected sync() to throw');
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).toContain('global');
      expect(msg).toContain('taxFlowClientProfile');
      expect(msg).toContain('403');
    }
  });

  // Req 2.4: field discrepancy detection
  it('logs warning when existing template is missing fields', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const getMetadataTemplate = vi.fn().mockResolvedValue({
      fields: [
        { key: 'client_external_id', type: 'string' },
        { key: 'client_email', type: 'string' },
        // Missing: tax_year_current, vault_status, firm_id
      ],
    });
    const client = createMockClient({ getMetadataTemplate });
    const engine = new SchemaSyncEngine(client, 'enterprise');

    await engine.sync();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('tax_year_current'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('vault_status'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('firm_id'),
    );
    warnSpy.mockRestore();
  });

  it('does not log warning when existing template has all fields', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const getMetadataTemplate = vi.fn().mockResolvedValue({
      fields: [
        { key: 'client_external_id', type: 'string' },
        { key: 'client_email', type: 'string' },
        { key: 'tax_year_current', type: 'string' },
        { key: 'vault_status', type: 'enum' },
        { key: 'firm_id', type: 'string' },
      ],
    });
    const client = createMockClient({ getMetadataTemplate });
    const engine = new SchemaSyncEngine(client, 'enterprise');

    await engine.sync();

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Field discrepancy'),
    );
    warnSpy.mockRestore();
  });
});
