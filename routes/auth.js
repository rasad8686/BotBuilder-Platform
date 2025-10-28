const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { sendWelcomeEmail } = require('../services/emailService');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Register endpoint
router.post('/register', async (req, res) => {
  // START DEBUGGING - Log incoming request
  console.log('\n========================================');
  console.log('📝 REGISTRATION REQUEST RECEIVED');
  console.log('========================================');
  console.log('🔍 Request Body:', JSON.stringify(req.body, null, 2));
  console.log('🔍 Headers:', JSON.stringify(req.headers, null, 2));

  try {
    // Check if database is connected
    console.log('🔍 Step 1: Checking database connection...');
    if (!pool) {
      console.error('❌ Database pool is null!');
      return res.status(503).json({
        error: 'Database not connected. Please try again later.'
      });
    }
    console.log('✅ Database pool exists');

    const { email, password, name } = req.body;
    console.log('🔍 Step 2: Extracted fields from body:');
    console.log(`   - email: ${email ? 'PROVIDED' : 'MISSING'} (${typeof email})`);
    console.log(`   - password: ${password ? 'PROVIDED' : 'MISSING'} (length: ${password ? password.length : 0})`);
    console.log(`   - name: ${name ? 'PROVIDED' : 'MISSING'} (${typeof name})`);

    // Validate required fields
    console.log('🔍 Step 3: Validating required fields...');
    if (!email || !password) {
      console.error('❌ Validation failed: Email or password missing');
      return res.status(400).json({ error: 'Email and password are required' });
    }
    console.log('✅ Email and password provided');

    if (!name || name.trim() === '') {
      console.error('❌ Validation failed: Name missing or empty');
      console.log(`   - name value: "${name}"`);
      console.log(`   - name type: ${typeof name}`);
      console.log(`   - name trimmed: "${name ? name.trim() : 'N/A'}"`);
      return res.status(400).json({ error: 'Name is required' });
    }
    console.log('✅ Name provided and not empty');

    // Validate email format
    console.log('🔍 Step 4: Validating email format...');
    console.log(`   - email value: "${email}"`);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('❌ Validation failed: Invalid email format');
      return res.status(400).json({ error: 'Invalid email format' });
    }
    console.log('✅ Email format valid');

    // Validate password strength
    console.log('🔍 Step 5: Validating password strength...');
    console.log(`   - password length: ${password.length}`);
    if (password.length < 6) {
      console.error('❌ Validation failed: Password too short');
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }
    console.log('✅ Password strength valid');

    // Normalize email to lowercase
    console.log('🔍 Step 6: Normalizing email and name...');
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedName = name.trim();
    console.log(`   - normalizedEmail: "${normalizedEmail}"`);
    console.log(`   - normalizedName: "${normalizedName}"`);

    // CRITICAL: Verify database schema before proceeding
    console.log('🔍 Step 6.5: Verifying database schema...');
    try {
      const schemaCheck = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      console.log('   📋 Users table columns:');
      schemaCheck.rows.forEach(col => {
        console.log(`      - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });

      const hasPasswordHash = schemaCheck.rows.some(col => col.column_name === 'password_hash');
      const hasPassword = schemaCheck.rows.some(col => col.column_name === 'password');

      console.log(`   - Has 'password_hash' column: ${hasPasswordHash ? '✅ YES' : '❌ NO'}`);
      console.log(`   - Has 'password' column: ${hasPassword ? '⚠️  YES (BAD!)' : '✅ NO (GOOD)'}`);

      if (!hasPasswordHash) {
        console.error('❌ CRITICAL: users table missing password_hash column!');
        return res.status(500).json({
          error: 'Database schema error. Please contact support.'
        });
      }

      if (hasPassword) {
        console.error('⚠️  WARNING: users table has old "password" column - schema mismatch!');
      }

      console.log('✅ Schema verification passed');
    } catch (schemaError) {
      console.error('❌ Schema verification failed:', schemaError.message);
      // Continue anyway - don't block registration on schema check failure
    }

    // Check if user already exists
    console.log('🔍 Step 7: Checking if user already exists...');
    console.log(`   - Query: SELECT * FROM users WHERE email = '${normalizedEmail}'`);

    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [normalizedEmail]
    );

    console.log(`   - Query result: ${existingUser.rows.length} row(s) found`);

    if (existingUser.rows.length > 0) {
      console.error('❌ User already exists');
      console.log(`   - Existing user ID: ${existingUser.rows[0].id}`);
      return res.status(400).json({
        error: 'Email already exists. Please login instead or use a different email.'
      });
    }
    console.log('✅ User does not exist, can proceed with registration');

    // Hash password with validation
    console.log('🔍 Step 8: Hashing password...');
    console.log(`   - bcrypt rounds: 10`);

    let hashedPassword;
    try {
      const hashStartTime = Date.now();
      hashedPassword = await bcrypt.hash(password, 10);
      const hashEndTime = Date.now();

      console.log(`   - Hash generation took: ${hashEndTime - hashStartTime}ms`);
      console.log(`   - Hash length: ${hashedPassword ? hashedPassword.length : 0}`);

      // Validate hash was created successfully
      if (!hashedPassword || hashedPassword.length < 20) {
        throw new Error('Password hash generation failed');
      }

      console.log(`✅ Password hashed successfully for ${normalizedEmail}`);
    } catch (hashError) {
      console.error(`❌ Password hashing error:`, hashError);
      console.error(`   - Error message: ${hashError.message}`);
      console.error(`   - Error stack:`, hashError.stack);
      return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }

    // Insert new user
    console.log('🔍 Step 9: Inserting user into database...');
    console.log(`   - Query: INSERT INTO users (email, password_hash, name) VALUES ('${normalizedEmail}', '[HASH]', '${normalizedName}')`);
    console.log(`   - Parameters:`);
    console.log(`     - email: "${normalizedEmail}"`);
    console.log(`     - password_hash: [${hashedPassword.length} chars]`);
    console.log(`     - name: "${normalizedName}"`);

    let result;
    try {
      result = await pool.query(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
        [normalizedEmail, hashedPassword, normalizedName]
      );
      console.log('✅ Database INSERT successful');
    } catch (dbError) {
      console.error('❌ Database INSERT failed:', dbError);
      console.error(`   - Error code: ${dbError.code}`);
      console.error(`   - Error message: ${dbError.message}`);
      console.error(`   - Error detail: ${dbError.detail}`);
      console.error(`   - Error stack:`, dbError.stack);
      throw dbError; // Re-throw to be caught by outer catch
    }

    const user = result.rows[0];
    console.log('🔍 Step 10: User created successfully!');
    console.log(`   - User ID: ${user.id}`);
    console.log(`   - User email: ${user.email}`);
    console.log(`   - User name: ${user.name}`);
    console.log(`   - Created at: ${user.created_at}`);

    // Generate JWT token
    console.log('🔍 Step 11: Generating JWT token...');
    console.log(`   - JWT_SECRET exists: ${!!JWT_SECRET}`);
    console.log(`   - JWT_SECRET length: ${JWT_SECRET ? JWT_SECRET.length : 0}`);
    console.log(`   - User ID for token: ${user.id}`);
    console.log(`   - User email for token: ${user.email}`);

    let token;
    try {
      token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: '7d'
      });
      console.log('✅ JWT token generated successfully');
      console.log(`   - Token length: ${token ? token.length : 0}`);
    } catch (jwtError) {
      console.error('❌ JWT generation failed:', jwtError);
      console.error(`   - Error message: ${jwtError.message}`);
      console.error(`   - Error stack:`, jwtError.stack);
      throw jwtError; // Re-throw to be caught by outer catch
    }

    console.log(`✅ New user registered: ${user.email}`);

    // Send welcome email (non-blocking)
    console.log('🔍 Step 12: Sending welcome email...');
    console.log(`   - Email service exists: ${!!sendWelcomeEmail}`);
    sendWelcomeEmail(user.id).catch(err => {
      console.error('⚠️  Failed to send welcome email (non-blocking):', err.message);
      console.error('   - This error is non-critical and won\'t affect registration');
    });

    console.log('🔍 Step 13: Preparing success response...');
    console.log(`   - Response status: 201`);
    console.log(`   - Response includes: user object + token`);

    const responseData = {
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at
      },
      token
    };

    console.log('========================================');
    console.log('✅ REGISTRATION SUCCESSFUL');
    console.log('========================================');
    console.log(`✅ User: ${user.email} (ID: ${user.id})`);
    console.log('✅ Token generated and returned to client');
    console.log('========================================\n');

    res.status(201).json(responseData);

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ REGISTRATION FAILED - OUTER CATCH');
    console.error('========================================');
    console.error('📋 Error Details:');
    console.error(`   - Error name: ${error.name}`);
    console.error(`   - Error message: ${error.message}`);
    console.error(`   - Error code: ${error.code}`);
    console.error(`   - Error detail: ${error.detail}`);
    console.error(`   - Error hint: ${error.hint}`);
    console.error(`   - Error constraint: ${error.constraint}`);
    console.error('📋 Full Error Object:', JSON.stringify(error, null, 2));
    console.error('📋 Error Stack Trace:');
    console.error(error.stack);
    console.error('========================================\n');

    // Handle specific PostgreSQL errors
    if (error.code === '23505') { // Unique violation
      console.error('⚠️  Detected: Duplicate email (23505)');
      return res.status(400).json({
        error: 'Email already exists. Please login instead.'
      });
    }

    // Handle missing column errors
    if (error.code === '42703') { // Undefined column
      console.error('⚠️  Detected: Column does not exist (42703)');
      console.error('   - This might be a schema mismatch issue!');
      return res.status(500).json({
        error: 'Database schema error. Please contact support.'
      });
    }

    // Handle database connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('⚠️  Detected: Database connection failed');
      return res.status(503).json({
        error: 'Database connection error. Please try again later.'
      });
    }

    console.error('⚠️  Sending generic 500 error to client');
    res.status(500).json({
      error: 'Registration failed. Please try again.'
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    // Check if database is connected
    if (!pool) {
      return res.status(503).json({
        error: 'Database not connected. Please try again later.'
      });
    }

    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email - EXPLICITLY SELECT password_hash
    const result = await pool.query(
      'SELECT id, email, name, password_hash, created_at FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      console.log(`❌ Login failed: User not found - ${normalizedEmail}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // DEBUG: Log what we retrieved (without exposing sensitive data)
    console.log(`🔍 Login attempt for: ${user.email}`);
    console.log(`🔍 User ID: ${user.id}`);
    console.log(`🔍 Has password_hash: ${!!user.password_hash}`);
    console.log(`🔍 Password hash length: ${user.password_hash ? user.password_hash.length : 0}`);

    // CRITICAL: Validate password_hash exists before bcrypt.compare()
    if (!user.password_hash || user.password_hash.trim() === '') {
      console.error(`❌ CRITICAL: User ${user.email} has no password hash in database!`);
      return res.status(500).json({
        error: 'Account configuration error. Please contact support.'
      });
    }

    // Validate input password is not empty
    if (!password || password.trim() === '') {
      console.log(`❌ Login failed: Empty password provided`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password with proper error handling
    let isValidPassword;
    try {
      isValidPassword = await bcrypt.compare(password, user.password_hash);
    } catch (bcryptError) {
      console.error(`❌ Bcrypt error for user ${user.email}:`, bcryptError.message);
      console.error(`❌ Password provided: ${!!password}, Hash exists: ${!!user.password_hash}`);
      return res.status(500).json({ error: 'Authentication error. Please try again.' });
    }

    if (!isValidPassword) {
      console.log(`❌ Login failed: Invalid password for ${user.email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d'
    });

    console.log(`✅ User logged in: ${user.email}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

module.exports = router;