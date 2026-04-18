/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('notifications', (table) => {
    table.text('id').primary();
    table.text('recipient_id').notNullable();
    table.text('event_type').notNullable();
    table.text('message').notNullable();
    table.text('document_id');
    table.text('comment_id');
    table.text('deep_link_url');
    table.boolean('read').notNullable().defaultTo(false);
    table.datetime('created_at').defaultTo(knex.fn.now());

    table.index('recipient_id');
    table.index('created_at');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('notifications');
}
