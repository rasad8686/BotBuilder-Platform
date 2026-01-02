/**
 * @fileoverview IP Allowlist Middleware
 * @description Validates request IP against token's IP allowlist
 * @module middleware/ipAllowlist
 */

const db = require('../db');
const log = require('../utils/logger');

/**
 * Check if an IP is within a CIDR range
 * @param {string} ip - IP address to check
 * @param {string} cidr - CIDR notation (e.g., 192.168.1.0/24)
 * @returns {boolean} - True if IP is in range
 */
function ipInCidr(ip, cidr) {
  // Handle exact IP match (no CIDR)
  if (!cidr || !cidr.includes('/')) {
    return ip === cidr || ip === ip;
  }

  const [range, bits] = cidr.split('/');
  const mask = parseInt(bits, 10);

  // Convert IP addresses to numeric values
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);

  if (ipNum === null || rangeNum === null) {
    return false;
  }

  // Calculate subnet mask
  const subnetMask = ~((1 << (32 - mask)) - 1) >>> 0;

  // Check if IP is in range
  return (ipNum & subnetMask) === (rangeNum & subnetMask);
}

/**
 * Convert IPv4 address to number
 * @param {string} ip - IPv4 address
 * @returns {number|null} - Numeric representation or null
 */
function ipToNumber(ip) {
  // Handle IPv6-mapped IPv4 addresses
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // Handle localhost variations
  if (ip === '::1') {
    ip = '127.0.0.1';
  }

  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null; // IPv6 not fully supported for CIDR
  }

  return parts.reduce((acc, octet) => {
    const num = parseInt(octet, 10);
    if (isNaN(num) || num < 0 || num > 255) {
      return null;
    }
    return (acc << 8) + num;
  }, 0) >>> 0;
}

/**
 * Normalize IP address for comparison
 * @param {string} ip - IP address
 * @returns {string} - Normalized IP
 */
function normalizeIp(ip) {
  if (!ip) return '';

  // Handle IPv6-mapped IPv4
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }

  // Handle localhost
  if (ip === '::1') {
    return '127.0.0.1';
  }

  return ip;
}

/**
 * Validate IP address format
 * @param {string} ip - IP address to validate
 * @returns {boolean} - True if valid
 */
function isValidIp(ip) {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Pattern.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Pattern.test(ip);
}

/**
 * Validate CIDR notation
 * @param {string} cidr - CIDR to validate
 * @returns {boolean} - True if valid
 */
function isValidCidr(cidr) {
  if (!cidr || !cidr.includes('/')) {
    return false;
  }

  const [ip, bits] = cidr.split('/');
  const mask = parseInt(bits, 10);

  if (!isValidIp(ip)) {
    return false;
  }

  // IPv4 CIDR mask should be 0-32
  if (ip.includes('.')) {
    return mask >= 0 && mask <= 32;
  }

  // IPv6 CIDR mask should be 0-128
  return mask >= 0 && mask <= 128;
}

/**
 * Check if request IP is in token's allowlist
 * @param {number} tokenId - API token ID
 * @param {string} requestIp - Request IP address
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
async function checkIpAllowlist(tokenId, requestIp) {
  try {
    // Get token's IP restriction setting
    const tokenResult = await db.query(
      'SELECT ip_restriction_enabled FROM api_tokens WHERE id = $1',
      [tokenId]
    );

    if (tokenResult.rows.length === 0) {
      return { allowed: false, reason: 'Token not found' };
    }

    const token = tokenResult.rows[0];

    // If IP restriction is not enabled, allow all
    if (!token.ip_restriction_enabled) {
      return { allowed: true };
    }

    // Get active IP allowlist entries
    const allowlistResult = await db.query(
      `SELECT ip_address, cidr_range FROM api_token_ip_allowlist
       WHERE api_token_id = $1 AND is_active = true`,
      [tokenId]
    );

    // If no IPs in allowlist but restriction enabled, deny all
    if (allowlistResult.rows.length === 0) {
      return {
        allowed: false,
        reason: 'IP restriction enabled but no IPs in allowlist'
      };
    }

    const normalizedRequestIp = normalizeIp(requestIp);

    // Check each allowlist entry
    for (const entry of allowlistResult.rows) {
      const normalizedEntryIp = normalizeIp(entry.ip_address);

      // Check exact IP match
      if (normalizedEntryIp === normalizedRequestIp) {
        return { allowed: true };
      }

      // Check CIDR range if specified
      if (entry.cidr_range) {
        if (ipInCidr(normalizedRequestIp, entry.cidr_range)) {
          return { allowed: true };
        }
      }
    }

    return {
      allowed: false,
      reason: `IP ${requestIp} not in allowlist`
    };

  } catch (error) {
    log.error('[IP_ALLOWLIST] Error checking allowlist:', { error: error.message });
    // On error, deny access for security
    return { allowed: false, reason: 'Error checking IP allowlist' };
  }
}

/**
 * Get client IP from request
 * @param {Object} req - Express request
 * @returns {string} - Client IP
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * IP Allowlist middleware
 * Use after API token authentication
 */
const ipAllowlistMiddleware = async (req, res, next) => {
  // Skip if no API token (might be JWT auth)
  if (!req.apiToken) {
    return next();
  }

  const clientIp = getClientIp(req);
  const result = await checkIpAllowlist(req.apiToken.id, clientIp);

  if (!result.allowed) {
    log.warn('[IP_ALLOWLIST] Access denied', {
      tokenId: req.apiToken.id,
      ip: clientIp,
      reason: result.reason
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied: IP address not allowed',
      error: result.reason
    });
  }

  next();
};

/**
 * Get IP allowlist for a token
 * @param {number} tokenId - API token ID
 * @returns {Promise<Array>}
 */
async function getIpAllowlist(tokenId) {
  const result = await db.query(
    `SELECT id, ip_address, cidr_range, description, is_active, created_at
     FROM api_token_ip_allowlist
     WHERE api_token_id = $1
     ORDER BY created_at DESC`,
    [tokenId]
  );

  return result.rows;
}

/**
 * Add IP to allowlist
 * @param {number} tokenId - API token ID
 * @param {Object} data - IP data
 * @returns {Promise<Object>}
 */
async function addIpToAllowlist(tokenId, data) {
  const { ipAddress, cidrRange, description } = data;

  // Validate IP
  if (!isValidIp(ipAddress)) {
    throw new Error('Invalid IP address format');
  }

  // Validate CIDR if provided
  if (cidrRange && !isValidCidr(cidrRange)) {
    throw new Error('Invalid CIDR notation');
  }

  const result = await db.query(
    `INSERT INTO api_token_ip_allowlist
     (api_token_id, ip_address, cidr_range, description, is_active, created_at)
     VALUES ($1, $2, $3, $4, true, NOW())
     RETURNING id, ip_address, cidr_range, description, is_active, created_at`,
    [tokenId, ipAddress, cidrRange || null, description || null]
  );

  return result.rows[0];
}

/**
 * Remove IP from allowlist
 * @param {number} tokenId - API token ID
 * @param {number} ipId - IP entry ID
 * @returns {Promise<boolean>}
 */
async function removeIpFromAllowlist(tokenId, ipId) {
  const result = await db.query(
    `DELETE FROM api_token_ip_allowlist
     WHERE id = $1 AND api_token_id = $2
     RETURNING id`,
    [ipId, tokenId]
  );

  return result.rows.length > 0;
}

/**
 * Update IP restriction setting for a token
 * @param {number} tokenId - API token ID
 * @param {boolean} enabled - Enable or disable
 * @returns {Promise<Object>}
 */
async function updateIpRestriction(tokenId, enabled) {
  const result = await db.query(
    `UPDATE api_tokens
     SET ip_restriction_enabled = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, ip_restriction_enabled`,
    [enabled, tokenId]
  );

  return result.rows[0];
}

module.exports = {
  ipAllowlistMiddleware,
  checkIpAllowlist,
  getIpAllowlist,
  addIpToAllowlist,
  removeIpFromAllowlist,
  updateIpRestriction,
  isValidIp,
  isValidCidr,
  normalizeIp,
  ipInCidr,
  getClientIp
};
