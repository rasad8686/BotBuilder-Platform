const { Pool } = require('pg');
require('dotenv').config();
const log = require('./utils/logger');

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be established
});

// Test database connection
pool.on('connect', () => {
  log.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  log.error('Unexpected error on idle client', { error: err.message });
  process.exit(-1);
});

// Export query helper
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
