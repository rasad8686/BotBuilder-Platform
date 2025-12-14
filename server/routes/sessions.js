/**
 * Session Management Routes
 * - View active sessions
 * - Logout from other devices
 * - Session timeout management
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const log = require('../utils/logger');
const { auditLog, getIpAddress, getUserAgent } = require('../middleware/audit');

// Session timeout: 24 hours
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/**
 * Generate secure session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Parse user agent for device info
 */
function parseDeviceInfo(userAgent) {
  if (!userAgent) return 'Unknown Device';

  let device = 'Unknown';
  let browser = 'Unknown';
  let os = 'Unknown';

  // Detect OS
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  // Detect Browser
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Edg')) browser = 'Edge';

  // Detect Device Type
  if (userAgent.includes('Mobile')) device = 'Mobile';
  else if (userAgent.includes('Tablet')) device = 'Tablet';
  else device = 'Desktop';

  return `${browser} on ${os} (${device})`;
}

/**
 * Create a new session for user
 */
async function createSession(userId, req) {
  const sessionToken = generateSessionToken();
  const ipAddress = getIpAddress(req);
  const userAgent = getUserAgent(req);
  const deviceInfo = parseDeviceInfo(userAgent);
  const expiresAt = new Date(Date.now() + SESSION_TIMEOUT_MS);

  await db.query(
    `INSERT INTO user_sessions (user_id, session_token, device_info, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, sessionToken, deviceInfo, ipAddress, userAgent, expiresAt]
  );

  return sessionToken;
}

/**
 * GET /api/sessions
 * Get all active sessions for current user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get current session token from cookie or header
    const currentToken = req.cookies?.session_token || req.headers['x-session-token'];

    const result = await db.query(
      `SELECT id, device_info, ip_address, created_at, last_activity_at,
              session_token = $2 as is_current
       FROM user_sessions
       WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
       ORDER BY last_activity_at DESC`,
      [req.user.id, currentToken]
    );

    res.json({
      success: true,
      sessions: result.rows.map(session => ({
        id: session.id,
        deviceInfo: session.device_info,
        ipAddress: session.ip_address,
        createdAt: session.created_at,
        lastActivity: session.last_activity_at,
        isCurrent: session.is_current
      }))
    });
  } catch (error) {
    log.error('Get sessions error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/sessions/:id
 * Logout from specific session (terminate session)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);

    // Verify session belongs to user
    const session = await db.query(
      'SELECT id, device_info, ip_address FROM user_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, req.user.id]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Deactivate session
    await db.query(
      'UPDATE user_sessions SET is_active = false WHERE id = $1',
      [sessionId]
    );

    // Audit log
    await auditLog({
      userId: req.user.id,
      action: 'session.terminated',
      resourceType: 'session',
      resourceId: sessionId,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
      metadata: {
        terminatedDevice: session.rows[0].device_info,
        terminatedIp: session.rows[0].ip_address
      }
    });

    log.info('Session terminated', { userId: req.user.id, sessionId });

    res.json({
      success: true,
      message: 'Session terminated successfully'
    });
  } catch (error) {
    log.error('Terminate session error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/sessions
 * Logout from all other sessions (except current)
 */
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const currentToken = req.cookies?.session_token || req.headers['x-session-token'];

    // Deactivate all sessions except current
    const result = await db.query(
      `UPDATE user_sessions
       SET is_active = false
       WHERE user_id = $1 AND is_active = true AND session_token != $2
       RETURNING id`,
      [req.user.id, currentToken || '']
    );

    // Audit log
    await auditLog({
      userId: req.user.id,
      action: 'session.terminated.all',
      resourceType: 'session',
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
      metadata: { terminatedCount: result.rowCount }
    });

    log.info('All other sessions terminated', { userId: req.user.id, count: result.rowCount });

    res.json({
      success: true,
      message: `Logged out from ${result.rowCount} other session(s)`,
      terminatedCount: result.rowCount
    });
  } catch (error) {
    log.error('Terminate all sessions error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/sessions/refresh
 * Refresh current session (update last_activity_at)
 */
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const currentToken = req.cookies?.session_token || req.headers['x-session-token'];

    if (!currentToken) {
      return res.status(400).json({ success: false, message: 'No session token' });
    }

    const newExpiresAt = new Date(Date.now() + SESSION_TIMEOUT_MS);

    await db.query(
      `UPDATE user_sessions
       SET last_activity_at = NOW(), expires_at = $1
       WHERE session_token = $2 AND user_id = $3 AND is_active = true`,
      [newExpiresAt, currentToken, req.user.id]
    );

    res.json({
      success: true,
      message: 'Session refreshed',
      expiresAt: newExpiresAt
    });
  } catch (error) {
    log.error('Refresh session error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Export helper functions for use in auth routes
module.exports = router;
module.exports.createSession = createSession;
module.exports.generateSessionToken = generateSessionToken;
module.exports.SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MS;
