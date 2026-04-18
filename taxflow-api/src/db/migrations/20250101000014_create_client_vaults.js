export function up(knex) {
  return knex.schema.createTable('client_vaults', (table) => {
    table.text('id').primary();
    table.text('client_id').notNullable().references('id').inTable('clients');
    table.text('financial_year').notNullable();
    table.text('root_folder_id').notNullable();
    table.text('year_folder_id').notNullable();
    table.text('tax_folder_id');
    table.text('uploads_folder_id').notNullable();
    table.text('supporting_docs_folder_id');
    table.text('signed_documents_folder_id');
    table.text('internal_notes_folder_id');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.unique(['client_id', 'financial_year']);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('client_vaults');
}
