/**
 * Migration: Add box_login_email to users table.
 * Stores the employee's free Box account email for collaborator-based editing.
 * Nullable — only employees who need to edit documents in Box need this set.
 */

export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.text('box_login_email');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('box_login_email');
  });
}
