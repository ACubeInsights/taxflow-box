/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('sessions', (table) => {
    table.text('token').primary();
    table.text('user_id').notNullable().references('id').inTable('users');
    table.text('email');
    table.text('name');
    table.text('role');
    table.datetime('expires_at').notNullable();
    table.datetime('created_at').defaultTo(knex.fn.now());

    table.index('expires_at');
    table.index('user_id');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('sessions');
}
