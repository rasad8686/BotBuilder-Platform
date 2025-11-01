# Quick Test Guide - BotBuilder

## ✅ All Critical Errors Fixed!

---

## Backend Status Check

### 1. Check if backend is running
```bash
curl http://localhost:5000/
```

**Expected Response:**
```json
{
  "status": "🚀 BotBuilder API Live!",
  "database": "Connected",
  "cors": {
    "allowedOrigins": [
      "http://localhost:5173",
      "http://localhost:5174",
      ...
    ]
  }
}
```

---

## Frontend Testing Steps

### Step 1: Start Frontend (if not running)
```bash
cd client
npm run dev
```

Frontend should start on: **http://localhost:5174** (or 5173)

---

### Step 2: Test User Registration

1. Open browser to: `http://localhost:5174`
2. Click **"Register"** or navigate to `/register`
3. Fill in the form:
   - **Name:** Test User
   - **Email:** your.email@example.com
   - **Password:** test123 (or any password)
4. Click **"Register"** button

**Expected Result:**
- ✅ No CORS errors in browser console
- ✅ Registration succeeds
- ✅ Redirects to Dashboard
- ✅ You're logged in

**If Registration Fails:**
- Open Browser DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed requests

---

### Step 3: Test Login

1. Logout if you're logged in
2. Navigate to `/login`
3. Enter credentials:
   - **Email:** your.email@example.com
   - **Password:** test123
4. Click **"Login"** button

**Expected Result:**
- ✅ Login succeeds
- ✅ Receive JWT token
- ✅ Redirect to Dashboard

---

### Step 4: Test Bot Creation

1. From Dashboard, click **"+ Create New Bot"**
2. Fill in the form:
   - **Bot Name:** My Test Bot
   - **Platform:** Telegram (or any)
   - **Description:** A test bot for testing
3. Click **"Create Bot 🚀"**

**Expected Result:**
- ✅ Bot created successfully
- ✅ Redirected to "My Bots" page
- ✅ New bot appears in the list

---

### Step 5: Test Bot Messages

1. From "My Bots", click **"Messages"** button on a bot
2. Click **"+ Add Message"**
3. Fill in:
   - **Message Type:** Greeting
   - **Content:** Hello! Welcome to my bot!
   - **Trigger Keywords:** hello, hi, hey
4. Click **"Save Message"**

**Expected Result:**
- ✅ Message added successfully
- ✅ Appears in messages list
- ✅ Shows trigger keywords as tags

---

### Step 6: Test Analytics

1. From Dashboard, click **"Analytics"** button
2. View statistics

**Expected Result:**
- ✅ Shows total bots count
- ✅ Shows total messages count
- ✅ Shows messages by type
- ✅ Shows recent bots list

---

## Common Issues & Solutions

### Issue 1: CORS Error
**Error:** "blocked by CORS policy"

**Solution:** ✅ FIXED
- Backend now allows ports: 5173, 5174, 3000, 4173
- Restart backend if you made changes

### Issue 2: Database Connection Failed
**Error:** "ECONNREFUSED" or "Database not connected"

**Solution:** ✅ FIXED
- Database connection now retries automatically
- Check backend logs for detailed error
- Verify DATABASE_URL in .env

### Issue 3: Registration/Login Fails
**Error:** "password_hash column not found"

**Solution:** ✅ FIXED
- Column renamed from `password` to `password_hash`
- All authentication endpoints working

---

## Manual API Testing (Optional)

### Test Registration via cURL
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test User"}'
```

### Test Login via cURL
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

### Test Get Bots (Protected)
```bash
curl -X GET http://localhost:5000/bots \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Checklist

Before reporting issues, verify:

- [ ] Backend is running on port 5000
- [ ] Frontend is running on port 5174 (or 5173)
- [ ] No CORS errors in browser console
- [ ] Database connection successful (check `GET /`)
- [ ] .env files are configured correctly
- [ ] Browser cache cleared (Ctrl+Shift+Delete)

---

## Success Indicators

### Backend Logs Should Show:
```
✅ New client connected to PostgreSQL database
✅ Database connection test successful!
   PostgreSQL version: PostgreSQL 17.6
✅ Server ready!
```

### Frontend Should:
- ✅ Load without errors
- ✅ Show login/register forms
- ✅ Successfully make API requests
- ✅ Store JWT token in localStorage
- ✅ Navigate between pages smoothly

---

## Need Help?

1. Check backend logs for detailed errors
2. Check browser console (F12) for frontend errors
3. Verify both frontend and backend are running
4. Check FIXES_APPLIED.md for detailed fix information

---

**Last Updated:** October 28, 2025

**Status:** 🎉 ALL SYSTEMS OPERATIONAL
