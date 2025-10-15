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
const botRoutes = require('./routes/bots');
// Use routes
app.use('/auth', authRoutes);
app.use('/bots', botRoutes);
app.get('/', (req, res) => {
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
});

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