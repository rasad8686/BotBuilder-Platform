# ⚡ QUICK FIX - Render Dashboard Root Directory

## 🎯 THE PROBLEM
Render Dashboard has "Root Directory" set to `client/server` which overrides everything.

## ✅ THE FIX (2 Minutes)

### **Step 1: Open Render Dashboard**
https://dashboard.render.com

### **Step 2: Click Your Backend Service**
Find: "botbuilder-backend" or "BotBuilder-Platform"

### **Step 3: Go to Settings**
Click "Settings" in left sidebar

### **Step 4: Find "Build & Deploy" Section**
Scroll down to find these fields

### **Step 5: Fix Root Directory**
**Current (WRONG):**
```
Root Directory: client/server
```

**Change to (CORRECT):**
```
Root Directory: [empty field]
```
or
```
Root Directory: .
```

### **Step 6: Verify Build Command**
```
Build Command: npm install
```

### **Step 7: Verify Start Command**
```
Start Command: node server.js
```

### **Step 8: Save Changes**
Click "Save Changes" button

### **Step 9: Manual Deploy**
1. Scroll to "Manual Deploy" section
2. Click "Deploy latest commit"
3. Wait 2-3 minutes

## ✅ Expected Result

**Build Logs Should Show:**
```
✅ Using root directory: /opt/render/project/src/
✅ Found package.json
✅ Running npm install
✅ Starting node server.js
✅ Database connection test successful!
```

**Should NOT Show:**
```
❌ /opt/render/project/src/client/server: No such file or directory
```

---

## 🚨 If Settings Are Locked/Stuck

**Option 1: Try Different Browser**
- Clear cache and try again

**Option 2: Delete & Recreate Service**
1. Create NEW web service
2. Connect to same GitHub repo
3. **IMPORTANT:** Leave "Root Directory" EMPTY
4. Set Build: `npm install`
5. Set Start: `node server.js`
6. Copy environment variables from old service
7. Delete old service

---

## 📋 Checklist

- [ ] Logged into Render Dashboard
- [ ] Found backend service
- [ ] Opened Settings
- [ ] Located "Root Directory" field
- [ ] Cleared/Deleted the value (or set to `.`)
- [ ] Verified Build Command: `npm install`
- [ ] Verified Start Command: `node server.js`
- [ ] Clicked "Save Changes"
- [ ] Triggered "Deploy latest commit"
- [ ] Checked logs for success

---

**This ONE setting is blocking everything!**

All our code fixes are perfect - they just need the Dashboard setting fixed to deploy! 🚀
