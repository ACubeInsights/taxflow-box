/**
 * Creates the resource_permissions table for granular file/folder access control.
 * Each record maps a client to a resource (file or folder) with a specific access level.
 *
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.createTable('resource_permissions', (table) => {
    table.text('id').primary();
    table.text('client_id').notNullable();
    table.text('resource_id').notNullable();
    table.text('resource_type').notNullable(); // 'file' or 'folder'
    table.text('resource_name').nullable();
    table.text('access_level').notNullable(); // 'no_access','viewer','commenter','writer','delete','all'
    table.text('granted_by').notNullable();
    table.boolean('is_cascaded').defaultTo(false);
    table.text('parent_permission_id').nullable();
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());

    table.unique(['client_id', 'resource_id']);
    table.index('client_id');
    table.index('resource_id');
    table.index(['client_id', 'access_level']);
    table.index('parent_permission_id');
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  return knex.schema.dropTableIfExists('resource_permissions');
}
