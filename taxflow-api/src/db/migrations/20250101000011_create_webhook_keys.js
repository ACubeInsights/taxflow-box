/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('webhook_keys', (table) => {
    table.text('folder_id').primary();
    table.text('webhook_id').notNullable();
    table.text('primary_key').notNullable();
    table.text('secondary_key').notNullable();
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('webhook_keys');
}
