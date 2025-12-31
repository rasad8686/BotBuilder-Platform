# Production Deployment Guide

Complete guide for deploying BotBuilder to production environments.

---

## Table of Contents

- [Deployment Options](#deployment-options)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Docker Deployment](#docker-deployment)
- [Railway Deployment](#railway-deployment)
- [Vercel Deployment (Frontend)](#vercel-deployment-frontend)
- [Manual Server Deployment](#manual-server-deployment)
- [Database Setup](#database-setup)
- [Environment Configuration](#environment-configuration)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Monitoring & Logging](#monitoring--logging)
- [Scaling](#scaling)
- [Backup & Recovery](#backup--recovery)
- [CI/CD Pipeline](#cicd-pipeline)

---

## Deployment Options

| Option | Best For | Complexity | Cost |
|--------|----------|------------|------|
| Railway | Quick deployment, startups | Low | $5-50/month |
| Docker + VPS | Full control, custom setups | Medium | $10-100/month |
| Vercel + Railway | Separated frontend/backend | Low | $0-50/month |
| AWS/GCP/Azure | Enterprise, high scale | High | Variable |
| Kubernetes | Large scale, microservices | High | Variable |

---

## Pre-Deployment Checklist

### Security

- [ ] Generate strong JWT_SECRET (64+ characters)
- [ ] Generate strong ENCRYPTION_KEY (32 characters)
- [ ] Configure CORS for your domain only
- [ ] Enable HTTPS/SSL
- [ ] Set NODE_ENV=production
- [ ] Remove debug logging
- [ ] Audit npm dependencies (`npm audit`)

### Database

- [ ] Use production PostgreSQL instance
- [ ] Enable SSL for database connection
- [ ] Configure connection pooling
- [ ] Set up automated backups
- [ ] Test migrations on staging first

### Configuration

- [ ] Set all required environment variables
- [ ] Configure rate limiting
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure logging service
- [ ] Test email delivery

---

## Docker Deployment

### 1. Docker Compose (Recommended)

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  server:
    build:
      context: ./server
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - REDIS_URL=redis://redis:6379
    ports:
      - "5000:5000"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  client:
    build:
      context: ./client
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - server
    restart: unless-stopped

  postgres:
    image: pgvector/pgvector:pg15
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=botbuilder
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 2. Server Dockerfile

Create `server/Dockerfile.prod`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "app.js"]
```

### 3. Client Dockerfile

Create `client/Dockerfile.prod`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
```

### 4. Nginx Configuration

Create `client/nginx.conf`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://server:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://server:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

### 5. Deploy

```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale server=3
```

---

## Railway Deployment

### 1. Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### 2. Deploy Backend

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd server
railway init

# Add PostgreSQL
railway add --plugin postgresql

# Add Redis
railway add --plugin redis

# Set environment variables
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your-secret
railway variables set ENCRYPTION_KEY=your-key

# Deploy
railway up
```

### 3. Deploy Frontend to Vercel

See [Vercel Deployment](#vercel-deployment-frontend) section.

### 4. Configure Domain

1. Go to Railway dashboard
2. Select your service
3. Go to Settings > Domains
4. Add custom domain

---

## Vercel Deployment (Frontend)

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Configure for React/Vite

Create `client/vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

### 3. Set Environment Variables

Create `.env.production`:

```env
VITE_API_URL=https://api.your-domain.com
```

### 4. Deploy

```bash
cd client
vercel --prod
```

---

## Manual Server Deployment

### 1. Provision Server

Recommended specs:
- 2+ CPU cores
- 4+ GB RAM
- 40+ GB SSD
- Ubuntu 22.04 LTS

### 2. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx
```

### 3. Configure PostgreSQL

```bash
sudo -u postgres psql

CREATE USER botbuilder WITH PASSWORD 'secure_password';
CREATE DATABASE botbuilder OWNER botbuilder;
\c botbuilder
CREATE EXTENSION vector;
\q
```

### 4. Deploy Application

```bash
# Clone repository
git clone https://github.com/your-org/BotBuilder.git
cd BotBuilder/server

# Install dependencies
npm ci --only=production

# Create .env file
cp .env.example .env
nano .env  # Edit with production values

# Run migrations
npm run migrate

# Start with PM2
pm2 start app.js --name botbuilder-api
pm2 save
pm2 startup
```

### 5. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/botbuilder
```

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/botbuilder /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Setup SSL

```bash
sudo certbot --nginx -d api.your-domain.com
```

---

## Database Setup

### Production PostgreSQL

#### Option 1: Railway PostgreSQL

Automatically provisioned with `railway add --plugin postgresql`

#### Option 2: Supabase

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Get connection string from Settings > Database
4. Enable pgvector extension in SQL editor

#### Option 3: AWS RDS

```bash
# Create RDS instance with PostgreSQL 15
# Enable pgvector extension
aws rds-data execute-statement \
  --resource-arn $RDS_ARN \
  --secret-arn $SECRET_ARN \
  --sql "CREATE EXTENSION vector"
```

### Connection Pooling

For high traffic, use PgBouncer:

```ini
# pgbouncer.ini
[databases]
botbuilder = host=localhost dbname=botbuilder

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

---

## Environment Configuration

### Production Environment Variables

```env
# Server
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-domain.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/botbuilder?sslmode=require

# Security (REQUIRED - use strong, unique values)
JWT_SECRET=<64-char-random-string>
ENCRYPTION_KEY=<32-char-random-string>

# Redis
REDIS_URL=redis://user:pass@host:6379

# AI Providers
OPENAI_API_KEY=sk-prod-...
ANTHROPIC_API_KEY=sk-ant-prod-...

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx

# Stripe (if using billing)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## SSL/TLS Configuration

### Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com -d api.your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Cloudflare (Recommended)

1. Add domain to Cloudflare
2. Update nameservers
3. Enable Full (strict) SSL mode
4. Enable Always Use HTTPS

---

## Monitoring & Logging

### PM2 Monitoring

```bash
# View logs
pm2 logs botbuilder-api

# Monitor
pm2 monit

# Dashboard
pm2 plus
```

### Sentry Integration

```javascript
// In app.js
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### Log Management

```bash
# Configure logrotate
sudo nano /etc/logrotate.d/botbuilder
```

```
/var/log/botbuilder/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## Scaling

### Horizontal Scaling

```bash
# PM2 cluster mode
pm2 start app.js -i max --name botbuilder-api

# Or specific number
pm2 start app.js -i 4 --name botbuilder-api
```

### Load Balancing

```nginx
upstream botbuilder {
    least_conn;
    server 127.0.0.1:5000;
    server 127.0.0.1:5001;
    server 127.0.0.1:5002;
    server 127.0.0.1:5003;
}

server {
    location / {
        proxy_pass http://botbuilder;
    }
}
```

### Database Read Replicas

```javascript
// db.js with read replicas
const { Pool } = require('pg');

const writePool = new Pool({ connectionString: process.env.DATABASE_URL });
const readPool = new Pool({ connectionString: process.env.DATABASE_READ_URL });
```

---

## Backup & Recovery

### Database Backup

```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR=/backups
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/botbuilder_$DATE.sql.gz

# Keep last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete
```

### Cron Schedule

```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup.sh
```

### Recovery

```bash
# Restore from backup
gunzip -c backup.sql.gz | psql $DATABASE_URL
```

---

## CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd server && npm ci
      - run: cd server && npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: botbuilder-api

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          working-directory: ./client
```

---

## Deployment Checklist

### Before Deployment

- [ ] All tests pass
- [ ] No security vulnerabilities (`npm audit`)
- [ ] Environment variables configured
- [ ] Database migrations tested on staging
- [ ] SSL certificates ready
- [ ] Monitoring configured
- [ ] Backup strategy in place

### After Deployment

- [ ] Verify application health
- [ ] Check logs for errors
- [ ] Test critical user flows
- [ ] Monitor performance metrics
- [ ] Verify SSL is working
- [ ] Test email delivery
- [ ] Verify AI features work

---

## Support

- **Issues:** GitHub Issues
- **Documentation:** [docs/](.)
- **Email:** devops@botbuilder.com
