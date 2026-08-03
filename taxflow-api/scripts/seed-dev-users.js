/**
 * Seeds local dev login accounts with real bcrypt passwords.
 * Safe to re-run — uses upsert by email.
 *
 * Usage: node scripts/seed-dev-users.js
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { hashPassword } from '../src/utils/authUtils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const dbPath = resolve(__dirname, '../data/taxflow.db');

const DEV_USERS = [
  {
    id: '66d9ad48-08a5-4866-8415-674f2a5dd8d0',
    email: 'employee01@gmail.com',
    name: 'Employee One',
    role: 'employee',
    password: 'Employee01',
    box_user_id: 'box-user-employee01',
  },
  {
    id: 'superadmin-1',
    email: 'admin@taxflowpro.com',
    name: 'Super Admin',
    role: 'superadmin',
    password: 'Admin123!',
    box_user_id: 'box-user-superadmin-1',
  },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed dev users while NODE_ENV=production');
    process.exit(1);
  }

  const db = new Database(dbPath);
  const now = new Date().toISOString();

  for (const user of DEV_USERS) {
    const password_hash = await hashPassword(user.password);
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(user.email);

    if (existing) {
      db.prepare(`
        UPDATE users SET
          name = ?, role = ?, password_hash = ?, box_user_id = ?, updated_at = ?
        WHERE id = ?
      `).run(user.name, user.role, password_hash, user.box_user_id, now, existing.id);
      console.log(`Updated: ${user.email} (password: ${user.password})`);
    } else {
      db.prepare(`
        INSERT INTO users (id, box_user_id, email, name, role, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.id,
        user.box_user_id,
        user.email.toLowerCase(),
        user.name,
        user.role,
        password_hash,
        now,
        now
      );
      console.log(`Created: ${user.email} (password: ${user.password})`);
    }
  }

  console.log('\nDev accounts ready. Login at http://localhost:5173');
  console.log('  employee01@gmail.com / Employee01');
  console.log('  admin@taxflowpro.com / Admin123!');
  console.log('\nOr use "Demo accounts" on the login screen (requires ALLOW_MOCK_AUTH=true).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
