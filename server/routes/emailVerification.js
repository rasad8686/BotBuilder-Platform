/**
 * Email Verification Routes
 * Handles email verification and resend verification flows
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const emailService = require('../services/emailService');
const log = require('../utils/logger');

/**
 * Generate verification token and expiration
 */
function generateVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return { token, expiresAt };
}

/**
 * POST /api/auth/send-verification
 * Send verification email to user (called after registration)
 */
router.post('/send-verification', async (req, res) => {
  try {
    const { userId, email, userName } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: 'User ID and email are required' });
    }

    // Generate new token
    const { token, expiresAt } = generateVerificationToken();

    // Save token to database
    await db.query(
      `UPDATE users
       SET verification_token = $1, verification_token_expires_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [token, expiresAt, userId]
    );

    // Send verification email
    try {
      await emailService.sendEmailVerificationEmail(email, token, userName);
      log.info('Verification email sent', { userId, email });
    } catch (emailError) {
      log.error('Failed to send verification email', { error: emailError.message, userId });
    }

    res.json({
      success: true,
      message: 'Verification email sent'
    });

  } catch (error) {
    log.error('Send verification error', { error: error.message });
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

/**
 * GET /api/auth/verify-email
 * Verify email with token
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    // Find user with this token
    const userResult = await db.query(
      `SELECT id, name, email, email_verified, verification_token_expires_at
       FROM users
       WHERE verification_token = $1`,
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.json({ success: false, error: 'Invalid or expired token' });
    }

    const user = userResult.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.json({ success: true, message: 'Email already verified', alreadyVerified: true });
    }

    // Check if token is expired
    if (user.verification_token_expires_at && new Date(user.verification_token_expires_at) < new Date()) {
      return res.json({ success: false, error: 'Token has expired. Please request a new verification email.' });
    }

    // Mark email as verified and clear token
    await db.query(
      `UPDATE users
       SET email_verified = true, verification_token = NULL, verification_token_expires_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    log.info('Email verified successfully', { userId: user.id, email: user.email });

    res.json({
      success: true,
      message: 'Email verified successfully',
      email: user.email
    });

  } catch (error) {
    log.error('Verify email error', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to verify email' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const userResult = await db.query(
      'SELECT id, name, email, email_verified FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      log.info('Resend verification requested for non-existent email', { email });
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a verification link.'
      });
    }

    const user = userResult.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.json({
        success: true,
        message: 'Email is already verified',
        alreadyVerified: true
      });
    }

    // Generate new token
    const { token, expiresAt } = generateVerificationToken();

    // Save new token to database
    await db.query(
      `UPDATE users
       SET verification_token = $1, verification_token_expires_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [token, expiresAt, user.id]
    );

    // Send verification email
    try {
      await emailService.sendEmailVerificationEmail(user.email, token, user.name);
      log.info('Resent verification email', { userId: user.id, email: user.email });
    } catch (emailError) {
      log.error('Failed to resend verification email', { error: emailError.message, userId: user.id });
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive a verification link.'
    });

  } catch (error) {
    log.error('Resend verification error', { error: error.message });
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

module.exports = router;
