/**
 * Schema mode helpers — full (legacy SQLite) vs minimal (Postgres 4-table).
 */

import { config } from '../config.js';

export function isMinimalSchema() {
  return config.dbSchema === 'minimal';
}

export function isFullSchema() {
  return !isMinimalSchema();
}
