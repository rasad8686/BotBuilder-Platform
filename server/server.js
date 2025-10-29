const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS - Vercel frontend + localhost
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    
    // Allow localhost
    if (origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    
    // Allow all Vercel deployments (production + previews)
    if (origin.includes('bot-builder-platform') && origin.includes('vercel.app')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
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

    // TODO: Database save - For now just creating user
    // In production, hash password and save to database
    const userId = Date.now();
    const user = {
      id: userId,
      username: username,
      email: email,
      createdAt: new Date().toISOString()
    };

    // Generate real JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      token: token,
      user: user
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

    // TODO: Database check - For now accepting any credentials
    // In production, verify against database
    const userId = Date.now();
    const user = {
      id: userId,
      email: email,
      username: email.split('@')[0] || 'User'
    };

    // Generate real JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful!',
      token: token,
      user: user
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

// ✅ Bot routes (CRUD) - Using modular router
app.use('/api/bots', require('./routes/bots'));

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
      'POST /api/bots (Auth Required)',
      'GET /api/bots (Auth Required)',
      'GET /api/bots/:id (Auth Required)',
      'PUT /api/bots/:id (Auth Required)',
      'DELETE /api/bots/:id (Auth Required)'
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