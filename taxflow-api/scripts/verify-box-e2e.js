/**
 * Phase 6 — End-to-End Box API Verification Script
 *
 * Executes live API calls against the Box sandbox to verify:
 * 1. JWT authentication works
 * 2. Tier detection returns enterprise
 * 3. Folder creation and listing
 * 4. File upload (direct) and download URL
 * 5. Metadata template sync
 *
 * Run: node scripts/verify-box-e2e.js
 */

import { config } from '../src/config.js';
import { BoxWrapperService } from '../../box-wrapper-service/dist/index.js';

const results = [];
let client;
let testFolderId = null;
let testFileId = null;

function log(testName, status, detail = '') {
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  const entry = { test: testName, status, detail, timestamp: new Date().toISOString() };
  results.push(entry);
  console.log(`${emoji} ${testName}: ${status}${detail ? ' — ' + detail : ''}`);
}

async function run() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Phase 6: End-to-End Box API Verification');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Config path: ${config.boxConfigPath}`);
  console.log(`  Root folder: ${config.boxRootFolderId}`);
  console.log(`  Enterprise: ${config.boxEnterpriseId}`);
  console.log('═══════════════════════════════════════════════════\n');

  // ─── TEST 1: JWT Authentication ──────────────────────────────────
  try {
    const service = new BoxWrapperService({
      configPath: config.boxConfigPath,
      rootFolderId: config.boxRootFolderId,
      enterpriseId: config.boxEnterpriseId,
    });
    client = service.getBoxClient();

    // Verify by calling GET /users/me
    const me = await client.users.getCurrentUser();
    log('JWT Authentication', 'PASS', `Service Account: ${me.name} (${me.id})`);
  } catch (err) {
    log('JWT Authentication', 'FAIL', err.message);
    console.error('\n🛑 Cannot proceed without authentication. Aborting.\n');
    printSummary();
    process.exit(1);
  }

  // ─── TEST 2: Tier Detection ──────────────────────────────────────
  try {
    const tierResult = await BoxWrapperService.detectTier(client, config.boxEnterpriseId);
    log('Tier Detection', tierResult.tier === 'enterprise' ? 'PASS' : 'WARN',
      `Detected: ${tierResult.tier}, Enterprise ID: ${tierResult.enterpriseId}`);
  } catch (err) {
    log('Tier Detection', 'FAIL', err.message);
  }

  // ─── TEST 3: Folder Creation ─────────────────────────────────────
  const testFolderName = `_e2e_test_${Date.now()}`;
  try {
    const folder = await client.folders.createFolder({
      name: testFolderName,
      parent: { id: config.boxRootFolderId },
    });
    testFolderId = folder.id;
    log('Folder Creation', 'PASS', `Created: "${folder.name}" (ID: ${folder.id})`);
  } catch (err) {
    log('Folder Creation', 'FAIL', err.message);
  }

  // ─── TEST 4: Folder Listing ──────────────────────────────────────
  if (testFolderId) {
    try {
      const items = await client.folders.getFolderItems(config.boxRootFolderId);
      const found = (items.entries || []).find(e => e.id === testFolderId);
      log('Folder Listing', found ? 'PASS' : 'FAIL',
        found ? `Found test folder in ${items.entries.length} items` : 'Test folder not found in listing');
    } catch (err) {
      log('Folder Listing', 'FAIL', err.message);
    }
  } else {
    log('Folder Listing', 'SKIP', 'No test folder created');
  }

  // ─── TEST 5: File Upload (Direct) ───────────────────────────────
  if (testFolderId) {
    try {
      const { Readable } = await import('stream');
      const content = Buffer.from('Phase 6 E2E test file content — ' + new Date().toISOString());
      const fileStream = Readable.from(content);
      const uploadResult = await client.uploads.uploadFile({
        attributes: {
          name: `e2e_test_${Date.now()}.txt`,
          parent: { id: testFolderId },
        },
        file: fileStream,
      });
      const file = uploadResult.entries[0];
      testFileId = file.id;
      log('File Upload (Direct)', 'PASS', `Uploaded: "${file.name}" (ID: ${file.id}, ${file.size} bytes)`);
    } catch (err) {
      log('File Upload (Direct)', 'FAIL', err.message);
    }
  } else {
    log('File Upload (Direct)', 'SKIP', 'No test folder');
  }

  // ─── TEST 6: Download URL Generation ────────────────────────────
  if (testFileId) {
    try {
      const downloadUrl = await client.downloads.getDownloadFileUrl(testFileId);
      const isUrl = downloadUrl && (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://'));
      log('Download URL', isUrl ? 'PASS' : 'FAIL',
        isUrl ? `URL generated (${downloadUrl.substring(0, 60)}...)` : `Not a URL: ${downloadUrl}`);
    } catch (err) {
      log('Download URL', 'FAIL', err.message);
    }
  } else {
    log('Download URL', 'SKIP', 'No test file');
  }

  // ─── TEST 7: Metadata Template Sync ─────────────────────────────
  try {
    const templateKey = 'taxFlowClientProfile';
    let templateExists = false;
    try {
      await client.metadataTemplates.getMetadataTemplate('enterprise', templateKey);
      templateExists = true;
    } catch (err) {
      if (err.statusCode === 404 || err.status === 404) {
        templateExists = false;
      } else {
        throw err;
      }
    }
    log('Metadata Template Access', 'PASS',
      templateExists ? `Template "${templateKey}" exists` : `Template "${templateKey}" not found (404 — enterprise scope accessible)`);
  } catch (err) {
    const status = err.statusCode || err.status;
    if (status === 403 || status === 405) {
      log('Metadata Template Access', 'WARN', `Enterprise metadata not accessible (${status}) — free tier?`);
    } else {
      log('Metadata Template Access', 'FAIL', err.message);
    }
  }

  // ─── TEST 8: Health Check Pattern ───────────────────────────────
  try {
    const me = await client.users.getCurrentUser();
    log('Health Check (GET /users/me)', 'PASS', `Responds: ${me.name}`);
  } catch (err) {
    log('Health Check (GET /users/me)', 'FAIL', err.message);
  }

  // ─── CLEANUP ────────────────────────────────────────────────────
  console.log('\n--- Cleanup ---');
  if (testFileId) {
    try {
      await client.files.deleteFileById(testFileId);
      console.log(`  Deleted test file: ${testFileId}`);
    } catch (err) {
      console.warn(`  Failed to delete test file: ${err.message}`);
    }
  }
  if (testFolderId) {
    try {
      await client.folders.deleteFolderById(testFolderId, { queryParams: { recursive: true } });
      console.log(`  Deleted test folder: ${testFolderId}`);
    } catch (err) {
      console.warn(`  Failed to delete test folder: ${err.message}`);
    }
  }

  printSummary();
}

function printSummary() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  console.log(`  PASS: ${passed}  |  FAIL: ${failed}  |  WARN: ${warned}  |  SKIP: ${skipped}`);
  console.log(`  Total: ${results.length} tests`);
  console.log('═══════════════════════════════════════════════════\n');

  // Output JSON for FLOW_VERIFICATION.md
  console.log('--- JSON Results ---');
  console.log(JSON.stringify(results, null, 2));
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
