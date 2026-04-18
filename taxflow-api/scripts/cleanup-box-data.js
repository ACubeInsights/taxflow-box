#!/usr/bin/env node
/**
 * Cleanup script — Deletes ALL Box App Users and their content,
 * plus all folders under the configured root folder.
 * Also wipes the local SQLite database.
 *
 * Usage: node scripts/cleanup-box-data.js
 *
 * WARNING: This is destructive and irreversible!
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, unlinkSync } from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

// Import BoxWrapperService from the built dist
import { BoxWrapperService } from '../../box-wrapper-service/dist/index.js';

const boxConfigPath = resolve(__dirname, '../', process.env.BOX_CONFIG_PATH || './box_config.json');
const rootFolderId = process.env.BOX_ROOT_FOLDER_ID || '0';

async function main() {
  console.log('=== TaxFlow Box Data Cleanup ===\n');

  // 1. Initialize Box client
  console.log('[1/4] Initializing Box client...');
  const service = new BoxWrapperService({ configPath: boxConfigPath, rootFolderId });
  const client = service.getBoxClient();
  console.log('  ✓ Box client ready\n');

  // 2. Delete all App Users (except the service account itself)
  console.log('[2/4] Fetching all Box users...');
  let deletedUsers = 0;
  let skippedUsers = 0;
  try {
    const allUsers = await client.users.getUsers({
      userType: 'all',
      fields: ['id', 'name', 'login', 'is_platform_access_only', 'external_app_user_id'],
    });
    const entries = allUsers.entries || [];
    console.log(`  Found ${entries.length} user(s)\n`);

    for (const user of entries) {
      // Skip the service account (admin) — it's not platform_access_only
      // and typically has no externalAppUserId
      const extId = user.externalAppUserId || user.external_app_user_id || '';
      const isPlatformUser = user.isPlatformAccessOnly || user.is_platform_access_only;

      // Only delete App Users created by TaxFlow (they have externalAppUserId set)
      if (extId) {
        try {
          console.log(`  Deleting user: ${user.name} (${user.id}) — ${extId.substring(0, 30)}...`);
          await client.users.deleteUserById(user.id, { queryParams: { force: true } });
          deletedUsers++;
          console.log(`    ✓ Deleted`);
        } catch (err) {
          console.error(`    ✗ Failed to delete user ${user.id}: ${err.message}`);
        }
      } else {
        skippedUsers++;
        console.log(`  Skipping: ${user.name} (${user.id}) — service/admin account`);
      }
    }
  } catch (err) {
    console.error(`  Failed to list users: ${err.message}`);
  }
  console.log(`\n  Users deleted: ${deletedUsers}, skipped: ${skippedUsers}\n`);

  // 3. Delete all folders under the root folder
  console.log('[3/4] Cleaning root folder contents...');
  let deletedFolders = 0;
  if (rootFolderId && rootFolderId !== '0') {
    try {
      const items = await client.folders.getFolderItems(rootFolderId);
      const entries = items.entries || [];
      console.log(`  Found ${entries.length} item(s) in root folder ${rootFolderId}\n`);

      for (const item of entries) {
        try {
          if (item.type === 'folder') {
            console.log(`  Deleting folder: ${item.name} (${item.id})`);
            await client.folders.deleteFolderById(item.id, { queryParams: { recursive: true } });
            deletedFolders++;
            console.log(`    ✓ Deleted`);
          } else if (item.type === 'file') {
            console.log(`  Deleting file: ${item.name} (${item.id})`);
            await client.files.deleteFileById(item.id);
            console.log(`    ✓ Deleted`);
          }
        } catch (err) {
          console.error(`    ✗ Failed to delete ${item.type} ${item.id}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`  Failed to list root folder: ${err.message}`);
    }
  } else {
    console.log('  Root folder is "0" (All Files) — skipping folder cleanup.');
    console.log('  Set BOX_ROOT_FOLDER_ID in .env to clean a specific folder.');
  }
  console.log(`\n  Folders deleted: ${deletedFolders}\n`);

  // 4. Delete local SQLite database
  console.log('[4/4] Cleaning local database...');
  const dbPath = resolve(__dirname, '../data/taxflow.db');
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
    console.log(`  ✓ Deleted ${dbPath}\n`);
  } else {
    console.log('  Database already clean\n');
  }

  console.log('=== Cleanup Complete ===');
  console.log(`  Box users deleted: ${deletedUsers}`);
  console.log(`  Box folders deleted: ${deletedFolders}`);
  console.log('  Local DB: wiped');
  console.log('\nRestart your server to recreate the database with fresh migrations.');
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
