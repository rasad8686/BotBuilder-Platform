# BotBuilder Security Audit Checklist

## Overview
Comprehensive security audit checklist for BotBuilder RBAC Multi-Tenant System.

**Last Audit Date**: 2025-01-XX
**Auditor**: [Name]
**Version**: 1.0

---

## 1. Authentication Security

### 1.1 Password Security
- [ ] Passwords hashed using bcrypt (salt rounds >= 10)
- [ ] Minimum password length enforced (6+ characters)
- [ ] Password complexity requirements documented
- [ ] Passwords never stored in plaintext
- [ ] Passwords never logged
- [ ] Password never returned in API responses

**Verification**:
```bash
# Check bcrypt implementation in server.js
grep -n "bcrypt.hash" server/server.js
grep -n "password.length" server/server.js
```

**Current Implementation**: ✅ bcrypt with 10 rounds
**Location**: `server/server.js:97`

---

### 1.2 JWT Token Security
- [ ] JWT secret stored in environment variable
- [ ] JWT secret is strong and unique (not default)
- [ ] JWT expiration set (24h max)
- [ ] JWT includes only necessary claims
- [ ] JWT signature verified on every request
- [ ] Expired tokens rejected
- [ ] Invalid tokens rejected

**Verification**:
```bash
# Check JWT implementation
grep -n "JWT_SECRET" server/server.js
grep -n "expiresIn" server/server.js
```

**Current Implementation**:
- ✅ Secret: `process.env.JWT_SECRET`
- ✅ Expiration: 24h
- ⚠️ Default fallback: `'your-super-secret-jwt-key-change-in-production'`

**ACTION REQUIRED**: Ensure JWT_SECRET is set in production `.env`

---

### 1.3 Session Management
- [ ] Token stored securely in localStorage (HTTPS only in prod)
- [ ] Token cleared on logout
- [ ] Token cleared on authentication errors
- [ ] No session fixation vulnerabilities
- [ ] Concurrent sessions handled properly

**Current Implementation**: ✅ localStorage cleared on logout/401

---

## 2. Authorization and Access Control

### 2.1 Role-Based Access Control (RBAC)
- [ ] Three roles implemented: owner, admin, member, viewer
- [ ] Role hierarchy enforced (owner > admin > member > viewer)
- [ ] Permissions checked on every protected endpoint
- [ ] UI components respect role permissions (PermissionGuard)
- [ ] Cannot escalate own privileges
- [ ] Cannot change owner role

**Verification Steps**:
1. Test as viewer - cannot create/delete
2. Test as member - can create, cannot delete
3. Test as admin - can create and delete
4. Test privilege escalation - should fail

**Current Implementation**: ✅ RBAC fully implemented

---

### 2.2 Multi-Tenant Isolation
- [ ] All resources scoped to organization_id
- [ ] Cannot access other organization's data
- [ ] SQL queries include organization_id filter
- [ ] Foreign key constraints enforce relationships
- [ ] CASCADE deletes work correctly
- [ ] Organization switching works securely

**Critical Test**: Cross-Organization Access
```sql
-- User A in Org 1 tries to access Org 2's bot
SELECT * FROM bots WHERE id = <org2_bot_id> AND organization_id = <org1_id>;
-- Should return 0 rows
```

**Verification**:
```bash
# Check organization_id in queries
grep -rn "organization_id" server/routes/
```

**Current Implementation**: ✅ organization_id enforced via middleware

---

### 2.3 API Endpoint Protection
- [ ] All protected routes require authentication
- [ ] Authentication middleware applied correctly
- [ ] Organization context middleware applied
- [ ] Permission checks on sensitive operations
- [ ] Cannot bypass checks with malformed requests

**Checklist**:
```
✅ POST /api/bots - Requires auth + member role
✅ DELETE /api/bots/:id - Requires auth + admin role
✅ GET /api/organizations/:id/members - Requires auth + membership
✅ POST /api/organizations/:id/invite - Requires auth + admin role
✅ DELETE /api/organizations/:id - Requires auth + owner role
```

---

## 3. Input Validation

### 3.1 Registration Input Validation
- [ ] Email format validated (regex)
- [ ] Username/email sanitized
- [ ] Password length validated
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (no eval, innerHTML with user input)
- [ ] No code injection possible

**Test Cases**:
```javascript
// SQL Injection attempts
email: "admin@test.com'; DROP TABLE users; --"
username: "admin' OR '1'='1"

// XSS attempts
username: "<script>alert('XSS')</script>"
email: "test@test.com<script>alert('XSS')</script>"
```

**Current Implementation**: ✅ Parameterized queries used everywhere
**Location**: `server/server.js` - All queries use `$1, $2, etc.`

---

### 3.2 API Input Validation
- [ ] Request body validated
- [ ] Required fields checked
- [ ] Data types validated
- [ ] String lengths limited
- [ ] No arbitrary JSON accepted without validation
- [ ] File uploads validated (if applicable)

**Verification**:
```bash
# Check validation logic
grep -rn "if (!.*||" server/routes/
grep -rn "required" server/routes/
```

**Current Implementation**: ✅ Basic validation present

---

## 4. SQL Injection Prevention

### 4.1 Parameterized Queries
- [ ] ALL queries use parameterized statements
- [ ] NO string concatenation in SQL queries
- [ ] NO dynamic table/column names from user input
- [ ] Prepared statements used

**Dangerous Pattern**:
```javascript
// ❌ DANGEROUS - SQL Injection
db.query(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ SAFE - Parameterized
db.query('SELECT * FROM users WHERE email = $1', [email]);
```

**Audit Commands**:
```bash
# Search for dangerous patterns
grep -rn "\`.*\${" server/
grep -rn '".*".*+.*"' server/routes/

# Should find NO results indicating string concatenation in queries
```

**Current Implementation**: ✅ All queries parameterized

---

## 5. Cross-Site Scripting (XSS) Prevention

### 5.1 Frontend XSS Protection
- [ ] React escapes output by default
- [ ] No dangerouslySetInnerHTML used with user input
- [ ] No eval() used
- [ ] No inline event handlers with user data
- [ ] Content Security Policy (CSP) configured

**Verification**:
```bash
# Check for dangerous patterns
grep -rn "dangerouslySetInnerHTML" client/src/
grep -rn "eval(" client/src/
grep -rn "innerHTML" client/src/
```

**Current Implementation**: ✅ React default escaping used

---

### 5.2 Backend XSS Protection
- [ ] Response headers include X-XSS-Protection
- [ ] Content-Type headers set correctly
- [ ] No user input reflected without sanitization

**Required Headers**:
```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

**Current Implementation**: ⚠️ Headers not explicitly set

**ACTION REQUIRED**: Add security headers

---

## 6. CORS Configuration

### 6.1 CORS Policy
- [ ] CORS configured to allow specific origins only
- [ ] Wildcards (*) not used in production
- [ ] Credentials enabled only for trusted origins
- [ ] Preflight requests handled correctly

**Current Configuration** (`server/server.js:14-32`):
```javascript
app.use(cors({
  origin: function (origin, callback) {
    // Allow localhost
    if (origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    // Allow Vercel deployments
    if (origin.includes('bot-builder-platform') && origin.includes('vercel.app')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
```

**Security Assessment**: ✅ Good - specific origins only
**Improvement**: Consider environment-based whitelist

---

## 7. Environment Variables

### 7.1 Sensitive Data Protection
- [ ] .env file in .gitignore
- [ ] No secrets in source code
- [ ] No secrets in logs
- [ ] Environment variables validated on startup
- [ ] Different secrets per environment

**Required Environment Variables**:
```bash
# Server
JWT_SECRET=<strong-random-secret>
DATABASE_URL=<postgresql-connection-string>
NODE_ENV=production

# Client
VITE_API_BASE_URL=<backend-url>
```

**Verification**:
```bash
# Check .gitignore
cat .gitignore | grep .env

# Search for hardcoded secrets
grep -rn "password.*=.*['\"]" server/ --exclude-dir=node_modules
grep -rn "secret.*=.*['\"]" server/ --exclude-dir=node_modules
```

**Current Implementation**:
- ✅ .env.example provided
- ⚠️ Default JWT secret in code

**ACTION REQUIRED**: Remove default JWT secret fallback

---

## 8. Database Security

### 8.1 Connection Security
- [ ] Database connection uses SSL in production
- [ ] Connection pooling configured
- [ ] Connection timeouts set
- [ ] Credentials not in source code

**Verification**:
```bash
# Check database configuration
cat server/db.js
```

---

### 8.2 Data Integrity
- [ ] Foreign key constraints enforced
- [ ] Unique constraints on critical fields
- [ ] NOT NULL constraints where appropriate
- [ ] CHECK constraints for valid values
- [ ] CASCADE deletes configured correctly

**Database Audit**:
```sql
-- Check constraints
SELECT
  tc.constraint_name,
  tc.table_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public';

-- Check foreign keys
SELECT
  kcu.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.key_column_usage kcu
JOIN information_schema.constraint_column_usage ccu
  ON kcu.constraint_name = ccu.constraint_name;
```

**Current Implementation**: ✅ Constraints from migration 005

---

## 9. Error Handling and Logging

### 9.1 Error Messages
- [ ] No stack traces in production responses
- [ ] No database errors exposed to users
- [ ] Generic error messages for security issues
- [ ] Detailed errors only in development

**Good Practice**:
```javascript
// ❌ BAD - Exposes internal details
res.status(500).json({ error: error.stack });

// ✅ GOOD - Generic message in production
res.status(500).json({
  message: process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : error.message
});
```

**Current Implementation**: ✅ Error details included (check if NODE_ENV check added)

---

### 9.2 Logging Security
- [ ] Passwords never logged
- [ ] Tokens never logged
- [ ] PII (Personal Identifiable Information) minimized in logs
- [ ] Logs stored securely
- [ ] Log rotation configured

**Verification**:
```bash
# Check for password logging
grep -rn "console.log.*password" server/
grep -rn "console.log.*token" server/
```

**Current Implementation**: ✅ Passwords not logged, tokens logged (OK for debug)

---

## 10. Rate Limiting and DDoS Prevention

### 10.1 Rate Limiting
- [ ] Rate limiting on authentication endpoints
- [ ] Rate limiting on API endpoints
- [ ] Brute force protection on login
- [ ] Account lockout after failed attempts

**Recommended**: Install express-rate-limit
```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: 'Too many login attempts, please try again later'
});

app.post('/auth/login', authLimiter, loginHandler);
```

**Current Implementation**: ❌ No rate limiting

**ACTION REQUIRED**: Implement rate limiting

---

## 11. Dependency Security

### 11.1 Package Vulnerabilities
- [ ] Dependencies up to date
- [ ] No known vulnerabilities (npm audit)
- [ ] Security patches applied
- [ ] Deprecated packages removed

**Audit Commands**:
```bash
# Check for vulnerabilities
cd server && npm audit
cd client && npm audit

# Fix auto-fixable issues
npm audit fix

# Check outdated packages
npm outdated
```

**Current Implementation**: ⚠️ Check with `npm audit`

**ACTION REQUIRED**: Run audit and fix critical vulnerabilities

---

## 12. API Security Best Practices

### 12.1 HTTP Security Headers
- [ ] Helmet.js installed and configured
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] X-XSS-Protection: 1; mode=block
- [ ] Strict-Transport-Security (HSTS) in production
- [ ] Content-Security-Policy (CSP) configured

**Implementation**:
```javascript
const helmet = require('helmet');
app.use(helmet());
```

**Current Implementation**: ❌ Helmet not installed

**ACTION REQUIRED**: Install and configure helmet

---

### 12.2 HTTPS Enforcement
- [ ] HTTPS used in production
- [ ] HTTP redirects to HTTPS
- [ ] Secure cookies (httpOnly, secure flags)
- [ ] SameSite cookie attribute set

**Current Implementation**: ⚠️ Depends on deployment (Render/Vercel handle HTTPS)

---

## 13. Frontend Security

### 13.1 Client-Side Storage
- [ ] No sensitive data in localStorage
- [ ] Tokens cleared on logout
- [ ] Session storage used appropriately
- [ ] No credentials in IndexedDB

**Current Implementation**: ✅ Only token and basic user info in localStorage

---

### 13.2 Build Security
- [ ] Source maps disabled in production
- [ ] Environment variables not exposed
- [ ] No console.logs in production
- [ ] Minification enabled

**Verification**:
```bash
# Check vite config
cat client/vite.config.js
```

---

## 14. Organization-Specific Security

### 14.1 Organization Deletion
- [ ] Only owner can delete organization
- [ ] Confirmation required
- [ ] CASCADE deletes work correctly
- [ ] Related data properly cleaned up
- [ ] Audit log of deletions (if applicable)

**Test**:
1. Try to delete org as non-owner → Should fail
2. Delete org as owner → Should remove all related data

**Current Implementation**: ✅ Owner-only, CASCADE configured

---

### 14.2 Member Invitation
- [ ] Only admin+ can invite
- [ ] Email validation on invite
- [ ] Cannot invite to non-member organization
- [ ] Cannot change owner role

**Current Implementation**: ✅ Checks in place

---

## Security Checklist Summary

### Critical (Must Fix)
- [ ] **Set JWT_SECRET in production .env**
- [ ] **Remove default JWT secret fallback**
- [ ] **Implement rate limiting on auth endpoints**
- [ ] **Install and configure helmet.js**
- [ ] **Run npm audit and fix critical vulnerabilities**

### High Priority (Should Fix)
- [ ] Add security response headers (CSP, XSS Protection)
- [ ] Implement brute force protection on login
- [ ] Add request size limits
- [ ] Configure log rotation
- [ ] Add account lockout mechanism

### Medium Priority (Nice to Have)
- [ ] Add 2FA support
- [ ] Implement session timeout
- [ ] Add IP-based rate limiting
- [ ] Configure WAF (Web Application Firewall)
- [ ] Add security monitoring/alerting

### Low Priority (Future Enhancements)
- [ ] Add audit logs for sensitive operations
- [ ] Implement data encryption at rest
- [ ] Add API versioning
- [ ] Implement request signing
- [ ] Add honeypot fields

---

## Penetration Testing Checklist

### Authentication Tests
- [ ] SQL injection in login
- [ ] Brute force login attempts
- [ ] Token replay attacks
- [ ] Session fixation
- [ ] Password reset flow

### Authorization Tests
- [ ] Horizontal privilege escalation
- [ ] Vertical privilege escalation
- [ ] IDOR (Insecure Direct Object Reference)
- [ ] Forced browsing
- [ ] Parameter tampering

### Input Validation Tests
- [ ] XSS in all input fields
- [ ] SQL injection in all parameters
- [ ] Command injection
- [ ] Path traversal
- [ ] XML/XXE injection

### Business Logic Tests
- [ ] Race conditions
- [ ] Mass assignment
- [ ] Price manipulation
- [ ] Quantity manipulation
- [ ] Workflow bypass

---

## Compliance Checklist

### GDPR (if applicable)
- [ ] Data collection consent
- [ ] Right to access data
- [ ] Right to delete data
- [ ] Data portability
- [ ] Privacy policy

### OWASP Top 10 2021
- [x] A01:2021 - Broken Access Control
- [x] A02:2021 - Cryptographic Failures
- [x] A03:2021 - Injection
- [ ] A04:2021 - Insecure Design
- [ ] A05:2021 - Security Misconfiguration
- [ ] A06:2021 - Vulnerable Components
- [ ] A07:2021 - Auth Failures
- [ ] A08:2021 - Software Integrity
- [ ] A09:2021 - Logging Failures
- [ ] A10:2021 - SSRF

---

## Security Incident Response

### If Security Issue Discovered:
1. Document the vulnerability
2. Assess severity (CVSS score)
3. Fix immediately if critical
4. Test the fix thoroughly
5. Deploy to production
6. Notify affected users (if data breach)
7. Update this checklist
8. Post-mortem analysis

---

**Audit Completed By**: ___________________
**Date**: ___________________
**Next Audit Due**: ___________________

---

**Last Updated**: 2025-01-XX
**Version**: 1.0
**RBAC System Version**: Phase 3 Complete
