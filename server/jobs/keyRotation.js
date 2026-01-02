/**
 * API Key Rotation Job
 *
 * Background job that handles automatic API key rotation:
 * - Runs every hour
 * - Checks for tokens with rotation_scheduled_at <= now
 * - Auto-rotates them and deactivates old tokens after overlap period
 * - Sends email notifications
 */

const db = require('../db');
const log = require('../utils/logger');
const crypto = require('crypto');
const emailService = require('../services/emailService');

// Polling interval (1 hour)
const POLL_INTERVAL = 60 * 60 * 1000;

// Active polling interval reference
let pollingInterval = null;

// Track if job is running
let isRunning = false;

/**
 * Get tokens scheduled for rotation
 * @returns {Promise<Array>} - Array of tokens to rotate
 */
async function getScheduledTokens() {
  const result = await db.query(
    `SELECT t.id, t.token_name, t.bot_id, t.permissions, t.expires_at,
            t.organization_id, t.user_id, u.email, u.name as user_name
     FROM api_tokens t
     LEFT JOIN users u ON t.user_id = u.id
     WHERE t.is_active = true
       AND t.rotation_scheduled_at IS NOT NULL
       AND t.rotation_scheduled_at <= NOW()
     ORDER BY t.rotation_scheduled_at ASC`
  );

  return result.rows;
}

/**
 * Get tokens with expired overlap period
 * @returns {Promise<Array>} - Array of tokens to deactivate
 */
async function getExpiredOverlapTokens() {
  const result = await db.query(
    `SELECT id, token_name, organization_id, user_id
     FROM api_tokens
     WHERE is_active = true
       AND overlap_expires_at IS NOT NULL
       AND overlap_expires_at <= NOW()
     ORDER BY overlap_expires_at ASC`
  );

  return result.rows;
}

/**
 * Rotate a single token
 * @param {Object} token - Token record
 * @returns {Promise<Object|null>} - New token or null on failure
 */
async function rotateToken(token) {
  try {
    log.info('[KEY_ROTATION] Auto-rotating token', {
      tokenId: token.id,
      tokenName: token.token_name
    });

    // Generate new token
    const newTokenValue = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newTokenValue).digest('hex');
    const newTokenPreview = newTokenValue.substring(0, 8) + '...' + newTokenValue.substring(newTokenValue.length - 4);

    // Default overlap period: 24 hours
    const overlapExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Start transaction
    await db.query('BEGIN');

    try {
      // Update old token with overlap expiry and clear scheduled rotation
      await db.query(
        `UPDATE api_tokens
         SET overlap_expires_at = $1,
             rotation_scheduled_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [overlapExpiresAt, token.id]
      );

      // Create new token
      const newTokenResult = await db.query(
        `INSERT INTO api_tokens (
          user_id, organization_id, bot_id, token_name, token_hash, token_preview,
          permissions, expires_at, is_active, rotated_from_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, token_name, token_preview, created_at`,
        [
          token.user_id,
          token.organization_id,
          token.bot_id,
          token.token_name + ' (auto-rotated)',
          newTokenHash,
          newTokenPreview,
          token.permissions,
          token.expires_at,
          token.id
        ]
      );

      await db.query('COMMIT');

      const newToken = newTokenResult.rows[0];

      log.info('[KEY_ROTATION] Token rotated successfully', {
        oldTokenId: token.id,
        newTokenId: newToken.id
      });

      return {
        oldToken: token,
        newToken: {
          ...newToken,
          value: newTokenValue
        },
        overlapExpiresAt
      };

    } catch (txError) {
      await db.query('ROLLBACK');
      throw txError;
    }

  } catch (error) {
    log.error('[KEY_ROTATION] Failed to rotate token', {
      tokenId: token.id,
      error: error.message
    });
    return null;
  }
}

/**
 * Deactivate a token after overlap period
 * @param {Object} token - Token record
 */
async function deactivateToken(token) {
  try {
    await db.query(
      `UPDATE api_tokens
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [token.id]
    );

    log.info('[KEY_ROTATION] Token deactivated after overlap period', {
      tokenId: token.id,
      tokenName: token.token_name
    });

  } catch (error) {
    log.error('[KEY_ROTATION] Failed to deactivate token', {
      tokenId: token.id,
      error: error.message
    });
  }
}

/**
 * Send rotation notification email
 * @param {Object} rotationResult - Result from rotateToken
 */
async function sendRotationNotification(rotationResult) {
  const { oldToken, newToken, overlapExpiresAt } = rotationResult;

  if (!oldToken.email) {
    log.warn('[KEY_ROTATION] No email for rotation notification', {
      tokenId: oldToken.id
    });
    return;
  }

  try {
    await emailService.sendKeyRotationEmail(oldToken.email, {
      userName: oldToken.user_name,
      tokenName: oldToken.token_name,
      newTokenPreview: newToken.token_preview,
      oldTokenValidUntil: overlapExpiresAt,
      isAutoRotation: true
    });

    log.info('[KEY_ROTATION] Rotation notification sent', {
      email: oldToken.email,
      tokenName: oldToken.token_name
    });

  } catch (error) {
    log.warn('[KEY_ROTATION] Failed to send rotation notification', {
      error: error.message
    });
  }
}

/**
 * Run a single job cycle
 */
async function runCycle() {
  if (isRunning) {
    log.debug('[KEY_ROTATION] Skipping cycle - previous cycle still running');
    return;
  }

  isRunning = true;

  try {
    // Step 1: Deactivate tokens with expired overlap period
    const expiredTokens = await getExpiredOverlapTokens();

    if (expiredTokens.length > 0) {
      log.info(`[KEY_ROTATION] Deactivating ${expiredTokens.length} token(s) with expired overlap`);

      for (const token of expiredTokens) {
        await deactivateToken(token);
      }
    }

    // Step 2: Rotate scheduled tokens
    const scheduledTokens = await getScheduledTokens();

    if (scheduledTokens.length === 0) {
      log.debug('[KEY_ROTATION] No tokens scheduled for rotation');
      return;
    }

    log.info(`[KEY_ROTATION] Processing ${scheduledTokens.length} scheduled rotation(s)`);

    for (const token of scheduledTokens) {
      const result = await rotateToken(token);

      if (result) {
        // Send notification
        await sendRotationNotification(result);

        // Small delay between operations
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

  } catch (error) {
    log.error('[KEY_ROTATION] Error in job cycle', { error: error.message });
  } finally {
    isRunning = false;
  }
}

/**
 * Start the rotation job
 */
function start() {
  if (pollingInterval) {
    log.warn('[KEY_ROTATION] Job already running');
    return;
  }

  log.info('[KEY_ROTATION] Starting API key rotation job', {
    interval: `${POLL_INTERVAL / 1000 / 60} minutes`
  });

  // Run immediately on start
  runCycle();

  // Then run at interval
  pollingInterval = setInterval(runCycle, POLL_INTERVAL);
}

/**
 * Stop the rotation job
 */
function stop() {
  if (pollingInterval) {
    log.info('[KEY_ROTATION] Stopping API key rotation job');
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Check if job is running
 */
function isJobRunning() {
  return !!pollingInterval;
}

/**
 * Manually trigger a job cycle
 */
async function runNow() {
  log.info('[KEY_ROTATION] Manual job trigger');
  await runCycle();
}

/**
 * Get job status
 */
function getStatus() {
  return {
    running: isJobRunning(),
    currentlyProcessing: isRunning,
    interval: POLL_INTERVAL
  };
}

module.exports = {
  start,
  stop,
  isRunning: isJobRunning,
  runNow,
  getStatus,
  POLL_INTERVAL
};
