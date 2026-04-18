export function up(knex) {
  return knex.schema.alterTable('client_vaults', (table) => {
    table.text('projects_folder_id');
  });
}

export function down(knex) {
  return knex.schema.alterTable('client_vaults', (table) => {
    table.dropColumn('projects_folder_id');
  });
}
