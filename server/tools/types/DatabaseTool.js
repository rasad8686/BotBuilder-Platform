/**
 * DatabaseTool - Database query tool for PostgreSQL and MySQL
 */

const { Pool } = require('pg');

class DatabaseTool {
  constructor(config = {}) {
    this.config = {
      type: config.type || 'postgresql',
      maxConnections: config.maxConnections || 10,
      ...config
    };
    this.pools = new Map();
  }

  /**
   * Get or create connection pool
   */
  getPool(connectionConfig) {
    const key = JSON.stringify(connectionConfig);

    if (!this.pools.has(key)) {
      if (this.config.type === 'postgresql') {
        const pool = new Pool({
          host: connectionConfig.host || 'localhost',
          port: connectionConfig.port || 5432,
          database: connectionConfig.database,
          user: connectionConfig.user,
          password: connectionConfig.password,
          max: this.config.maxConnections,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000
        });
        this.pools.set(key, pool);
      } else if (this.config.type === 'mysql') {
        // MySQL support placeholder - would require mysql2 package
        throw new Error('MySQL support requires mysql2 package');
      }
    }

    return this.pools.get(key);
  }

  /**
   * Execute database query
   */
  async execute(input, context = {}) {
    const {
      query,
      params = [],
      operation,
      table,
      columns,
      values,
      where,
      orderBy,
      limit,
      offset
    } = input;

    const connectionConfig = this.config.connection || input.connection;

    if (!connectionConfig) {
      throw new Error('Database connection configuration is required');
    }

    // Build query from operation if not provided directly
    let finalQuery = query;
    let finalParams = params;

    if (!finalQuery && operation) {
      const built = this.buildQuery(operation, { table, columns, values, where, orderBy, limit, offset });
      finalQuery = built.query;
      finalParams = built.params;
    }

    if (!finalQuery) {
      throw new Error('Query or operation is required');
    }

    // Validate query for safety
    this.validateQuery(finalQuery, operation);

    const pool = this.getPool(connectionConfig);

    try {
      const startTime = Date.now();
      const result = await pool.query(finalQuery, finalParams);
      const duration = Date.now() - startTime;

      return {
        success: true,
        rows: result.rows || [],
        rowCount: result.rowCount,
        fields: result.fields?.map(f => ({ name: f.name, dataType: f.dataTypeID })) || [],
        duration
      };
    } catch (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * Build query from operation
   */
  buildQuery(operation, options) {
    const { table, columns, values, where, orderBy, limit, offset } = options;
    let query = '';
    let params = [];
    let paramIndex = 1;

    switch (operation.toUpperCase()) {
      case 'SELECT':
        const selectColumns = columns && columns.length > 0 ? columns.join(', ') : '*';
        query = `SELECT ${selectColumns} FROM ${this.escapeIdentifier(table)}`;

        if (where) {
          const whereClause = this.buildWhereClause(where, paramIndex);
          query += ` WHERE ${whereClause.clause}`;
          params = params.concat(whereClause.params);
          paramIndex += whereClause.params.length;
        }

        if (orderBy) {
          query += ` ORDER BY ${orderBy}`;
        }

        if (limit) {
          query += ` LIMIT $${paramIndex++}`;
          params.push(limit);
        }

        if (offset) {
          query += ` OFFSET $${paramIndex++}`;
          params.push(offset);
        }
        break;

      case 'INSERT':
        const insertColumns = columns || Object.keys(values);
        const insertValues = columns ? columns.map(c => values[c]) : Object.values(values);
        const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');

        query = `INSERT INTO ${this.escapeIdentifier(table)} (${insertColumns.map(c => this.escapeIdentifier(c)).join(', ')}) VALUES (${placeholders}) RETURNING *`;
        params = insertValues;
        break;

      case 'UPDATE':
        const setClauses = [];
        const setValues = [];

        Object.entries(values).forEach(([key, value]) => {
          setClauses.push(`${this.escapeIdentifier(key)} = $${paramIndex++}`);
          setValues.push(value);
        });

        query = `UPDATE ${this.escapeIdentifier(table)} SET ${setClauses.join(', ')}`;
        params = setValues;

        if (where) {
          const whereClause = this.buildWhereClause(where, paramIndex);
          query += ` WHERE ${whereClause.clause}`;
          params = params.concat(whereClause.params);
        }

        query += ' RETURNING *';
        break;

      case 'DELETE':
        query = `DELETE FROM ${this.escapeIdentifier(table)}`;

        if (where) {
          const whereClause = this.buildWhereClause(where, paramIndex);
          query += ` WHERE ${whereClause.clause}`;
          params = whereClause.params;
        }

        query += ' RETURNING *';
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { query, params };
  }

  /**
   * Build WHERE clause from object
   */
  buildWhereClause(where, startIndex = 1) {
    const clauses = [];
    const params = [];
    let paramIndex = startIndex;

    Object.entries(where).forEach(([key, value]) => {
      if (value === null) {
        clauses.push(`${this.escapeIdentifier(key)} IS NULL`);
      } else if (typeof value === 'object' && value.operator) {
        clauses.push(`${this.escapeIdentifier(key)} ${value.operator} $${paramIndex++}`);
        params.push(value.value);
      } else {
        clauses.push(`${this.escapeIdentifier(key)} = $${paramIndex++}`);
        params.push(value);
      }
    });

    return {
      clause: clauses.join(' AND '),
      params
    };
  }

  /**
   * Escape identifier to prevent SQL injection
   */
  escapeIdentifier(identifier) {
    // Remove any existing quotes and validate
    const clean = identifier.replace(/"/g, '');
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(clean)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    return `"${clean}"`;
  }

  /**
   * Validate query for safety
   */
  validateQuery(query, operation) {
    const upperQuery = query.toUpperCase();

    // Block dangerous statements if not explicitly allowed
    const dangerous = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE'];

    for (const keyword of dangerous) {
      if (upperQuery.includes(keyword) && operation?.toUpperCase() !== keyword) {
        throw new Error(`Query contains restricted keyword: ${keyword}`);
      }
    }

    // Check for multiple statements (SQL injection prevention)
    const statementCount = (query.match(/;/g) || []).length;
    if (statementCount > 1) {
      throw new Error('Multiple statements not allowed');
    }
  }

  /**
   * Close all connection pools
   */
  async close() {
    for (const pool of this.pools.values()) {
      await pool.end();
    }
    this.pools.clear();
  }

  /**
   * Get input schema
   */
  static getInputSchema() {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Raw SQL query (parameterized)'
        },
        params: {
          type: 'array',
          items: {},
          description: 'Query parameters'
        },
        operation: {
          type: 'string',
          enum: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
          description: 'Query operation type (alternative to raw query)'
        },
        table: {
          type: 'string',
          description: 'Table name for operation'
        },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Columns to select or insert'
        },
        values: {
          type: 'object',
          description: 'Values for INSERT or UPDATE'
        },
        where: {
          type: 'object',
          description: 'WHERE clause conditions'
        },
        orderBy: {
          type: 'string',
          description: 'ORDER BY clause'
        },
        limit: {
          type: 'integer',
          description: 'LIMIT clause'
        },
        offset: {
          type: 'integer',
          description: 'OFFSET clause'
        }
      }
    };
  }

  /**
   * Get output schema
   */
  static getOutputSchema() {
    return {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the query was successful'
        },
        rows: {
          type: 'array',
          items: { type: 'object' },
          description: 'Query result rows'
        },
        rowCount: {
          type: 'integer',
          description: 'Number of affected/returned rows'
        },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              dataType: { type: 'integer' }
            }
          },
          description: 'Field metadata'
        },
        duration: {
          type: 'integer',
          description: 'Query duration in milliseconds'
        }
      }
    };
  }

  /**
   * Get configuration schema
   */
  static getConfigSchema() {
    return {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['postgresql', 'mysql'],
          default: 'postgresql',
          description: 'Database type'
        },
        connection: {
          type: 'object',
          properties: {
            host: { type: 'string', default: 'localhost' },
            port: { type: 'integer', default: 5432 },
            database: { type: 'string' },
            user: { type: 'string' },
            password: { type: 'string' }
          },
          required: ['database', 'user'],
          description: 'Database connection settings'
        },
        maxConnections: {
          type: 'integer',
          default: 10,
          description: 'Maximum pool connections'
        }
      }
    };
  }
}

module.exports = DatabaseTool;
