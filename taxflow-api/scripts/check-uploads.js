import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });
import { BoxWrapperService } from '../../box-wrapper-service/dist/index.js';
const svc = new BoxWrapperService({ configPath: resolve(__dirname, '../', process.env.BOX_CONFIG_PATH || './box_config.json'), rootFolderId: '0' });
const client = svc.getBoxClient();

// Uploads folder ID for Astralsage
const uploadsFolderId = '377483685440';
console.log(`Listing Uploads folder (${uploadsFolderId})...`);
const items = await client.folders.getFolderItems(uploadsFolderId);
console.log(`Found ${(items.entries||[]).length} item(s):`);
for (const item of (items.entries||[])) {
  console.log(`  ${item.type}: ${item.name} (${item.id})`);
}
if ((items.entries||[]).length === 0) console.log('  (empty)');

// Also check root folder for any files uploaded to wrong location
console.log('\nListing root of Astral vault (375097491871)...');
const rootItems = await client.folders.getFolderItems('375097491871');
for (const item of (rootItems.entries||[])) {
  console.log(`  ${item.type}: ${item.name} (${item.id})`);
}
