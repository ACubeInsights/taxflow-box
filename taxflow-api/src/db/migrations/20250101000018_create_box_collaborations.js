/**
 * Migration: Create box_collaborations table.
 * Tracks which employees have Box Editor collaboration on which client vaults.
 * Enables adding/revoking access and provides audit trail.
 */

export async function up(knex) {
  await knex.schema.createTable('box_collaborations', (table) => {
    table.text('id').primary();
    table.text('employee_id').notNullable();
    table.text('client_id').notNullable();
    table.text('folder_id').notNullable();
    table.text('box_collaboration_id'); // Box API's collaboration ID for deletion
    table.text('employee_email').notNullable(); // Box email used at time of creation
    table.text('role').notNullable().defaultTo('editor');
    table.text('status').notNullable().defaultTo('active'); // active | revoked | failed
    table.text('created_at').notNullable().defaultTo(knex.fn.now());
    table.text('revoked_at');

    table.unique(['employee_id', 'client_id']);
  });

  await knex.schema.alterTable('box_collaborations', (table) => {
    table.index(['employee_id'], 'idx_box_collabs_employee');
    table.index(['client_id'], 'idx_box_collabs_client');
    table.index(['status'], 'idx_box_collabs_status');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('box_collaborations');
}
