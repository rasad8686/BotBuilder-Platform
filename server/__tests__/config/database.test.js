/**
 * Database Configuration Tests
 * Tests for server/db.js
 */

// Mock pg Pool BEFORE importing anything
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
  totalCount: 0,
  idleCount: 0,
  waitingCount: 0
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool)
}));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const { Pool } = require('pg');
const dotenv = require('dotenv');
const log = require('../../utils/logger');

describe('Database Configuration', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockPool.query.mockClear();
    mockPool.connect.mockClear();
    mockPool.end.mockClear();
    mockPool.on.mockClear();
    Pool.mockClear();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ========================================
  // Environment Variable Loading
  // ========================================
  describe('Environment Variable Loading', () => {
    it('should load dotenv config on module import', () => {
      delete require.cache[require.resolve('../../db')];
      require('../../db');

      expect(dotenv.config).toHaveBeenCalled();
    });

    it('should use DATABASE_URL from environment', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://user:pass@localhost:5432/testdb'
        })
      );
    });

    it('should handle missing DATABASE_URL', () => {
      delete process.env.DATABASE_URL;
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: undefined
        })
      );
    });
  });

  // ========================================
  // SSL Configuration
  // ========================================
  describe('SSL Configuration', () => {
    it('should enable SSL for Render databases', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@db.render.com:5432/mydb';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should enable SSL for AWS RDS databases', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@mydb.amazonaws.com:5432/db';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should enable SSL for Heroku databases', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@ec2-heroku.compute-1.amazonaws.com:5432/db';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should enable SSL for Neon databases', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@ep-test.neon.tech:5432/mydb';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should enable SSL for Supabase databases', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@db.supabase.co:5432/postgres';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should enable SSL when DB_SSL=true', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      process.env.DB_SSL = 'true';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should disable SSL for localhost without DB_SSL flag', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete process.env.DB_SSL;
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: false
        })
      );
    });

    it('should disable SSL when DB_SSL=false', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      process.env.DB_SSL = 'false';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: false
        })
      );
    });
  });

  // ========================================
  // Pool Configuration
  // ========================================
  describe('Pool Configuration', () => {
    it('should configure pool with max 20 connections', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 20
        })
      );
    });

    it('should configure idle timeout to 30 seconds', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          idleTimeoutMillis: 30000
        })
      );
    });

    it('should configure connection timeout to 10 seconds', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionTimeoutMillis: 10000
        })
      );
    });

    it('should create Pool instance', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalled();
    });
  });

  // ========================================
  // Event Handlers
  // ========================================
  describe('Event Handlers', () => {
    it('should register connect event handler', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('should register error event handler', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should log info on successful connection', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];

      let connectHandler;
      mockPool.on.mockImplementation((event, handler) => {
        if (event === 'connect') connectHandler = handler;
      });

      require('../../db');
      connectHandler();

      expect(log.info).toHaveBeenCalledWith('Connected to PostgreSQL database');
    });

    it('should log error on pool error', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];

      let errorHandler;
      mockPool.on.mockImplementation((event, handler) => {
        if (event === 'error') errorHandler = handler;
      });

      require('../../db');
      const error = new Error('Connection lost');
      errorHandler(error);

      expect(log.error).toHaveBeenCalledWith(
        'Unexpected error on idle client',
        expect.objectContaining({ error: 'Connection lost' })
      );
    });

    it('should not exit process on pool error', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];

      let errorHandler;
      mockPool.on.mockImplementation((event, handler) => {
        if (event === 'error') errorHandler = handler;
      });

      require('../../db');

      expect(() => {
        errorHandler(new Error('Test error'));
      }).not.toThrow();
    });
  });

  // ========================================
  // Query Method
  // ========================================
  describe('Query Method', () => {
    let db;

    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];
      db = require('../../db');
    });

    it('should export query function', () => {
      expect(typeof db.query).toBe('function');
    });

    it('should call pool.query with text and params', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await db.query('SELECT * FROM users WHERE id = $1', [1]);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });

    it('should return query result', async () => {
      const mockResult = { rows: [{ id: 1, name: 'Test' }], rowCount: 1 };
      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await db.query('SELECT * FROM users');

      expect(result).toEqual(mockResult);
    });

    it('should handle query errors', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Query failed'));

      await expect(db.query('SELECT * FROM invalid')).rejects.toThrow('Query failed');
    });

    it('should support queries without parameters', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await db.query('SELECT NOW()');

      expect(mockPool.query).toHaveBeenCalledWith('SELECT NOW()', undefined);
    });

    it('should support multiple parameters', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await db.query(
        'SELECT * FROM users WHERE email = $1 AND status = $2',
        ['test@example.com', 'active']
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1 AND status = $2',
        ['test@example.com', 'active']
      );
    });
  });

  // ========================================
  // Pool Export
  // ========================================
  describe('Pool Export', () => {
    it('should export pool instance', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];
      const db = require('../../db');

      expect(db.pool).toBeDefined();
      expect(db.pool).toBe(mockPool);
    });

    it('should allow direct access to pool methods', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];
      const db = require('../../db');

      expect(typeof db.pool.connect).toBe('function');
      expect(typeof db.pool.query).toBe('function');
      expect(typeof db.pool.end).toBe('function');
    });
  });

  // ========================================
  // Different Environments
  // ========================================
  describe('Different Environments', () => {
    it('should configure correctly for development', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/botbuilder_dev';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://localhost:5432/botbuilder_dev',
          ssl: false
        })
      );
    });

    it('should configure correctly for test', () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/botbuilder_test';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://localhost:5432/botbuilder_test',
          ssl: false
        })
      );
    });

    it('should configure correctly for production with cloud provider', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://user:pass@db.render.com:5432/prod_db';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://user:pass@db.render.com:5432/prod_db',
          ssl: { rejectUnauthorized: false }
        })
      );
    });
  });

  // ========================================
  // Module Exports Structure
  // ========================================
  describe('Module Exports Structure', () => {
    it('should export object with query and pool', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];
      const db = require('../../db');

      expect(db).toHaveProperty('query');
      expect(db).toHaveProperty('pool');
    });

    it('should export exactly two properties', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/mydb';
      delete require.cache[require.resolve('../../db')];
      const db = require('../../db');

      expect(Object.keys(db)).toEqual(['query', 'pool']);
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('Edge Cases', () => {
    it('should handle empty connection string', () => {
      process.env.DATABASE_URL = '';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: ''
        })
      );
    });

    it('should handle connection string with special characters', () => {
      process.env.DATABASE_URL = 'postgresql://user%40name:p%40ssw0rd@localhost:5432/db';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://user%40name:p%40ssw0rd@localhost:5432/db'
        })
      );
    });

    it('should handle multiple cloud provider indicators in URL', () => {
      // Edge case: URL that might match multiple patterns
      process.env.DATABASE_URL = 'postgresql://user:pass@test.neon.tech.amazonaws.com:5432/db';
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should handle localhost with port', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5433/mydb';
      delete process.env.DB_SSL;
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: false
        })
      );
    });

    it('should handle 127.0.0.1 as localhost', () => {
      process.env.DATABASE_URL = 'postgresql://127.0.0.1:5432/mydb';
      delete process.env.DB_SSL;
      delete require.cache[require.resolve('../../db')];

      require('../../db');

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: false
        })
      );
    });
  });
});
