import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

import { BoxWrapperService } from '../../box-wrapper-service/dist/index.js';

const boxConfigPath = resolve(__dirname, '../', process.env.BOX_CONFIG_PATH || './box_config.json');
const dbPath = resolve(__dirname, '../data/taxflow.db');

async function main() {
  const svc = new BoxWrapperService({ configPath: boxConfigPath, rootFolderId: '0' });
  const client = svc.getBoxClient();

  // Find the Box user
  const users = await client.users.getUsers({ userType: 'all', fields: ['id','name','external_app_user_id'] });
  const astral = (users.entries||[]).find(u => {
    const ext = u.externalAppUserId || u.external_app_user_id || '';
    return ext.includes('sageastral14@gmail.com');
  });
  
  if (!astral) { console.log('No Box user found'); return; }
  console.log(`Box user: ${astral.name} (${astral.id})`);

  // Find the vault folder
  const rootItems = await client.folders.getFolderItems('0');
  const vaultFolder = (rootItems.entries||[]).find(i => 
    i.type === 'folder' && i.name && i.name.includes('Astral')
  );
  
  let rootId = null, yearId = null, projectsId = null;
  let taxId = null, uploadsId = null, supportingDocsId = null, signedDocsId = null, internalNotesId = null;

  if (vaultFolder) {
    rootId = vaultFolder.id;
    console.log(`Root folder: ${vaultFolder.name} (${rootId})`);
    
    const rootChildren = await client.folders.getFolderItems(rootId);
    const yearFolder = (rootChildren.entries||[]).find(i => i.type === 'folder');
    if (yearFolder) {
      yearId = yearFolder.id;
      console.log(`Year folder: ${yearFolder.name} (${yearId})`);
      
      const yearChildren = await client.folders.getFolderItems(yearId);
      const projFolder = (yearChildren.entries||[]).find(i => i.type === 'folder' && i.name === 'Projects');
      if (projFolder) {
        projectsId = projFolder.id;
        console.log(`Projects folder: ${projFolder.name} (${projectsId})`);
        
        const projChildren = await client.folders.getFolderItems(projectsId);
        for (const item of (projChildren.entries||[])) {
          if (item.type !== 'folder') continue;
          if (item.name === 'Tax') taxId = item.id;
          if (item.name === 'Uploads') uploadsId = item.id;
          if (item.name === 'SupportingDocs') supportingDocsId = item.id;
          if (item.name === 'SignedDocuments') signedDocsId = item.id;
          if (item.name === 'InternalNotes') internalNotesId = item.id;
          console.log(`  ${item.name}: ${item.id}`);
        }
      }
    }
  }

  // Insert into DB
  const db = new Database(dbPath);
  const now = new Date().toISOString();
  const clientId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const empId = '66d9ad48-08a5-4866-8415-674f2a5dd8d0'; // Employee01

  db.exec('BEGIN');
  try {
    db.prepare(`INSERT INTO clients (id, name, email, entity_type, engagement_status, box_user_id, external_id, box_folder_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      clientId, 'Astralsage', 'sageastral14@gmail.com', 'Individual', 'Active', astral.id, 'Astral', rootId, now, now
    );
    console.log(`Client created: ${clientId}`);

    db.prepare(`INSERT INTO projects (id, client_id, name, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      projectId, clientId, '2026 Tax Return', 'Tax filing for Astralsage', 'Active', now, now
    );
    console.log(`Project created: ${projectId}`);

    db.prepare(`INSERT OR IGNORE INTO employee_clients (id, employee_id, client_id, assigned_at)
      VALUES (?, ?, ?, ?)`).run(`ec-emp01-${clientId}`, empId, clientId, now);
    console.log(`Assigned to Employee01`);

    if (rootId) {
      const vaultId = crypto.randomUUID();
      db.prepare(`INSERT INTO client_vaults (id, client_id, financial_year, root_folder_id, year_folder_id, projects_folder_id, tax_folder_id, uploads_folder_id, supporting_docs_folder_id, signed_documents_folder_id, internal_notes_folder_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        vaultId, clientId, '2026', rootId, yearId, projectsId, taxId, uploadsId || rootId, supportingDocsId, signedDocsId, internalNotesId, now, now
      );
      console.log(`Vault created: ${vaultId}`);
    }

    db.exec('COMMIT');
    console.log('\nDone! Astralsage is now fully registered.');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Failed:', err.message);
  }
  db.close();
}

main().catch(err => { console.error(err); process.exit(1); });
