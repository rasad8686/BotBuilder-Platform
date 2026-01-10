/**
 * Webhook Signature Verification Middleware
 * Verifies incoming webhook signatures
 */

const crypto = require('crypto');
const { ErrorCodes } = require('../constants/errorCodes');

const SIGNATURE_HEADER = 'x-botbuilder-signature';
const TIMESTAMP_TOLERANCE = 300; // 5 minutes

/**
 * Verify webhook signature
 * @param {string} secret - Webhook secret
 */
function verifyWebhook(secret) {
  return (req, res, next) => {
    const signature = req.headers[SIGNATURE_HEADER];

    if (!signature) {
      return res.apiError(ErrorCodes.WEBHOOK_SIGNATURE_INVALID, {
        message: 'Missing webhook signature header'
      });
    }

    // Parse signature: t=timestamp,v1=signature
    const parts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {});

    if (!parts.t || !parts.v1) {
      return res.apiError(ErrorCodes.WEBHOOK_SIGNATURE_INVALID, {
        message: 'Invalid signature format'
      });
    }

    const timestamp = parseInt(parts.t);
    const providedSignature = parts.v1;

    // Check timestamp
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE) {
      return res.apiError(ErrorCodes.WEBHOOK_SIGNATURE_INVALID, {
        message: 'Webhook timestamp is too old'
      });
    }

    // Calculate expected signature
    const payload = `${timestamp}.${JSON.stringify(req.body)}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      return res.apiError(ErrorCodes.WEBHOOK_SIGNATURE_INVALID, {
        message: 'Webhook signature verification failed'
      });
    }

    req.webhookTimestamp = timestamp;
    next();
  };
}

module.exports = verifyWebhook;
