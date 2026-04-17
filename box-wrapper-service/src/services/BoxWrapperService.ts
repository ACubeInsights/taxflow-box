import { BoxClient } from 'box-node-sdk';
import { JWTAuthModule } from '../auth/JWTAuthModule.js';
import { SchemaSyncEngine } from '../schema/SchemaSyncEngine.js';
import type { ServiceConfig, CreateVaultResult, VaultFolder, BoxTier, TierDetectionResult } from '../types.js';

const DEFAULT_CONFIG: ServiceConfig = {
  configPath: './box_config.json',
  rootFolderId: '0',
};

export class BoxWrapperService {
  private authModule: JWTAuthModule;
  private boxClient: BoxClient | null = null;
  private schemaReady: boolean = false;
  private config: ServiceConfig;
  private detectedTier: BoxTier | null = null;

  constructor(config?: Partial<ServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.authModule = new JWTAuthModule();
  }

  /**
   * Returns the detected tier, defaulting to 'free' if not yet detected.
   */
  getTier(): BoxTier {
    return this.detectedTier ?? 'free';
  }

  /**
   * Probes Box API to determine account tier.
   * GET /metadata_templates/enterprise/taxFlowClientProfile
   *   200 or 404 → enterprise (enterprise scope is accessible)
   *   403 or 405 → free (enterprise scope not available)
   *   Network/unexpected error → free (with warning)
   */
  static async detectTier(client: BoxClient, enterpriseId: string): Promise<TierDetectionResult> {
    let tier: BoxTier = 'free';

    try {
      await client.metadataTemplates.getMetadataTemplate(
        'enterprise',
        'taxFlowClientProfile',
      );
      // HTTP 200 — template exists, enterprise scope accessible
      tier = 'enterprise';
    } catch (error: unknown) {
      const statusCode = BoxWrapperService.extractStatusCode(error);

      if (statusCode === 404) {
        // 404 — enterprise scope accessible but template not yet created
        tier = 'enterprise';
      } else if (statusCode === 403 || statusCode === 405) {
        // 403/405 — enterprise scope not available, free tier
        tier = 'free';
      } else {
        // Network or unexpected error — default to free, log warning
        console.warn(
          `[BoxWrapperService] Tier detection failed for enterprise ${enterpriseId}, defaulting to free tier:`,
          error instanceof Error ? error.message : String(error),
        );
        tier = 'free';
      }
    }

    console.info(
      `[BoxWrapperService] Detected tier: ${tier} for enterprise ${enterpriseId}`,
    );

    return {
      tier,
      enterpriseId,
      detectedAt: new Date().toISOString(),
    };
  }

  /**
   * Extracts HTTP status code from Box SDK errors.
   * Checks error.status, error.statusCode, error.response.status, error.response.statusCode,
   * and falls back to parsing from error message.
   */
  private static extractStatusCode(error: unknown): number | undefined {
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

      // Try response.status / response.statusCode
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
   * When tier is provided, stores it and uses the appropriate scope.
   * Enterprise tier → 'enterprise' scope, Free tier → 'global' scope.
   * Must complete before any vault operations on enterprise tier.
   * @param tier - Optional detected BoxTier; defaults to 'enterprise' when not provided
   * @throws Error on unexpected API errors
   */
  async syncMetadataSchema(tier?: BoxTier): Promise<void> {
    const effectiveTier = tier ?? 'enterprise';
    this.detectedTier = effectiveTier;

    const scope = effectiveTier === 'enterprise' ? 'enterprise' : 'global';
    const client = this.getBoxClient();
    const engine = new SchemaSyncEngine(client, scope);
    await engine.sync();
    this.schemaReady = true;
  }

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
  async createAutomatedVault(
    clientName: string,
    externalId: string,
    email: string,
  ): Promise<CreateVaultResult> {
    const tier = this.detectedTier;

    // Schema readiness guard: enforce on enterprise (or unset tier), skip on free
    if (tier !== 'free') {
      this.ensureSchemaReady();
    }

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

    // Free tier: skip metadata and cascade
    if (tier === 'free') {
      console.warn(
        `[BoxWrapperService] Free tier: skipping metadata and cascade policy for vault folder ${folderId}`,
      );
      return {
        folder: {
          id: folder.id,
          name: folder.name,
          type: 'folder',
        },
        metadataCascadePolicyId: 'skipped',
        metadataApplied: false,
      };
    }

    // Enterprise tier: Step 2 — Apply taxFlowClientProfile metadata to the folder
    try {
      await client.folderMetadata.createFolderMetadataById(
        folderId,
        'enterprise',
        'taxFlowClientProfile',
        {
          client_external_id: externalId,
          client_email: email,
          tax_year_current: String(new Date().getFullYear()),
          vault_status: 'Active',
          firm_id: this.config.enterpriseId ?? '',
        },
      );
    } catch (error: any) {
      throw new Error(
        `Failed to apply metadata to vault folder ${folderId}: ${error.message ?? error}`,
      );
    }

    // Enterprise tier: Step 3 — Create metadata cascade policy on the folder
    try {
      const cascadeResult = await client.metadataCascadePolicies.createMetadataCascadePolicy({
        folderId: folderId,
        scope: 'enterprise',
        templateKey: 'taxFlowClientProfile',
      });

      return {
        folder: {
          id: folder.id,
          name: folder.name,
          type: 'folder',
        },
        metadataCascadePolicyId: cascadeResult.id,
        metadataApplied: true,
      };
    } catch (error: any) {
      throw new Error(
        `Vault folder ${folderId} created but cascade policy failed: ${error.message ?? error}. Manual remediation required.`,
      );
    }
  }

  /**
   * Finds a vault folder by external ID.
   * Enterprise tier: uses metadata query for precise, indexed lookup.
   * Free tier: falls back to folder name search.
   * @param externalId - The client_external_id to search for
   * @returns The matching folder or null if not found
   * @throws Error on API/network failures
   */
  async findVaultByExternalId(externalId: string): Promise<VaultFolder | null> {
    const tier = this.detectedTier;

    // Schema readiness guard: enforce on enterprise (or unset tier), skip on free
    if (tier !== 'free') {
      this.ensureSchemaReady();
    }

    const client = this.getBoxClient();

    // Enterprise tier: use metadata query
    if (tier === 'enterprise') {
      let result;
      try {
        result = await (client as any).metadataQueries?.executeRead?.({
          from: 'enterprise_taxFlowClientProfile',
          query: 'client_external_id = :id',
          queryParams: { id: externalId },
          ancestorFolderId: this.config.rootFolderId,
          fields: ['id', 'name', 'type'],
        });
        // If executeRead is not available, fall through to search
        if (!result) {
          result = { entries: [] };
        }
      } catch (error: any) {
        throw new Error(
          `Vault query failed for externalId ${externalId}: ${error.message ?? error}`,
        );
      }

      if (!result.entries || result.entries.length === 0) {
        return null;
      }

      const entry = result.entries[0];
      return {
        id: entry.id ?? '',
        name: entry.name ?? '',
        type: 'folder',
      };
    }

    // Free tier: use folder name search
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
      entry.name && entry.name.endsWith(`(${externalId})`),
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
