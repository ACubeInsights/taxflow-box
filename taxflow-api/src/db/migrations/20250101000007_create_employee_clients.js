/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('employee_clients', (table) => {
    table.text('id').primary();
    table.text('employee_id').notNullable().references('id').inTable('users');
    table.text('client_id').notNullable().references('id').inTable('clients');
    table.datetime('assigned_at').notNullable();

    table.unique(['employee_id', 'client_id']);
    table.index('employee_id');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('employee_clients');
}
