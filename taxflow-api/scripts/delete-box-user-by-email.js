#!/usr/bin/env node
/**
 * Deletes a Box App User by email.
 * Usage: node scripts/delete-box-user-by-email.js <email>
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

import { BoxWrapperService } from '../../box-wrapper-service/dist/index.js';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/delete-box-user-by-email.js <email>');
  process.exit(1);
}

const boxConfigPath = resolve(__dirname, '../', process.env.BOX_CONFIG_PATH || './box_config.json');

async function main() {
  const service = new BoxWrapperService({ configPath: boxConfigPath, rootFolderId: '0' });
  const client = service.getBoxClient();

  const allUsers = await client.users.getUsers({
    userType: 'all',
    fields: ['id', 'name', 'login', 'external_app_user_id'],
  });

  const target = (allUsers.entries || []).find((u) => {
    const extId = u.externalAppUserId || u.external_app_user_id || '';
    const match = extId.match(/\|em:([^|]+)/);
    const storedEmail = match ? match[1] : '';
    return storedEmail.toLowerCase() === email.toLowerCase() || (u.login || '').toLowerCase() === email.toLowerCase();
  });

  if (!target) {
    console.log(`No Box user found with email: ${email}`);
    process.exit(0);
  }

  console.log(`Found: ${target.name} (${target.id})`);
  await client.users.deleteUserById(target.id, { queryParams: { force: true } });
  console.log(`✓ Deleted`);
}

main().catch((err) => { console.error('Failed:', err.message); process.exit(1); });
