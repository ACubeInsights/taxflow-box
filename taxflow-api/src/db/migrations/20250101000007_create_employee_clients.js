/**
 * This migration drops the employee_clients table.
 * Employee-client assignment has been removed — all employees can now access all clients.
 *
 * @param {import('knex').Knex} knex
 */
export function up(knex) {
  return knex.schema.dropTableIfExists('employee_clients');
}

/**
 * @param {import('knex').Knex} knex
 */
export function down(knex) {
  // No-op: we no longer create this table
  return Promise.resolve();
}
