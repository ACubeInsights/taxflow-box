import { BoxClient } from 'box-node-sdk';
import type { ServiceConfig, CreateVaultResult, VaultFolder } from '../types.js';
export declare class BoxWrapperService {
    private authModule;
    private boxClient;
    private schemaReady;
    private config;
    constructor(config?: Partial<ServiceConfig>);
    /**
     * Returns the singleton authenticated Box client.
     * Lazily initializes the JWTAuthModule on first call.
     * @throws Error if JWT config is missing or malformed
     */
    getBoxClient(): BoxClient;
    /**
     * Ensures the taxFlowClientProfile metadata template exists.
     * Must complete before any vault operations.
     * @throws Error on unexpected API errors
     */
    syncMetadataSchema(): Promise<void>;
    /**
     * Creates a vault folder with metadata and cascade policy.
     * @param clientName - Display name for the client
     * @param externalId - Unique external identifier (from auth provider)
     * @param email - Client email address
     * @returns Created folder object with Box folder ID and cascade policy ID
     * @throws Error if folder creation fails
     */
    createAutomatedVault(clientName: string, externalId: string, email: string): Promise<CreateVaultResult>;
    /**
     * Finds a vault folder by external ID using folder name search.
     * @param externalId - The client_external_id to search for
     * @returns The matching folder or null if not found
     * @throws Error on API/network failures
     */
    findVaultByExternalId(externalId: string): Promise<VaultFolder | null>;
    private ensureSchemaReady;
}
//# sourceMappingURL=BoxWrapperService.d.ts.map