# Complete Render.com Deployment Guide

## 🎯 Deployment Status: READY FOR DEPLOYMENT

All critical issues have been fixed. The project is 100% ready for Render deployment.

---

## ✅ What Was Fixed

### 1. CORS Configuration - FULLY FIXED
- **Before:** Only allowed specific ports (5173, 5174, etc.)
- **After:** Allows ALL localhost ports in development (5175, 5176, any port!)
- **Production:** Only allows specific Vercel/Render domains
- **Status:** ✅ WORKING

### 2. Database Connection - FULLY STABLE
- **Added:** Automatic retry mechanism (3 attempts)
- **Added:** Detailed error logging
- **Added:** Connection pool optimization
- **Status:** ✅ WORKING

### 3. Authentication - FULLY FIXED
- **Fixed:** Column name from `password` to `password_hash`
- **Tested:** Registration, Login, JWT tokens
- **Status:** ✅ WORKING

---

## 📋 Pre-Deployment Checklist

### Backend Files Required:
- [x] `server.js` - Main Express server
- [x] `db.js` - PostgreSQL connection
- [x] `package.json` - Dependencies
- [x] `.gitignore` - Git exclusions
- [x] `render.yaml` - Render configuration
- [x] `routes/` - All API routes
- [x] `middleware/` - Authentication middleware
- [x] `migrations/` - Database migrations

### Environment Variables Needed:
- [x] `DATABASE_URL` - PostgreSQL connection string
- [x] `JWT_SECRET` - Secret key for JWT
- [x] `NODE_ENV` - Should be "production"
- [x] `PORT` - Usually 5000 (Render sets automatically)

---

## 🚀 Deployment Steps

### Step 1: Prepare Git Repository

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Fix: CORS configuration, database connection, authentication"

# Create GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/botbuilder.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Render

#### Option A: Using Dashboard (Recommended)

1. **Go to:** https://render.com/
2. **Click:** "New +"
3. **Select:** "Web Service"
4. **Connect:** Your GitHub repository
5. **Configure:**
   - **Name:** `botbuilder-backend`
   - **Region:** Frankfurt (or closest to you)
   - **Branch:** `main`
   - **Root Directory:** `.` (leave empty if root)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free

6. **Add Environment Variables:**
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = `your-secure-random-string-here-change-this`
   - `DATABASE_URL` = (Copy from Render PostgreSQL service)

   **STRIPE CONFIGURATION (REQUIRED for billing):**
   - `STRIPE_SECRET_KEY` = `sk_test_...` (from https://dashboard.stripe.com/test/apikeys)
   - `STRIPE_PUBLISHABLE_KEY` = `pk_test_...` (from https://dashboard.stripe.com/test/apikeys)
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...` (from Stripe webhook settings)
   - `STRIPE_PRO_PRICE_ID` = `price_...` (from https://dashboard.stripe.com/test/products - Pro Plan)
   - `STRIPE_ENTERPRISE_PRICE_ID` = `price_...` (from https://dashboard.stripe.com/test/products - Enterprise Plan)

   ⚠️ **CRITICAL**: Without Stripe Price IDs, billing will fail with "Price ID not configured" error!

7. **Click:** "Create Web Service"

#### Option B: Using render.yaml (Auto-Deploy)

1. Make sure `render.yaml` is in root directory
2. Connect your repo to Render
3. Render will automatically detect and use render.yaml
4. Configure environment variables in dashboard

---

### Step 3: Create PostgreSQL Database

1. **In Render Dashboard:**
2. **Click:** "New +"
3. **Select:** "PostgreSQL"
4. **Configure:**
   - **Name:** `botbuilder-db`
   - **Database:** `botbuilder`
   - **User:** `botbuilder_user`
   - **Region:** Frankfurt (same as backend)
   - **Plan:** Free

5. **Get Connection String:**
   - Go to database dashboard
   - Copy "External Database URL"
   - Paste it as `DATABASE_URL` in backend service

---

### Step 4: Run Migrations

After deployment, you need to run migrations:

#### Method 1: Using Render Shell

1. Go to your backend service dashboard
2. Click "Shell" tab
3. Run:
```bash
node runMigrations.js
```

#### Method 2: Manual SQL

1. Go to database dashboard
2. Click "Connect"
3. Use external connection
4. Run SQL from `migrations/001_initial_schema.sql`

---

## 🔍 Verify Deployment

### 1. Check Backend Health

```bash
curl https://your-app.onrender.com/
```

**Expected Response:**
```json
{
  "status": "🚀 BotBuilder API Live!",
  "database": "Connected",
  "environment": "production"
}
```

### 2. Test Registration

```bash
curl -X POST https://your-app.onrender.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test"}'
```

### 3. Test Login

```bash
curl -X POST https://your-app.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

---

## 🎨 Frontend Deployment (Vercel)

### Step 1: Update Frontend .env

```env
VITE_API_BASE_URL=https://your-app.onrender.com
```

### Step 2: Deploy to Vercel

```bash
cd client

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow prompts
```

Or use Vercel Dashboard:
1. Go to vercel.com
2. Import project from GitHub
3. Select `client` folder
4. Add environment variable: `VITE_API_BASE_URL`
5. Deploy

---

## 🐛 Troubleshooting

### Issue 1: CORS Errors in Production

**Symptom:** Frontend can't connect to backend

**Solution:**
1. Check backend logs
2. Verify frontend URL is in CORS whitelist
3. Update server.js if needed:
```javascript
'https://your-frontend.vercel.app'
```

### Issue 2: Database Connection Failed

**Symptom:** "Database not connected" error

**Solutions:**
1. Check DATABASE_URL is set correctly
2. Verify database service is running
3. Check if SSL is enabled:
```javascript
ssl: { rejectUnauthorized: false }
```

### Issue 3: 503 Service Unavailable

**Symptom:** Backend returns 503

**Solutions:**
1. Check backend logs in Render dashboard
2. Verify all environment variables are set
3. Check if database is accessible
4. Restart service

### Issue 4: Routes Return 404

**Symptom:** API endpoints not found

**Solutions:**
1. Check Start Command is `node server.js`
2. Verify routes are properly imported
3. Check base path in frontend API calls

---

## 📊 Post-Deployment Monitoring

### Check Logs

1. Go to Render Dashboard
2. Select your service
3. Click "Logs" tab
4. Monitor for errors

### Common Log Messages

**Success:**
```
✅ Database connection test successful!
✅ Server ready!
```

**Warning:**
```
⚠️ Database connection retry
```

**Error:**
```
❌ Database connection failed
❌ Authentication failed
```

---

## 🔐 Security Checklist

- [ ] Change `JWT_SECRET` to strong random string
- [ ] Use environment variables (never hardcode secrets)
- [ ] Enable SSL in production
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS origins
- [ ] Use secure password hashing (bcrypt)
- [ ] Validate all user inputs
- [ ] Rate limit API endpoints (optional)

---

## 💡 Performance Tips

1. **Database Connection Pool:**
   - Already configured in `db.js`
   - Max 20 connections
   - 10s timeout

2. **Enable Caching:**
   - Use Redis for session storage (optional)
   - Cache static responses

3. **Monitoring:**
   - Use Render metrics
   - Set up alerts for errors

---

## 📞 Support Resources

- **Render Documentation:** https://render.com/docs
- **Node.js Guide:** https://render.com/docs/deploy-node-express-app
- **PostgreSQL Guide:** https://render.com/docs/databases

---

## ✅ Final Checklist

Before going live:

- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Test registration endpoint
- [ ] Test login endpoint
- [ ] Test protected endpoints
- [ ] Verify CORS works with frontend
- [ ] Check logs for errors
- [ ] Test from different devices
- [ ] Verify SSL certificate works
- [ ] Document API endpoints

---

## 🎉 Success!

If all tests pass, your BotBuilder backend is:
- ✅ Deployed on Render
- ✅ Connected to PostgreSQL
- ✅ CORS configured correctly
- ✅ Authentication working
- ✅ All endpoints functional

**Your API is now live at:** `https://your-app.onrender.com`

---

**Last Updated:** October 28, 2025

**Deployment Status:** 🟢 READY FOR PRODUCTION
