import * as fs from 'fs';
import { BoxClient, BoxJwtAuth, JwtConfig } from 'box-node-sdk';
import type { BoxJWTConfig } from '../types.js';

const REQUIRED_TOP_LEVEL_FIELDS = ['boxAppSettings', 'enterpriseID'] as const;
const REQUIRED_APP_SETTINGS_FIELDS = ['clientID', 'clientSecret', 'appAuth'] as const;

export class JWTAuthModule {
  private sdk: BoxJwtAuth | null = null;
  private client: BoxClient | null = null;

  /**
   * Loads and validates box_config.json, initializes SDK.
   * @param configPath - Path to box_config.json
   * @throws Error if file missing, unreadable, or malformed
   */
  initialize(configPath: string): void {
    const configJSON = this.loadConfigFile(configPath);
    this.validateConfig(configJSON);

    try {
      const configString = JSON.stringify(configJSON);
      const jwtConfig = JwtConfig.fromConfigJsonString(configString);
      this.sdk = new BoxJwtAuth({ config: jwtConfig });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize Box SDK: ${message}`);
    }
  }

  /**
   * Returns the authenticated service account client.
   * Caches the client instance (singleton).
   */
  getClient(): BoxClient {
    if (!this.sdk) {
      throw new Error('JWTAuthModule has not been initialized. Call initialize() first.');
    }

    if (!this.client) {
      this.client = new BoxClient({ auth: this.sdk });
    }

    return this.client;
  }

  private loadConfigFile(configPath: string): BoxJWTConfig {
    let rawContent: string;

    try {
      rawContent = fs.readFileSync(configPath, 'utf-8');
    } catch {
      throw new Error(`JWT configuration file not found at ${configPath}`);
    }

    try {
      return JSON.parse(rawContent) as BoxJWTConfig;
    } catch {
      throw new Error('JWT configuration file contains invalid JSON');
    }
  }

  private validateConfig(config: unknown): void {
    const cfg = config as Record<string, unknown>;

    for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
      if (!(field in cfg) || cfg[field] === undefined || cfg[field] === null) {
        throw new Error(`JWT configuration missing required field: ${field}`);
      }
    }

    const appSettings = cfg.boxAppSettings as Record<string, unknown>;
    if (typeof appSettings !== 'object' || appSettings === null) {
      throw new Error('JWT configuration missing required field: boxAppSettings');
    }

    for (const field of REQUIRED_APP_SETTINGS_FIELDS) {
      if (!(field in appSettings) || appSettings[field] === undefined || appSettings[field] === null) {
        throw new Error(`JWT configuration missing required field: ${field}`);
      }
    }
  }
}
