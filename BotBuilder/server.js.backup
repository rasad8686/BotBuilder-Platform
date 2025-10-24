require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Connected to PostgreSQL database!');
    release();
  }
});

// Import routes
const authRoutes = require('./routes/auth');
//const botRoutes = require('./routes/bots');
// Use routes
//app.use('/auth', authRoutes);
//app.use('/bots', botRoutes);
// ========================================
// Bot Routes - Database Operations
// ========================================

// GET /bots - List all bots
app.get('/bots', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bots ORDER BY created_at DESC'
    );
    
    res.json({
      success: true,
      message: 'Bots retrieved successfully',
      bots: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Get bots error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// POST /bots - Create new bot
app.post('/bots', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Bot name is required'
      });
    }

    // Auto-generate token
    const token = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result = await pool.query(
      'INSERT INTO bots (name, token, description, status, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [name, token, description || '', 'active']
    );

    res.status(201).json({
      success: true,
      message: 'Bot created successfully!',
      bot: result.rows[0]
    });
  } catch (error) {
    console.error('Create bot error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});
res.json({ 
    message: 'Welcome to BotBuilder API!',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        register: 'POST /auth/register',
        login: 'POST /auth/login'
      }
    }
  });
//});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    database: 'connected'
  });
});

app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
  console.log('Database: ' + (process.env.DATABASE_URL ? 'Connected' : 'Not configured'));
});