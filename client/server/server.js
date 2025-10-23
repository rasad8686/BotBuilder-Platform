require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// CORS - Allow Vercel deployments
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.startsWith('http://localhost:')) return callback(null, true);
    if (origin.includes('bot-builder-platform') && origin.includes('vercel.app')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(helmet());
app.use(express.json());

// Rate limiters
// Rate limiters (DISABLED FOR TESTING)
const authLimiter = (req, res, next) => next(); // Bypass
const apiLimiter = (req, res, next) => next(); // Bypass

// Auth Middleware
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Setup Database Tables
async function setupDatabase() {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bots table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bots (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        token VARCHAR(255) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables ready');
  } catch (err) {
    console.error('❌ Database setup error:', err);
  }
}

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🚀 BotBuilder Backend is LIVE!',
    version: '2.0',
    endpoints: ['/auth/register', '/auth/login', '/bots']
  });
});

// Register
app.post('/auth/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id',
      [name, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, token, user: { id: user.id, name, email } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/auth/login', authLimiter, async (req, res) => {
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
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get bots
app.get('/bots', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bots WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({
      success: true,
      message: 'Bots retrieved successfully',
      bots: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Get bots error:', error);
    res.status(500).json({ error: 'Failed to fetch bots' });
  }
});

// Create bot
app.post('/bots', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const { name, description, token } = req.body;

    if (!name || !token) {
      return res.status(400).json({ error: 'Name and token required' });
    }

    const result = await pool.query(
      'INSERT INTO bots (name, description, token, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, token, req.userId]
    );

    res.json({
      success: true,
      message: 'Bot created successfully',
      bot: result.rows[0]
    });
  } catch (error) {
    console.error('Create bot error:', error);
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

// Update bot
app.put('/bots/:id', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, token, description } = req.body;

    const result = await pool.query(
      'UPDATE bots SET name = $1, token = $2, description = $3 WHERE id = $4 AND user_id = $5 RETURNING *',
      [name, token, description, id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json({
      success: true,
      message: 'Bot updated successfully',
      bot: result.rows[0]
    });
  } catch (error) {
    console.error('Update bot error:', error);
    res.status(500).json({ error: 'Failed to update bot' });
  }
});

// Delete bot
app.delete('/bots/:id', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM bots WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json({
      success: true,
      message: 'Bot deleted successfully',
      deletedId: parseInt(id)
    });
  } catch (error) {
    console.error('Delete bot error:', error);
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Start server
setupDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('🚀 BotBuilder Backend is LIVE!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('═══════════════════════════════════════');
    console.log('');
  });
});