/**
 * Spending Limiter Middleware
 * Checks API token spending limits on each request
 * - Returns 429 if spending_limit_usd exceeded and auto_disable_on_limit = true
 * - Triggers alert when spending_warning_usd exceeded
 */

const db = require('../db');
const log = require('../utils/logger');

/**
 * Check spending limit for API token
 * Middleware to be used after API key authentication
 */
const checkSpendingLimit = async (req, res, next) => {
  try {
    // Only check if we have an API token (not JWT auth)
    const apiTokenId = req.apiTokenId;
    if (!apiTokenId) {
      return next();
    }

    // Get token spending info
    const result = await db.query(
      `SELECT
        id,
        spending_limit_usd,
        spending_warning_usd,
        current_period_spend_usd,
        auto_disable_on_limit,
        disabled_by_limit,
        last_warning_sent_at,
        is_active,
        token_name
       FROM api_tokens
       WHERE id = $1`,
      [apiTokenId]
    );

    if (result.rows.length === 0) {
      return next();
    }

    const token = result.rows[0];

    // Check if disabled by limit
    if (token.disabled_by_limit) {
      log.warn('[SPENDING_LIMITER] Token disabled by spending limit', {
        tokenId: apiTokenId,
        tokenName: token.token_name
      });

      return res.status(429).json({
        success: false,
        error: 'spending_limit_exceeded',
        message: 'API key spending limit exceeded. Token has been disabled.',
        currentSpend: parseFloat(token.current_period_spend_usd) || 0,
        limit: parseFloat(token.spending_limit_usd) || null
      });
    }

    // Check if limit exists and is exceeded
    const limit = parseFloat(token.spending_limit_usd);
    const currentSpend = parseFloat(token.current_period_spend_usd) || 0;
    const warningThreshold = parseFloat(token.spending_warning_usd);

    if (limit && currentSpend >= limit) {
      if (token.auto_disable_on_limit) {
        // Disable the token
        await db.query(
          `UPDATE api_tokens
           SET disabled_by_limit = true, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [apiTokenId]
        );

        log.warn('[SPENDING_LIMITER] Token auto-disabled due to spending limit', {
          tokenId: apiTokenId,
          tokenName: token.token_name,
          currentSpend,
          limit
        });

        // Trigger alert (could send email/webhook here)
        await triggerSpendingAlert(apiTokenId, 'limit_exceeded', currentSpend, limit);

        return res.status(429).json({
          success: false,
          error: 'spending_limit_exceeded',
          message: 'API key spending limit exceeded. Token has been disabled.',
          currentSpend,
          limit
        });
      }
    }

    // Check warning threshold
    if (warningThreshold && currentSpend >= warningThreshold) {
      // Only send warning once per hour
      const lastWarning = token.last_warning_sent_at;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      if (!lastWarning || new Date(lastWarning) < oneHourAgo) {
        await db.query(
          `UPDATE api_tokens
           SET last_warning_sent_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [apiTokenId]
        );

        log.warn('[SPENDING_LIMITER] Spending warning threshold reached', {
          tokenId: apiTokenId,
          tokenName: token.token_name,
          currentSpend,
          warningThreshold
        });

        // Trigger warning alert
        await triggerSpendingAlert(apiTokenId, 'warning_reached', currentSpend, warningThreshold);
      }
    }

    // Add spending info to request for downstream use
    req.spendingInfo = {
      tokenId: apiTokenId,
      currentSpend,
      limit: limit || null,
      warning: warningThreshold || null,
      percentUsed: limit ? Math.round((currentSpend / limit) * 100) : 0
    };

    next();
  } catch (error) {
    log.error('[SPENDING_LIMITER] Error checking spending limit', {
      error: error.message,
      tokenId: req.apiTokenId
    });
    // Don't block request on error, just log it
    next();
  }
};

/**
 * Record spending for an API token
 * Call this after a successful API request that incurs cost
 * @param {number} tokenId - API token ID
 * @param {number} costUsd - Cost in USD to add
 */
const recordSpending = async (tokenId, costUsd) => {
  try {
    if (!tokenId || !costUsd || costUsd <= 0) {
      return;
    }

    await db.query(
      `UPDATE api_tokens
       SET current_period_spend_usd = COALESCE(current_period_spend_usd, 0) + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [costUsd, tokenId]
    );

    log.debug('[SPENDING_LIMITER] Recorded spending', {
      tokenId,
      costUsd
    });
  } catch (error) {
    log.error('[SPENDING_LIMITER] Error recording spending', {
      error: error.message,
      tokenId,
      costUsd
    });
  }
};

/**
 * Trigger spending alert (warning or limit exceeded)
 * Can be extended to send emails, webhooks, etc.
 */
const triggerSpendingAlert = async (tokenId, alertType, currentSpend, threshold) => {
  try {
    // Get token and organization info
    const result = await db.query(
      `SELECT
        at.token_name,
        at.organization_id,
        o.name as org_name,
        u.email as owner_email
       FROM api_tokens at
       JOIN organizations o ON at.organization_id = o.id
       JOIN users u ON o.owner_id = u.id
       WHERE at.id = $1`,
      [tokenId]
    );

    if (result.rows.length === 0) {
      return;
    }

    const info = result.rows[0];

    // Log the alert
    log.warn('[SPENDING_ALERT]', {
      type: alertType,
      tokenId,
      tokenName: info.token_name,
      organizationId: info.organization_id,
      orgName: info.org_name,
      ownerEmail: info.owner_email,
      currentSpend,
      threshold
    });

    // TODO: Send email notification
    // emailService.sendSpendingAlert(info.owner_email, {
    //   tokenName: info.token_name,
    //   alertType,
    //   currentSpend,
    //   threshold
    // });

    // TODO: Send webhook notification if configured

  } catch (error) {
    log.error('[SPENDING_ALERT] Error triggering alert', {
      error: error.message,
      tokenId,
      alertType
    });
  }
};

/**
 * Get spending status for a token
 * Utility function for checking current spending state
 */
const getSpendingStatus = async (tokenId) => {
  try {
    const result = await db.query(
      `SELECT
        spending_limit_usd,
        spending_warning_usd,
        current_period_spend_usd,
        period_reset_at,
        spending_period_type,
        auto_disable_on_limit,
        disabled_by_limit
       FROM api_tokens
       WHERE id = $1`,
      [tokenId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const token = result.rows[0];
    const limit = parseFloat(token.spending_limit_usd) || null;
    const warning = parseFloat(token.spending_warning_usd) || null;
    const currentSpend = parseFloat(token.current_period_spend_usd) || 0;

    return {
      tokenId,
      currentSpend,
      limit,
      warning,
      percentUsed: limit ? Math.round((currentSpend / limit) * 100) : 0,
      warningReached: warning && currentSpend >= warning,
      limitReached: limit && currentSpend >= limit,
      disabledByLimit: token.disabled_by_limit,
      periodResetAt: token.period_reset_at,
      periodType: token.spending_period_type,
      autoDisableOnLimit: token.auto_disable_on_limit
    };
  } catch (error) {
    log.error('[SPENDING_LIMITER] Error getting spending status', {
      error: error.message,
      tokenId
    });
    return null;
  }
};

module.exports = {
  checkSpendingLimit,
  recordSpending,
  triggerSpendingAlert,
  getSpendingStatus
};
