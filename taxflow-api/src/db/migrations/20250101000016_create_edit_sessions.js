/**
 * Migration: Create edit_sessions table.
 * Tracks which employee opened which document for editing and when.
 * Provides per-employee audit trail since Box sees all edits as one shared account.
 */

export async function up(knex) {
  await knex.schema.createTable('edit_sessions', (table) => {
    table.text('id').primary();
    table.text('file_id').notNullable();
    table.text('file_name').notNullable();
    table.text('employee_id').notNullable();
    table.text('employee_name').defaultTo('');
    table.text('client_id').defaultTo('');
    table.text('action').notNullable(); // 'open_editor' | 'open_in_box' | 'upload_version'
    table.text('created_at').notNullable();
  });

  await knex.schema.alterTable('edit_sessions', (table) => {
    table.index(['file_id'], 'idx_edit_sessions_file_id');
    table.index(['employee_id'], 'idx_edit_sessions_employee_id');
    table.index(['created_at'], 'idx_edit_sessions_created_at');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('edit_sessions');
}
