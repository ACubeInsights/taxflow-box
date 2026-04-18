/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('users', (table) => {
    table.text('id').primary();
    table.text('box_user_id').notNullable().unique();
    table.text('email').notNullable().unique();
    table.text('name').notNullable();
    table.text('role').notNullable();
    table.text('password_hash').notNullable();
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.datetime('deleted_at').nullable();
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('users');
}
