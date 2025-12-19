/**
 * Refresh Token Service
 *
 * Handles JWT refresh token operations with token rotation.
 * - Access token: 15 minutes
 * - Refresh token: 7 days
 * - Automatic token rotation on refresh
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const db = require('../db');
const log = require('../utils/logger');
const { getSecureEnv } = require('../utils/envValidator');

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '15m';  // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Generate a secure random refresh token
 */
function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Hash a refresh token for secure storage
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate access token (JWT)
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.name || user.username,
      current_organization_id: user.organizationId || user.current_organization_id
    },
    getSecureEnv('JWT_SECRET'),
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Create a new refresh token and store in database
 */
async function createRefreshToken(userId, req = null, familyId = null) {
  const token = generateRefreshToken();
  const tokenHash = hashToken(token);
  const newFamilyId = familyId || uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  const ipAddress = req?.ip || req?.connection?.remoteAddress || null;
  const userAgent = req?.headers?.['user-agent']?.substring(0, 500) || null;

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, tokenHash, newFamilyId, expiresAt, ipAddress, userAgent]
  );

  log.debug('Refresh token created', { userId, familyId: newFamilyId });

  return {
    token,
    familyId: newFamilyId,
    expiresAt
  };
}

/**
 * Validate and rotate refresh token
 * Returns new tokens if valid, null if invalid
 */
async function rotateRefreshToken(refreshToken, req = null) {
  const tokenHash = hashToken(refreshToken);

  // Find the token in database
  const result = await db.query(
    `SELECT rt.*, u.id as user_id, u.name, u.email, u.is_superadmin
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    log.warn('Refresh token not found');
    return null;
  }

  const storedToken = result.rows[0];

  // Check if token is revoked
  if (storedToken.is_revoked) {
    // Token reuse detected - revoke entire family (security measure)
    log.warn('Refresh token reuse detected - revoking token family', {
      userId: storedToken.user_id,
      familyId: storedToken.family_id
    });

    await revokeTokenFamily(storedToken.family_id);
    return null;
  }

  // Check if token is expired
  if (new Date(storedToken.expires_at) < new Date()) {
    log.warn('Refresh token expired', { userId: storedToken.user_id });
    return null;
  }

  // Revoke the current token (single use)
  await db.query(
    'UPDATE refresh_tokens SET is_revoked = true WHERE id = $1',
    [storedToken.id]
  );

  // Get user's organization
  const orgResult = await db.query(
    `SELECT org_id FROM organization_members
     WHERE user_id = $1 AND status = 'active'
     ORDER BY joined_at ASC LIMIT 1`,
    [storedToken.user_id]
  );

  const organizationId = orgResult.rows[0]?.org_id || null;

  // Create new refresh token in same family (rotation)
  const newRefreshToken = await createRefreshToken(
    storedToken.user_id,
    req,
    storedToken.family_id
  );

  // Generate new access token
  const accessToken = generateAccessToken({
    id: storedToken.user_id,
    email: storedToken.email,
    name: storedToken.name,
    organizationId
  });

  log.info('Token rotation successful', { userId: storedToken.user_id });

  return {
    accessToken,
    refreshToken: newRefreshToken.token,
    expiresIn: 900, // 15 minutes in seconds
    refreshExpiresAt: newRefreshToken.expiresAt,
    user: {
      id: storedToken.user_id,
      email: storedToken.email,
      username: storedToken.name,
      currentOrganizationId: organizationId,
      is_superadmin: storedToken.is_superadmin || false
    }
  };
}

/**
 * Revoke all tokens in a family (security measure for token reuse)
 */
async function revokeTokenFamily(familyId) {
  await db.query(
    'UPDATE refresh_tokens SET is_revoked = true WHERE family_id = $1',
    [familyId]
  );
  log.info('Token family revoked', { familyId });
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
async function revokeAllUserTokens(userId) {
  const result = await db.query(
    'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND is_revoked = false',
    [userId]
  );
  log.info('All user tokens revoked', { userId, count: result.rowCount });
  return result.rowCount;
}

/**
 * Revoke a specific refresh token
 */
async function revokeRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const result = await db.query(
    'UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1',
    [tokenHash]
  );
  return result.rowCount > 0;
}

/**
 * Clean up expired tokens (should be run periodically)
 */
async function cleanupExpiredTokens() {
  const result = await db.query(
    'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR is_revoked = true'
  );
  log.info('Expired tokens cleaned up', { count: result.rowCount });
  return result.rowCount;
}

/**
 * Get active sessions for a user
 */
async function getUserSessions(userId) {
  const result = await db.query(
    `SELECT id, created_at, expires_at, ip_address, user_agent
     FROM refresh_tokens
     WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

module.exports = {
  generateAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeTokenFamily,
  revokeAllUserTokens,
  revokeRefreshToken,
  cleanupExpiredTokens,
  getUserSessions,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS
};
