/**
 * DatabaseTool Tests
 * Tests for server/tools/types/DatabaseTool.js
 */

// Mock pg Pool
const mockQuery = jest.fn();
const mockEnd = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    end: mockEnd
  }))
}));

const DatabaseTool = require('../../../tools/types/DatabaseTool');

describe('DatabaseTool', () => {
  let dbTool;

  beforeEach(() => {
    jest.clearAllMocks();
    dbTool = new DatabaseTool({
      connection: {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass'
      }
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const tool = new DatabaseTool();

      expect(tool.config.type).toBe('postgresql');
      expect(tool.config.maxConnections).toBe(10);
      expect(tool.pools).toBeInstanceOf(Map);
    });

    it('should accept custom config', () => {
      const tool = new DatabaseTool({
        type: 'postgresql',
        maxConnections: 20
      });

      expect(tool.config.maxConnections).toBe(20);
    });
  });

  describe('getPool', () => {
    it('should create and cache pool', () => {
      const connectionConfig = { database: 'test', user: 'user', password: 'pass' };

      const pool1 = dbTool.getPool(connectionConfig);
      const pool2 = dbTool.getPool(connectionConfig);

      expect(pool1).toBe(pool2);
    });

    it('should throw for MySQL', () => {
      const tool = new DatabaseTool({ type: 'mysql' });

      expect(() => {
        tool.getPool({ database: 'test' });
      }).toThrow('MySQL support requires mysql2 package');
    });
  });

  describe('escapeIdentifier', () => {
    it('should escape valid identifier', () => {
      expect(dbTool.escapeIdentifier('users')).toBe('"users"');
      expect(dbTool.escapeIdentifier('user_name')).toBe('"user_name"');
    });

    it('should reject invalid identifier', () => {
      expect(() => {
        dbTool.escapeIdentifier('users; DROP TABLE');
      }).toThrow('Invalid identifier');
    });

    it('should remove existing quotes', () => {
      expect(dbTool.escapeIdentifier('"users"')).toBe('"users"');
    });
  });

  describe('validateQuery', () => {
    it('should allow SELECT queries', () => {
      expect(() => {
        dbTool.validateQuery('SELECT * FROM users', 'SELECT');
      }).not.toThrow();
    });

    it('should block DROP statements', () => {
      expect(() => {
        dbTool.validateQuery('DROP TABLE users', 'SELECT');
      }).toThrow('restricted keyword');
    });

    it('should block TRUNCATE statements', () => {
      expect(() => {
        dbTool.validateQuery('TRUNCATE TABLE users', 'SELECT');
      }).toThrow('restricted keyword');
    });

    it('should block multiple statements', () => {
      expect(() => {
        dbTool.validateQuery('SELECT * FROM users; DELETE FROM users;', 'SELECT');
      }).toThrow('Multiple statements not allowed');
    });

    it('should allow DROP when explicitly specified', () => {
      expect(() => {
        dbTool.validateQuery('DROP TABLE users', 'DROP');
      }).not.toThrow();
    });
  });

  describe('buildWhereClause', () => {
    it('should build simple equality clause', () => {
      const result = dbTool.buildWhereClause({ id: 1, name: 'test' });

      expect(result.clause).toContain('"id" = $1');
      expect(result.clause).toContain('"name" = $2');
      expect(result.params).toEqual([1, 'test']);
    });

    it('should handle NULL values', () => {
      const result = dbTool.buildWhereClause({ deleted_at: null });

      expect(result.clause).toBe('"deleted_at" IS NULL');
      expect(result.params).toEqual([]);
    });

    it('should handle custom operators', () => {
      const result = dbTool.buildWhereClause({
        age: { operator: '>=', value: 18 }
      });

      expect(result.clause).toBe('"age" >= $1');
      expect(result.params).toEqual([18]);
    });

    it('should use custom start index', () => {
      const result = dbTool.buildWhereClause({ id: 1 }, 5);

      expect(result.clause).toBe('"id" = $5');
    });
  });

  describe('buildQuery', () => {
    describe('SELECT', () => {
      it('should build basic SELECT', () => {
        const result = dbTool.buildQuery('SELECT', { table: 'users' });

        expect(result.query).toBe('SELECT * FROM "users"');
        expect(result.params).toEqual([]);
      });

      it('should build SELECT with columns', () => {
        const result = dbTool.buildQuery('SELECT', {
          table: 'users',
          columns: ['id', 'name']
        });

        expect(result.query).toBe('SELECT id, name FROM "users"');
      });

      it('should build SELECT with WHERE', () => {
        const result = dbTool.buildQuery('SELECT', {
          table: 'users',
          where: { active: true }
        });

        expect(result.query).toContain('WHERE');
        expect(result.query).toContain('"active" = $1');
        expect(result.params).toEqual([true]);
      });

      it('should build SELECT with ORDER BY', () => {
        const result = dbTool.buildQuery('SELECT', {
          table: 'users',
          orderBy: 'created_at DESC'
        });

        expect(result.query).toContain('ORDER BY created_at DESC');
      });

      it('should build SELECT with LIMIT and OFFSET', () => {
        const result = dbTool.buildQuery('SELECT', {
          table: 'users',
          limit: 10,
          offset: 20
        });

        expect(result.query).toContain('LIMIT $1');
        expect(result.query).toContain('OFFSET $2');
        expect(result.params).toEqual([10, 20]);
      });
    });

    describe('INSERT', () => {
      it('should build INSERT query', () => {
        const result = dbTool.buildQuery('INSERT', {
          table: 'users',
          values: { name: 'John', email: 'john@example.com' }
        });

        expect(result.query).toContain('INSERT INTO "users"');
        expect(result.query).toContain('RETURNING *');
        expect(result.params).toContain('John');
        expect(result.params).toContain('john@example.com');
      });

      it('should build INSERT with specific columns', () => {
        const result = dbTool.buildQuery('INSERT', {
          table: 'users',
          columns: ['name'],
          values: { name: 'John', email: 'john@example.com' }
        });

        expect(result.query).toContain('"name"');
        expect(result.params).toEqual(['John']);
      });
    });

    describe('UPDATE', () => {
      it('should build UPDATE query', () => {
        const result = dbTool.buildQuery('UPDATE', {
          table: 'users',
          values: { name: 'Jane' },
          where: { id: 1 }
        });

        expect(result.query).toContain('UPDATE "users"');
        expect(result.query).toContain('SET "name" = $1');
        expect(result.query).toContain('WHERE');
        expect(result.query).toContain('RETURNING *');
      });
    });

    describe('DELETE', () => {
      it('should build DELETE query', () => {
        const result = dbTool.buildQuery('DELETE', {
          table: 'users',
          where: { id: 1 }
        });

        expect(result.query).toContain('DELETE FROM "users"');
        expect(result.query).toContain('WHERE');
        expect(result.query).toContain('RETURNING *');
      });
    });

    it('should throw for unknown operation', () => {
      expect(() => {
        dbTool.buildQuery('MERGE', { table: 'users' });
      }).toThrow('Unknown operation');
    });
  });

  describe('execute', () => {
    it('should throw if no connection config', async () => {
      const tool = new DatabaseTool();

      await expect(tool.execute({ query: 'SELECT 1' })).rejects.toThrow(
        'Database connection configuration is required'
      );
    });

    it('should throw if no query or operation', async () => {
      await expect(dbTool.execute({})).rejects.toThrow('Query or operation is required');
    });

    it('should execute raw query', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
        fields: [{ name: 'id', dataTypeID: 23 }]
      });

      const result = await dbTool.execute({
        query: 'SELECT * FROM users WHERE id = $1',
        params: [1]
      });

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.rowCount).toBe(1);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });

    it('should build query from operation', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1,
        fields: []
      });

      const result = await dbTool.execute({
        operation: 'SELECT',
        table: 'users',
        where: { id: 1 }
      });

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should handle query errors', async () => {
      mockQuery.mockRejectedValue(new Error('Connection refused'));

      await expect(dbTool.execute({
        query: 'SELECT * FROM users'
      })).rejects.toThrow('Database query failed');
    });

    it('should include duration', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: []
      });

      const result = await dbTool.execute({
        query: 'SELECT 1'
      });

      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('close', () => {
    it('should close all pools', async () => {
      // Create a pool first
      dbTool.getPool({ database: 'test', user: 'user' });

      await dbTool.close();

      expect(mockEnd).toHaveBeenCalled();
      expect(dbTool.pools.size).toBe(0);
    });
  });

  describe('static schemas', () => {
    it('should return input schema', () => {
      const schema = DatabaseTool.getInputSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties.query).toBeDefined();
      expect(schema.properties.operation).toBeDefined();
      expect(schema.properties.table).toBeDefined();
    });

    it('should return output schema', () => {
      const schema = DatabaseTool.getOutputSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties.success).toBeDefined();
      expect(schema.properties.rows).toBeDefined();
      expect(schema.properties.rowCount).toBeDefined();
    });

    it('should return config schema', () => {
      const schema = DatabaseTool.getConfigSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties.type).toBeDefined();
      expect(schema.properties.connection).toBeDefined();
    });
  });
});
