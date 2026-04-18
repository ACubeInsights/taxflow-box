/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('reset_tokens', (table) => {
    table.text('token').primary();
    table.text('email').notNullable();
    table.datetime('expires_at').notNullable();
    table.datetime('created_at').defaultTo(knex.fn.now());

    table.index('expires_at');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('reset_tokens');
}
