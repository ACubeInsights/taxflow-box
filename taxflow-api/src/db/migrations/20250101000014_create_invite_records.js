/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('invite_records', (table) => {
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

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('invite_records');
}
