import { BoxClient } from 'box-node-sdk';
import type { ServiceConfig, CreateVaultResult, VaultFolder, BoxTier, TierDetectionResult } from '../types.js';
export declare class BoxWrapperService {
    private authModule;
    private boxClient;
    private schemaReady;
    private config;
    private detectedTier;
    constructor(config?: Partial<ServiceConfig>);
    /**
     * Returns the detected tier, defaulting to 'free' if not yet detected.
     */
    getTier(): BoxTier;
    /**
     * Probes Box API to determine account tier.
     * GET /metadata_templates/enterprise/taxFlowClientProfile
     *   200 or 404 → enterprise (enterprise scope is accessible)
     *   403 or 405 → free (enterprise scope not available)
     *   Network/unexpected error → free (with warning)
     */
    static detectTier(client: BoxClient, enterpriseId: string): Promise<TierDetectionResult>;
    /**
     * Extracts HTTP status code from Box SDK errors.
     * Checks error.status, error.statusCode, error.response.status, error.response.statusCode,
     * and falls back to parsing from error message.
     */
    private static extractStatusCode;
    /**
     * Returns the singleton authenticated Box client.
     * Lazily initializes the JWTAuthModule on first call.
     * @throws Error if JWT config is missing or malformed
     */
    getBoxClient(): BoxClient;
    /**
     * Ensures the taxFlowClientProfile metadata template exists.
     * When tier is provided, stores it and uses the appropriate scope.
     * Enterprise tier → 'enterprise' scope, Free tier → 'global' scope.
     * Must complete before any vault operations on enterprise tier.
     * @param tier - Optional detected BoxTier; defaults to 'enterprise' when not provided
     * @throws Error on unexpected API errors
     */
    syncMetadataSchema(tier?: BoxTier): Promise<void>;
    /**
     * Creates a vault folder with metadata and cascade policy.
     * On enterprise tier: applies metadata + cascade policy.
     * On free tier: skips metadata, returns metadataCascadePolicyId = 'skipped'.
     * @param clientName - Display name for the client
     * @param externalId - Unique external identifier (from auth provider)
     * @param email - Client email address
     * @returns Created folder object with Box folder ID and cascade policy ID
     * @throws Error if folder creation fails
     */
    createAutomatedVault(clientName: string, externalId: string, email: string): Promise<CreateVaultResult>;
    /**
     * Finds a vault folder by external ID.
     * Enterprise tier: uses metadata query for precise, indexed lookup.
     * Free tier: falls back to folder name search.
     * @param externalId - The client_external_id to search for
     * @returns The matching folder or null if not found
     * @throws Error on API/network failures
     */
    findVaultByExternalId(externalId: string): Promise<VaultFolder | null>;
    private ensureSchemaReady;
}
//# sourceMappingURL=BoxWrapperService.d.ts.map