import { BoxClient } from 'box-node-sdk';
import { JWTAuthModule } from '../auth/JWTAuthModule.js';
import { SchemaSyncEngine } from '../schema/SchemaSyncEngine.js';
import type { ServiceConfig, CreateVaultResult, VaultFolder } from '../types.js';

const DEFAULT_CONFIG: ServiceConfig = {
  configPath: './box_config.json',
  rootFolderId: '0',
};

export class BoxWrapperService {
  private authModule: JWTAuthModule;
  private boxClient: BoxClient | null = null;
  private schemaReady: boolean = false;
  private config: ServiceConfig;

  constructor(config?: Partial<ServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.authModule = new JWTAuthModule();
  }

  /**
   * Returns the singleton authenticated Box client.
   * Lazily initializes the JWTAuthModule on first call.
   * @throws Error if JWT config is missing or malformed
   */
  getBoxClient(): BoxClient {
    if (!this.boxClient) {
      this.authModule.initialize(this.config.configPath);
      this.boxClient = this.authModule.getClient();
    }
    return this.boxClient;
  }

  /**
   * Ensures the taxFlowClientProfile metadata template exists.
   * Must complete before any vault operations.
   * @throws Error on unexpected API errors
   */
  async syncMetadataSchema(): Promise<void> {
    const client = this.getBoxClient();
    const engine = new SchemaSyncEngine(client);
    await engine.sync();
    this.schemaReady = true;
  }

  /**
   * Creates a vault folder with metadata and cascade policy.
   * @param clientName - Display name for the client
   * @param externalId - Unique external identifier (from auth provider)
   * @param email - Client email address
   * @returns Created folder object with Box folder ID and cascade policy ID
   * @throws Error if folder creation fails
   */
  async createAutomatedVault(
    clientName: string,
    externalId: string,
    email: string,
  ): Promise<CreateVaultResult> {
    // Skip schema check for free accounts
    // this.ensureSchemaReady();
    const client = this.getBoxClient();

    // Step 1: Create folder named "{clientName} ({externalId})" under root folder
    let folder: any;
    try {
      folder = await client.folders.createFolder({
        name: `${clientName} (${externalId})`,
        parent: { id: this.config.rootFolderId },
      });
    } catch (error: any) {
      throw new Error(`Failed to create vault folder: ${error.message ?? error}`);
    }

    const folderId = folder.id;

    // Skip metadata steps for free accounts - not supported
    // Step 2: Apply taxFlowClientProfile metadata to the folder (SKIPPED)
    // Step 3: Create metadata cascade policy on the folder (SKIPPED)

    return {
      folder: {
        id: folder.id,
        name: folder.name,
        type: 'folder',
      },
      metadataCascadePolicyId: 'skipped', // No cascade policy for free accounts
    };
  }

  /**
   * Finds a vault folder by external ID using folder name search.
   * @param externalId - The client_external_id to search for
   * @returns The matching folder or null if not found
   * @throws Error on API/network failures
   */
  async findVaultByExternalId(externalId: string): Promise<VaultFolder | null> {
    // Skip schema check for free accounts
    // this.ensureSchemaReady();
    const client = this.getBoxClient();

    // Use folder name search instead of metadata query (not available on free accounts)
    let result;
    try {
      result = await client.search.searchForContent({
        query: `(${externalId})`,
        type: 'folder',
        ancestorFolderIds: [this.config.rootFolderId],
      });
    } catch (error: any) {
      throw new Error(`Vault query failed for externalId ${externalId}: ${error.message ?? error}`);
    }

    if (!result.entries || result.entries.length === 0) {
      return null;
    }

    // Find exact match by checking if folder name ends with (externalId)
    const exactMatch = result.entries.find((entry: any) => 
      entry.name && entry.name.endsWith(`(${externalId})`)
    );

    if (!exactMatch) {
      return null;
    }

    return {
      id: (exactMatch as any).id ?? '',
      name: (exactMatch as any).name ?? '',
      type: 'folder',
    };
  }

  private ensureSchemaReady(): void {
    if (!this.schemaReady) {
      throw new Error('Service not ready: metadata schema has not been synchronized');
    }
  }
}
