const { Pool } = require('pg');
require('dotenv').config();
const log = require('./utils/logger');

// Determine SSL configuration
// Auto-enable SSL for external databases (Render, Heroku, etc.)
const isExternalDb = process.env.DATABASE_URL && (
  process.env.DATABASE_URL.includes('render.com') ||
  process.env.DATABASE_URL.includes('amazonaws.com') ||
  process.env.DATABASE_URL.includes('heroku') ||
  process.env.DATABASE_URL.includes('neon.tech') ||
  process.env.DATABASE_URL.includes('supabase.co')
);
const sslConfig = process.env.DB_SSL === 'true' || isExternalDb
  ? { rejectUnauthorized: false }
  : false;

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
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
  // Don't exit - let the pool recover automatically
});

// Export query helper
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
