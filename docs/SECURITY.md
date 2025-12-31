# Security Guide

Comprehensive security documentation for BotBuilder platform.

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Data Protection](#data-protection)
- [API Security](#api-security)
- [Infrastructure Security](#infrastructure-security)
- [Security Best Practices](#security-best-practices)
- [Vulnerability Reporting](#vulnerability-reporting)
- [Compliance](#compliance)

---

## Overview

BotBuilder implements a defense-in-depth security model with multiple layers of protection:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Perimeter          - WAF, DDoS protection             │
│  Layer 2: Network            - TLS, CORS, rate limiting          │
│  Layer 3: Application        - Auth, RBAC, input validation      │
│  Layer 4: Data               - Encryption, isolation             │
│  Layer 5: Monitoring         - Audit logs, alerting              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication

### JWT Token Authentication

BotBuilder uses JSON Web Tokens (JWT) for stateless authentication.

#### Token Structure

```javascript
// Access Token Payload
{
  "userId": 123,
  "email": "user@example.com",
  "organizationId": 456,
  "role": "admin",
  "iat": 1704067200,
  "exp": 1704068100  // 15 minutes
}
```

#### Token Configuration

```javascript
// Environment variables
JWT_SECRET=<minimum-64-character-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

#### Implementation

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};
```

### Refresh Tokens

Refresh tokens enable secure token renewal without re-authentication.

- Stored in HTTP-only cookies
- Hashed in database
- Rotated on each use
- Device-bound (optional)

```javascript
// Token refresh flow
POST /api/auth/refresh
Cookie: refreshToken=<refresh-token>

// Response
{
  "token": "<new-access-token>",
  "expiresIn": 900
}
```

### Two-Factor Authentication (2FA)

TOTP-based 2FA using authenticator apps.

```javascript
// Setup 2FA
POST /api/2fa/setup
// Returns: { secret, qrCode }

// Verify and enable
POST /api/2fa/verify
{ "token": "123456" }

// Login with 2FA
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "...",
  "twoFactorToken": "123456"
}
```

### Password Security

- **Hashing:** bcrypt with 12 rounds
- **Requirements:**
  - Minimum 8 characters
  - At least one uppercase
  - At least one lowercase
  - At least one number
  - At least one special character
- **History:** Last 5 passwords prevented
- **Expiry:** Optional (enterprise)

```javascript
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

// Hash password
const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

// Verify password
const isValid = await bcrypt.compare(password, passwordHash);
```

---

## Authorization

### Role-Based Access Control (RBAC)

Three default roles with customizable permissions:

| Role | Permissions |
|------|-------------|
| **Viewer** | Read bots, analytics, messages |
| **Member** | All viewer + create/edit bots, flows |
| **Admin** | All member + delete, team management, settings |

### Permission Middleware

```javascript
// middleware/checkPermission.js
const checkPermission = (requiredRole) => {
  const roleHierarchy = ['viewer', 'member', 'admin'];

  return (req, res, next) => {
    const userRole = req.user.role;
    const userRoleIndex = roleHierarchy.indexOf(userRole);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

    if (userRoleIndex < requiredRoleIndex) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }
    next();
  };
};

// Usage
router.delete('/bots/:id',
  authenticateToken,
  checkPermission('admin'),
  deleteBotHandler
);
```

### Organization Isolation

Multi-tenant data isolation ensures organizations cannot access each other's data.

```javascript
// middleware/organizationContext.js
const organizationContext = async (req, res, next) => {
  const userId = req.user.id;

  // Get user's organization membership
  const membership = await db.query(
    `SELECT organization_id, role FROM organization_members
     WHERE user_id = $1`,
    [userId]
  );

  if (!membership.rows.length) {
    return res.status(403).json({
      success: false,
      error: 'No organization access'
    });
  }

  req.organization = {
    id: membership.rows[0].organization_id,
    role: membership.rows[0].role
  };

  next();
};
```

All database queries include organization_id filtering:

```sql
-- Secure query pattern
SELECT * FROM bots
WHERE id = $1 AND organization_id = $2
```

---

## Data Protection

### Encryption at Rest

Sensitive data is encrypted using AES-256-GCM:

```javascript
// services/ai/encryptionHelper.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function encrypt(text, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag.toString('hex')
  };
}

function decrypt(encrypted, key) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encrypted.iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

  let decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

**Encrypted fields:**
- API keys (OpenAI, Anthropic)
- Channel credentials (Telegram, WhatsApp tokens)
- 2FA secrets
- Webhook secrets

### Encryption in Transit

- TLS 1.2+ for all connections
- HTTPS enforced
- HSTS enabled

### Database Security

```javascript
// Parameterized queries (SQL injection prevention)
const result = await db.query(
  'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
  [botId, organizationId]
);

// NEVER do this:
// `SELECT * FROM bots WHERE id = ${botId}` // SQL INJECTION!
```

---

## API Security

### Rate Limiting

```javascript
// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication rate limit (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many login attempts'
  }
});

// AI endpoints (most expensive)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20
});
```

### CORS Configuration

```javascript
// app.js
const cors = require('cors');

const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
};

app.use(cors(corsOptions));
```

### Security Headers

```javascript
// middleware/securityHeaders.js
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.API_URL]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

### CSRF Protection

```javascript
// middleware/csrf.js
const csrf = require('csurf');

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Apply to state-changing routes
router.post('/settings', csrfProtection, updateSettings);
```

### Input Validation

```javascript
// middleware/validators.js
const { body, validationResult } = require('express-validator');

const createBotValidator = [
  body('name')
    .trim()
    .notEmpty()
    .isLength({ min: 1, max: 255 })
    .escape(),
  body('platform')
    .isIn(['telegram', 'whatsapp', 'slack', 'discord', 'web']),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .escape()
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};
```

### XSS Prevention

```javascript
// Sanitize output
const sanitizeHtml = require('sanitize-html');

const sanitizeOptions = {
  allowedTags: [],
  allowedAttributes: {}
};

const sanitizedContent = sanitizeHtml(userInput, sanitizeOptions);
```

---

## Infrastructure Security

### Environment Variables

**Required secrets:**

| Variable | Description | Generation |
|----------|-------------|------------|
| JWT_SECRET | JWT signing key | `openssl rand -hex 32` |
| ENCRYPTION_KEY | Data encryption key | `openssl rand -hex 16` |
| DATABASE_URL | Database connection | Secure password |

**Never commit secrets:**

```gitignore
# .gitignore
.env
.env.local
.env.production
*.pem
*.key
```

### Database Security

```sql
-- Create dedicated user with limited permissions
CREATE USER botbuilder_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE botbuilder TO botbuilder_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO botbuilder_app;

-- No DROP, TRUNCATE, or DDL permissions
```

### Redis Security

```javascript
// Enable authentication
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.NODE_ENV === 'production' ? {} : undefined
});
```

---

## Security Best Practices

### For Developers

1. **Never log sensitive data:**
```javascript
// BAD
console.log('User credentials:', { email, password });

// GOOD
console.log('Login attempt for user:', email);
```

2. **Use parameterized queries:**
```javascript
// GOOD
await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

3. **Validate all input:**
```javascript
// GOOD
if (!validator.isEmail(email)) {
  throw new Error('Invalid email');
}
```

4. **Handle errors securely:**
```javascript
// Don't expose internal errors
catch (error) {
  logger.error('Database error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
    // Don't include: error.message, error.stack
  });
}
```

### For Deployment

1. **Use HTTPS everywhere**
2. **Enable firewall rules**
3. **Keep dependencies updated**
4. **Regular security audits**
5. **Enable audit logging**
6. **Implement backup encryption**

### Audit Logging

```javascript
// middleware/audit.js
const logAuditEvent = async (req, action, details) => {
  await db.query(
    `INSERT INTO audit_logs
     (organization_id, user_id, action, resource_type, resource_id,
      old_values, new_values, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      req.organization?.id,
      req.user?.id,
      action,
      details.resourceType,
      details.resourceId,
      JSON.stringify(details.oldValues),
      JSON.stringify(details.newValues),
      req.ip,
      req.headers['user-agent']
    ]
  );
};
```

---

## Vulnerability Reporting

### Reporting Process

1. **Do NOT** disclose publicly
2. Email: security@botbuilder.com
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (optional)

### Response Timeline

| Stage | Timeframe |
|-------|-----------|
| Acknowledgment | 24 hours |
| Initial Assessment | 72 hours |
| Resolution | 14-30 days |
| Disclosure | After fix deployed |

### Security Contacts

- **Email:** security@botbuilder.com
- **PGP Key:** Available on request

---

## Compliance

### Data Privacy

- GDPR compliant data handling
- User data export capability
- Right to deletion (data purge)
- Consent management

### Security Standards

- OWASP Top 10 addressed
- SOC 2 Type II (in progress)
- ISO 27001 (planned)

### Audit Capabilities

- Complete audit trail
- Log retention (3 years)
- Access logging
- Change tracking

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets in environment variables
- [ ] HTTPS configured
- [ ] CORS restricted to specific origins
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented
- [ ] Security headers configured
- [ ] Dependencies audited (`npm audit`)

### Ongoing

- [ ] Regular dependency updates
- [ ] Security audit reviews
- [ ] Penetration testing (annual)
- [ ] Incident response plan updated
- [ ] Access reviews (quarterly)
- [ ] Backup testing (monthly)

---

## Support

For security-related questions:

- **Email:** security@botbuilder.com
- **Documentation:** This guide
- **Emergency:** Contact immediately for critical vulnerabilities
