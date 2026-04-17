import { BoxClient } from 'box-node-sdk';
import type { TemplateField } from '../types.js';

const TEMPLATE_KEY = 'taxFlowClientProfile';

const TEMPLATE_FIELDS: TemplateField[] = [
  { type: 'string', key: 'client_external_id', displayName: 'Client External ID' },
  { type: 'string', key: 'client_email', displayName: 'Client Email' },
  { type: 'string', key: 'tax_year_current', displayName: 'Current Tax Year' },
  {
    type: 'enum',
    key: 'vault_status',
    displayName: 'Vault Status',
    options: [
      { key: 'Active' },
      { key: 'Pending' },
      { key: 'Archived' },
    ],
  },
  { type: 'string', key: 'firm_id', displayName: 'Firm ID' },
];

export class SchemaSyncEngine {
  constructor(private client: BoxClient, private scope: string = 'enterprise') {}

  /**
   * Creates or verifies the taxFlowClientProfile template in the configured scope.
   * When the template already exists, verifies all required fields are present.
   * @throws Error on unexpected failures (non-409 errors), including scope, template key, and HTTP status
   */
  async sync(): Promise<void> {
    console.log('[SchemaSyncEngine] Starting metadata template sync...');
    console.log('[SchemaSyncEngine] Template:', this.scope, TEMPLATE_KEY);

    try {
      const existing = await this.client.metadataTemplates.getMetadataTemplate(
        this.scope,
        TEMPLATE_KEY,
      );
      console.log('[SchemaSyncEngine] Template already exists:', existing);

      // Field discrepancy detection: compare existing fields against canonical definition
      this.detectFieldDiscrepancies(existing);

      return;
    } catch (error: unknown) {
      const statusCode = this.getStatusCode(error);
      console.log('[SchemaSyncEngine] GET template returned status:', statusCode);

      if (statusCode !== 404) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Schema sync failed for template '${TEMPLATE_KEY}' in scope '${this.scope}': HTTP ${statusCode ?? 'unknown'} — ${message}`,
        );
      }
      // 404 means template doesn't exist — proceed to create
      console.log('[SchemaSyncEngine] Template does not exist, creating...');
    }

    try {
      const created = await this.client.metadataTemplates.createMetadataTemplate({
        scope: this.scope,
        templateKey: TEMPLATE_KEY,
        displayName: 'TaxFlow Client Profile',
        fields: TEMPLATE_FIELDS.map((field) => ({
          type: field.type,
          key: field.key,
          displayName: field.displayName,
          options: field.options,
        })),
      });
      console.log('[SchemaSyncEngine] Template created successfully:', created);
    } catch (error: unknown) {
      const statusCode = this.getStatusCode(error);
      console.log('[SchemaSyncEngine] CREATE template returned status:', statusCode);
      console.log('[SchemaSyncEngine] CREATE error details:', error);

      if (statusCode === 409) {
        // Template was created by another process — treat as success
        console.log('[SchemaSyncEngine] Template already exists (409), continuing...');
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Schema sync failed for template '${TEMPLATE_KEY}' in scope '${this.scope}': HTTP ${statusCode ?? 'unknown'} — ${message}`,
      );
    }
  }

  /**
   * Returns the template field definitions for taxFlowClientProfile.
   */
  getTemplateFields(): TemplateField[] {
    return [...TEMPLATE_FIELDS];
  }

  /**
   * Compares existing template fields against the canonical TEMPLATE_FIELDS definition.
   * Logs a warning for any missing fields.
   */
  private detectFieldDiscrepancies(existingTemplate: unknown): void {
    const existing = existingTemplate as Record<string, unknown>;
    const existingFields = Array.isArray(existing?.fields) ? existing.fields : [];

    const existingKeys = new Set(
      existingFields
        .filter((f: unknown): f is Record<string, unknown> => f !== null && typeof f === 'object')
        .map((f: Record<string, unknown>) => f.key)
        .filter((k: unknown): k is string => typeof k === 'string'),
    );

    const missingKeys = TEMPLATE_FIELDS
      .map((f) => f.key)
      .filter((key) => !existingKeys.has(key));

    if (missingKeys.length > 0) {
      console.warn(
        `[SchemaSyncEngine] Field discrepancy detected in template '${TEMPLATE_KEY}' (scope: ${this.scope}): missing fields: ${missingKeys.join(', ')}`,
      );
    }
  }

  private getStatusCode(error: unknown): number | undefined {
    // Try multiple ways to extract status code from Box SDK errors
    if (error !== null && typeof error === 'object') {
      const err = error as Record<string, unknown>;

      // Try direct status property
      if ('status' in err && typeof err.status === 'number') {
        return err.status;
      }

      // Try statusCode property
      if ('statusCode' in err && typeof err.statusCode === 'number') {
        return err.statusCode;
      }

      // Try response.status
      if ('response' in err && err.response !== null && typeof err.response === 'object') {
        const response = err.response as Record<string, unknown>;
        if ('status' in response && typeof response.status === 'number') {
          return response.status;
        }
        if ('statusCode' in response && typeof response.statusCode === 'number') {
          return response.statusCode;
        }
      }

      // Try to parse from message
      if ('message' in err && typeof err.message === 'string') {
        const match = err.message.match(/\b(\d{3})\b/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    }

    return undefined;
  }
}
