/**
 * Production schema — Box-first Postgres (11 tables).
 * Domain data (clients, projects, documents, permissions, vaults) lives in Box.
 */

export async function up(knex) {
  await knex.schema.createTable('users', (table) => {
    table.text('id').primary();
    table.text('box_user_id').notNullable().unique();
    table.text('email').notNullable().unique();
    table.text('name').notNullable();
    table.text('role').notNullable();
    table.text('password_hash').notNullable();
    table.text('box_login_email').nullable();
    table.text('external_id').nullable().unique();
    table.text('entity_type').nullable();
    table.text('engagement_status').nullable();
    table.text('box_folder_id').nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.index('role');
    table.index('engagement_status');
  });

  await knex.schema.createTable('sessions', (table) => {
    table.text('token').primary();
    table.text('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('email').notNullable();
    table.text('name').notNullable();
    table.text('role').notNullable();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.index('user_id');
    table.index('expires_at');
  });

  await knex.schema.createTable('reset_tokens', (table) => {
    table.text('token').primary();
    table.text('email').notNullable();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.index('expires_at');
  });

  await knex.schema.createTable('invite_records', (table) => {
    table.text('id').primary();
    table.text('client_name').notNullable();
    table.text('email').notNullable();
    table.text('external_id').notNullable();
    table.text('employee_email').notNullable();
    table.text('financial_year').notNullable();
    table.text('status').notNullable().defaultTo('pending_invite');
    table.boolean('delivery_failure_flag').notNullable().defaultTo(false);
    table.integer('resend_count').notNullable().defaultTo(0);
    table.timestamp('last_resend_at', { useTz: true }).nullable();
    table.timestamp('token_expires_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.index('email');
    table.index('employee_email');
    table.index('status');
  });

  await knex.schema.createTable('comments', (table) => {
    table.text('id').primary();
    table.text('document_id').notNullable();
    table.text('type').notNullable();
    table.text('author_id').notNullable();
    table.text('author_name').nullable();
    table.text('text').notNullable();
    table.text('mentions').nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('edited_at', { useTz: true }).nullable();
    table.index('document_id');
    table.index(['document_id', 'created_at']);
  });

  await knex.schema.createTable('notifications', (table) => {
    table.text('id').primary();
    table.text('recipient_id').notNullable();
    table.text('event_type').notNullable();
    table.text('message').notNullable();
    table.text('document_id').nullable();
    table.text('comment_id').nullable();
    table.text('deep_link_url').nullable();
    table.boolean('read').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.index('recipient_id');
    table.index('created_at');
    table.index(['recipient_id', 'read', 'created_at']);
  });

  await knex.schema.createTable('activity_log', (table) => {
    table.text('id').primary();
    table.text('type').notNullable();
    table.text('actor_id').notNullable();
    table.text('actor_name').nullable();
    table.text('document_id').nullable();
    table.text('document_name').nullable();
    table.text('client_id').nullable();
    table.text('client_name').nullable();
    table.text('description').notNullable();
    table.timestamp('timestamp', { useTz: true }).notNullable();
    table.index('client_id');
    table.index('timestamp');
  });

  await knex.schema.createTable('webhook_keys', (table) => {
    table.text('folder_id').primary();
    table.text('webhook_id').notNullable();
    table.text('primary_key').notNullable();
    table.text('secondary_key').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('approval_undo', (table) => {
    table.text('document_id').primary();
    table.timestamp('approved_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('box_collaborations', (table) => {
    table.text('id').primary();
    table.text('employee_id').notNullable();
    table.text('client_id').notNullable();
    table.text('folder_id').notNullable();
    table.text('box_collaboration_id').nullable();
    table.text('employee_email').notNullable();
    table.text('role').notNullable().defaultTo('editor');
    table.text('status').notNullable().defaultTo('active');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('revoked_at', { useTz: true }).nullable();
    table.unique(['employee_id', 'client_id']);
    table.index(['employee_id']);
    table.index(['client_id']);
    table.index(['status']);
  });

  await knex.schema.createTable('edit_sessions', (table) => {
    table.text('id').primary();
    table.text('file_id').notNullable();
    table.text('file_name').notNullable();
    table.text('employee_id').notNullable();
    table.text('employee_name').defaultTo('');
    table.text('client_id').defaultTo('');
    table.text('action').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable();
    table.index(['file_id']);
    table.index(['employee_id']);
    table.index(['created_at']);
  });
}

export async function down(knex) {
  await knex.schema
    .dropTableIfExists('edit_sessions')
    .dropTableIfExists('box_collaborations')
    .dropTableIfExists('approval_undo')
    .dropTableIfExists('webhook_keys')
    .dropTableIfExists('activity_log')
    .dropTableIfExists('notifications')
    .dropTableIfExists('comments')
    .dropTableIfExists('invite_records')
    .dropTableIfExists('reset_tokens')
    .dropTableIfExists('sessions')
    .dropTableIfExists('users');
}
