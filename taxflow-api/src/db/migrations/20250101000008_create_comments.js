/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('comments', (table) => {
    table.text('id').primary();
    table.text('document_id').notNullable();
    table.text('type').notNullable();
    table.text('author_id').notNullable();
    table.text('author_name');
    table.text('text').notNullable();
    table.text('mentions');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('edited_at').nullable();

    table.index('document_id');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('comments');
}
