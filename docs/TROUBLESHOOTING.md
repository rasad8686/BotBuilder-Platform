# Troubleshooting Guide

Common issues and solutions for BotBuilder platform.

---

## Table of Contents

- [Installation Issues](#installation-issues)
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)
- [Bot Issues](#bot-issues)
- [Channel Issues](#channel-issues)
- [AI/Knowledge Base Issues](#aiknowledge-base-issues)
- [Performance Issues](#performance-issues)
- [Deployment Issues](#deployment-issues)
- [Error Reference](#error-reference)

---

## Installation Issues

### Node.js Version Mismatch

**Error:**
```
error: The engine "node" is incompatible with this module
```

**Solution:**
```bash
# Check current version
node -v

# Install Node 18+ using nvm
nvm install 18
nvm use 18

# Or download from nodejs.org
```

### npm Install Fails

**Error:**
```
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# If still failing, try with legacy peer deps
npm install --legacy-peer-deps
```

### Permission Denied Errors

**Error:**
```
EACCES: permission denied
```

**Solution:**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use npm prefix
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

---

## Database Issues

### Cannot Connect to PostgreSQL

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**

1. **Check if PostgreSQL is running:**
```bash
# Linux
sudo systemctl status postgresql
sudo systemctl start postgresql

# macOS
brew services start postgresql

# Windows
net start postgresql-x64-14
```

2. **Verify connection string:**
```bash
# Test connection
psql postgresql://user:password@localhost:5432/botbuilder
```

3. **Check firewall:**
```bash
# Allow port 5432
sudo ufw allow 5432/tcp
```

### pgvector Extension Not Found

**Error:**
```
ERROR: extension "vector" is not available
```

**Solution:**
```bash
# Install pgvector
# Ubuntu/Debian
sudo apt install postgresql-14-pgvector

# macOS
brew install pgvector

# Then enable
psql -d botbuilder -c "CREATE EXTENSION vector;"
```

### Migration Fails

**Error:**
```
Error: relation "table_name" already exists
```

**Solution:**
```bash
# Check migration status
npm run migrate:status

# Rollback and retry
npm run migrate:rollback
npm run migrate

# Or reset entirely (CAUTION: data loss)
npm run migrate:reset
```

### Database Connection Pool Exhausted

**Error:**
```
Error: timeout exceeded when trying to connect
```

**Solution:**

1. **Increase pool size:**
```javascript
// db.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Increase from default 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

2. **Check for connection leaks:**
```javascript
// Always release connections
const client = await pool.connect();
try {
  // ... use client
} finally {
  client.release(); // Important!
}
```

---

## Authentication Issues

### JWT Token Invalid

**Error:**
```
{"success": false, "error": "Invalid or expired token"}
```

**Solutions:**

1. **Check token expiration:**
```javascript
// Decode token (without verification)
const jwt = require('jsonwebtoken');
const decoded = jwt.decode(token);
console.log('Expires:', new Date(decoded.exp * 1000));
```

2. **Verify JWT_SECRET matches:**
```bash
# Check .env
echo $JWT_SECRET
```

3. **Refresh token:**
```http
POST /api/auth/refresh
Cookie: refreshToken=<your-refresh-token>
```

### Login Returns 401

**Error:**
```
{"success": false, "error": "Invalid credentials"}
```

**Solutions:**

1. **Reset password:**
```http
POST /api/auth/forgot-password
{"email": "user@example.com"}
```

2. **Check if account is active:**
```sql
SELECT is_active FROM users WHERE email = 'user@example.com';
```

3. **Verify password hash:**
```javascript
const bcrypt = require('bcrypt');
const isValid = await bcrypt.compare(password, storedHash);
```

### 2FA Not Working

**Error:**
```
{"success": false, "error": "Invalid 2FA token"}
```

**Solutions:**

1. **Check time synchronization:**
```bash
# Sync system time
sudo ntpdate time.google.com
```

2. **Use backup codes if available**

3. **Reset 2FA (admin):**
```sql
UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL
WHERE email = 'user@example.com';
```

---

## Bot Issues

### Bot Not Responding

**Checklist:**

1. **Check bot is active:**
```sql
SELECT is_active FROM bots WHERE id = <bot_id>;
```

2. **Verify channel connection:**
```http
GET /api/channels/<channel_id>/status
```

3. **Check AI configuration:**
```http
GET /api/bots/<bot_id>/ai/config
```

4. **Review logs:**
```bash
pm2 logs botbuilder-api | grep "bot_id"
```

### Bot Sends Empty Responses

**Solutions:**

1. **Check system prompt:**
```http
GET /api/bots/<bot_id>/ai/config
```

2. **Verify knowledge base is linked:**
```sql
SELECT knowledge_base_id FROM ai_configurations WHERE bot_id = <bot_id>;
```

3. **Test AI directly:**
```http
POST /api/bots/<bot_id>/ai/chat
{"message": "test", "session_id": "test-123"}
```

### Flow Not Executing

**Solutions:**

1. **Check flow is published:**
```sql
SELECT is_published FROM bot_flows WHERE id = <flow_id>;
```

2. **Verify trigger conditions:**
```http
GET /api/bots/<bot_id>/flows/<flow_id>
```

3. **Check intent matching:**
```http
POST /api/nlu/classify
{"bot_id": <bot_id>, "text": "user message"}
```

---

## Channel Issues

### Telegram Webhook Not Working

**Error:**
```
Webhook was not set
```

**Solutions:**

1. **Check webhook URL:**
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

2. **Set webhook manually:**
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/api/webhooks/telegram/<bot_id>"
```

3. **Verify SSL certificate:**
```bash
openssl s_client -connect your-domain.com:443
```

### WhatsApp Messages Not Delivered

**Solutions:**

1. **Check Meta Business verification status**

2. **Verify webhook subscription:**
   - Go to Meta App Dashboard
   - WhatsApp > Configuration
   - Verify webhook URL and subscribed events

3. **Check message template approval** (for business-initiated messages)

4. **Review API response:**
```http
POST /api/channels/whatsapp/send
{"to": "1234567890", "message": "test"}
```

### Slack Bot Not Responding

**Solutions:**

1. **Re-authenticate:**
```http
GET /api/channels/slack/oauth/start?bot_id=<bot_id>
```

2. **Check bot token scopes:**
   - Go to Slack App Dashboard
   - OAuth & Permissions
   - Verify required scopes

3. **Verify Event Subscriptions:**
   - Go to Event Subscriptions
   - Check Request URL verification

---

## AI/Knowledge Base Issues

### AI Response Too Slow

**Solutions:**

1. **Reduce max_tokens:**
```http
PUT /api/bots/<bot_id>/ai/config
{"max_tokens": 500}
```

2. **Use faster model:**
```http
PUT /api/bots/<bot_id>/ai/config
{"model": "gpt-3.5-turbo"}
```

3. **Check knowledge base size:**
```sql
SELECT COUNT(*) FROM chunks WHERE document_id IN (
  SELECT id FROM documents WHERE knowledge_base_id = <kb_id>
);
```

### Knowledge Base Search Not Finding Results

**Solutions:**

1. **Lower similarity threshold:**
```http
POST /api/knowledge/<kb_id>/search
{"query": "...", "threshold": 0.5}
```

2. **Check if documents are processed:**
```sql
SELECT status, chunk_count FROM documents WHERE knowledge_base_id = <kb_id>;
```

3. **Reprocess documents:**
```http
POST /api/knowledge/<kb_id>/documents/<doc_id>/reprocess
```

### API Key Errors

**Error:**
```
Error: Invalid API key
```

**Solutions:**

1. **Verify API key in environment:**
```bash
echo $OPENAI_API_KEY
```

2. **Check usage limits** in provider dashboard

3. **Test API key directly:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## Performance Issues

### High Memory Usage

**Solutions:**

1. **Enable garbage collection logging:**
```bash
node --expose-gc --trace-gc app.js
```

2. **Check for memory leaks:**
```javascript
// Add to app.js
setInterval(() => {
  const used = process.memoryUsage();
  console.log(`Memory: ${Math.round(used.heapUsed / 1024 / 1024)} MB`);
}, 30000);
```

3. **Increase PM2 memory limit:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'botbuilder-api',
    script: 'app.js',
    max_memory_restart: '1G'
  }]
};
```

### Slow API Responses

**Solutions:**

1. **Enable query logging:**
```javascript
// db.js
pool.on('query', (query) => {
  console.log('Query:', query.text, 'Duration:', query.duration);
});
```

2. **Add indexes:**
```sql
-- Find slow queries
SELECT query, calls, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

3. **Enable Redis caching:**
```javascript
// middleware/apiCache.js
const cacheMiddleware = (duration) => async (req, res, next) => {
  const key = `cache:${req.originalUrl}`;
  const cached = await redis.get(key);
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  // ... continue
};
```

### Database Query Timeouts

**Solutions:**

1. **Increase statement timeout:**
```sql
SET statement_timeout = '30s';
```

2. **Optimize queries:**
```sql
EXPLAIN ANALYZE SELECT * FROM messages WHERE bot_id = 1;
```

3. **Add missing indexes:**
```sql
CREATE INDEX CONCURRENTLY idx_messages_bot_id ON messages(bot_id);
```

---

## Deployment Issues

### Docker Build Fails

**Error:**
```
ERROR: failed to solve: process "/bin/sh -c npm install" did not complete successfully
```

**Solutions:**

1. **Clear Docker cache:**
```bash
docker builder prune
docker build --no-cache .
```

2. **Check .dockerignore:**
```
node_modules
.env
*.log
```

### SSL Certificate Issues

**Error:**
```
SSL_ERROR_RX_RECORD_TOO_LONG
```

**Solutions:**

1. **Verify SSL setup:**
```bash
openssl s_client -connect your-domain.com:443
```

2. **Renew certificate:**
```bash
sudo certbot renew
```

3. **Check Nginx config:**
```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/domain/privkey.pem;
}
```

### Environment Variables Not Loading

**Solutions:**

1. **Check .env file location:**
```bash
ls -la .env
```

2. **Load manually:**
```javascript
require('dotenv').config({ path: '/path/to/.env' });
```

3. **Verify in production:**
```bash
# Railway
railway variables

# Vercel
vercel env pull
```

---

## Error Reference

### Common Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request body/params |
| 401 | Unauthorized | Check/refresh token |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Verify resource exists |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Wait and retry |
| 500 | Internal Server Error | Check server logs |

### Logging

**Enable debug logging:**
```bash
DEBUG=botbuilder:* npm run dev
```

**View PM2 logs:**
```bash
pm2 logs botbuilder-api --lines 100
```

**Search logs:**
```bash
pm2 logs botbuilder-api | grep "ERROR"
```

---

## Getting Help

If you can't resolve an issue:

1. **Search existing issues:** [GitHub Issues](https://github.com/your-org/BotBuilder/issues)
2. **Check discussions:** [GitHub Discussions](https://github.com/your-org/BotBuilder/discussions)
3. **Create new issue** with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)
   - Relevant logs
4. **Email support:** support@botbuilder.com
