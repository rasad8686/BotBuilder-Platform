const helmet = require('helmet');
const crypto = require('crypto');

// Generate nonce for inline scripts (more secure than unsafe-inline)
const generateNonce = () => crypto.randomBytes(16).toString('base64');

// Security headers middleware using Helmet
// SECURITY: Removed 'unsafe-inline' - use nonce-based CSP instead
const securityHeaders = (req, res, next) => {
  // Skip CSP for Swagger UI (uses inline styles)
  if (req.path.startsWith('/api-docs')) {
    return next();
  }

  // Generate unique nonce for this request
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;

  // ✅ Permissions-Policy header (formerly Feature-Policy)
  // Controls which browser features can be used
  res.setHeader('Permissions-Policy', [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=(self)',
    'usb=()',
    'interest-cohort=()',
    'autoplay=(self)',
    'fullscreen=(self)'
  ].join(', '));

  // ✅ X-Download-Options header (IE8+ download security)
  res.setHeader('X-Download-Options', 'noopen');

  // ✅ X-Permitted-Cross-Domain-Policies (Flash/PDF cross-domain)
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // ✅ Cache-Control for API responses (prevent sensitive data caching)
  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/sessions')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", `'nonce-${nonce}'`],
        scriptSrc: ["'self'", `'nonce-${nonce}'`, "https://js.stripe.com", "https://cdn.socket.io"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.stripe.com", "https://cdn.socket.io", "wss:", "ws:"],
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
    // ✅ Cross-Origin headers for additional isolation
    crossOriginEmbedderPolicy: false, // Disabled for Stripe/Socket.io compatibility
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow widget embedding
  })(req, res, next);
};

module.exports = securityHeaders;
