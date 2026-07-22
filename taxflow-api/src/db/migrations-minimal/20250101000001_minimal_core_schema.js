/**
 * Minimal production schema — auth and invites only.
 * Clients, projects, and documents live in Box (metadata + folder structure).
 */

export function up(knex) {
  return knex.schema
    .createTable('users', (table) => {
      table.text('id').primary();
      table.text('box_user_id').notNullable().unique();
      table.text('email').notNullable().unique();
      table.text('name').notNullable();
      table.text('role').notNullable();
      table.text('password_hash').notNullable();
      table.text('box_login_email').nullable();
      // Client profile fields (null for staff)
      table.text('external_id').nullable().unique();
      table.text('entity_type').nullable();
      table.text('engagement_status').nullable();
      table.text('box_folder_id').nullable();
      table.datetime('created_at').defaultTo(knex.fn.now());
      table.datetime('updated_at').defaultTo(knex.fn.now());
      table.datetime('deleted_at').nullable();
      table.index('role');
      table.index('engagement_status');
    })
    .createTable('sessions', (table) => {
      table.text('token').primary();
      table.text('user_id').notNullable().references('id').inTable('users');
      table.text('email').notNullable();
      table.text('name').notNullable();
      table.text('role').notNullable();
      table.datetime('expires_at').notNullable();
      table.datetime('created_at').defaultTo(knex.fn.now());
      table.index('user_id');
      table.index('expires_at');
    })
    .createTable('reset_tokens', (table) => {
      table.text('token').primary();
      table.text('email').notNullable();
      table.datetime('expires_at').notNullable();
      table.datetime('created_at').defaultTo(knex.fn.now());
      table.index('expires_at');
    })
    .createTable('invite_records', (table) => {
      table.text('id').primary();
      table.text('client_name').notNullable();
      table.text('email').notNullable();
      table.text('external_id').notNullable();
      table.text('employee_email').notNullable();
      table.text('financial_year').notNullable();
      table.text('status').notNullable().defaultTo('pending_invite');
      table.integer('delivery_failure_flag').notNullable().defaultTo(0);
      table.integer('resend_count').notNullable().defaultTo(0);
      table.datetime('last_resend_at').nullable();
      table.datetime('token_expires_at').notNullable();
      table.datetime('created_at').defaultTo(knex.fn.now());
      table.datetime('updated_at').defaultTo(knex.fn.now());
      table.index('email');
      table.index('employee_email');
      table.index('status');
    });
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('invite_records')
    .dropTableIfExists('reset_tokens')
    .dropTableIfExists('sessions')
    .dropTableIfExists('users');
}
