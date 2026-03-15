export interface VaultFolder {
  id: string;
  name: string;
  type: 'folder';
}

export interface CreateVaultResult {
  folder: VaultFolder;
  metadataCascadePolicyId: string;
}

export interface ServiceConfig {
  configPath: string;
  rootFolderId: string;
}

export interface BoxJWTConfig {
  boxAppSettings: {
    clientID: string;
    clientSecret: string;
    appAuth: {
      publicKeyID: string;
      privateKey: string;
      passphrase: string;
    };
  };
  enterpriseID: string;
}

export interface TemplateField {
  type: 'string' | 'enum';
  key: string;
  displayName: string;
  options?: Array<{ key: string }>;
}
