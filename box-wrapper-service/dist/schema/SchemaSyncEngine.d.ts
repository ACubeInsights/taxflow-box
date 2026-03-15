import { BoxClient } from 'box-node-sdk';
import type { TemplateField } from '../types.js';
export declare class SchemaSyncEngine {
    private client;
    constructor(client: BoxClient);
    /**
     * Creates or verifies the taxFlowClientProfile template.
     * @throws Error on unexpected failures (non-409 errors)
     */
    sync(): Promise<void>;
    /**
     * Returns the template field definitions for taxFlowClientProfile.
     */
    getTemplateFields(): TemplateField[];
    private getStatusCode;
}
//# sourceMappingURL=SchemaSyncEngine.d.ts.map