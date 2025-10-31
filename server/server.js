const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

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

    // Check if email already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database (using correct column names from schema)
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, email, email_verified, created_at`,
      [username, email, hashedPassword, false]
    );

    const user = result.rows[0];
    console.log(`[Register] User created with ID: ${user.id}, email: ${user.email}`);

    // Create personal organization for the new user
    const orgSlug = `${username.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${user.id}`;
    const orgResult = await db.query(
      `INSERT INTO organizations (name, slug, owner_id, plan_tier, settings, created_at, updated_at)
       VALUES ($1, $2, $3, 'free', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [`${username}'s Organization`, orgSlug, user.id]
    );

    const organizationId = orgResult.rows[0].id;
    console.log(`[Register] Organization created with ID: ${organizationId}, slug: ${orgSlug}`);

    // Add user as admin to their organization
    await db.query(
      `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP)`,
      [organizationId, user.id]
    );
    console.log(`[Register] User added to organization as admin`);

    // Generate JWT token with REAL database user ID and organization ID
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.name, // Map 'name' from DB to 'username' in JWT
        current_organization_id: organizationId
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      { expiresIn: '24h' }
    );

    console.log(`[Register] JWT token generated for user ${user.id} with org ${organizationId}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      token: token,
      user: {
        id: user.id,
        username: user.name,
        email: user.email,
        isVerified: user.email_verified,
        createdAt: user.created_at,
        currentOrganizationId: organizationId
      }
    });

    console.log(`[Register] Registration complete for ${user.email}`);

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

    // Query database for user (using correct column names from schema)
    const result = await db.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    // Check if user exists
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Get user's default organization (first one they joined)
    const orgResult = await db.query(
      `SELECT om.org_id
       FROM organization_members om
       WHERE om.user_id = $1 AND om.status = 'active'
       ORDER BY om.joined_at ASC
       LIMIT 1`,
      [user.id]
    );

    let organizationId = null;
    if (orgResult.rows.length > 0) {
      organizationId = orgResult.rows[0].org_id;
    }

    // Generate JWT token with REAL database user ID and organization ID
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.name, // Map 'name' from DB to 'username' in JWT
        current_organization_id: organizationId
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful!',
      token: token,
      user: {
        id: user.id,
        username: user.name,
        email: user.email,
        currentOrganizationId: organizationId
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

// ✅ Bot routes (CRUD) - Using modular router
app.use('/api/bots', require('./routes/bots'));

// ✅ Messages routes (CRUD) - Using modular router
app.use('/api/messages', require('./routes/messages'));

// ✅ Organizations routes (Multi-Tenant) - Using modular router
app.use('/api/organizations', require('./routes/organizations'));

// ✅ Bot Flows routes (Visual Flow Builder) - Using modular router
app.use('/api/bots', require('./routes/botFlows'));

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
      'DELETE /api/bots/:id (Auth Required)',
      'POST /api/messages (Auth Required)',
      'GET /api/messages/bot/:botId (Auth Required)',
      'GET /api/messages/:id (Auth Required)',
      'PUT /api/messages/:id (Auth Required)',
      'DELETE /api/messages/:id (Auth Required)',
      'POST /api/bots/:botId/flow (Auth Required)',
      'GET /api/bots/:botId/flow (Auth Required)',
      'PUT /api/bots/:botId/flow/:flowId (Auth Required)',
      'GET /api/bots/:botId/flow/history (Auth Required)'
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