/**
 * Security Headers Middleware Tests
 * Tests for server/middleware/securityHeaders.js
 */

jest.mock('helmet', () => {
  return jest.fn(() => (req, res, next) => next());
});

const helmet = require('helmet');
const securityHeaders = require('../../middleware/securityHeaders');

describe('securityHeaders middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      path: '/api/test' // Add path to avoid startsWith error
    };
    res = {
      locals: {},
      setHeader: jest.fn() // Add setHeader mock for Permissions-Policy
    };
    next = jest.fn();
  });

  it('should generate a nonce and store it in res.locals', () => {
    securityHeaders(req, res, next);

    expect(res.locals.cspNonce).toBeDefined();
    expect(typeof res.locals.cspNonce).toBe('string');
    expect(res.locals.cspNonce.length).toBeGreaterThan(0);
  });

  it('should call helmet with security configuration', () => {
    securityHeaders(req, res, next);

    expect(helmet).toHaveBeenCalledWith(expect.objectContaining({
      contentSecurityPolicy: expect.any(Object),
      hsts: expect.any(Object),
      noSniff: true,
      xssFilter: true,
      hidePoweredBy: true,
      referrerPolicy: expect.any(Object)
    }));
  });

  it('should call next', () => {
    securityHeaders(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should generate unique nonces for each request', () => {
    const res1 = { locals: {}, setHeader: jest.fn() };
    const res2 = { locals: {}, setHeader: jest.fn() };

    securityHeaders(req, res1, jest.fn());
    securityHeaders(req, res2, jest.fn());

    expect(res1.locals.cspNonce).not.toBe(res2.locals.cspNonce);
  });

  it('should include CSP directives', () => {
    securityHeaders(req, res, next);

    const helmetCall = helmet.mock.calls[0][0];
    expect(helmetCall.contentSecurityPolicy.directives).toBeDefined();
    expect(helmetCall.contentSecurityPolicy.directives.defaultSrc).toContain("'self'");
    expect(helmetCall.contentSecurityPolicy.directives.objectSrc).toContain("'none'");
  });

  it('should include HSTS configuration', () => {
    securityHeaders(req, res, next);

    const helmetCall = helmet.mock.calls[0][0];
    expect(helmetCall.hsts.maxAge).toBe(31536000);
    expect(helmetCall.hsts.includeSubDomains).toBe(true);
    expect(helmetCall.hsts.preload).toBe(true);
  });

  it('should include nonce in script-src and style-src', () => {
    securityHeaders(req, res, next);

    const helmetCall = helmet.mock.calls[0][0];
    const nonce = res.locals.cspNonce;

    expect(helmetCall.contentSecurityPolicy.directives.scriptSrc).toContain(`'nonce-${nonce}'`);
    expect(helmetCall.contentSecurityPolicy.directives.styleSrc).toContain(`'nonce-${nonce}'`);
  });

  it('should allow Stripe and Socket.IO scripts', () => {
    securityHeaders(req, res, next);

    const helmetCall = helmet.mock.calls[0][0];
    expect(helmetCall.contentSecurityPolicy.directives.scriptSrc).toContain('https://js.stripe.com');
    expect(helmetCall.contentSecurityPolicy.directives.scriptSrc).toContain('https://cdn.socket.io');
  });

  it('should allow data URLs for images', () => {
    securityHeaders(req, res, next);

    const helmetCall = helmet.mock.calls[0][0];
    expect(helmetCall.contentSecurityPolicy.directives.imgSrc).toContain('data:');
    expect(helmetCall.contentSecurityPolicy.directives.imgSrc).toContain('https:');
  });

  it('should allow WebSocket connections', () => {
    securityHeaders(req, res, next);

    const helmetCall = helmet.mock.calls[0][0];
    expect(helmetCall.contentSecurityPolicy.directives.connectSrc).toContain('wss:');
    expect(helmetCall.contentSecurityPolicy.directives.connectSrc).toContain('ws:');
  });

  it('should set referrer policy to strict-origin-when-cross-origin', () => {
    securityHeaders(req, res, next);

    const helmetCall = helmet.mock.calls[0][0];
    expect(helmetCall.referrerPolicy.policy).toBe('strict-origin-when-cross-origin');
  });
});
