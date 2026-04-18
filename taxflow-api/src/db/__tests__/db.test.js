import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the module by importing and exercising the three exported functions
// against an in-memory SQLite database (no migrations directory needed for basic tests).

describe('db module', () => {
  let dbModule;

  beforeEach(async () => {
    // Fresh import each test to reset module-level state
    vi.resetModules();
    // Mock config to use in-memory SQLite
    vi.doMock('../../config.js', () => ({
      config: {
        dbDialect: 'sqlite',
        databaseUrl: ':memory:',
        dbPoolMin: 2,
        dbPoolMax: 10,
      },
    }));
    // Mock logger to suppress output during tests
    vi.doMock('../../utils/logger.js', () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));
    dbModule = await import('../db.js');
  });

  afterEach(async () => {
    try {
      await dbModule.shutdownDatabase();
    } catch {
      // ignore if already shut down
    }
  });

  describe('initDatabase', () => {
    it('should create a Knex instance and return it', async () => {
      const db = await dbModule.initDatabase();
      expect(db).toBeDefined();
      // Verify connection works
      const result = await db.raw('SELECT 1 as val');
      expect(result).toBeDefined();
    });

    it('should allow getDb() to return the instance after init', async () => {
      await dbModule.initDatabase();
      const db = dbModule.getDb();
      expect(db).toBeDefined();
    });
  });

  describe('getDb', () => {
    it('should throw if called before initDatabase', () => {
      expect(() => dbModule.getDb()).toThrow(
        'Database not initialized. Call initDatabase() first.'
      );
    });
  });

  describe('shutdownDatabase', () => {
    it('should destroy the connection and reset state', async () => {
      await dbModule.initDatabase();
      await dbModule.shutdownDatabase();
      // After shutdown, getDb should throw
      expect(() => dbModule.getDb()).toThrow(
        'Database not initialized. Call initDatabase() first.'
      );
    });

    it('should be safe to call when not initialized', async () => {
      // Should not throw
      await dbModule.shutdownDatabase();
    });
  });
});
