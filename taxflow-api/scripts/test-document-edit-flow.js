/**
 * Test: Employee Document Edit Flow
 *
 * Demonstrates:
 * 1. Upload a document (as if client uploaded)
 * 2. Get preview embed URL (employee views it)
 * 3. Get download URL (employee downloads to edit)
 * 4. Upload new version (employee saves edited version)
 * 5. Verify version history shows both versions
 *
 * Run: node scripts/test-document-edit-flow.js
 *
 * This simulates the real flow:
 * - Client uploads a tax document
 * - Employee opens it for review (via embed preview or download)
 * - Employee makes edits locally
 * - Employee uploads the edited version back to Box
 * - Box maintains version history
 */

import dotenv from 'dotenv';
dotenv.config();

import { config } from '../src/config.js';
import { BoxWrapperService } from '../../box-wrapper-service/dist/index.js';
import { Readable } from 'stream';
import fs from 'fs';

async function main() {
  console.log('══════════════════════════════════════════════════');
  console.log('  Employee Document Edit Flow Test');
  console.log('══════════════════════════════════════════════════\n');

  // Initialize Box
  const service = new BoxWrapperService({
    configPath: config.boxConfigPath,
    rootFolderId: config.boxRootFolderId,
  });
  const client = service.getBoxClient();

  let testFolderId, testFileId;

  try {
    // ─── STEP 1: Create a test folder (simulates client vault) ────
    console.log('1. Creating test folder (simulating client vault)...');
    const folder = await client.folders.createFolder({
      name: 'DocEditTest_' + Date.now(),
      parent: { id: '0' },
    });
    testFolderId = folder.id;
    console.log(`   ✅ Folder: ${folder.name} (ID: ${testFolderId})\n`);

    // ─── STEP 2: Upload a document (simulates client upload) ──────
    console.log('2. Uploading original document (simulating client upload)...');
    const originalContent = `TAX DOCUMENT - W-2 FORM
    
Employee: John Smith
Employer: Acme Corp
Tax Year: 2025
Wages: $85,000
Federal Withholding: $17,000
State Withholding: $4,250

This is the ORIGINAL version uploaded by the client.
Generated: ${new Date().toISOString()}`;

    const stream1 = Readable.from(Buffer.from(originalContent));
    const upload1 = await client.uploads.uploadFile({
      attributes: {
        name: 'W2_JohnSmith_2025.txt',
        parent: { id: testFolderId },
      },
      file: stream1,
    });
    testFileId = upload1.entries[0].id;
    console.log(`   ✅ Original uploaded: ${upload1.entries[0].name} (ID: ${testFileId}, ${upload1.entries[0].size}B)`);
    console.log(`   Version: 1\n`);

    // ─── STEP 3: Employee gets preview/embed URL ──────────────────
    console.log('3. Employee gets preview embed URL...');
    try {
      const fileInfo = await client.files.getFileById(testFileId, {
        queryParams: { fields: 'expiring_embed_link,name,extension' },
      });
      const embedUrl = fileInfo.expiringEmbedLink?.url;
      if (embedUrl) {
        console.log(`   ✅ Embed URL: ${embedUrl.substring(0, 80)}...`);
        console.log(`   (Employee can view this in an iframe in the app)\n`);
      } else {
        console.log(`   ⚠️ No embed link available for this file type`);
        console.log(`   (This is expected for .txt — PDFs and Office docs get embeds)\n`);
      }
    } catch (err) {
      console.log(`   ⚠️ Embed link: ${err.message}\n`);
    }

    // ─── STEP 4: Employee downloads for editing ───────────────────
    console.log('4. Employee gets download URL (to edit locally)...');
    const downloadUrl = await client.downloads.getDownloadFileUrl(testFileId);
    console.log(`   ✅ Download URL: ${downloadUrl.substring(0, 80)}...`);
    console.log(`   (Employee downloads, opens in Word/Excel/etc, edits)\n`);

    // ─── STEP 5: Employee uploads edited version ──────────────────
    console.log('5. Employee uploads edited version (new version)...');
    const editedContent = `TAX DOCUMENT - W-2 FORM (REVIEWED & CORRECTED)
    
Employee: John Smith
Employer: Acme Corp
Tax Year: 2025
Wages: $85,000
Federal Withholding: $17,000
State Withholding: $4,250

REVIEWER NOTES:
- Verified wages match pay stubs ✓
- SSN verified ✓
- Employer EIN confirmed ✓
- Marked as APPROVED

Reviewed by: Sarah Johnson (Employee)
Review date: ${new Date().toISOString()}

This is the EDITED version uploaded by the employee after review.`;

    const stream2 = Readable.from(Buffer.from(editedContent));
    const upload2 = await client.uploads.uploadFileVersion(testFileId, {
      attributes: { name: 'W2_JohnSmith_2025.txt' },
      file: stream2,
    });
    const newVersion = upload2.entries[0];
    console.log(`   ✅ New version uploaded: ${newVersion.name} (${newVersion.size}B)`);
    console.log(`   File ID unchanged: ${newVersion.id}`);
    console.log(`   (Box maintains both versions — original accessible via version history)\n`);

    // ─── STEP 6: Verify version history ───────────────────────────
    console.log('6. Checking version history...');
    const versions = await client.fileVersions.getFileVersions(testFileId);
    const versionCount = (versions.entries || []).length + 1; // +1 for current
    console.log(`   ✅ ${versionCount} versions exist:`);
    console.log(`      - Current (v${versionCount}): Employee's reviewed version`);
    for (const v of (versions.entries || []).reverse()) {
      console.log(`      - v${v.version_number || '1'}: Original client upload (${v.size}B)`);
    }
    console.log('');

    // ─── STEP 7: Get file info (confirm current state) ────────────
    console.log('7. Final file state...');
    const finalFile = await client.files.getFileById(testFileId, {
      queryParams: { fields: 'name,size,modified_at,modified_by' },
    });
    console.log(`   Name: ${finalFile.name}`);
    console.log(`   Size: ${finalFile.size}B`);
    console.log(`   Modified: ${finalFile.modifiedAt}`);
    console.log(`   Modified by: ${finalFile.modifiedBy?.name || 'Service Account'}\n`);

    console.log('══════════════════════════════════════════════════');
    console.log('  ✅ DOCUMENT EDIT FLOW: COMPLETE');
    console.log('══════════════════════════════════════════════════');
    console.log('');
    console.log('  In the real app, this flow works as:');
    console.log('  1. Client uploads via /api/documents/upload');
    console.log('  2. Employee sees file in review dashboard');
    console.log('  3. Employee clicks "Preview" → Box embed/iframe');
    console.log('  4. Employee clicks "Download" → edits locally');
    console.log('  5. Employee clicks "Upload New Version" → POST /api/documents/upload');
    console.log('  6. Version history preserved automatically');
    console.log('');

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.responseInfo) {
      console.error('   Box response:', JSON.stringify(err.responseInfo.body || {}).substring(0, 200));
    }
  } finally {
    // Cleanup
    console.log('--- Cleanup ---');
    if (testFileId) {
      try {
        await client.files.deleteFileById(testFileId);
        console.log(`  Deleted file ${testFileId}`);
      } catch (e) { console.log(`  File cleanup: ${e.message}`); }
    }
    if (testFolderId) {
      try {
        await client.folders.deleteFolderById(testFolderId, { queryParams: { recursive: true } });
        console.log(`  Deleted folder ${testFolderId}`);
      } catch (e) { console.log(`  Folder cleanup: ${e.message}`); }
    }
  }
}

main().catch(console.error);
