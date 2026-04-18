#!/usr/bin/env node
/**
 * Cleanup script — Lists and deletes ALL folders in the Box root folder (folder 0).
 * 
 * Usage: node scripts/cleanup-box-folders.js
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
  console.log('=== Box Folder Cleanup ===\n');

  const service = new BoxWrapperService({ configPath: boxConfigPath, rootFolderId: '0' });
  const client = service.getBoxClient();

  // List all items in root folder (folder 0)
  console.log('Listing root folder contents...\n');
  const items = await client.folders.getFolderItems('0');
  const entries = items.entries || [];
  
  console.log(`Found ${entries.length} item(s):\n`);
  
  let deleted = 0;
  for (const item of entries) {
    console.log(`  ${item.type}: ${item.name} (${item.id})`);
    try {
      if (item.type === 'folder') {
        await client.folders.deleteFolderById(item.id, { queryParams: { recursive: true } });
        console.log(`    ✓ Deleted folder`);
        deleted++;
      } else if (item.type === 'file') {
        await client.files.deleteFileById(item.id);
        console.log(`    ✓ Deleted file`);
        deleted++;
      }
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}`);
    }
  }

  console.log(`\nDeleted ${deleted} item(s). Box is now clean.`);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
