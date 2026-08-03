import { describe, it, expect } from 'vitest';
import {
  isMinimalSchema,
  isFullSchema,
  isProductionSchema,
  isBoxFirstSchema,
  getMigrationsDirectoryName,
} from '../../db/schemaMode.js';
import { mapVaultManifest } from '../vaultDiscoveryService.js';

describe('schemaMode', () => {
  it('defaults to full schema in tests', () => {
    expect(isFullSchema()).toBe(true);
    expect(isMinimalSchema()).toBe(false);
    expect(isProductionSchema()).toBe(false);
    expect(isBoxFirstSchema()).toBe(false);
    expect(getMigrationsDirectoryName()).toBe('migrations');
  });
});

describe('mapVaultManifest', () => {
  it('normalizes DB row keys', () => {
    const vault = mapVaultManifest({
      client_id: 'u1',
      root_folder_id: 'f-root',
      uploads_folder_id: 'f-up',
    });
    expect(vault.clientId).toBe('u1');
    expect(vault.root).toBe('f-root');
    expect(vault.uploads).toBe('f-up');
  });
});
