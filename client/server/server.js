require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 10000;

// Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// CORS - Allow all Vercel
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.includes('localhost') || origin.includes('vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Auth Middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Setup DB
async function setupDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Users table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bots (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        description TEXT,
        token VARCHAR(255) UNIQUE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Bots table ready');

    // Migration: Ensure user_id index exists
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id)
      `);
      console.log('✅ Migration: user_id index checked');
    } catch (migrationError) {
      console.error('⚠️ Migration warning:', migrationError.message);
    }

  } catch (err) {
    console.error('❌ DB error:', err);
    throw err;
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({ message: '🚀 BotBuilder API v2.1', status: 'live' });
});

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id',
      [name, email, hash]
    );

    const token = jwt.sign({ userId: result.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: result.rows[0].id, name, email } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get bots
app.get('/bots', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bots WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ success: true, bots: result.rows, total: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bots' });
  }
});

// Create bot
app.post('/bots', auth, async (req, res) => {
  try {
    const { name, description, token } = req.body;
    if (!name || !token) {
      return res.status(400).json({ error: 'Name and token required' });
    }

    const result = await pool.query(
      'INSERT INTO bots (name, description, token, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, token, req.userId]
    );
    res.json({ success: true, bot: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

// Update bot
app.put('/bots/:id', auth, async (req, res) => {
  try {
    const { name, token, description } = req.body;
    const result = await pool.query(
      'UPDATE bots SET name = $1, token = $2, description = $3 WHERE id = $4 AND user_id = $5 RETURNING *',
      [name, token, description, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json({ success: true, bot: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update bot' });
  }
});

// Delete bot
app.delete('/bots/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM bots WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json({ success: true, deletedId: parseInt(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

// Start
setupDB().then(() => {
  app.listen(PORT, () => {
    console.log('🚀 BotBuilder Backend LIVE!');
    console.log(`📍 Port: ${PORT}`);
  });
});