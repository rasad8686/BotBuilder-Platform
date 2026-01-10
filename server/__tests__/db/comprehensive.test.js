/**
 * @fileoverview Comprehensive test suite for database module
 * @description Tests the PostgreSQL pool connection, query execution,
 * transaction handling, error handling, and connection pooling behavior
 * @module server/__tests__/db/comprehensive.test.js
 */

// Mock pg module before requiring db module
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  const mockPool = {
    query: jest.fn(),
    connect: jest.fn(() => Promise.resolve(mockClient)),
    end: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
  };

  return { Pool: jest.fn(() => mockPool) };
});

// Mock logger module
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  audit: jest.fn(),
  http: jest.fn(),
}));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

const { Pool } = require('pg');
const log = require('../../utils/logger');

describe('Database Module - Comprehensive Test Suite', () => {
  let db;
  let mockPool;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Get mock pool instance
    mockPool = Pool.mock.results[0]?.value;

    // Reset and reload the db module
    jest.resetModules();
    jest.mock('pg', () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      const mockPoolInstance = {
        query: jest.fn(),
        connect: jest.fn(() => Promise.resolve(mockClient)),
        end: jest.fn(() => Promise.resolve()),
        on: jest.fn(),
      };

      return { Pool: jest.fn(() => mockPoolInstance) };
    });

    jest.mock('../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      audit: jest.fn(),
      http: jest.fn(),
    }));

    jest.mock('dotenv', () => ({
      config: jest.fn(),
    }));

    // Require db module fresh
    db = require('../../db');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // SECTION 1: Module Exports and Initialization
  // ============================================================================

  describe('Module Exports and Initialization', () => {
    test('1. Should export query function', () => {
      expect(typeof db.query).toBe('function');
    });

    test('2. Should export pool object', () => {
      expect(db.pool).toBeDefined();
      expect(typeof db.pool).toBe('object');
    });

    test('3. Pool should have query method', () => {
      expect(typeof db.pool.query).toBe('function');
    });

    test('4. Pool should have connect method', () => {
      expect(typeof db.pool.connect).toBe('function');
    });

    test('5. Pool should have end method', () => {
      expect(typeof db.pool.end).toBe('function');
    });

    test('6. Pool should have on method for event listeners', () => {
      expect(typeof db.pool.on).toBe('function');
    });

    test('7. Pool constructor should be called with connectionString', () => {
      expect(Pool).toHaveBeenCalled();
      const poolConfig = Pool.mock.calls[0][0];
      expect(poolConfig.connectionString).toBeDefined();
    });

    test('8. Pool should be configured with connection limits', () => {
      const poolConfig = Pool.mock.calls[0][0];
      expect(poolConfig.max).toBe(20);
    });

    test('9. Pool should have idle timeout configuration', () => {
      const poolConfig = Pool.mock.calls[0][0];
      expect(poolConfig.idleTimeoutMillis).toBe(30000);
    });

    test('10. Pool should have connection timeout configuration', () => {
      const poolConfig = Pool.mock.calls[0][0];
      expect(poolConfig.connectionTimeoutMillis).toBe(10000);
    });
  });

  // ============================================================================
  // SECTION 2: SSL Configuration
  // ============================================================================

  describe('SSL Configuration', () => {
    test('11. Should configure SSL when DATABASE_URL includes render.com', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@db.render.com/dbname';
      jest.resetModules();
      require('../../db');
      const poolConfig = Pool.mock.calls[Pool.mock.calls.length - 1][0];
      expect(poolConfig.ssl).toEqual({ rejectUnauthorized: false });
    });

    test('12. Should configure SSL when DATABASE_URL includes herokuapp.com', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@db.herokuapp.com/dbname';
      jest.resetModules();
      require('../../db');
      const poolConfig = Pool.mock.calls[Pool.mock.calls.length - 1][0];
      expect(poolConfig.ssl).toEqual({ rejectUnauthorized: false });
    });

    test('13. Should configure SSL when DATABASE_URL includes neon.tech', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@db.neon.tech/dbname';
      jest.resetModules();
      require('../../db');
      const poolConfig = Pool.mock.calls[Pool.mock.calls.length - 1][0];
      expect(poolConfig.ssl).toEqual({ rejectUnauthorized: false });
    });

    test('14. Should configure SSL when DATABASE_URL includes supabase.co', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@db.supabase.co/dbname';
      jest.resetModules();
      require('../../db');
      const poolConfig = Pool.mock.calls[Pool.mock.calls.length - 1][0];
      expect(poolConfig.ssl).toEqual({ rejectUnauthorized: false });
    });

    test('15. Should configure SSL when DB_SSL environment variable is true', () => {
      process.env.DB_SSL = 'true';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost/dbname';
      jest.resetModules();
      require('../../db');
      const poolConfig = Pool.mock.calls[Pool.mock.calls.length - 1][0];
      expect(poolConfig.ssl).toEqual({ rejectUnauthorized: false });
    });

    test('16. Should not configure SSL for local database', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost/dbname';
      process.env.DB_SSL = 'false';
      jest.resetModules();
      require('../../db');
      const poolConfig = Pool.mock.calls[Pool.mock.calls.length - 1][0];
      expect(poolConfig.ssl).toBe(false);
    });

    test('17. Should not configure SSL when DB_SSL is false', () => {
      process.env.DB_SSL = 'false';
      jest.resetModules();
      require('../../db');
      const poolConfig = Pool.mock.calls[Pool.mock.calls.length - 1][0];
      expect(poolConfig.ssl).toBe(false);
    });
  });

  // ============================================================================
  // SECTION 3: Query Execution
  // ============================================================================

  describe('Query Execution', () => {
    test('18. Should execute query with text and params', async () => {
      const queryResult = { rows: [{ id: 1, name: 'test' }] };
      db.pool.query.mockResolvedValue(queryResult);

      const result = await db.query('SELECT * FROM users WHERE id = $1', [1]);

      expect(db.pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [1]
      );
      expect(result).toEqual(queryResult);
    });

    test('19. Should execute query without params', async () => {
      const queryResult = { rows: [{ id: 1 }, { id: 2 }] };
      db.pool.query.mockResolvedValue(queryResult);

      const result = await db.query('SELECT * FROM users');

      expect(db.pool.query).toHaveBeenCalledWith('SELECT * FROM users', undefined);
      expect(result).toEqual(queryResult);
    });

    test('20. Should return query results with rows', async () => {
      const rows = [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }];
      db.pool.query.mockResolvedValue({ rows, rowCount: 2 });

      const result = await db.query('SELECT * FROM users');

      expect(result.rows).toEqual(rows);
      expect(result.rowCount).toBe(2);
    });

    test('21. Should handle empty query results', async () => {
      db.pool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await db.query('SELECT * FROM users WHERE id = $1', [999]);

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    test('22. Should handle INSERT queries with returned rows', async () => {
      const newUser = { id: 3, name: 'New User', email: 'new@example.com' };
      db.pool.query.mockResolvedValue({ rows: [newUser], rowCount: 1 });

      const result = await db.query(
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
        ['New User', 'new@example.com']
      );

      expect(result.rows[0]).toEqual(newUser);
    });

    test('23. Should handle UPDATE queries', async () => {
      db.pool.query.mockResolvedValue({ rowCount: 1 });

      const result = await db.query(
        'UPDATE users SET name = $1 WHERE id = $2',
        ['Updated User', 1]
      );

      expect(result.rowCount).toBe(1);
    });

    test('24. Should handle DELETE queries', async () => {
      db.pool.query.mockResolvedValue({ rowCount: 1 });

      const result = await db.query('DELETE FROM users WHERE id = $1', [1]);

      expect(result.rowCount).toBe(1);
    });

    test('25. Should pass multiple parameters correctly', async () => {
      db.pool.query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

      await db.query(
        'INSERT INTO users (name, email, age) VALUES ($1, $2, $3)',
        ['John', 'john@example.com', 30]
      );

      expect(db.pool.query).toHaveBeenCalledWith(
        'INSERT INTO users (name, email, age) VALUES ($1, $2, $3)',
        ['John', 'john@example.com', 30]
      );
    });

    test('26. Should handle parameterized queries with special characters', async () => {
      db.pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await db.query(
        'SELECT * FROM users WHERE name = $1',
        ["O'Brien"]
      );

      expect(db.pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE name = $1',
        ["O'Brien"]
      );
    });
  });

  // ============================================================================
  // SECTION 4: Error Handling
  // ============================================================================

  describe('Error Handling for Database Operations', () => {
    test('27. Should handle query execution errors', async () => {
      const dbError = new Error('Database connection error');
      db.pool.query.mockRejectedValue(dbError);

      await expect(db.query('SELECT * FROM users')).rejects.toThrow(
        'Database connection error'
      );
    });

    test('28. Should handle syntax errors', async () => {
      const syntaxError = new Error('syntax error at or near "SELCT"');
      db.pool.query.mockRejectedValue(syntaxError);

      await expect(db.query('SELCT * FROM users')).rejects.toThrow();
      expect(db.pool.query).toHaveBeenCalled();
    });

    test('29. Should handle connection timeout errors', async () => {
      const timeoutError = new Error('connect ETIMEDOUT');
      db.pool.query.mockRejectedValue(timeoutError);

      await expect(db.query('SELECT * FROM users')).rejects.toThrow(
        'connect ETIMEDOUT'
      );
    });

    test('30. Should handle constraint violation errors', async () => {
      const constraintError = new Error('duplicate key value violates unique constraint');
      db.pool.query.mockRejectedValue(constraintError);

      await expect(
        db.query('INSERT INTO users (email) VALUES ($1)', ['existing@example.com'])
      ).rejects.toThrow();
    });

    test('31. Should handle foreign key constraint errors', async () => {
      const fkError = new Error('insert or update on table violates foreign key constraint');
      db.pool.query.mockRejectedValue(fkError);

      await expect(
        db.query('INSERT INTO orders (user_id) VALUES ($1)', [999])
      ).rejects.toThrow();
    });

    test('32. Should handle permission denied errors', async () => {
      const permissionError = new Error('permission denied for schema public');
      db.pool.query.mockRejectedValue(permissionError);

      await expect(db.query('DELETE FROM users')).rejects.toThrow();
    });

    test('33. Should propagate error message correctly', async () => {
      const error = new Error('Table does not exist');
      db.pool.query.mockRejectedValue(error);

      try {
        await db.query('SELECT * FROM nonexistent_table');
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).toBe('Table does not exist');
      }
    });

    test('34. Should handle errors with error codes', async () => {
      const error = new Error('Relation "users" does not exist');
      error.code = '42P01';
      db.pool.query.mockRejectedValue(error);

      try {
        await db.query('SELECT * FROM users');
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.code).toBe('42P01');
      }
    });
  });

  // ============================================================================
  // SECTION 5: Connection Pooling Behavior
  // ============================================================================

  describe('Connection Pooling Behavior', () => {
    test('35. Should use pool connection for queries', async () => {
      db.pool.query.mockResolvedValue({ rows: [] });

      await db.query('SELECT * FROM users');

      expect(db.pool.query).toHaveBeenCalled();
    });

    test('36. Should reuse connections from pool', async () => {
      db.pool.query.mockResolvedValue({ rows: [] });

      await db.query('SELECT * FROM users');
      await db.query('SELECT * FROM orders');
      await db.query('SELECT * FROM products');

      expect(db.pool.query).toHaveBeenCalledTimes(3);
    });

    test('37. Should allow multiple concurrent queries', async () => {
      db.pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const queries = [
        db.query('SELECT * FROM users'),
        db.query('SELECT * FROM orders'),
        db.query('SELECT * FROM products'),
      ];

      const results = await Promise.all(queries);

      expect(results).toHaveLength(3);
      expect(db.pool.query).toHaveBeenCalledTimes(3);
    });

    test('38. Should handle connection pool exhaustion gracefully', async () => {
      const exhaustionError = new Error('the client is closed');
      db.pool.query.mockRejectedValue(exhaustionError);

      await expect(db.query('SELECT * FROM users')).rejects.toThrow(
        'the client is closed'
      );
    });

    test('39. Should register event listeners on pool', () => {
      expect(db.pool.on).toHaveBeenCalled();
    });

    test('40. Should register connect event listener', () => {
      const connectListeners = db.pool.on.mock.calls.filter(
        call => call[0] === 'connect'
      );
      expect(connectListeners.length).toBeGreaterThan(0);
    });

    test('41. Should register error event listener', () => {
      const errorListeners = db.pool.on.mock.calls.filter(
        call => call[0] === 'error'
      );
      expect(errorListeners.length).toBeGreaterThan(0);
    });

    test('42. Should log connection success', () => {
      // Get the connect event handler
      const connectCall = db.pool.on.mock.calls.find(
        call => call[0] === 'connect'
      );

      if (connectCall && connectCall[1]) {
        connectCall[1]();
        expect(log.info).toHaveBeenCalledWith(
          'Connected to PostgreSQL database'
        );
      }
    });

    test('43. Should log pool errors', () => {
      // Get the error event handler
      const errorCall = db.pool.on.mock.calls.find(
        call => call[0] === 'error'
      );

      if (errorCall && errorCall[1]) {
        const testError = new Error('Idle client error');
        errorCall[1](testError);
        expect(log.error).toHaveBeenCalledWith(
          'Unexpected error on idle client',
          { error: 'Idle client error' }
        );
      }
    });
  });

  // ============================================================================
  // SECTION 6: Query Helper Function
  // ============================================================================

  describe('Query Helper Function', () => {
    test('44. Should be a function', () => {
      expect(typeof db.query).toBe('function');
    });

    test('45. Should return a Promise', () => {
      db.pool.query.mockResolvedValue({ rows: [] });
      const result = db.query('SELECT * FROM users');
      expect(result).toBeInstanceOf(Promise);
    });

    test('46. Should delegate to pool.query', async () => {
      const mockResult = { rows: [{ id: 1 }] };
      db.pool.query.mockResolvedValue(mockResult);

      const result = await db.query('SELECT * FROM users WHERE id = $1', [1]);

      expect(db.pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [1]
      );
      expect(result).toBe(mockResult);
    });

    test('47. Should handle null parameters', async () => {
      db.pool.query.mockResolvedValue({ rows: [] });

      await db.query('SELECT * FROM users WHERE deleted_at IS NULL');

      expect(db.pool.query).toHaveBeenCalled();
    });

    test('48. Should accept variable number of parameters', async () => {
      db.pool.query.mockResolvedValue({ rows: [] });

      await db.query(
        'INSERT INTO users (name, email, age, status) VALUES ($1, $2, $3, $4)',
        ['John', 'john@example.com', 30, 'active']
      );

      expect(db.pool.query).toHaveBeenCalledWith(
        'INSERT INTO users (name, email, age, status) VALUES ($1, $2, $3, $4)',
        ['John', 'john@example.com', 30, 'active']
      );
    });
  });

  // ============================================================================
  // SECTION 7: Transaction Support (Simulated)
  // ============================================================================

  describe('Transaction Support', () => {
    test('49. Should support BEGIN transaction', async () => {
      db.pool.query.mockResolvedValue({ rows: [] });

      await db.query('BEGIN');

      expect(db.pool.query).toHaveBeenCalledWith('BEGIN', undefined);
    });

    test('50. Should support COMMIT transaction', async () => {
      db.pool.query.mockResolvedValue({ rows: [] });

      await db.query('COMMIT');

      expect(db.pool.query).toHaveBeenCalledWith('COMMIT', undefined);
    });

    test('51. Should support ROLLBACK transaction', async () => {
      db.pool.query.mockResolvedValue({ rows: [] });

      await db.query('ROLLBACK');

      expect(db.pool.query).toHaveBeenCalledWith('ROLLBACK', undefined);
    });

    test('52. Should handle transaction with multiple queries', async () => {
      db.pool.query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

      // Simulate transaction
      await db.query('BEGIN');
      await db.query('INSERT INTO users (name) VALUES ($1)', ['User 1']);
      await db.query('INSERT INTO users (name) VALUES ($1)', ['User 2']);
      await db.query('COMMIT');

      expect(db.pool.query).toHaveBeenCalledTimes(4);
    });

    test('53. Should handle transaction rollback on error', async () => {
      db.pool.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT 1
        .mockRejectedValueOnce(new Error('Constraint violation')) // INSERT 2
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await db.query('BEGIN');
      await db.query('INSERT INTO users (name) VALUES ($1)', ['User 1']);

      try {
        await db.query('INSERT INTO users (email) VALUES ($1)', ['duplicate@example.com']);
      } catch (err) {
        // Expected error
      }

      await db.query('ROLLBACK');

      expect(db.pool.query).toHaveBeenCalledTimes(4);
    });
  });

  // ============================================================================
  // SECTION 8: Pool Configuration Validation
  // ============================================================================

  describe('Pool Configuration Validation', () => {
    test('54. Should configure maximum pool size to 20', () => {
      const poolConfig = Pool.mock.calls[0][0];
      expect(poolConfig.max).toBe(20);
    });

    test('55. Should configure idle timeout to 30 seconds', () => {
      const poolConfig = Pool.mock.calls[0][0];
      expect(poolConfig.idleTimeoutMillis).toBe(30000);
    });

    test('56. Should configure connection timeout to 10 seconds', () => {
      const poolConfig = Pool.mock.calls[0][0];
      expect(poolConfig.connectionTimeoutMillis).toBe(10000);
    });

    test('57. Should use DATABASE_URL environment variable', () => {
      const poolConfig = Pool.mock.calls[0][0];
      expect(poolConfig.connectionString).toBe(process.env.DATABASE_URL);
    });

    test('58. Should have ssl configuration property', () => {
      const poolConfig = Pool.mock.calls[0][0];
      expect(poolConfig.hasOwnProperty('ssl')).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 9: Type Safety and Return Values
  // ============================================================================

  describe('Type Safety and Return Values', () => {
    test('59. Should return object with rows property', async () => {
      const rows = [{ id: 1, name: 'Test' }];
      db.pool.query.mockResolvedValue({ rows, rowCount: 1 });

      const result = await db.query('SELECT * FROM users');

      expect(result).toHaveProperty('rows');
      expect(Array.isArray(result.rows)).toBe(true);
    });

    test('60. Should return object with rowCount property', async () => {
      db.pool.query.mockResolvedValue({ rows: [], rowCount: 5 });

      const result = await db.query('DELETE FROM users');

      expect(result).toHaveProperty('rowCount');
      expect(typeof result.rowCount).toBe('number');
    });

    test('61. Should handle complex data types in results', async () => {
      const complexRow = {
        id: 1,
        name: 'Test',
        metadata: { key: 'value' },
        timestamp: new Date('2025-01-01'),
        scores: [1, 2, 3],
      };
      db.pool.query.mockResolvedValue({ rows: [complexRow] });

      const result = await db.query('SELECT * FROM users');

      expect(result.rows[0].metadata).toEqual({ key: 'value' });
      expect(Array.isArray(result.rows[0].scores)).toBe(true);
    });

    test('62. Should handle null values in results', async () => {
      const rowWithNulls = {
        id: 1,
        name: 'Test',
        email: null,
        age: null,
      };
      db.pool.query.mockResolvedValue({ rows: [rowWithNulls] });

      const result = await db.query('SELECT * FROM users');

      expect(result.rows[0].email).toBeNull();
      expect(result.rows[0].age).toBeNull();
    });

    test('63. Should handle boolean values in results', async () => {
      const rowWithBooleans = {
        id: 1,
        is_active: true,
        is_admin: false,
      };
      db.pool.query.mockResolvedValue({ rows: [rowWithBooleans] });

      const result = await db.query('SELECT * FROM users');

      expect(result.rows[0].is_active).toBe(true);
      expect(result.rows[0].is_admin).toBe(false);
    });

    test('64. Should handle numeric values in results', async () => {
      const rowWithNumbers = {
        id: 1,
        count: 42,
        rating: 4.5,
        balance: -10.99,
      };
      db.pool.query.mockResolvedValue({ rows: [rowWithNumbers] });

      const result = await db.query('SELECT * FROM users');

      expect(result.rows[0].count).toBe(42);
      expect(result.rows[0].rating).toBe(4.5);
      expect(result.rows[0].balance).toBe(-10.99);
    });
  });

  // ============================================================================
  // SECTION 10: Edge Cases and Stress Scenarios
  // ============================================================================

  describe('Edge Cases and Stress Scenarios', () => {
    test('65. Should handle very long query strings', async () => {
      const longQuery = 'SELECT * FROM users WHERE ' + Array(1000).fill('id = 1 OR').join(' ');
      db.pool.query.mockResolvedValue({ rows: [] });

      await db.query(longQuery);

      expect(db.pool.query).toHaveBeenCalled();
    });

    test('66. Should handle large result sets', async () => {
      const largeRows = Array(1000).fill(null).map((_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
      }));
      db.pool.query.mockResolvedValue({ rows: largeRows, rowCount: 1000 });

      const result = await db.query('SELECT * FROM users LIMIT 1000');

      expect(result.rows.length).toBe(1000);
      expect(result.rowCount).toBe(1000);
    });

    test('67. Should handle query with many parameters', async () => {
      const params = Array(50).fill(null).map((_, i) => `value${i}`);
      db.pool.query.mockResolvedValue({ rows: [] });

      const placeholders = Array(50).fill(null).map((_, i) => `$${i + 1}`).join(', ');
      const query = `SELECT * FROM table WHERE col IN (${placeholders})`;

      await db.query(query, params);

      expect(db.pool.query).toHaveBeenCalledWith(query, params);
    });

    test('68. Should handle rapid successive queries', async () => {
      db.pool.query.mockResolvedValue({ rows: [] });

      for (let i = 0; i < 100; i++) {
        await db.query('SELECT * FROM users WHERE id = $1', [i]);
      }

      expect(db.pool.query).toHaveBeenCalledTimes(100);
    });

    test('69. Should handle query with empty string parameter', async () => {
      db.pool.query.mockResolvedValue({ rows: [{ id: 1, name: '' }] });

      await db.query('SELECT * FROM users WHERE name = $1', ['']);

      expect(db.pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE name = $1',
        ['']
      );
    });

    test('70. Should handle query with unicode characters', async () => {
      db.pool.query.mockResolvedValue({ rows: [{ id: 1, name: '日本語' }] });

      await db.query('SELECT * FROM users WHERE name = $1', ['日本語']);

      expect(db.pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE name = $1',
        ['日本語']
      );
    });
  });

  // ============================================================================
  // SECTION 11: Logger Integration
  // ============================================================================

  describe('Logger Integration', () => {
    test('71. Should have access to logger for error reporting', () => {
      expect(log).toBeDefined();
    });

    test('72. Should call logger info on successful connection', () => {
      const connectCall = db.pool.on.mock.calls.find(
        call => call[0] === 'connect'
      );

      if (connectCall && connectCall[1]) {
        connectCall[1]();
      }

      expect(log.info).toHaveBeenCalled();
    });

    test('73. Should call logger error on pool error', () => {
      const errorCall = db.pool.on.mock.calls.find(
        call => call[0] === 'error'
      );

      if (errorCall && errorCall[1]) {
        errorCall[1](new Error('Test error'));
      }

      expect(log.error).toHaveBeenCalled();
    });

    test('74. Should pass error message to logger', () => {
      const errorCall = db.pool.on.mock.calls.find(
        call => call[0] === 'error'
      );

      if (errorCall && errorCall[1]) {
        const testError = new Error('Connection pool error');
        errorCall[1](testError);

        const errorCall2 = log.error.mock.calls[0];
        expect(errorCall2[1]).toEqual({ error: 'Connection pool error' });
      }
    });
  });
});
