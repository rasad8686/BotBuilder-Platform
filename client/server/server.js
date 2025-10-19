const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS - Vercel frontend + localhost
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174', 
    'http://localhost:5175',
    'https://bot-builder-platform.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());

// ✅ Test route
app.get('/test', (req, res) => {
  res.json({ 
    message: 'BotBuilder Backend is LIVE!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ✅ Auth routes
app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        message: 'All fields required',
        required: ['username', 'email', 'password']
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Invalid email format' 
      });
    }

    // Password length check
    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters' 
      });
    }

    // TODO: Database save (gələcək)
    // For now, just return success
    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      user: { 
        id: Date.now(),
        username, 
        email,
        createdAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password required' 
      });
    }

    // TODO: Database check (gələcək)
    // For now, just return mock success
    res.json({
      success: true,
      message: 'Login successful!',
      token: 'mock-jwt-token-' + Date.now(),
      user: { 
        id: Date.now(),
        email,
        username: 'Demo User'
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// ✅ Bot routes (CRUD)
app.get('/bots', async (req, res) => {
  try {
    // TODO: Get from database - real implementation now
    const bots = []; // Placeholder for now, will be replaced with DB query
    
    res.json({
      success: true,
      message: 'Bots retrieved successfully',
      bots: bots,
      total: bots.length
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

app.post('/bots', (req, res) => {
  try {
   const { name, description } = req.body;

if (!name || name.trim() === '') {
    return res.status(400).json({
        message: 'Bot name is required'
    });
}

// Auto-generate token
const token = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // TODO: Save to database
    res.status(201).json({ 
      success: true,
      message: 'Bot created successfully!',
      bot: { 
        id: Date.now(), 
        name, 
        token,
        description: description || '',
        status: 'active',
        createdAt: new Date().toISOString()
      }
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

app.get('/bots/:id', (req, res) => {
  const { id } = req.params;
  
  // TODO: Get from database
  res.json({
    success: true,
    bot: {
      id: parseInt(id),
      name: 'Demo Bot',
      token: 'demo-token-123',
      status: 'active',
      createdAt: new Date().toISOString()
    }
  });
});

app.put('/bots/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, token, description } = req.body;
    
    // TODO: Update in database
    res.json({
      success: true,
      message: 'Bot updated successfully!',
      bot: {
        id: parseInt(id),
        name,
        token,
        description,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Update bot error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

app.delete('/bots/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // TODO: Delete from database
    res.json({
      success: true,
      message: 'Bot deleted successfully!',
      deletedId: parseInt(id)
    });
  } catch (error) {
    console.error('Delete bot error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method,
    availableRoutes: [
      'GET /test',
      'POST /auth/register',
      'POST /auth/login',
      'GET /bots',
      'POST /bots',
      'GET /bots/:id',
      'PUT /bots/:id',
      'DELETE /bots/:id'
    ]
  });
});

// ✅ Error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log('🚀 ═══════════════════════════════════════');
  console.log(`🚀 BotBuilder Backend is LIVE!`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 Time: ${new Date().toLocaleString()}`);
  console.log('🚀 ═══════════════════════════════════════');
});