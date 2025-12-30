require('dotenv').config();

const connectionConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 60000,
  idleTimeoutMillis: 60000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};

const poolConfig = {
  min: 2,
  max: 10,
  acquireTimeoutMillis: 60000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200,
  propagateCreateError: false
};

module.exports = {
  development: {
    client: 'pg',
    connection: connectionConfig,
    pool: poolConfig,
    acquireConnectionTimeout: 60000,
    migrations: {
      directory: './migrations'
    }
  },
  production: {
    client: 'pg',
    connection: connectionConfig,
    pool: poolConfig,
    acquireConnectionTimeout: 60000,
    migrations: {
      directory: './migrations'
    }
  }
};
