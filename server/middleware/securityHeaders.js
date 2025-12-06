const helmet = require('helmet');
const crypto = require('crypto');

// Generate nonce for inline scripts (more secure than unsafe-inline)
const generateNonce = () => crypto.randomBytes(16).toString('base64');

// Security headers middleware using Helmet
// SECURITY: Removed 'unsafe-inline' - use nonce-based CSP instead
const securityHeaders = (req, res, next) => {
  // Generate unique nonce for this request
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;

  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", `'nonce-${nonce}'`],
        scriptSrc: ["'self'", `'nonce-${nonce}'`, "https://js.stripe.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.stripe.com", "wss:", "ws:"],
        frameSrc: ["'self'", "https://js.stripe.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })(req, res, next);
};

module.exports = securityHeaders;
