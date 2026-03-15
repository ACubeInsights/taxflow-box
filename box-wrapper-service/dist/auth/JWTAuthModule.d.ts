import { BoxClient } from 'box-node-sdk';
export declare class JWTAuthModule {
    private sdk;
    private client;
    /**
     * Loads and validates box_config.json, initializes SDK.
     * @param configPath - Path to box_config.json
     * @throws Error if file missing, unreadable, or malformed
     */
    initialize(configPath: string): void;
    /**
     * Returns the authenticated service account client.
     * Caches the client instance (singleton).
     */
    getClient(): BoxClient;
    private loadConfigFile;
    private validateConfig;
}
//# sourceMappingURL=JWTAuthModule.d.ts.map