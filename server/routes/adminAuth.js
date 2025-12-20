/**
 * Admin Authentication Routes
 *
 * Separate authentication flow for admin users.
 * Includes rate limiting, IP whitelist, and mandatory 2FA.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const db = require('../db');
const {
  adminLoginRateLimit,
  adminIpWhitelist,
  logAdminAction
} = require('../middleware/requireSuperAdmin');

/**
 * POST /api/admin-auth/login
 * Admin login endpoint with enhanced security
 */
router.post('/login', adminIpWhitelist, adminLoginRateLimit, async (req, res) => {
  try {
    const { email, password, twoFactorCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const userResult = await db.query(`
      SELECT u.id, u.name, u.email, u.password_hash, u.is_superadmin,
             u.two_factor_enabled, u.two_factor_secret, u.email_verified
      FROM users u
      WHERE u.email = $1
    `, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      await req.logLoginAttempt(false);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await req.logLoginAttempt(false);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is admin or superadmin
    const memberResult = await db.query(`
      SELECT om.role, om.org_id, o.name as org_name
      FROM organization_members om
      JOIN organizations o ON o.id = om.org_id
      WHERE om.user_id = $1 AND om.role = 'admin'
      LIMIT 1
    `, [user.id]);

    const isOrgAdmin = memberResult.rows.length > 0;
    const isSuperAdmin = user.is_superadmin === true;

    if (!isOrgAdmin && !isSuperAdmin) {
      await req.logLoginAttempt(false);
      await logAdminAction(
        user.id,
        user.email,
        'ADMIN_LOGIN_DENIED_NOT_ADMIN',
        'auth',
        null,
        {},
        req
      );
      return res.status(403).json({
        success: false,
        message: 'Admin access required. Please use the regular login.'
      });
    }

    // Check 2FA - MANDATORY for admin login
    if (!user.two_factor_enabled) {
      await req.logLoginAttempt(false);
      return res.status(403).json({
        success: false,
        message: 'Two-factor authentication is required for admin login. Please enable 2FA in your security settings.',
        require2FASetup: true
      });
    }

    // Verify 2FA code
    if (!twoFactorCode) {
      return res.status(200).json({
        success: false,
        require2FA: true,
        message: 'Please enter your 2FA code'
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: twoFactorCode,
      window: 1
    });

    if (!verified) {
      await req.logLoginAttempt(false);
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA code'
      });
    }

    // Create admin session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    await db.query(`
      INSERT INTO admin_sessions (user_id, session_token, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      user.id,
      sessionToken,
      req.ip || req.connection?.remoteAddress,
      req.headers['user-agent'],
      expiresAt
    ]);

    // Create JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        isAdmin: true,
        isSuperAdmin: isSuperAdmin,
        adminSession: sessionToken
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Log successful login
    await req.logLoginAttempt(true);
    await logAdminAction(
      user.id,
      user.email,
      'ADMIN_LOGIN_SUCCESS',
      'auth',
      null,
      { isSuperAdmin },
      req
    );

    // Return response
    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSuperAdmin: isSuperAdmin,
        is_superadmin: isSuperAdmin,
        isAdmin: true
      },
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    // Admin login error - silent fail
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

/**
 * POST /api/admin-auth/logout
 * Admin logout - invalidate session
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.json({ success: true, message: 'Logged out' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.json({ success: true, message: 'Logged out' });
    }

    // Decode token to get session
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.adminSession) {
        // Invalidate admin session
        await db.query(`
          UPDATE admin_sessions
          SET is_active = false
          WHERE session_token = $1
        `, [decoded.adminSession]);

        // Log logout
        await logAdminAction(
          decoded.id,
          decoded.email,
          'ADMIN_LOGOUT',
          'auth',
          null,
          {},
          req
        );
      }
    } catch (e) {
      // Token expired or invalid, that's ok for logout
    }

    res.json({
      success: true,
      message: 'Admin session ended'
    });
  } catch (error) {
    // Admin logout error - silent fail
    res.json({ success: true, message: 'Logged out' });
  }
});

/**
 * GET /api/admin-auth/session
 * Verify admin session is still valid
 */
router.get('/session', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.adminSession) {
      return res.status(401).json({
        success: false,
        message: 'Not an admin session'
      });
    }

    // Verify session in database
    const session = await db.query(`
      SELECT ads.*, u.name, u.email, u.is_superadmin
      FROM admin_sessions ads
      JOIN users u ON u.id = ads.user_id
      WHERE ads.session_token = $1 AND ads.is_active = true AND ads.expires_at > NOW()
    `, [decoded.adminSession]);

    if (session.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid'
      });
    }

    const sessionData = session.rows[0];

    res.json({
      success: true,
      data: {
        user: {
          id: sessionData.user_id,
          name: sessionData.name,
          email: sessionData.email,
          isSuperAdmin: sessionData.is_superadmin,
          isAdmin: true
        },
        session: {
          expiresAt: sessionData.expires_at,
          createdAt: sessionData.created_at
        }
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    // Session check error - silent fail
    res.status(500).json({
      success: false,
      message: 'Session verification failed'
    });
  }
});

/**
 * GET /api/admin-auth/check-2fa/:email
 * Check if user has 2FA enabled (for login flow)
 */
router.get('/check-2fa/:email', async (req, res) => {
  try {
    const email = req.params.email;

    const result = await db.query(`
      SELECT two_factor_enabled FROM users WHERE email = $1
    `, [email.toLowerCase()]);

    if (result.rows.length === 0) {
      // Don't reveal if user exists
      return res.json({
        success: true,
        has2FA: false
      });
    }

    res.json({
      success: true,
      has2FA: result.rows[0].two_factor_enabled === true
    });
  } catch (error) {
    // Check 2FA error - silent fail
    res.status(500).json({
      success: false,
      message: 'Failed to check 2FA status'
    });
  }
});

module.exports = router;
