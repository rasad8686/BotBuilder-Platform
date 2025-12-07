const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const db = require('./db');
const { logRegister, logLogin } = require('./middleware/audit');
const log = require('./utils/logger');
const { detectCustomDomain } = require('./middleware/whitelabel');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const securityHeaders = require('./middleware/securityHeaders');
const { initializeWebSocket } = require('./websocket');

// Load .env from server directory (same directory as this file)
dotenv.config({ path: path.join(__dirname, '.env') });

// Verify email configuration loaded
log.info('Email configuration check', {
  EMAIL_USER: process.env.EMAIL_USER ? 'loaded' : 'missing',
  EMAIL_PASS: process.env.EMAIL_PASS ? 'loaded' : 'missing'
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize WebSocket
const { io, executionSocket } = initializeWebSocket(server);

// ========================================
// 🔐 AUTO-ADMIN ACCOUNT CREATION
// ========================================
/**
 * Automatically creates admin account on server startup
 * - LOCAL: admin@local.dev / admin123
 * - PRODUCTION: dunugojaev@gmail.com + admin@local.dev (for testing)
 */
async function ensureAdminExists() {
  try {
    const isProduction = process.env.NODE_ENV === 'production';

    // Admin configurations to create
    const adminConfigs = isProduction ? [
      {
        email: process.env.ADMIN_EMAIL || 'dunugojaev@gmail.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@BotBuilder2025!SecurePass',
        name: 'Dunu Admin',
        orgSlug: 'dunu-admin-org',
        orgName: 'Dunu Admin Organization'
      },
      {
        email: 'admin@local.dev',
        password: 'admin123',
        name: 'Test Admin',
        orgSlug: 'test-admin-org',
        orgName: 'Test Admin Organization'
      }
    ] : [
      {
        email: 'admin@local.dev',
        password: 'admin123',
        name: 'Local Admin',
        orgSlug: 'local-admin-org',
        orgName: 'Local Admin Organization'
      }
    ];

    // Create each admin account if it doesn't exist
    for (const adminConfig of adminConfigs) {
      // Check if admin exists
      const existingAdmin = await db.query(
        'SELECT id, name, email FROM users WHERE email = $1',
        [adminConfig.email]
      );

      if (existingAdmin.rows.length === 0) {
        log.info('Creating admin account', { email: adminConfig.email });

        // Hash password with bcrypt
        const hashedPassword = await bcrypt.hash(adminConfig.password, 10);

        // Create admin user with is_verified = true
        const userResult = await db.query(
          `INSERT INTO users (name, email, password_hash, email_verified, created_at, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id, name, email`,
          [adminConfig.name, adminConfig.email, hashedPassword, true]
        );

        const adminUser = userResult.rows[0];

        // Create organization for admin
        const orgResult = await db.query(
          `INSERT INTO organizations (name, slug, owner_id, plan_tier, settings, created_at, updated_at)
           VALUES ($1, $2, $3, 'enterprise', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id, name, slug`,
          [adminConfig.orgName, adminConfig.orgSlug, adminUser.id]
        );

        const adminOrg = orgResult.rows[0];

        // Add admin to organization with admin role
        await db.query(
          `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
           VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP)`,
          [adminOrg.id, adminUser.id]
        );

        log.info('Admin account created successfully', {
          email: adminConfig.email,
          name: adminConfig.name,
          userId: adminUser.id,
          orgId: adminOrg.id,
          orgName: adminOrg.name,
          environment: isProduction ? 'production' : 'development'
        });
      } else {
        log.debug('Admin account already exists', { email: adminConfig.email });
      }
    }
  } catch (error) {
    log.error('Error creating admin account', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
  }
}

// ✅ CORS - Vercel frontend + localhost
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);

    // Allow localhost
    if (origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }

    // Allow production domain
    if (origin === 'https://bot-builder-platform.vercel.app') {
      return callback(null, true);
    }

    // Allow all Vercel deployments (production + previews)
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id']
}));

// ✅ Stripe webhook requires raw body for signature verification
// Must be BEFORE express.json() to capture raw body
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// ✅ HTTP request logging with Morgan
// Custom format: :method :url :status :response-time ms - :user-agent
morgan.token('user-agent', (req) => req.headers['user-agent']);

// Create custom stream to pipe Morgan output to Winston
const morganStream = {
  write: (message) => {
    log.http(message.trim());
  }
};

// Use Morgan with custom format and Winston stream
app.use(morgan(':method :url :status :response-time ms - :user-agent', {
  stream: morganStream,
  skip: (req, res) => {
    // Skip logging for test route in production to reduce noise
    if (process.env.NODE_ENV === 'production' && req.path === '/test') {
      return true;
    }
    return false;
  }
}));

// ✅ Security headers middleware
app.use(securityHeaders);

// ✅ Domain detection middleware (for white-label custom domains)
app.use(detectCustomDomain);

// ✅ Rate limiting for API routes
app.use('/api/', apiLimiter);

// ✅ Serve uploaded files (logos, favicons, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ✅ Serve widget.js with CORS headers for cross-origin embedding
app.get('/widget.js', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../public/widget.js'));
});

// ✅ Serve public static files (widget assets)
app.use(express.static(path.join(__dirname, '../public')));

// ✅ Test route
app.get('/test', (req, res) => {
  res.json({ 
    message: 'BotBuilder Backend is LIVE!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ✅ Auth routes
app.post('/api/auth/register', async (req, res) => {
  log.info('Registration attempt', { email: req.body.email });

  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      log.debug('Registration validation failed: Missing fields');
      return res.status(400).json({
        message: 'All fields required',
        required: ['username', 'email', 'password']
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      log.debug('Registration validation failed: Invalid email', { email });
      return res.status(400).json({
        message: 'Invalid email format'
      });
    }

    // Password length check
    if (password.length < 6) {
      log.debug('Registration validation failed: Password too short');
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
      log.debug('Registration failed: Email already registered', { email });
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, email, email_verified, created_at`,
      [username, email, hashedPassword, false]
    );

    const user = result.rows[0];
    log.debug('User created', { userId: user.id, email: user.email });

    // Verify user was created
    const verifyUser = await db.query('SELECT id, name, email FROM users WHERE id = $1', [user.id]);
    if (verifyUser.rows.length === 0) {
      throw new Error('User verification failed - user not found after creation');
    }

    // Create personal organization
    const orgSlug = `${username.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${user.id}`;
    const orgName = `${username}'s Organization`;

    const orgResult = await db.query(
      `INSERT INTO organizations (name, slug, owner_id, plan_tier, settings, created_at, updated_at)
       VALUES ($1, $2, $3, 'free', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, slug, owner_id`,
      [orgName, orgSlug, user.id]
    );

    const organization = orgResult.rows[0];
    const organizationId = organization.id;
    log.debug('Organization created', { orgId: organizationId, orgSlug });

    // Verify organization was created
    const verifyOrg = await db.query('SELECT id, name, slug, owner_id FROM organizations WHERE id = $1', [organizationId]);
    if (verifyOrg.rows.length === 0) {
      throw new Error('Organization verification failed - organization not found after creation');
    }

    // Add user as admin to organization
    const memberResult = await db.query(
      `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP)
       RETURNING id, org_id, user_id, role, status`,
      [organizationId, user.id]
    );

    const membership = memberResult.rows[0];

    // Verify membership was created
    const verifyMember = await db.query(
      'SELECT id, org_id, user_id, role FROM organization_members WHERE org_id = $1 AND user_id = $2',
      [organizationId, user.id]
    );
    if (verifyMember.rows.length === 0) {
      throw new Error('Membership verification failed - membership not found after creation');
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.name,
        current_organization_id: organizationId
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      { expiresIn: '24h' }
    );

    // Final verification query
    const finalCheck = await db.query(`
      SELECT
        u.id as user_id,
        u.email,
        u.name,
        o.id as org_id,
        o.name as org_name,
        o.slug as org_slug,
        om.role as user_role
      FROM users u
      JOIN organizations o ON o.owner_id = u.id
      JOIN organization_members om ON om.org_id = o.id AND om.user_id = u.id
      WHERE u.id = $1
    `, [user.id]);

    if (finalCheck.rows.length === 0) {
      throw new Error('Final verification failed - user/organization relationship not found');
    }

    const finalData = finalCheck.rows[0];

    // Log successful registration to audit trail
    await logRegister(req, user.id, user.email);

    log.info('Registration successful', { userId: user.id, email: user.email, orgId: organizationId });

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

  } catch (error) {
    log.error('Registration error', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });

    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      // SECURITY: Don't expose error details in production
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
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
      // Log failed login attempt - user not found
      await logLogin(req, null, false, 'User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Log failed login attempt - invalid password
      await logLogin(req, user.id, false, 'Invalid password');
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

    // Log successful login to audit trail
    await logLogin(req, user.id, true);

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
    log.error('Login error', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ✅ Demo Login Endpoint - Auto-login for demo account
app.post('/api/auth/demo', async (req, res) => {
  try {
    log.info('Demo login request');

    // Demo credentials
    const demoEmail = 'demo@botbuilder.com';

    // Query database for demo user
    const result = await db.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [demoEmail]
    );

    // Check if demo user exists
    if (result.rows.length === 0) {
      log.warn('Demo user not found');
      return res.status(404).json({
        success: false,
        message: 'Demo account not found. Please contact support.'
      });
    }

    const user = result.rows[0];

    // Get demo user's organization
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

    // Generate JWT token for demo user
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.name,
        current_organization_id: organizationId,
        is_demo: true // Flag to identify demo users
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      { expiresIn: '24h' }
    );

    // Log demo login to audit trail
    await logLogin(req, user.id, true, 'Demo login');

    log.info('Demo login successful', { userId: user.id, orgId: organizationId });

    res.json({
      success: true,
      message: 'Demo login successful! You are viewing a demo account.',
      token: token,
      user: {
        id: user.id,
        username: user.name,
        email: user.email,
        currentOrganizationId: organizationId,
        isDemo: true
      }
    });

  } catch (error) {
    log.error('Demo login error', { message: error.message });
    res.status(500).json({
      success: false,
      message: 'Demo login error'
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

// ✅ Bot AI routes - Mount at /api/bots to handle /api/bots/:id/ai/* endpoints
app.use('/api/bots', require('./routes/ai'));

// ✅ Admin routes (Monitoring & Audit) - Using modular router
app.use('/api/admin', require('./routes/admin'));

// ✅ White-label routes (Custom Branding) - Using modular router
app.use('/api/whitelabel', require('./routes/whitelabel'));

// ✅ Billing routes (Subscription Management) - Using modular router
app.use('/api/billing', require('./routes/billing'));

// ✅ AI public routes - Mount at /api/ai for public endpoints like /api/ai/providers
app.use('/api/ai', require('./routes/ai'));

// ✅ Analytics routes - Using modular router
app.use('/api/analytics', require('./routes/analytics'));

// ✅ Webhooks routes - Using modular router
app.use('/api/webhooks', require('./routes/webhooks'));

// ✅ Feedback routes
app.use('/api/feedback', require('./routes/feedback'));

// ✅ API Tokens routes
app.use('/api/api-tokens', require('./routes/api-tokens'));

// ✅ Multi-Agent AI routes
app.use('/api/agents', require('./routes/agents'));
app.use('/api/workflows', require('./routes/workflows'));
app.use('/api/executions', require('./routes/executions'));

// ✅ Tools routes (Tool Calling / Function Calling)
app.use('/api/tools', require('./routes/tools'));

// ✅ Knowledge Base routes (Vector DB / RAG)
app.use('/api/knowledge', require('./routes/knowledge'));

// ✅ Plugin Marketplace routes
app.use('/api/plugins', require('./routes/plugins'));

// ✅ Channel Management routes (WhatsApp, Instagram, Telegram)
app.use('/api/channels', require('./routes/channels'));

// ✅ Channel Webhooks (incoming messages from messaging platforms)
app.use('/webhooks', require('./routes/channelWebhooks'));

// ✅ Team Collaboration routes
app.use('/api/team', require('./routes/team'));

// ✅ Version Control routes
app.use('/api/versions', require('./routes/versions'));

// ✅ AI Flow Generation routes
app.use('/api/ai/flow', require('./routes/aiFlow'));

// ✅ Orchestrations routes (Multi-flow management)
app.use('/api/orchestrations', require('./routes/orchestrations'));

// ✅ Intent & Entity routes (NLU)
app.use('/api/intents', require('./routes/intents'));
app.use('/api/entities', require('./routes/entities'));
app.use('/api/nlu', require('./routes/nlu'));

// ✅ Widget routes (Web Chat Widget)
app.use('/api/widget', require('./routes/widget'));

// ✅ Import error handler middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// ✅ 404 handler - use errorHandler version
app.use(notFoundHandler);

// ✅ Global error handler - SECURITY: No stack traces in production
app.use(errorHandler);

// ✅ Start server with WebSocket support
server.listen(PORT, async () => {
  log.info('BotBuilder Backend started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    websocket: 'enabled',
    time: new Date().toISOString()
  });

  // 🔐 Create admin account automatically
  await ensureAdminExists();
});