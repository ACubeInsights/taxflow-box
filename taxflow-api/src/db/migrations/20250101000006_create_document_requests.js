/**
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('document_requests', (table) => {
    table.text('id').primary();
    table.text('project_id').notNullable().references('id').inTable('projects');
    table.text('client_id').notNullable().references('id').inTable('clients');
    table.text('name').notNullable();
    table.text('description');
    table.text('document_type').notNullable();
    table.date('due_date').notNullable();
    table.text('priority').notNullable().defaultTo('Medium');
    table.text('status').notNullable().defaultTo('Not_Requested');
    table.text('revision_comments');
    table.text('uploaded_file_name');
    table.text('box_file_id');
    table.integer('version').notNullable().defaultTo(1);
    table.boolean('is_draft').notNullable().defaultTo(false);
    table.text('created_by');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.datetime('deleted_at').nullable();

    table.index('project_id');
    table.index('client_id');
    table.index('status');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('document_requests');
}
