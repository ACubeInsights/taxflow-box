import { BoxClient } from 'box-node-sdk';
import type { TemplateField } from '../types.js';

const TEMPLATE_KEY = 'taxFlowClientProfile';
const TEMPLATE_SCOPE = 'global'; // Changed from 'enterprise' to 'global' for free developer accounts

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
  constructor(private client: BoxClient) {}

  /**
   * Creates or verifies the taxFlowClientProfile template.
   * @throws Error on unexpected failures (non-409 errors)
   */
  async sync(): Promise<void> {
    console.log('[SchemaSyncEngine] Starting metadata template sync...');
    console.log('[SchemaSyncEngine] Template:', TEMPLATE_SCOPE, TEMPLATE_KEY);
    
    try {
      const existing = await this.client.metadataTemplates.getMetadataTemplate(
        TEMPLATE_SCOPE,
        TEMPLATE_KEY,
      );
      console.log('[SchemaSyncEngine] Template already exists:', existing);
      // Template already exists — nothing to do
      return;
    } catch (error: unknown) {
      const statusCode = this.getStatusCode(error);
      console.log('[SchemaSyncEngine] GET template returned status:', statusCode);
      
      if (statusCode !== 404) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Schema sync failed: ${message}`);
      }
      // 404 means template doesn't exist — proceed to create
      console.log('[SchemaSyncEngine] Template does not exist, creating...');
    }

    try {
      const created = await this.client.metadataTemplates.createMetadataTemplate({
        scope: TEMPLATE_SCOPE,
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
      throw new Error(`Schema sync failed: ${message}`);
    }
  }

  /**
   * Returns the template field definitions for taxFlowClientProfile.
   */
  getTemplateFields(): TemplateField[] {
    return [...TEMPLATE_FIELDS];
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
