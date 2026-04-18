import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

import { BoxWrapperService } from '../../box-wrapper-service/dist/index.js';

const boxConfigPath = resolve(__dirname, '../', process.env.BOX_CONFIG_PATH || './box_config.json');
const dbPath = resolve(__dirname, '../data/taxflow.db');

async function createOrReuse(client, name, parentId) {
  try {
    const f = await client.folders.createFolder({ name, parent: { id: parentId } });
    console.log(`  Created: ${name} (${f.id})`);
    return f;
  } catch (err) {
    const status = err.statusCode || err.responseInfo?.statusCode || err.status;
    if (status === 409) {
      // Extract conflict folder ID from error response
      const conflicts = err.responseInfo?.body?.context_info?.conflicts || [];
      if (conflicts.length > 0) {
        console.log(`  Reused (from conflict): ${name} (${conflicts[0].id})`);
        return conflicts[0];
      }
      // Fallback: list parent children
      const items = await client.folders.getFolderItems(parentId);
      const existing = (items.entries||[]).find(i => i.type === 'folder' && i.name === name);
      if (existing) { console.log(`  Reused: ${name} (${existing.id})`); return existing; }
    }
    throw err;
  }
}

async function main() {
  const svc = new BoxWrapperService({ configPath: boxConfigPath, rootFolderId: '0' });
  const client = svc.getBoxClient();

  // Find root folder
  const rootItems = await client.folders.getFolderItems('0');
  const root = (rootItems.entries||[]).find(i => i.type === 'folder' && i.name?.includes('Astral'));
  if (!root) { console.log('No Astral folder found'); return; }
  console.log(`Root: ${root.name} (${root.id})`);

  // Find or create year folder
  const year = await createOrReuse(client, '2026', root.id);
  
  // Find or create Projects folder
  const projects = await createOrReuse(client, 'Projects', year.id);
  
  // Find or create 5 subfolders
  const tax = await createOrReuse(client, 'Tax', projects.id);
  const uploads = await createOrReuse(client, 'Uploads', projects.id);
  const supportingDocs = await createOrReuse(client, 'SupportingDocs', projects.id);
  const signedDocs = await createOrReuse(client, 'SignedDocuments', projects.id);
  const internalNotes = await createOrReuse(client, 'InternalNotes', projects.id);

  // Update DB vault
  const db = new Database(dbPath);
  db.prepare(`UPDATE client_vaults SET 
    root_folder_id = ?, year_folder_id = ?, projects_folder_id = ?,
    tax_folder_id = ?, uploads_folder_id = ?, supporting_docs_folder_id = ?,
    signed_documents_folder_id = ?, internal_notes_folder_id = ?, updated_at = ?
    WHERE client_id = '47dcd0fc-5bba-4e2b-9ebd-b8906733fdc8'`).run(
    root.id, year.id, projects.id, tax.id, uploads.id, supportingDocs.id, signedDocs.id, internalNotes.id,
    new Date().toISOString()
  );
  db.close();
  
  console.log('\nVault updated with all folder IDs. Client is ready.');
}

main().catch(err => { console.error(err); process.exit(1); });
