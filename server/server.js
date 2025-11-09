const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const path = require('path');
const db = require('./db');
const { logRegister, logLogin } = require('./middleware/audit');
const log = require('./utils/logger');
const { detectCustomDomain } = require('./middleware/whitelabel');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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
        console.log('\n🔐 ========================================');
        console.log('🔐 CREATING ADMIN ACCOUNT...');
        console.log('🔐 ========================================');

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

        console.log('\n🎉 ========================================');
        console.log('✅ ADMIN ACCOUNT CREATED SUCCESSFULLY!');
        console.log('========================================');
        console.log(`📧 Email: ${adminConfig.email}`);
        console.log(`🔑 Password: ${adminConfig.password}`);
        console.log(`👤 Name: ${adminConfig.name}`);
        console.log(`👑 Role: admin`);
        console.log(`🏢 Organization: ${adminOrg.name} (${adminOrg.slug})`);
        console.log(`💎 Plan: Enterprise`);
        console.log(`🌐 Environment: ${isProduction ? 'PRODUCTION' : 'LOCAL DEVELOPMENT'}`);
        console.log(`🆔 User ID: ${adminUser.id}`);
        console.log(`🏢 Org ID: ${adminOrg.id}`);
        console.log('========================================\n');
      } else {
        console.log(`✅ Admin account already exists: ${adminConfig.email}`);
      }
    }
  } catch (error) {
    console.error('\n❌ ========================================');
    console.error('❌ ERROR CREATING ADMIN ACCOUNT');
    console.error('========================================');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('========================================\n');
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

    // Allow all Vercel deployments (production + previews)
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
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

// ✅ Domain detection middleware (for white-label custom domains)
app.use(detectCustomDomain);

// ✅ Serve uploaded files (logos, favicons, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
  console.log('\n========== NEW REGISTRATION ATTEMPT ==========');
  console.log('[REGISTER] Request body:', { username: req.body.username, email: req.body.email, hasPassword: !!req.body.password });

  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      console.log('[REGISTER] Validation failed: Missing fields');
      return res.status(400).json({
        message: 'All fields required',
        required: ['username', 'email', 'password']
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[REGISTER] Validation failed: Invalid email format');
      return res.status(400).json({
        message: 'Invalid email format'
      });
    }

    // Password length check
    if (password.length < 6) {
      console.log('[REGISTER] Validation failed: Password too short');
      return res.status(400).json({
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if email already exists
    console.log('[REGISTER] Step 1: Checking if email exists...');
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log('[REGISTER] Email already registered');
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    console.log('[REGISTER] ✓ Email is available');

    // Hash password
    console.log('[REGISTER] Step 2: Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('[REGISTER] ✓ Password hashed');

    // Insert user into database
    console.log('[REGISTER] Step 3: Creating user in database...');
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, email, email_verified, created_at`,
      [username, email, hashedPassword, false]
    );

    const user = result.rows[0];
    console.log(`[REGISTER] ✓ User created successfully!`);
    console.log(`[REGISTER]   - User ID: ${user.id}`);
    console.log(`[REGISTER]   - Email: ${user.email}`);
    console.log(`[REGISTER]   - Name: ${user.name}`);

    // Verify user was created
    const verifyUser = await db.query('SELECT id, name, email FROM users WHERE id = $1', [user.id]);
    if (verifyUser.rows.length === 0) {
      throw new Error('User verification failed - user not found after creation');
    }
    console.log('[REGISTER] ✓ User verified in database');

    // Create personal organization
    console.log('[REGISTER] Step 4: Creating organization...');
    const orgSlug = `${username.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${user.id}`;
    const orgName = `${username}'s Organization`;
    console.log(`[REGISTER]   - Organization name: ${orgName}`);
    console.log(`[REGISTER]   - Organization slug: ${orgSlug}`);
    console.log(`[REGISTER]   - Owner ID: ${user.id}`);

    const orgResult = await db.query(
      `INSERT INTO organizations (name, slug, owner_id, plan_tier, settings, created_at, updated_at)
       VALUES ($1, $2, $3, 'free', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, slug, owner_id`,
      [orgName, orgSlug, user.id]
    );

    const organization = orgResult.rows[0];
    const organizationId = organization.id;
    console.log(`[REGISTER] ✓ Organization created successfully!`);
    console.log(`[REGISTER]   - Organization ID: ${organizationId}`);
    console.log(`[REGISTER]   - Name: ${organization.name}`);
    console.log(`[REGISTER]   - Slug: ${organization.slug}`);
    console.log(`[REGISTER]   - Owner ID: ${organization.owner_id}`);

    // Verify organization was created
    const verifyOrg = await db.query('SELECT id, name, slug, owner_id FROM organizations WHERE id = $1', [organizationId]);
    if (verifyOrg.rows.length === 0) {
      throw new Error('Organization verification failed - organization not found after creation');
    }
    console.log('[REGISTER] ✓ Organization verified in database');

    // Add user as admin to organization
    console.log('[REGISTER] Step 5: Adding user to organization as admin...');
    console.log(`[REGISTER]   - org_id: ${organizationId}`);
    console.log(`[REGISTER]   - user_id: ${user.id}`);
    console.log(`[REGISTER]   - role: admin`);

    const memberResult = await db.query(
      `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP)
       RETURNING id, org_id, user_id, role, status`,
      [organizationId, user.id]
    );

    const membership = memberResult.rows[0];
    console.log(`[REGISTER] ✓ User added to organization successfully!`);
    console.log(`[REGISTER]   - Membership ID: ${membership.id}`);
    console.log(`[REGISTER]   - Org ID: ${membership.org_id}`);
    console.log(`[REGISTER]   - User ID: ${membership.user_id}`);
    console.log(`[REGISTER]   - Role: ${membership.role}`);
    console.log(`[REGISTER]   - Status: ${membership.status}`);

    // Verify membership was created
    const verifyMember = await db.query(
      'SELECT id, org_id, user_id, role FROM organization_members WHERE org_id = $1 AND user_id = $2',
      [organizationId, user.id]
    );
    if (verifyMember.rows.length === 0) {
      throw new Error('Membership verification failed - membership not found after creation');
    }
    console.log('[REGISTER] ✓ Membership verified in database');

    // Generate JWT token
    console.log('[REGISTER] Step 6: Generating JWT token...');
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
    console.log(`[REGISTER] ✓ JWT token generated`);
    console.log(`[REGISTER]   - User ID in token: ${user.id}`);
    console.log(`[REGISTER]   - Organization ID in token: ${organizationId}`);

    // Final verification query
    console.log('[REGISTER] Step 7: Final verification...');
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
    console.log('[REGISTER] ✓✓✓ FINAL VERIFICATION PASSED ✓✓✓');
    console.log(`[REGISTER]   - User ID: ${finalData.user_id}`);
    console.log(`[REGISTER]   - Email: ${finalData.email}`);
    console.log(`[REGISTER]   - Organization ID: ${finalData.org_id}`);
    console.log(`[REGISTER]   - Organization Name: ${finalData.org_name}`);
    console.log(`[REGISTER]   - User Role: ${finalData.user_role}`);

    // Log successful registration to audit trail
    await logRegister(req, user.id, user.email);

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

    console.log(`[REGISTER] ✓✓✓ REGISTRATION COMPLETE FOR ${user.email} ✓✓✓`);
    console.log('========== REGISTRATION SUCCESS ==========\n');

  } catch (error) {
    console.error('\n❌❌❌ REGISTRATION ERROR ❌❌❌');
    console.error('[REGISTER] Error type:', error.name);
    console.error('[REGISTER] Error message:', error.message);
    console.error('[REGISTER] Error stack:', error.stack);
    console.error('[REGISTER] Error code:', error.code);
    console.error('[REGISTER] Error detail:', error.detail);
    console.error('========== REGISTRATION FAILED ==========\n');

    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message,
      errorCode: error.code,
      errorDetail: error.detail
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

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method,
    availableRoutes: [
      'GET /test',
      'POST /api/auth/register',
      'POST /api/auth/login',
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
app.listen(PORT, async () => {
  console.log('🚀 ═══════════════════════════════════════');
  console.log(`🚀 BotBuilder Backend is LIVE!`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 Time: ${new Date().toLocaleString()}`);
  console.log('🚀 ═══════════════════════════════════════');

  // 🔐 Create admin account automatically
  await ensureAdminExists();
});