/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('projects', (table) => {
    table.text('id').primary();
    table.text('client_id').notNullable().references('id').inTable('clients');
    table.text('name').notNullable();
    table.text('description');
    table.text('status').notNullable().defaultTo('Active');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.datetime('deleted_at').nullable();

    table.index('client_id');
    table.index('status');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('projects');
}
