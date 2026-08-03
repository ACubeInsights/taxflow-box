/**
 * Schema mode helpers — full (legacy SQLite) vs production/minimal (Box-first Postgres).
 */

import { config } from '../config.js';

/** Legacy 4-table minimal schema (superseded by production). */
export function isMinimalSchema() {
  return config.dbSchema === 'minimal';
}

/** AWS production: auth + operational tables; domain data in Box. */
export function isProductionSchema() {
  return config.dbSchema === 'production';
}

/** Box is system of record for clients, projects, documents (production or minimal). */
export function isBoxFirstSchema() {
  return isMinimalSchema() || isProductionSchema();
}

/** Local dev: all 16 legacy tables in SQLite. */
export function isFullSchema() {
  return !isBoxFirstSchema();
}

/** Returns Knex migrations directory name for the active schema mode. */
export function getMigrationsDirectoryName() {
  if (isProductionSchema()) return 'migrations-production';
  if (isMinimalSchema()) return 'migrations-minimal';
  return 'migrations';
}
