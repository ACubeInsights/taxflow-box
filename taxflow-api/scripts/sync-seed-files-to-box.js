/**
 * Uploads placeholder files to Box for seeded document_requests rows that still
 * use fake IDs (e.g. box-file-d5), then updates box_file_id in SQLite.
 *
 * Usage: node scripts/sync-seed-files-to-box.js
 * Optional: node scripts/sync-seed-files-to-box.js --document-id=d5
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import boxService from '../src/services/boxService.js';
import boxDocumentStatusService from '../src/services/boxDocumentStatusService.js';
import { config } from '../src/config.js';
import { isPlaceholderBoxFileId, isRealBoxFileId } from '../src/utils/boxIds.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const dbPath = resolve(__dirname, '../data/taxflow.db');
const SEED_FOLDER_NAME = 'TaxFlow-Seed-Documents';

const docIdArg = process.argv.find((arg) => arg.startsWith('--document-id='));
const onlyDocumentId = docIdArg?.split('=')[1] || null;

async function getOrCreateSeedFolder() {
  const client = boxService.getBoxClient();
  const rootId = config.boxRootFolderId || '0';
  const items = await client.folders.getFolderItems(rootId);
  const existing = (items.entries || []).find(
    (entry) => entry.type === 'folder' && entry.name === SEED_FOLDER_NAME
  );
  if (existing) return existing.id;

  const created = await client.folders.createFolder({
    name: SEED_FOLDER_NAME,
    parent: { id: rootId },
  });
  return created.id;
}

function buildPlaceholderContent(doc) {
  return [
    'TaxFlow seed document placeholder',
    '',
    `Document: ${doc.name}`,
    `Request ID: ${doc.id}`,
    `Client: ${doc.client_id}`,
    `Project: ${doc.project_id}`,
    `Status: ${doc.status}`,
    `Original filename: ${doc.uploaded_file_name || doc.name}`,
    '',
    `Generated: ${new Date().toISOString()}`,
  ].join('\n');
}

async function findExistingSeedFile(folderId, fileName) {
  const client = boxService.getBoxClient();
  const items = await client.folders.getFolderItems(folderId);
  return (items.entries || []).find((entry) => entry.type === 'file' && entry.name === fileName) || null;
}

async function syncDocument(doc, folderId, db) {
  const fileName = doc.uploaded_file_name || `${doc.name.replace(/[^\w.-]+/g, '_')}.txt`;
  const content = Buffer.from(buildPlaceholderContent(doc), 'utf8');

  let uploaded;
  try {
    uploaded = await boxService.uploadFile(folderId, fileName, content);
  } catch (err) {
    const message = String(err?.message || '');
    if (!message.includes('409') && !message.includes('item_name_in_use')) throw err;
    const existing = await findExistingSeedFile(folderId, fileName);
    if (!existing) throw err;
    uploaded = { id: existing.id, name: existing.name };
    console.log(`  reusing existing Box file for ${doc.id}: ${existing.id}`);
  }

  db.prepare(`
    UPDATE document_requests
    SET box_file_id = ?, updated_at = ?
    WHERE id = ?
  `).run(String(uploaded.id), new Date().toISOString(), doc.id);

  try {
    await boxDocumentStatusService.setFileStatus(uploaded.id, doc.status, {
      requestId: doc.id,
      clientId: doc.client_id,
      documentType: doc.document_type || '',
      engagementId: doc.project_id,
      priority: (doc.priority || 'Medium').toLowerCase(),
      requestName: doc.name,
      dueDate: doc.due_date || undefined,
      description: doc.description || '',
    });
  } catch (metaErr) {
    console.warn(`  metadata warning for ${doc.id}: ${metaErr.message}`);
  }

  return { documentId: doc.id, fileName, boxFileId: uploaded.id };
}

async function main() {
  const db = new Database(dbPath);

  await boxService.initialize();
  const folderId = await getOrCreateSeedFolder();
  console.log(`Using Box folder "${SEED_FOLDER_NAME}" (${folderId})\n`);

  let query = `
    SELECT id, name, description, status, priority, due_date, document_type,
           uploaded_file_name, box_file_id, client_id, project_id
    FROM document_requests
    WHERE box_file_id IS NOT NULL
  `;
  const docs = onlyDocumentId
    ? db.prepare(`${query} AND id = ?`).all(onlyDocumentId)
    : db.prepare(query).all();

  const pending = docs.filter((doc) => isPlaceholderBoxFileId(doc.box_file_id));
  if (!pending.length) {
    console.log('No placeholder box_file_id values found — nothing to sync.');
    if (onlyDocumentId) {
      const row = docs[0];
      if (row && isRealBoxFileId(row.box_file_id)) {
        console.log(`Document ${onlyDocumentId} already linked to Box file ${row.box_file_id}.`);
      } else if (!row) {
        console.log(`Document ${onlyDocumentId} not found.`);
      }
    }
    return;
  }

  console.log(`Syncing ${pending.length} seeded document(s) to Box...\n`);

  for (const doc of pending) {
    try {
      const result = await syncDocument(doc, folderId, db);
      console.log(`✓ ${result.documentId} → ${result.boxFileId} (${result.fileName})`);
    } catch (err) {
      console.error(`✗ ${doc.id}: ${err.message}`);
    }
  }

  console.log('\nDone. Reload the document detail page to preview files in Box.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
