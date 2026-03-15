import * as fs from 'fs';
import { BoxClient, BoxJwtAuth, JwtConfig } from 'box-node-sdk';
const REQUIRED_TOP_LEVEL_FIELDS = ['boxAppSettings', 'enterpriseID'];
const REQUIRED_APP_SETTINGS_FIELDS = ['clientID', 'clientSecret', 'appAuth'];
export class JWTAuthModule {
    sdk = null;
    client = null;
    /**
     * Loads and validates box_config.json, initializes SDK.
     * @param configPath - Path to box_config.json
     * @throws Error if file missing, unreadable, or malformed
     */
    initialize(configPath) {
        const configJSON = this.loadConfigFile(configPath);
        this.validateConfig(configJSON);
        try {
            const configString = JSON.stringify(configJSON);
            const jwtConfig = JwtConfig.fromConfigJsonString(configString);
            this.sdk = new BoxJwtAuth({ config: jwtConfig });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to initialize Box SDK: ${message}`);
        }
    }
    /**
     * Returns the authenticated service account client.
     * Caches the client instance (singleton).
     */
    getClient() {
        if (!this.sdk) {
            throw new Error('JWTAuthModule has not been initialized. Call initialize() first.');
        }
        if (!this.client) {
            this.client = new BoxClient({ auth: this.sdk });
        }
        return this.client;
    }
    loadConfigFile(configPath) {
        let rawContent;
        try {
            rawContent = fs.readFileSync(configPath, 'utf-8');
        }
        catch {
            throw new Error(`JWT configuration file not found at ${configPath}`);
        }
        try {
            return JSON.parse(rawContent);
        }
        catch {
            throw new Error('JWT configuration file contains invalid JSON');
        }
    }
    validateConfig(config) {
        const cfg = config;
        for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
            if (!(field in cfg) || cfg[field] === undefined || cfg[field] === null) {
                throw new Error(`JWT configuration missing required field: ${field}`);
            }
        }
        const appSettings = cfg.boxAppSettings;
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
//# sourceMappingURL=JWTAuthModule.js.map