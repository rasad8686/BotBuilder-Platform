/**
 * Webhook Signature Utilities
 * For signing outgoing webhook payloads
 */

const crypto = require('crypto');

/**
 * Generate webhook signature
 * @param {Object} payload - Webhook payload
 * @param {string} secret - Webhook secret
 * @returns {string} Signature header value
 */
function generateSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = typeof payload === 'string'
    ? payload
    : JSON.stringify(payload);

  const signaturePayload = `${timestamp}.${payloadString}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}

/**
 * Verify webhook signature
 * @param {string} signature - Signature header value
 * @param {Object|string} payload - Webhook payload
 * @param {string} secret - Webhook secret
 * @param {number} tolerance - Timestamp tolerance in seconds (default 5 min)
 * @returns {boolean} Whether signature is valid
 */
function verifySignature(signature, payload, secret, tolerance = 300) {
  if (!signature) return false;

  // Parse signature
  const parts = signature.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {});

  if (!parts.t || !parts.v1) return false;

  const timestamp = parseInt(parts.t);
  const providedSignature = parts.v1;

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    return false;
  }

  // Calculate expected signature
  const payloadString = typeof payload === 'string'
    ? payload
    : JSON.stringify(payload);
  const signaturePayload = `${timestamp}.${payloadString}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Generate a secure webhook secret
 */
function generateSecret() {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

module.exports = {
  generateSignature,
  verifySignature,
  generateSecret
};
