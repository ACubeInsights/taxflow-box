#!/usr/bin/env node
/**
 * Cleanup script v2 — Deletes ALL folders in Box root using admin collaboration.
 * For folders owned by deleted users, tries to add collaboration first, then delete.
 * 
 * Usage: node scripts/cleanup-box-folders-v2.js
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

import { BoxWrapperService } from '../../box-wrapper-service/dist/index.js';

const boxConfigPath = resolve(__dirname, '../', process.env.BOX_CONFIG_PATH || './box_config.json');

async function main() {
  console.log('=== Box Folder Cleanup v2 ===\n');

  const service = new BoxWrapperService({ configPath: boxConfigPath, rootFolderId: '0' });
  const client = service.getBoxClient();

  // Get the service account user ID
  const me = await client.users.getUserMe();
  console.log(`Service account: ${me.name} (${me.id})\n`);

  // List all items in root folder
  console.log('Listing root folder contents...\n');
  const items = await client.folders.getFolderItems('0');
  const entries = items.entries || [];
  
  console.log(`Found ${entries.length} item(s):\n`);
  
  let deleted = 0;
  let failed = 0;
  for (const item of entries) {
    console.log(`  ${item.type}: ${item.name} (${item.id})`);
    try {
      if (item.type === 'folder') {
        // Try to update ownership to service account first
        try {
          await client.folders.updateFolderById(item.id, {
            requestBody: { owned_by: { id: me.id } }
          });
        } catch (ownerErr) {
          // Ownership transfer may fail — try direct delete anyway
        }
        await client.folders.deleteFolderById(item.id, { queryParams: { recursive: true } });
        console.log(`    ✓ Deleted`);
        deleted++;
      } else if (item.type === 'file') {
        await client.files.deleteFileById(item.id);
        console.log(`    ✓ Deleted`);
        deleted++;
      }
    } catch (err) {
      // Try adding collaboration and then deleting
      try {
        await client.userCollaborations.createCollaboration({
          item: { type: 'folder', id: item.id },
          accessibleBy: { type: 'user', id: me.id },
          role: 'co-owner',
        });
        await client.folders.deleteFolderById(item.id, { queryParams: { recursive: true } });
        console.log(`    ✓ Deleted (via collaboration)`);
        deleted++;
      } catch (err2) {
        console.error(`    ✗ Failed: ${err.statusCode || err.message}`);
        failed++;
      }
    }
  }

  console.log(`\nDeleted: ${deleted}, Failed: ${failed}`);
  if (failed > 0) {
    console.log('\nSome folders could not be deleted. These may be owned by deleted users.');
    console.log('You can delete them manually from the Box Admin Console → Content Manager.');
  }
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
