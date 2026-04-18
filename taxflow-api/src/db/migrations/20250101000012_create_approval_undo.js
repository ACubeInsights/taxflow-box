/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('approval_undo', (table) => {
    table.text('document_id').primary();
    table.datetime('approved_at').notNullable();
    table.datetime('created_at').defaultTo(knex.fn.now());
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('approval_undo');
}
