const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS - Frontend URLs
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'https://bot-builder-platform.vercel.app'
  ],
  credentials: true
}));

// Body Parser
app.use(express.json());

// Test Route
app.get('/', (req, res) => {
  res.json({ message: 'BotBuilder Backend is LIVE!', status: 'running' });
});

// Auth Routes
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Simple validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    
    // TODO: Add database logic here
    res.status(201).json({ 
      message: 'User registered successfully',
      token: 'dummy-token-for-now'
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // TODO: Add database logic here
    res.json({ 
      message: 'Login successful',
      token: 'dummy-token-for-now'
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});