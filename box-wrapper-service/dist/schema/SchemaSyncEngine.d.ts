import { BoxClient } from 'box-node-sdk';
import type { TemplateField } from '../types.js';
export declare class SchemaSyncEngine {
    private client;
    private scope;
    constructor(client: BoxClient, scope?: string);
    /**
     * Creates or verifies the taxFlowClientProfile template in the configured scope.
     * When the template already exists, verifies all required fields are present.
     * @throws Error on unexpected failures (non-409 errors), including scope, template key, and HTTP status
     */
    sync(): Promise<void>;
    /**
     * Returns the template field definitions for taxFlowClientProfile.
     */
    getTemplateFields(): TemplateField[];
    /**
     * Compares existing template fields against the canonical TEMPLATE_FIELDS definition.
     * Logs a warning for any missing fields.
     */
    private detectFieldDiscrepancies;
    private getStatusCode;
}
//# sourceMappingURL=SchemaSyncEngine.d.ts.map