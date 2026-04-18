/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('activity_log', (table) => {
    table.text('id').primary();
    table.text('type').notNullable();
    table.text('actor_id').notNullable();
    table.text('actor_name');
    table.text('document_id');
    table.text('document_name');
    table.text('client_id');
    table.text('client_name');
    table.text('description').notNullable();
    table.datetime('timestamp').notNullable();

    table.index('client_id');
    table.index('timestamp');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('activity_log');
}
