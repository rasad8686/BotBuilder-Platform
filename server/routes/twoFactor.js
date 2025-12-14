/**
 * Two-Factor Authentication (2FA) Routes
 * Uses TOTP (Time-based One-Time Password) with speakeasy
 */

const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const log = require('../utils/logger');
const { auditLog, getIpAddress, getUserAgent } = require('../middleware/audit');

/**
 * GET /api/auth/2fa/status
 * Check if 2FA is enabled for current user
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      enabled: result.rows[0].two_factor_enabled || false
    });
  } catch (error) {
    log.error('2FA status check error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/auth/2fa/setup
 * Generate 2FA secret and QR code
 */
router.post('/setup', authenticateToken, async (req, res) => {
  try {
    // Check if 2FA is already enabled
    const user = await db.query(
      'SELECT email, two_factor_enabled FROM users WHERE id = $1',
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.rows[0].two_factor_enabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled. Disable it first to set up again.'
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `BotBuilder (${user.rows[0].email})`,
      issuer: 'BotBuilder',
      length: 32
    });

    // Store secret temporarily (not enabled yet)
    await db.query(
      'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
      [secret.base32, req.user.id]
    );

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }

    // Hash and store backup codes
    for (const code of backupCodes) {
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      await db.query(
        'INSERT INTO two_factor_backup_codes (user_id, code_hash) VALUES ($1, $2)',
        [req.user.id, codeHash]
      );
    }

    log.info('2FA setup initiated', { userId: req.user.id });

    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl,
      backupCodes: backupCodes,
      message: 'Scan the QR code with your authenticator app, then verify with a code'
    });
  } catch (error) {
    log.error('2FA setup error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/auth/2fa/verify
 * Verify 2FA code and enable 2FA
 */
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Verification code required' });
    }

    // Get user's secret
    const user = await db.query(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.rows[0].two_factor_secret) {
      return res.status(400).json({
        success: false,
        message: 'Please set up 2FA first by calling /api/auth/2fa/setup'
      });
    }

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: user.rows[0].two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 1 // Allow 1 step tolerance (30 seconds before/after)
    });

    if (!verified) {
      log.warn('2FA verification failed', { userId: req.user.id });
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    // Enable 2FA
    await db.query(
      'UPDATE users SET two_factor_enabled = true, two_factor_enabled_at = NOW() WHERE id = $1',
      [req.user.id]
    );

    // Audit log
    await auditLog({
      userId: req.user.id,
      action: 'user.2fa.enabled',
      resourceType: 'user',
      resourceId: req.user.id,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });

    log.info('2FA enabled successfully', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Two-factor authentication enabled successfully'
    });
  } catch (error) {
    log.error('2FA verify error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/auth/2fa/validate
 * Validate 2FA code during login (called after password verification)
 */
router.post('/validate', async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ success: false, message: 'User ID and code required' });
    }

    // Get user's secret
    const user = await db.query(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.rows[0].two_factor_enabled) {
      return res.status(400).json({ success: false, message: '2FA is not enabled' });
    }

    // Try TOTP code first
    let verified = speakeasy.totp.verify({
      secret: user.rows[0].two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 1
    });

    // If TOTP fails, try backup code
    if (!verified) {
      const codeHash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
      const backupResult = await db.query(
        'SELECT id FROM two_factor_backup_codes WHERE user_id = $1 AND code_hash = $2 AND used = false',
        [userId, codeHash]
      );

      if (backupResult.rows.length > 0) {
        // Mark backup code as used
        await db.query(
          'UPDATE two_factor_backup_codes SET used = true, used_at = NOW() WHERE id = $1',
          [backupResult.rows[0].id]
        );
        verified = true;
        log.info('Backup code used for 2FA', { userId });
      }
    }

    if (!verified) {
      log.warn('2FA validation failed during login', { userId });
      return res.status(400).json({ success: false, message: 'Invalid 2FA code' });
    }

    res.json({ success: true, message: '2FA validated successfully' });
  } catch (error) {
    log.error('2FA validate error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/auth/2fa/disable
 * Disable 2FA (requires current password)
 */
router.post('/disable', authenticateToken, async (req, res) => {
  try {
    const { password, code } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password required' });
    }

    // Verify password
    const user = await db.query(
      'SELECT password_hash, two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    if (!user.rows[0].two_factor_enabled) {
      return res.status(400).json({ success: false, message: '2FA is not enabled' });
    }

    // Verify 2FA code if provided
    if (code) {
      const verified = speakeasy.totp.verify({
        secret: user.rows[0].two_factor_secret,
        encoding: 'base32',
        token: code,
        window: 1
      });

      if (!verified) {
        return res.status(400).json({ success: false, message: 'Invalid 2FA code' });
      }
    }

    // Disable 2FA
    await db.query(
      'UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL, two_factor_enabled_at = NULL WHERE id = $1',
      [req.user.id]
    );

    // Delete backup codes
    await db.query(
      'DELETE FROM two_factor_backup_codes WHERE user_id = $1',
      [req.user.id]
    );

    // Audit log
    await auditLog({
      userId: req.user.id,
      action: 'user.2fa.disabled',
      resourceType: 'user',
      resourceId: req.user.id,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });

    log.info('2FA disabled', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Two-factor authentication disabled'
    });
  } catch (error) {
    log.error('2FA disable error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/auth/2fa/backup-codes/regenerate
 * Regenerate backup codes
 */
router.post('/backup-codes/regenerate', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: '2FA code required' });
    }

    // Verify 2FA code
    const user = await db.query(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!user.rows[0].two_factor_enabled) {
      return res.status(400).json({ success: false, message: '2FA is not enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.rows[0].two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid 2FA code' });
    }

    // Delete old backup codes
    await db.query('DELETE FROM two_factor_backup_codes WHERE user_id = $1', [req.user.id]);

    // Generate new backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }

    // Store new backup codes
    for (const backupCode of backupCodes) {
      const codeHash = crypto.createHash('sha256').update(backupCode).digest('hex');
      await db.query(
        'INSERT INTO two_factor_backup_codes (user_id, code_hash) VALUES ($1, $2)',
        [req.user.id, codeHash]
      );
    }

    log.info('2FA backup codes regenerated', { userId: req.user.id });

    res.json({
      success: true,
      backupCodes: backupCodes,
      message: 'Backup codes regenerated. Store these safely!'
    });
  } catch (error) {
    log.error('Backup codes regeneration error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
