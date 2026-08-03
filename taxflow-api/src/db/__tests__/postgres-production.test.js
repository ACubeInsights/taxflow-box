/**
 * Postgres production schema integration test.
 * Requires a running Postgres instance (see docker-compose.postgres.yml).
 *
 * Run:
 *   docker compose -f docker-compose.postgres.yml up -d
 *   INTEGRATION_POSTGRES_URL=postgresql://taxflow:taxflow_dev@localhost:5432/taxflow npm run test:postgres
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import knex from 'knex';
import crypto from 'crypto';
import { hashPassword } from '../../utils/authUtils.js';
import path from 'path';
import { fileURLToPath } from 'url';

const connectionUrl = process.env.INTEGRATION_POSTGRES_URL;
const describeIf = connectionUrl ? describe : describe.skip;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '../migrations-production');

describeIf('production schema on Postgres', () => {
  /** @type {import('knex').Knex} */
  let db;

  beforeAll(async () => {
    db = knex({
      client: 'pg',
      connection: connectionUrl,
      migrations: { directory: migrationsDir },
    });
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  }, 60000);

  afterAll(async () => {
    if (db) await db.destroy();
  });

  it('creates all 11 production tables', async () => {
    const tables = await db.raw(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const names = tables.rows.map((r) => r.table_name);
    expect(names).toContain('users');
    expect(names).toContain('sessions');
    expect(names).toContain('reset_tokens');
    expect(names).toContain('invite_records');
    expect(names).toContain('comments');
    expect(names).toContain('notifications');
    expect(names).toContain('activity_log');
    expect(names).toContain('webhook_keys');
    expect(names).toContain('approval_undo');
    expect(names).toContain('box_collaborations');
    expect(names).toContain('edit_sessions');
    expect(names).not.toContain('clients');
    expect(names).not.toContain('document_requests');
  });

  it('supports auth user insert and session FK', async () => {
    const passwordHash = await hashPassword('TestPass123!');
    const userId = crypto.randomUUID();

    await db('users').insert({
      id: userId,
      box_user_id: `box-${userId}`,
      email: `integration-${userId}@test.local`,
      name: 'Integration User',
      role: 'employee',
      password_hash: passwordHash,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const token = `sess-${userId}`;
    await db('sessions').insert({
      token,
      user_id: userId,
      email: `integration-${userId}@test.local`,
      name: 'Integration User',
      role: 'employee',
      expires_at: new Date(Date.now() + 3600000),
      created_at: new Date(),
    });

    const session = await db('sessions').where({ token }).first();
    expect(session.user_id).toBe(userId);

    await db('sessions').where({ token }).del();
    await db('users').where({ id: userId }).del();
  });

  it('stores boolean invite delivery_failure_flag', async () => {
    const id = crypto.randomUUID();
    await db('invite_records').insert({
      id,
      client_name: 'Test Co',
      email: 'invite@test.local',
      external_id: 'ext-1',
      employee_email: 'emp@test.local',
      financial_year: '2025',
      delivery_failure_flag: false,
      resend_count: 0,
      token_expires_at: new Date(Date.now() + 86400000),
      created_at: new Date(),
      updated_at: new Date(),
    });

    const row = await db('invite_records').where({ id }).first();
    expect(row.delivery_failure_flag).toBe(false);
    await db('invite_records').where({ id }).del();
  });
});
