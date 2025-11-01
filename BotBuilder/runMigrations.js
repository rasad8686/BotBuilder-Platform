require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigrations() {
  console.log('Starting migrations...');
  
  try {
    const migrationFile = path.join(__dirname, 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: 001_initial_schema.sql');
    await pool.query(sql);
    
    console.log('Migration completed successfully!');
    console.log('Tables created: users, bots, bot_messages');
    
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigrations();