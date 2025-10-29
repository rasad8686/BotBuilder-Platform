require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Import routes
const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bots');
const messageRoutes = require('./routes/messages');
const subscriptionRoutes = require('./routes/subscriptions');
const apiTokenRoutes = require('./routes/apiTokens');
const webhookRoutes = require('./routes/webhooks');
const analyticsRoutes = require('./routes/analytics');

// ===============================
// MIDDLEWARE
// ===============================

// CORS Configuration - Allow ALL localhost ports in development
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In production, only allow specific domains
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = [
        'https://botbuilder-platform.onrender.com',
        'https://botbuilder-platform.vercel.app',
        'https://bot-builder-platform.vercel.app',
        /^https:\/\/.*\.vercel\.app$/
      ];

      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') return allowed === origin;
        return allowed.test(origin);
      });

      if (isAllowed) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    }

    // In development, allow all localhost ports
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    // Fallback: deny
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
  maxAge: 86400 // 24 hours
}));

app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`\n📨 ${req.method} ${req.path}`);
  if (Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  if (req.headers.authorization) {
    console.log('🔑 Authorization header present');
  }
  next();
});

// Database Health Check Middleware (for API routes only)
app.use('/auth', (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      error: 'Database not connected',
      message: 'Server is running but database connection is not available. Please check DATABASE_URL configuration.'
    });
  }
  next();
});

app.use('/bots', (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      error: 'Database not connected',
      message: 'Server is running but database connection is not available. Please check DATABASE_URL configuration.'
    });
  }
  next();
});

// ===============================
// ROUTES
// ===============================

// Health Check
app.get('/', async (req, res) => {
  let dbStatus = 'Not Connected';
  let dbDetails = null;

  if (pool) {
    try {
      const result = await pool.query('SELECT NOW() as time, current_database() as database');
      dbStatus = 'Connected';
      dbDetails = {
        database: result.rows[0].database,
        time: result.rows[0].time,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount
      };
    } catch (err) {
      dbStatus = 'Error: ' + err.message;
    }
  }

  res.json({
    status: '🚀 BotBuilder API Live!',
    version: '1.0.0',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    databaseDetails: dbDetails,
    cors: {
      policy: process.env.NODE_ENV === 'production'
        ? 'Specific domains only (Vercel, Render)'
        : 'All localhost ports allowed',
      info: process.env.NODE_ENV === 'production'
        ? ['https://botbuilder-platform.onrender.com', 'https://*.vercel.app']
        : ['http://localhost:*', 'http://127.0.0.1:*']
    }
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/bots', botRoutes);
app.use('/bots', messageRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/api-tokens', apiTokenRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/analytics', analyticsRoutes);

// ===============================
// ERROR HANDLING
// ===============================

// 404 Handler
app.use((req, res) => {
  console.log('❌ 404 - Endpoint not found:', req.path);
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((error, req, res, next) => {
  console.error('❌ Unexpected error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   🚀 BOTBUILDER BACKEND STARTED! 🚀   ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\n📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? '✅ Configured' : '❌ NOT SET'}`);
  console.log(`💾 Database: ${pool ? '✅ PostgreSQL Connected' : '❌ Not Connected'}`);
  console.log('\n🔗 API Endpoints:');
  console.log('   POST   /auth/register');
  console.log('   POST   /auth/login');
  console.log('   GET    /bots (protected)');
  console.log('   POST   /bots (protected)');
  console.log('   GET    /bots/:id (protected)');
  console.log('   PUT    /bots/:id (protected)');
  console.log('   DELETE /bots/:id (protected)');
  console.log('   GET    /bots/:botId/messages (protected)');
  console.log('   POST   /bots/:botId/messages (protected)');
  console.log('   DELETE /bots/:botId/messages/:messageId (protected)');
  console.log('   GET    /subscriptions/plans');
  console.log('   GET    /subscriptions/current (protected)');
  console.log('   POST   /subscriptions/create-checkout (protected)');
  console.log('   GET    /api-tokens (protected)');
  console.log('   POST   /api-tokens (protected)');
  console.log('   GET    /webhooks/:botId/logs (protected)');
  console.log('   POST   /webhooks/:botId/test (protected)');
  console.log('   GET    /analytics/usage (protected)');
  console.log('   GET    /analytics/dashboard (protected)');
  console.log('\n✅ Server ready!\n');
  console.log('════════════════════════════════════════\n');
});

module.exports = app;
