/**
 * Adds client profile columns to users for gradual migration toward minimal schema.
 * In minimal schema mode these fields are populated at onboarding instead of clients table.
 */

export function up(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.text('external_id').nullable();
    table.text('entity_type').nullable();
    table.text('engagement_status').nullable();
    table.text('box_folder_id').nullable();
  });
}

export function down(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('external_id');
    table.dropColumn('entity_type');
    table.dropColumn('engagement_status');
    table.dropColumn('box_folder_id');
  });
}
