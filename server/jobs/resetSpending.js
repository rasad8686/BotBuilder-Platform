/**
 * Reset Spending Job
 * Resets spending for API tokens based on their period type (daily/monthly)
 * Should be run by a cron scheduler every hour
 */

const db = require('../db');
const log = require('../utils/logger');

/**
 * Reset spending for tokens whose period has expired
 * Called by cron job scheduler
 */
const resetExpiredSpending = async () => {
  try {
    const now = new Date();

    // Find tokens that need reset (period_reset_at has passed)
    const tokensToReset = await db.query(
      `SELECT
        id,
        token_name,
        organization_id,
        spending_period_type,
        current_period_spend_usd,
        period_reset_at
       FROM api_tokens
       WHERE period_reset_at IS NOT NULL
         AND period_reset_at <= $1
         AND (current_period_spend_usd > 0 OR disabled_by_limit = true)`,
      [now]
    );

    if (tokensToReset.rows.length === 0) {
      log.debug('[RESET_SPENDING] No tokens need reset');
      return { reset: 0 };
    }

    log.info('[RESET_SPENDING] Resetting spending for tokens', {
      count: tokensToReset.rows.length
    });

    let resetCount = 0;

    for (const token of tokensToReset.rows) {
      try {
        // Calculate new reset time based on period type
        const periodType = token.spending_period_type || 'monthly';
        let newResetAt;

        if (periodType === 'daily') {
          // Reset at midnight tomorrow
          newResetAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        } else {
          // Reset on first day of next month
          newResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }

        // Reset the token
        await db.query(
          `UPDATE api_tokens
           SET current_period_spend_usd = 0,
               period_reset_at = $1,
               disabled_by_limit = false,
               last_warning_sent_at = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [newResetAt, token.id]
        );

        log.info('[RESET_SPENDING] Token spending reset', {
          tokenId: token.id,
          tokenName: token.token_name,
          previousSpend: parseFloat(token.current_period_spend_usd) || 0,
          periodType,
          nextResetAt: newResetAt
        });

        resetCount++;
      } catch (tokenError) {
        log.error('[RESET_SPENDING] Error resetting token', {
          tokenId: token.id,
          error: tokenError.message
        });
      }
    }

    log.info('[RESET_SPENDING] Spending reset complete', {
      tokensReset: resetCount,
      tokensAttempted: tokensToReset.rows.length
    });

    return { reset: resetCount };
  } catch (error) {
    log.error('[RESET_SPENDING] Error in reset job', {
      error: error.message
    });
    throw error;
  }
};

/**
 * Reset spending for a specific token
 * @param {number} tokenId - Token ID to reset
 */
const resetTokenSpending = async (tokenId) => {
  try {
    const now = new Date();

    // Get token info
    const result = await db.query(
      'SELECT spending_period_type FROM api_tokens WHERE id = $1',
      [tokenId]
    );

    if (result.rows.length === 0) {
      throw new Error('Token not found');
    }

    const periodType = result.rows[0].spending_period_type || 'monthly';
    let newResetAt;

    if (periodType === 'daily') {
      newResetAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else {
      newResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    await db.query(
      `UPDATE api_tokens
       SET current_period_spend_usd = 0,
           period_reset_at = $1,
           disabled_by_limit = false,
           last_warning_sent_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newResetAt, tokenId]
    );

    log.info('[RESET_SPENDING] Manual token spending reset', {
      tokenId,
      nextResetAt: newResetAt
    });

    return { success: true, nextResetAt: newResetAt };
  } catch (error) {
    log.error('[RESET_SPENDING] Error resetting token spending', {
      tokenId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Start the spending reset scheduler
 * Runs every hour to check for tokens needing reset
 */
let resetInterval = null;

const start = () => {
  if (resetInterval) {
    log.warn('[RESET_SPENDING] Scheduler already running');
    return;
  }

  // Run immediately on start
  resetExpiredSpending().catch(err => {
    log.error('[RESET_SPENDING] Initial run failed', { error: err.message });
  });

  // Run every hour
  const ONE_HOUR = 60 * 60 * 1000;
  resetInterval = setInterval(() => {
    resetExpiredSpending().catch(err => {
      log.error('[RESET_SPENDING] Scheduled run failed', { error: err.message });
    });
  }, ONE_HOUR);

  log.info('[RESET_SPENDING] Scheduler started (runs every hour)');
};

const stop = () => {
  if (resetInterval) {
    clearInterval(resetInterval);
    resetInterval = null;
    log.info('[RESET_SPENDING] Scheduler stopped');
  }
};

module.exports = {
  resetExpiredSpending,
  resetTokenSpending,
  start,
  stop
};
