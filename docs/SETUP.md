# Development Setup Guide

Complete guide for setting up the BotBuilder development environment.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [System Requirements](#system-requirements)
- [Installation Steps](#installation-steps)
- [Database Setup](#database-setup)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Development Tools](#development-tools)
- [IDE Configuration](#ide-configuration)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x or higher | JavaScript runtime |
| npm | 9.x or higher | Package manager |
| PostgreSQL | 14 or higher | Primary database |
| Git | 2.x | Version control |

### Optional Software

| Software | Version | Purpose |
|----------|---------|---------|
| Redis | 6.x | Caching & rate limiting |
| Docker | 20.x | Containerization |
| VS Code | Latest | Recommended IDE |

---

## System Requirements

### Minimum Requirements

- **CPU:** 2 cores
- **RAM:** 4 GB
- **Storage:** 10 GB free space
- **OS:** Windows 10+, macOS 10.15+, Ubuntu 20.04+

### Recommended Requirements

- **CPU:** 4+ cores
- **RAM:** 8+ GB
- **Storage:** 20+ GB SSD
- **OS:** Latest stable version

---

## Installation Steps

### 1. Clone Repository

```bash
git clone https://github.com/your-org/BotBuilder.git
cd BotBuilder
```

### 2. Install Node.js (if not installed)

**Windows (using Chocolatey):**
```powershell
choco install nodejs-lts
```

**macOS (using Homebrew):**
```bash
brew install node@18
```

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Install PostgreSQL

**Windows:**
```powershell
# Download from https://www.postgresql.org/download/windows/
# Or use Chocolatey:
choco install postgresql
```

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 4. Install Redis (Optional)

**Windows:**
```powershell
# Use WSL2 or Docker for Redis
docker run -d -p 6379:6379 redis:alpine
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

### 5. Install Server Dependencies

```bash
cd server
npm install
```

### 6. Install Client Dependencies

```bash
cd ../client
npm install
```

---

## Database Setup

### 1. Create Database User

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create user and database
CREATE USER botbuilder WITH PASSWORD 'your_password';
CREATE DATABASE botbuilder OWNER botbuilder;
GRANT ALL PRIVILEGES ON DATABASE botbuilder TO botbuilder;

# Exit
\q
```

### 2. Install pgvector Extension

pgvector is required for the Knowledge Base RAG features.

```bash
# Connect to the database
psql -U botbuilder -d botbuilder

# Install extension
CREATE EXTENSION IF NOT EXISTS vector;

# Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';

# Exit
\q
```

**Note:** If pgvector is not available, you may need to install it first:

```bash
# Ubuntu/Debian
sudo apt install postgresql-14-pgvector

# macOS (Homebrew)
brew install pgvector

# From source
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

### 3. Run Migrations

```bash
cd server
npm run migrate
```

### 4. (Optional) Seed Database

```bash
npm run seed
```

---

## Environment Configuration

### 1. Create Environment File

```bash
cd server
cp .env.example .env
```

### 2. Configure Required Variables

Edit `.env` with your settings:

```env
# ========================================
# REQUIRED CONFIGURATION
# ========================================

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database (update with your credentials)
DATABASE_URL=postgresql://botbuilder:your_password@localhost:5432/botbuilder

# JWT Secret (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=<generated-64-char-secret>

# Encryption Key (generate with: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
ENCRYPTION_KEY=<generated-32-char-key>

# ========================================
# OPTIONAL CONFIGURATION
# ========================================

# Redis (if installed)
REDIS_URL=redis://localhost:6379

# AI Providers (for AI features)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Email (for email features)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-pass
```

### 3. Generate Secrets

```bash
# Generate JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Encryption Key
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

### Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000/api |
| Swagger UI | http://localhost:5000/api-docs |
| API JSON | http://localhost:5000/api-docs.json |

### Using Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## Development Tools

### Running Tests

**Backend Tests:**
```bash
cd server
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

**Frontend Tests:**
```bash
cd client
npm test                    # Unit tests
npm run cypress:open        # E2E tests (interactive)
npm run cypress:run         # E2E tests (headless)
```

### Linting

```bash
# Server
cd server
npm run lint
npm run lint:fix

# Client
cd client
npm run lint
npm run lint:fix
```

### Database Operations

```bash
cd server

# Create new migration
npm run migrate:create -- migration_name

# Run migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback

# Reset database
npm run migrate:reset
```

---

## IDE Configuration

### VS Code (Recommended)

#### Recommended Extensions

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "formulahendry.auto-rename-tag",
    "dsznajder.es7-react-js-snippets",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "Prisma.prisma",
    "ckolkman.vscode-postgres"
  ]
}
```

#### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": ["./server", "./client"],
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

#### Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Server",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/server",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test", "--", "--runInBand"],
      "cwd": "${workspaceFolder}/server",
      "console": "integratedTerminal"
    }
  ]
}
```

### WebStorm/IntelliJ

1. Open project folder
2. Mark `server` and `client` as separate modules
3. Configure ESLint for both directories
4. Enable Prettier integration
5. Configure Node.js interpreter

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Verify user credentials

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Start if not running
sudo systemctl start postgresql
```

#### 2. pgvector Extension Error

```
Error: extension "vector" is not available
```

**Solution:**
- Install pgvector extension for your PostgreSQL version
- Ensure you're connecting to the correct database

#### 3. Node.js Version Mismatch

```
Error: The engine "node" is incompatible with this module
```

**Solution:**
- Install Node.js 18 or higher
- Use nvm to manage Node versions

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node 18
nvm install 18
nvm use 18
```

#### 4. Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
- Find and kill the process using the port
- Or change PORT in .env

```bash
# Find process on port 5000
lsof -i :5000

# Kill process
kill -9 <PID>
```

#### 5. Redis Connection Error

```
Error: Redis connection to localhost:6379 failed
```

**Solution:**
- Start Redis or remove REDIS_URL from .env
- Application works without Redis (with reduced caching)

#### 6. Module Not Found

```
Error: Cannot find module 'xyz'
```

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Getting Help

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more solutions
2. Search existing GitHub issues
3. Create a new issue with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)

---

## Next Steps

After setup is complete:

1. Read the [API Documentation](API.md)
2. Understand the [Architecture](ARCHITECTURE.md)
3. Review the [Database Schema](DATABASE.md)
4. Check the [Security Guide](SECURITY.md)

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm test` | Run tests |
| `npm run lint` | Check code style |
| `npm run migrate` | Run database migrations |
| `npm run build` | Build for production |
