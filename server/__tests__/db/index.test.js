/**
 * Database Module Tests
 * Tests for server/db.js
 *
 * Comprehensive tests covering:
 * - Pool initialization and configuration
 * - Query execution (simple and parameterized)
 * - Connection handling
 * - Error handling
 * - Event listeners
 * - SSL configuration
 * - Connection pool settings
 */

// Mock dependencies before imports
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockEnd = jest.fn();
const mockOn = jest.fn();
const mockRelease = jest.fn();

const mockClient = {
  query: jest.fn(),
  release: mockRelease
};

const MockPool = jest.fn().mockImplementation(function(config) {
  this.query = mockQuery;
  this.connect = mockConnect;
  this.end = mockEnd;
  this.on = mockOn;
  this.config = config;
  return this;
});

jest.mock('pg', () => ({
  Pool: MockPool
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const log = require('../../utils/logger');

describe('Database Module', () => {
  let originalEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    MockPool.mockClear();
    mockQuery.mockClear();
    mockConnect.mockClear();
    mockEnd.mockClear();
    mockOn.mockClear();
    mockRelease.mockClear();
    mockClient.query.mockClear();

    // Reset environment
    process.env = { ...originalEnv };

    // Clear module cache to allow fresh imports
    jest.resetModules();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  // ========================================
  // Pool Initialization Tests
  // ========================================
  describe('Pool Initialization', () => {
    it('should initialize pool with DATABASE_URL', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

      require('../../db');

      expect(MockPool).toHaveBeenCalledTimes(1);
      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://user:pass@localhost:5432/testdb'
        })
      );
    });

    it('should initialize pool with correct max connections', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';

      require('../../db');

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 20
        })
      );
    });

    it('should initialize pool with correct idle timeout', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';

      require('../../db');

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          idleTimeoutMillis: 30000
        })
      );
    });

    it('should initialize pool with correct connection timeout', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';

      require('../../db');

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionTimeoutMillis: 10000
        })
      );
    });

    it('should initialize pool only once', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';

      const db1 = require('../../db');
      const db2 = require('../../db');

      expect(MockPool).toHaveBeenCalledTimes(1);
      expect(db1).toBe(db2);
    });
  });

  // ========================================
  // SSL Configuration Tests
  // ========================================
  describe('SSL Configuration', () => {
    it('should disable SSL for local database', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      delete process.env.DB_SSL;

      require('../../db');

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: false
        })
      );
    });

    it('should enable SSL when DB_SSL is true', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      process.env.DB_SSL = 'true';

      require('../../db');

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should auto-enable SSL for Render.com database', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@dpg-abc123.render.com/mydb';
      delete process.env.DB_SSL;

      require('../../db');

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should auto-enable SSL for AWS RDS database', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@db.amazonaws.com/mydb';
      delete process.env.DB_SSL;

      require('../../db');

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should auto-enable SSL for Heroku database', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@ec2-heroku.compute-1.amazonaws.com/heroku-db';
      delete process.env.DB_SSL;

      require('../../db');

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should auto-enable SSL for Neon.tech database', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@ep-abc123.neon.tech/mydb';
      delete process.env.DB_SSL;

      require('../../db');

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should auto-enable SSL for Supabase database', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@db.supabase.co/mydb';
      delete process.env.DB_SSL;

      require('../../db');

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      );
    });

    it('should set rejectUnauthorized to false for external databases', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@db.render.com/mydb';
      delete process.env.DB_SSL;

      require('../../db');

      const sslConfig = MockPool.mock.calls[0][0].ssl;
      expect(sslConfig).toEqual({ rejectUnauthorized: false });
    });
  });

  // ========================================
  // Query Function Tests
  // ========================================
  describe('Query Function', () => {
    it('should execute simple query without parameters', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [{ id: 1, name: 'test' }], rowCount: 1 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await db.query('SELECT * FROM users');

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users', undefined);
      expect(result).toEqual(mockResult);
    });

    it('should execute parameterized query', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [{ id: 1, name: 'John' }], rowCount: 1 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await db.query('SELECT * FROM users WHERE id = $1', [1]);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
      expect(result).toEqual(mockResult);
    });

    it('should execute query with multiple parameters', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await db.query(
        'INSERT INTO users (name, email) VALUES ($1, $2)',
        ['John', 'john@example.com']
      );

      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO users (name, email) VALUES ($1, $2)',
        ['John', 'john@example.com']
      );
      expect(result).toEqual(mockResult);
    });

    it('should return empty rows for query with no results', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await db.query('SELECT * FROM users WHERE id = $1', [999]);

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should handle UPDATE queries', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [], rowCount: 1 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await db.query(
        'UPDATE users SET name = $1 WHERE id = $2',
        ['Jane', 1]
      );

      expect(result.rowCount).toBe(1);
    });

    it('should handle DELETE queries', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [], rowCount: 1 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await db.query('DELETE FROM users WHERE id = $1', [1]);

      expect(result.rowCount).toBe(1);
    });

    it('should handle complex queries with JOINs', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = {
        rows: [{ user_id: 1, user_name: 'John', post_title: 'Hello' }],
        rowCount: 1
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await db.query(
        'SELECT u.id as user_id, u.name as user_name, p.title as post_title FROM users u JOIN posts p ON u.id = p.user_id WHERE u.id = $1',
        [1]
      );

      expect(result.rows).toHaveLength(1);
    });

    it('should handle queries with NULL parameters', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await db.query('SELECT * FROM users WHERE email = $1', [null]);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        [null]
      );
    });

    it('should handle queries with array parameters', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [{ id: 1 }, { id: 2 }], rowCount: 2 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await db.query('SELECT * FROM users WHERE id = ANY($1)', [[1, 2, 3]]);

      expect(result.rows).toHaveLength(2);
    });

    it('should handle queries returning JSONB data', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = {
        rows: [{ id: 1, metadata: { key: 'value', nested: { data: 'test' } } }],
        rowCount: 1
      };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await db.query('SELECT * FROM documents WHERE id = $1', [1]);

      expect(result.rows[0].metadata).toEqual({ key: 'value', nested: { data: 'test' } });
    });
  });

  // ========================================
  // Error Handling Tests
  // ========================================
  describe('Error Handling', () => {
    it('should propagate query errors', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const error = new Error('Query failed');
      mockQuery.mockRejectedValueOnce(error);

      await expect(db.query('INVALID SQL')).rejects.toThrow('Query failed');
    });

    it('should handle syntax errors', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const error = new Error('syntax error at or near "SELCT"');
      error.code = '42601';
      mockQuery.mockRejectedValueOnce(error);

      await expect(db.query('SELCT * FROM users')).rejects.toThrow('syntax error');
    });

    it('should handle constraint violation errors', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const error = new Error('duplicate key value violates unique constraint');
      error.code = '23505';
      mockQuery.mockRejectedValueOnce(error);

      await expect(
        db.query('INSERT INTO users (email) VALUES ($1)', ['duplicate@example.com'])
      ).rejects.toThrow('duplicate key value');
    });

    it('should handle foreign key constraint errors', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const error = new Error('violates foreign key constraint');
      error.code = '23503';
      mockQuery.mockRejectedValueOnce(error);

      await expect(
        db.query('INSERT INTO posts (user_id) VALUES ($1)', [999])
      ).rejects.toThrow('violates foreign key constraint');
    });

    it('should handle connection timeout errors', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const error = new Error('Connection timeout');
      error.code = 'ETIMEDOUT';
      mockQuery.mockRejectedValueOnce(error);

      await expect(db.query('SELECT 1')).rejects.toThrow('Connection timeout');
    });

    it('should handle database not found errors', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const error = new Error('database "testdb" does not exist');
      error.code = '3D000';
      mockQuery.mockRejectedValueOnce(error);

      await expect(db.query('SELECT 1')).rejects.toThrow('database "testdb" does not exist');
    });

    it('should handle authentication errors', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const error = new Error('password authentication failed');
      error.code = '28P01';
      mockQuery.mockRejectedValueOnce(error);

      await expect(db.query('SELECT 1')).rejects.toThrow('password authentication failed');
    });

    it('should handle network errors', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const error = new Error('connect ECONNREFUSED');
      error.code = 'ECONNREFUSED';
      mockQuery.mockRejectedValueOnce(error);

      await expect(db.query('SELECT 1')).rejects.toThrow('connect ECONNREFUSED');
    });

    it('should handle connection lost errors', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const error = new Error('Connection terminated unexpectedly');
      error.code = '57P01';
      mockQuery.mockRejectedValueOnce(error);

      await expect(db.query('SELECT 1')).rejects.toThrow('Connection terminated unexpectedly');
    });

    it('should handle parameter type errors', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const error = new Error('invalid input syntax for type integer');
      error.code = '22P02';
      mockQuery.mockRejectedValueOnce(error);

      await expect(
        db.query('SELECT * FROM users WHERE id = $1', ['not-a-number'])
      ).rejects.toThrow('invalid input syntax');
    });
  });

  // ========================================
  // Event Listener Tests
  // ========================================
  describe('Event Listeners', () => {
    it('should register connect event listener', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';

      require('../../db');

      expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('should log on connect event', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';

      require('../../db');

      // Find the connect event handler and call it
      const connectCall = mockOn.mock.calls.find(call => call[0] === 'connect');
      expect(connectCall).toBeDefined();

      const connectHandler = connectCall[1];
      connectHandler();

      expect(log.info).toHaveBeenCalledWith('Connected to PostgreSQL database');
    });

    it('should register error event listener', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';

      require('../../db');

      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should log on error event', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';

      require('../../db');

      // Find the error event handler and call it
      const errorCall = mockOn.mock.calls.find(call => call[0] === 'error');
      expect(errorCall).toBeDefined();

      const errorHandler = errorCall[1];
      const testError = new Error('Test error');
      errorHandler(testError);

      expect(log.error).toHaveBeenCalledWith(
        'Unexpected error on idle client',
        { error: 'Test error' }
      );
    });

    it('should not exit process on idle client error', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      require('../../db');

      const errorCall = mockOn.mock.calls.find(call => call[0] === 'error');
      const errorHandler = errorCall[1];
      errorHandler(new Error('Idle client error'));

      expect(exitSpy).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });

    it('should handle multiple connect events', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';

      require('../../db');

      const connectCall = mockOn.mock.calls.find(call => call[0] === 'connect');
      const connectHandler = connectCall[1];

      connectHandler();
      connectHandler();
      connectHandler();

      expect(log.info).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple error events', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';

      require('../../db');

      const errorCall = mockOn.mock.calls.find(call => call[0] === 'error');
      const errorHandler = errorCall[1];

      errorHandler(new Error('Error 1'));
      errorHandler(new Error('Error 2'));
      errorHandler(new Error('Error 3'));

      expect(log.error).toHaveBeenCalledTimes(3);
    });
  });

  // ========================================
  // Connection Pool Management Tests
  // ========================================
  describe('Connection Pool Management', () => {
    it('should export pool object', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      expect(db.pool).toBeDefined();
      expect(db.pool.query).toBe(mockQuery);
      expect(db.pool.connect).toBe(mockConnect);
      expect(db.pool.end).toBe(mockEnd);
    });

    it('should allow direct pool.query calls', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await db.pool.query('SELECT * FROM users');

      expect(result).toEqual(mockResult);
    });

    it('should allow getting client from pool', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockConnect.mockResolvedValueOnce(mockClient);

      const client = await db.pool.connect();

      expect(client).toEqual(mockClient);
      expect(mockConnect).toHaveBeenCalled();
    });

    it('should allow ending the pool', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockEnd.mockResolvedValueOnce();

      await db.pool.end();

      expect(mockEnd).toHaveBeenCalled();
    });

    it('should maintain pool configuration', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      expect(db.pool.config).toEqual(
        expect.objectContaining({
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000
        })
      );
    });
  });

  // ========================================
  // Transaction Support Tests
  // ========================================
  describe('Transaction Support', () => {
    it('should execute BEGIN transaction', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValueOnce(mockResult);

      await db.query('BEGIN');

      expect(mockQuery).toHaveBeenCalledWith('BEGIN', undefined);
    });

    it('should execute COMMIT transaction', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValueOnce(mockResult);

      await db.query('COMMIT');

      expect(mockQuery).toHaveBeenCalledWith('COMMIT', undefined);
    });

    it('should execute ROLLBACK transaction', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValueOnce(mockResult);

      await db.query('ROLLBACK');

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK', undefined);
    });

    it('should support transaction with client', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockConnect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // INSERT
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

      const client = await db.pool.connect();
      await client.query('BEGIN');
      await client.query('INSERT INTO users (name) VALUES ($1)', ['John']);
      await client.query('COMMIT');
      client.release();

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should rollback on transaction error', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockConnect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
        .mockRejectedValueOnce(new Error('Query failed')) // INSERT fails
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

      const client = await db.pool.connect();
      await client.query('BEGIN');

      try {
        await client.query('INSERT INTO users (name) VALUES ($1)', ['John']);
      } catch (error) {
        await client.query('ROLLBACK');
      }

      client.release();

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should support savepoints', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValueOnce(mockResult);

      await db.query('SAVEPOINT my_savepoint');

      expect(mockQuery).toHaveBeenCalledWith('SAVEPOINT my_savepoint', undefined);
    });

    it('should support rollback to savepoint', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [], rowCount: 0 };
      mockQuery.mockResolvedValueOnce(mockResult);

      await db.query('ROLLBACK TO SAVEPOINT my_savepoint');

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT my_savepoint', undefined);
    });
  });

  // ========================================
  // Module Exports Tests
  // ========================================
  describe('Module Exports', () => {
    it('should export query function', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      expect(db.query).toBeDefined();
      expect(typeof db.query).toBe('function');
    });

    it('should export pool object', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      expect(db.pool).toBeDefined();
      expect(typeof db.pool).toBe('object');
    });

    it('should export only query and pool', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const exports = Object.keys(db);
      expect(exports).toHaveLength(2);
      expect(exports).toContain('query');
      expect(exports).toContain('pool');
    });

    it('should have query function that calls pool.query', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await db.query('SELECT 1');

      expect(mockQuery).toHaveBeenCalledWith('SELECT 1', undefined);
      expect(result).toEqual(mockResult);
    });
  });

  // ========================================
  // Integration-like Tests
  // ========================================
  describe('Integration-like Tests', () => {
    it('should handle multiple queries in sequence', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 3 }], rowCount: 1 });

      const result1 = await db.query('SELECT * FROM users WHERE id = $1', [1]);
      const result2 = await db.query('SELECT * FROM users WHERE id = $1', [2]);
      const result3 = await db.query('SELECT * FROM users WHERE id = $1', [3]);

      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(result1.rows[0].id).toBe(1);
      expect(result2.rows[0].id).toBe(2);
      expect(result3.rows[0].id).toBe(3);
    });

    it('should handle concurrent queries', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 3 }], rowCount: 1 });

      const results = await Promise.all([
        db.query('SELECT * FROM users WHERE id = $1', [1]),
        db.query('SELECT * FROM users WHERE id = $1', [2]),
        db.query('SELECT * FROM users WHERE id = $1', [3])
      ]);

      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(3);
    });

    it('should handle CRUD operations', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      // CREATE
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
      const createResult = await db.query(
        'INSERT INTO users (name) VALUES ($1) RETURNING *',
        ['John']
      );

      // READ
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'John' }], rowCount: 1 });
      const readResult = await db.query('SELECT * FROM users WHERE id = $1', [1]);

      // UPDATE
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Jane' }], rowCount: 1 });
      const updateResult = await db.query(
        'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
        ['Jane', 1]
      );

      // DELETE
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      const deleteResult = await db.query('DELETE FROM users WHERE id = $1', [1]);

      expect(mockQuery).toHaveBeenCalledTimes(4);
      expect(createResult.rows[0].id).toBe(1);
      expect(readResult.rows[0].name).toBe('John');
      expect(updateResult.rows[0].name).toBe('Jane');
      expect(deleteResult.rowCount).toBe(1);
    });

    it('should maintain connection after error', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      // First query fails
      mockQuery.mockRejectedValueOnce(new Error('Query failed'));

      try {
        await db.query('INVALID SQL');
      } catch (error) {
        // Expected
      }

      // Second query should still work
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
      const result = await db.query('SELECT 1');

      expect(result.rows[0].id).toBe(1);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================
  // Edge Cases Tests
  // ========================================
  describe('Edge Cases', () => {
    it('should handle empty query string', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await db.query('');

      expect(mockQuery).toHaveBeenCalledWith('', undefined);
    });

    it('should handle query with only whitespace', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await db.query('   ');

      expect(mockQuery).toHaveBeenCalledWith('   ', undefined);
    });

    it('should handle empty parameters array', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await db.query('SELECT 1', []);

      expect(mockQuery).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('should handle very long query strings', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const longQuery = 'SELECT * FROM users WHERE id IN (' +
        Array(1000).fill('$').map((_, i) => `$${i + 1}`).join(',') + ')';
      const longParams = Array(1000).fill(1);

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await db.query(longQuery, longParams);

      expect(mockQuery).toHaveBeenCalledWith(longQuery, longParams);
    });

    it('should handle special characters in parameters', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await db.query(
        'INSERT INTO users (name) VALUES ($1)',
        ["O'Brien; DROP TABLE users;--"]
      );

      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO users (name) VALUES ($1)',
        ["O'Brien; DROP TABLE users;--"]
      );
    });

    it('should handle unicode characters', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await db.query(
        'INSERT INTO users (name) VALUES ($1)',
        ['こんにちは 🎉 Привет']
      );

      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO users (name) VALUES ($1)',
        ['こんにちは 🎉 Привет']
      );
    });

    it('should handle undefined DATABASE_URL', () => {
      delete process.env.DATABASE_URL;

      require('../../db');

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: undefined
        })
      );
    });

    it('should handle very large result sets', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const largeResult = {
        rows: Array(10000).fill(null).map((_, i) => ({ id: i, name: `User ${i}` })),
        rowCount: 10000
      };
      mockQuery.mockResolvedValueOnce(largeResult);

      const result = await db.query('SELECT * FROM users');

      expect(result.rows).toHaveLength(10000);
      expect(result.rowCount).toBe(10000);
    });

    it('should handle boolean parameters', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await db.query('UPDATE users SET active = $1 WHERE id = $2', [true, 1]);

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET active = $1 WHERE id = $2',
        [true, 1]
      );
    });

    it('should handle date parameters', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      const testDate = new Date('2024-01-01');
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await db.query(
        'INSERT INTO events (name, date) VALUES ($1, $2)',
        ['Test Event', testDate]
      );

      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO events (name, date) VALUES ($1, $2)',
        ['Test Event', testDate]
      );
    });

    it('should handle numeric string parameters', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';
      const db = require('../../db');

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await db.query('SELECT * FROM users WHERE id = $1', ['123']);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        ['123']
      );
    });
  });
});
