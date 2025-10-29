const { Pool } = require('pg');
require('dotenv').config();

// Check if DATABASE_URL is configured
if (!process.env.DATABASE_URL) {
  console.error('\n❌ CRITICAL ERROR: DATABASE_URL not found in .env file');
  console.error('⚠️  Database features will be disabled');
  console.error('⚠️  To enable database:');
  console.error('   1. For local: Install PostgreSQL and set DATABASE_URL=postgresql://user:pass@localhost:5432/botbuilder');
  console.error('   2. For production: Get URL from Render.com PostgreSQL dashboard\n');

  // Export null pool to prevent crashes
  module.exports = null;
  return;
}

// Determine if SSL is needed (Render requires SSL, localhost doesn't)
const useSSL = process.env.DATABASE_URL.includes('render.com') ||
               process.env.DATABASE_URL.includes('railway.app') ||
               process.env.DATABASE_URL.includes('neon.tech');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? {
    rejectUnauthorized: false
  } : false,
  connectionTimeoutMillis: 10000, // 10 seconds
  idleTimeoutMillis: 30000,
  max: 20 // Maximum number of clients in the pool
});

pool.on('connect', (client) => {
  console.log('✅ New client connected to PostgreSQL database');
});

pool.on('error', (err, client) => {
  console.error('\n❌ Unexpected database error:', err.message);
  if (err.code === 'ECONNREFUSED') {
    console.error('💡 Connection refused - PostgreSQL server not accessible');
    console.error('   Check: 1) Is PostgreSQL running? 2) Is DATABASE_URL correct?');
  } else if (err.code === 'ENOTFOUND') {
    console.error('💡 Host not found - Check DATABASE_URL hostname');
  } else if (err.code === '28P01') {
    console.error('💡 Authentication failed - Check username/password in DATABASE_URL');
  }
  console.error('');
});

// Test connection on startup with retry
let retryCount = 0;
const maxRetries = 3;

function testConnection() {
  pool.query('SELECT NOW() as current_time, version() as pg_version', (err, res) => {
    if (err) {
      console.error(`\n❌ Database connection test failed (attempt ${retryCount + 1}/${maxRetries})`);
      console.error(`   Error: ${err.message}`);
      console.error(`   Code: ${err.code}`);

      if (err.code === '28P01') {
        console.error('\n🔐 AUTHENTICATION FAILED');
        console.error('   Username/password in DATABASE_URL is incorrect');
        console.error('   Current DATABASE_URL starts with: ' + process.env.DATABASE_URL.substring(0, 30) + '...');
      }

      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`   ⏳ Retrying in 2 seconds...\n`);
        setTimeout(testConnection, 2000);
      } else {
        console.error('\n❌ CRITICAL: Database connection failed after all retries');
        console.error('   Server will run but database operations will fail\n');
      }
    } else {
      console.log('✅ Database connection test successful!');
      console.log(`   Time: ${res.rows[0].current_time}`);
      console.log(`   PostgreSQL version: ${res.rows[0].pg_version.split(' ')[0]} ${res.rows[0].pg_version.split(' ')[1]}\n`);
      retryCount = 0; // Reset retry count on success
    }
  });
}

// Start initial connection test
testConnection();

module.exports = pool;