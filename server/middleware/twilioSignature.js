/**
 * Twilio Signature Verification Middleware
 * Validates incoming Twilio webhook requests
 */

const twilio = require('twilio');
const logger = require('../utils/logger');

/**
 * Validate Twilio request signature
 * @param {boolean} allowLocal - Allow requests without signature in development
 */
const validateTwilioSignature = (allowLocal = false) => {
  return (req, res, next) => {
    // Skip validation in development if allowLocal is true
    if (allowLocal && process.env.NODE_ENV === 'development') {
      logger.debug('Skipping Twilio signature validation in development');
      return next();
    }

    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      logger.error('TWILIO_AUTH_TOKEN not configured');
      return res.status(500).send('Server configuration error');
    }

    // Get the signature from header
    const twilioSignature = req.headers['x-twilio-signature'];

    if (!twilioSignature) {
      logger.warn('Missing Twilio signature header', {
        ip: req.ip,
        path: req.path
      });
      return res.status(403).send('Forbidden: Missing signature');
    }

    // Build the full URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const url = `${protocol}://${host}${req.originalUrl}`;

    // Get request body params
    const params = req.body || {};

    // Validate the signature
    const isValid = twilio.validateRequest(
      authToken,
      twilioSignature,
      url,
      params
    );

    if (!isValid) {
      logger.warn('Invalid Twilio signature', {
        ip: req.ip,
        path: req.path,
        url: url
      });
      return res.status(403).send('Forbidden: Invalid signature');
    }

    logger.debug('Twilio signature validated successfully', { path: req.path });
    next();
  };
};

/**
 * Validate Twilio signature with fallback URL
 * Some proxies may modify the URL, so we try multiple variations
 */
const validateTwilioSignatureFlexible = () => {
  return (req, res, next) => {
    // Skip validation in development
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_TWILIO_VALIDATION === 'true') {
      return next();
    }

    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      logger.error('TWILIO_AUTH_TOKEN not configured');
      return res.status(500).send('Server configuration error');
    }

    const twilioSignature = req.headers['x-twilio-signature'];

    if (!twilioSignature) {
      return res.status(403).send('Forbidden: Missing signature');
    }

    const params = req.body || {};

    // Try different URL variations
    const urlVariations = [
      // Standard URL
      `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      // With x-forwarded headers
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.get('host')}${req.originalUrl}`,
      // HTTPS forced
      `https://${req.get('host')}${req.originalUrl}`,
      // With configured base URL
      process.env.BASE_URL ? `${process.env.BASE_URL}${req.originalUrl}` : null
    ].filter(Boolean);

    const isValid = urlVariations.some(url =>
      twilio.validateRequest(authToken, twilioSignature, url, params)
    );

    if (!isValid) {
      logger.warn('Invalid Twilio signature after trying all URL variations', {
        ip: req.ip,
        path: req.path
      });
      return res.status(403).send('Forbidden: Invalid signature');
    }

    next();
  };
};

module.exports = {
  validateTwilioSignature,
  validateTwilioSignatureFlexible
};
