/**
 * Request ID Middleware
 * Generates unique request ID for tracing
 */

const crypto = require('crypto');

function generateRequestId() {
  return `req_${crypto.randomBytes(12).toString('hex')}`;
}

function requestId(req, res, next) {
  // Use existing request ID from header or generate new one
  const id = req.headers['x-request-id'] || generateRequestId();

  req.requestId = id;
  res.setHeader('X-Request-Id', id);

  next();
}

module.exports = requestId;
