/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('clients', (table) => {
    table.text('id').primary();
    table.text('name').notNullable();
    table.text('email').notNullable().unique();
    table.text('entity_type').notNullable();
    table.text('engagement_status').notNullable().defaultTo('Active');
    table.text('box_folder_id');
    table.text('box_user_id');
    table.text('external_id');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.datetime('deleted_at').nullable();

    table.index('engagement_status');
    table.index('entity_type');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('clients');
}
