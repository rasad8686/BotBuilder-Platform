# Comprehensive Middleware Test Suite

## Overview
This test suite provides comprehensive coverage for all server middleware components in the BotBuilder application.

## File Location
`server/__tests__/middleware/comprehensive.test.js`

## Test Statistics
- **Total Tests**: 115 test cases
- **Total Lines**: 1,743 lines of code
- **Test Suites**: 41 describe blocks
- **Middleware Covered**: 7 middleware modules

## Middleware Coverage

### 1. Authentication Middleware (auth.js)
**Tests**: 13
**Coverage**:
- JWT token validation from cookies
- JWT token validation from Authorization header
- Token priority (cookie vs header)
- Invalid token handling
- Expired token handling
- Malformed header handling
- Error logging and handling
- User object attachment to request

### 2. Rate Limiter Middleware (rateLimiter.js)
**Tests**: 15
**Coverage**:
- Rate limit settings caching and database fetch
- IP blocking detection
- Failed attempt recording
- Attempt clearing on successful login
- Database-backed auth limiting
- Failed login tracking
- Window-based rate limiting
- SQL injection prevention in parameterized queries

### 3. Organization Context Middleware (organizationContext.js)
**Tests**: 12
**Coverage**:
- User organization lookup
- Header-based organization selection
- Default organization fallback
- Organization membership verification
- Owner flag setting
- Role hierarchy helper function
- Database error handling
- Connection error handling (503 responses)

### 4. Validation Middleware (validators.js)
**Tests**: 15
**Coverage**:
- XSS sanitization (script tags, event handlers, javascript: URLs)
- HTML character escaping
- Nested object sanitization
- Array sanitization
- Registration validation (username, email, password complexity)
- Login validation
- Bot creation/update validation
- Parameter validation
- Schema-based validation with Joi

### 5. CSRF Protection Middleware (csrf.js)
**Tests**: 15
**Coverage**:
- Token generation
- Token cookie management
- Double-submit cookie pattern validation
- Protected methods (POST, PUT, DELETE, PATCH)
- Exempt routes handling
- Token mismatch detection
- Production vs development security settings
- Timing-safe comparison for tokens

### 6. Admin Access Control Middleware (requireSuperAdmin.js)
**Tests**: 20
**Coverage**:
- Superadmin verification
- Organization admin verification
- Owner verification
- Rate limiting for admin logins (email and IP based)
- IP whitelist enforcement
- IPv6 mapped IPv4 handling
- Audit logging for access attempts
- Database whitelist support
- 2FA requirements

### 7. API Cache Middleware (apiCache.js)
**Tests**: 25
**Coverage**:
- Cache key generation (user, organization, query params)
- Redis connection handling
- Cache hit/miss logic
- Cache headers (X-Cache, X-Cache-Age)
- TTL customization
- Conditional caching
- Cache invalidation by pattern
- Error response exclusion from cache
- no-cache header support
- Response interception and caching

## Edge Cases and Integration Tests
**Tests**: 10+
**Coverage**:
- Request header parsing edge cases
- next() calling patterns
- Response modifications
- Concurrent request handling
- Memory efficiency with large objects
- Deep nesting sanitization
- Missing/malformed headers

## Mock Patterns Used

### Database Mock
```javascript
jest.mock('../../db', () => ({
  query: jest.fn()
}));
```

### Logger Mock
```javascript
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));
```

### HTTP Mocks
```javascript
const httpMocks = require('node-mocks-http');
mockReq = httpMocks.createRequest();
mockRes = httpMocks.createResponse();
```

### Redis Mock
```javascript
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(),
  isRedisConnected: jest.fn(),
  CACHE_TTL: { ... },
  CACHE_PREFIX: { ... }
}));
```

## Running the Tests

### Run all tests
```bash
npm test -- server/__tests__/middleware/comprehensive.test.js
```

### Run with verbose output
```bash
npm test -- server/__tests__/middleware/comprehensive.test.js --verbose
```

### Run specific test suite
```bash
npm test -- server/__tests__/middleware/comprehensive.test.js -t "Authentication Middleware"
```

### Run with coverage
```bash
npm test -- server/__tests__/middleware/comprehensive.test.js --coverage
```

## Key Testing Patterns

### 1. Async/Promise Testing
```javascript
it('should handle async operation', async () => {
  await middleware(mockReq, mockRes, mockNext);
  expect(mockNext).toHaveBeenCalled();
});
```

### 2. Callback Testing
```javascript
it('should call next on success', (done) => {
  middleware(mockReq, mockRes, () => {
    expect(mockReq.user).toBeDefined();
    done();
  });
});
```

### 3. Error Handling
```javascript
it('should return 403 on error', () => {
  middleware(mockReq, mockRes, mockNext);
  expect(mockRes.statusCode).toBe(403);
  expect(mockNext).not.toHaveBeenCalled();
});
```

### 4. Response Validation
```javascript
it('should return correct JSON', () => {
  middleware(mockReq, mockRes, mockNext);
  const data = mockRes._getJSONData();
  expect(data.success).toBe(false);
  expect(data.message).toContain('error');
});
```

## Test Coverage Goals
- ✅ Middleware execution flow
- ✅ Request header parsing
- ✅ Token validation (JWT)
- ✅ Rate limit tracking
- ✅ Cache hit/miss scenarios
- ✅ Error handling (4xx, 5xx)
- ✅ next() calling patterns
- ✅ Response modifications
- ✅ Security (XSS, CSRF, injection)
- ✅ Edge cases (missing data, malformed input)
- ✅ Concurrent requests
- ✅ Database errors
- ✅ Redis connection failures

## Notes
- All tests use isolated mocks to prevent side effects
- Tests do not modify source code
- Each test suite has proper setup/teardown with `beforeEach`
- Comprehensive error scenarios covered
- Production vs development environment handling tested
- Security vulnerabilities tested (XSS, CSRF, SQL injection prevention)

## Maintenance
- Add new tests when middleware functionality changes
- Keep mock patterns consistent across test suites
- Update test counts in this README when adding/removing tests
- Ensure all async operations use proper async/await or done callbacks
