import knex from 'knex';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let db = null;
let cleanupInterval = null;

/**
 * Deletes expired sessions, reset tokens, and approval undo records.
 * Each cleanup runs independently — a failure in one doesn't block others.
 * Errors are logged but don't crash the process.
 */
async function cleanupExpired() {
  const now = new Date().toISOString();

  // Delete expired sessions
  try {
    const deletedSessions = await db('sessions')
      .where('expires_at', '<', now)
      .del();
    if (deletedSessions > 0) {
      logger.info('Cleaned up expired sessions', { count: deletedSessions });
    }
  } catch (err) {
    logger.error('Failed to clean up expired sessions', { error: err.message });
  }

  // Delete expired reset tokens
  try {
    const deletedTokens = await db('reset_tokens')
      .where('expires_at', '<', now)
      .del();
    if (deletedTokens > 0) {
      logger.info('Cleaned up expired reset tokens', { count: deletedTokens });
    }
  } catch (err) {
    logger.error('Failed to clean up expired reset tokens', { error: err.message });
  }

  // Delete expired approval undo records (approved_at older than 10 minutes)
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const deletedUndos = await db('approval_undo')
      .where('approved_at', '<', tenMinutesAgo)
      .del();
    if (deletedUndos > 0) {
      logger.info('Cleaned up expired approval undo records', { count: deletedUndos });
    }
  } catch (err) {
    logger.error('Failed to clean up expired approval undo records', { error: err.message });
  }
}

/**
 * Initializes the Knex instance from environment variables.
 * Tests the connection and runs pending migrations.
 * Starts the periodic cleanup job.
 *
 * @returns {Promise<import('knex').Knex>}
 */
export async function initDatabase() {
  const { dbDialect, databaseUrl, dbPoolMin, dbPoolMax } = config;

  let knexConfig;

  if (dbDialect === 'sqlite') {
    knexConfig = {
      client: 'better-sqlite3',
      connection: {
        filename: databaseUrl,
      },
      useNullAsDefault: true,
      migrations: {
        directory: new URL('./migrations', import.meta.url).pathname,
      },
    };
  } else if (dbDialect === 'postgres') {
    knexConfig = {
      client: 'pg',
      connection: databaseUrl,
      pool: {
        min: dbPoolMin,
        max: dbPoolMax,
      },
      migrations: {
        directory: new URL('./migrations', import.meta.url).pathname,
      },
    };
  } else {
    knexConfig = {
      client: 'better-sqlite3',
      connection: {
        filename: databaseUrl,
      },
      useNullAsDefault: true,
      migrations: {
        directory: new URL('./migrations', import.meta.url).pathname,
      },
    };
  }

  db = knex(knexConfig);

  // Test connection
  try {
    await db.raw('SELECT 1');
    logger.info('Database connection established', { dialect: dbDialect });
  } catch (err) {
    logger.error('Database connection failed', {
      dialect: dbDialect,
      error: err.message,
    });
    process.exit(1);
  }

  // Run pending migrations
  try {
    const [batchNo, migrationLog] = await db.migrate.latest();
    if (migrationLog.length > 0) {
      logger.info('Migrations applied', {
        batch: batchNo,
        count: migrationLog.length,
        migrations: migrationLog,
      });
    } else {
      logger.info('No pending migrations');
    }
  } catch (err) {
    logger.error('Migration failed', { error: err.message });
    process.exit(1);
  }

  // Start periodic cleanup interval (15 minutes)
  cleanupInterval = setInterval(cleanupExpired, 15 * 60 * 1000);

  return db;
}

/**
 * Returns the initialized Knex instance.
 * Throws if called before initDatabase().
 *
 * @returns {import('knex').Knex}
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Gracefully shuts down: stops cleanup interval, drains pool.
 * @returns {Promise<void>}
 */
export async function shutdownDatabase() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  if (db) {
    await db.destroy();
    db = null;
    logger.info('Database connection closed');
  }
}
