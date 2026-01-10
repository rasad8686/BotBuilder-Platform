/**
 * @fileoverview Knex Database Configuration
 * @description Exports a configured knex instance for database operations
 */

const knex = require('knex');
require('dotenv').config();

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

const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  },
  pool: {
    min: 0,
    max: 20,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    propagateCreateError: false
  },
  acquireConnectionTimeout: 60000
});

module.exports = db;
