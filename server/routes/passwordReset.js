/**
 * Password Reset Routes
 * Handles forgot password and reset password flows
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const emailService = require('../services/emailService');
const log = require('../utils/logger');

/**
 * POST /api/auth/forgot-password
 * Request password reset - sends email with reset link
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const userResult = await db.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      log.info('Password reset requested for non-existent email', { email });
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }

    const user = userResult.rows[0];

    // Invalidate any existing tokens for this user
    await db.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    );

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Save token to database
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(user.email, token, user.name);
      log.info('Password reset email sent', { userId: user.id, email: user.email });
    } catch (emailError) {
      log.error('Failed to send password reset email', { error: emailError.message, userId: user.id });
      // Don't expose email sending failure to user
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.'
    });

  } catch (error) {
    log.error('Forgot password error', { error: error.message });
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

/**
 * GET /api/auth/verify-reset-token
 * Verify if reset token is valid
 */
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token is required' });
    }

    // Find valid token
    const tokenResult = await db.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.email
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = $1`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.json({ valid: false, error: 'Invalid or expired token' });
    }

    const tokenData = tokenResult.rows[0];

    // Check if token is used
    if (tokenData.used_at) {
      return res.json({ valid: false, error: 'Token has already been used' });
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.json({ valid: false, error: 'Token has expired' });
    }

    res.json({
      valid: true,
      email: tokenData.email
    });

  } catch (error) {
    log.error('Verify reset token error', { error: error.message });
    res.status(500).json({ valid: false, error: 'Failed to verify token' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with valid token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Find valid token
    const tokenResult = await db.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.email, u.name
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = $1`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const tokenData = tokenResult.rows[0];

    // Check if token is used
    if (tokenData.used_at) {
      return res.status(400).json({ error: 'Token has already been used' });
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Token has expired' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, tokenData.user_id]
    );

    // Mark token as used
    await db.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [tokenData.id]
    );

    log.info('Password reset successful', { userId: tokenData.user_id, email: tokenData.email });

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    log.error('Reset password error', { error: error.message });
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
