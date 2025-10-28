# Registration Debugging Guide

## 🎯 Overview
Comprehensive debugging has been added to the registration endpoint to identify why user registration is failing in production.

## 📋 What Was Added

### **Complete Step-by-Step Logging**
The registration flow now logs every single step with detailed information:

#### **Initial Request Logging**
- ✅ Full request body (JSON formatted)
- ✅ Request headers
- ✅ Timestamp and session markers

#### **Step 1: Database Connection Check**
- ✅ Verifies database pool exists
- ✅ Immediate failure if no connection
- ✅ Clear error message if DB unavailable

#### **Step 2: Field Extraction**
- ✅ Logs each field (email, password, name)
- ✅ Shows field types
- ✅ Shows which fields are present/missing

#### **Step 3: Required Field Validation**
- ✅ Validates email and password exist
- ✅ Validates name exists and is not empty
- ✅ Detailed logging of validation results

#### **Step 4: Email Format Validation**
- ✅ Tests email against regex pattern
- ✅ Logs the email value being tested
- ✅ Fails fast with clear error

#### **Step 5: Password Strength Validation**
- ✅ Checks minimum length (6 characters)
- ✅ Logs password length (not value for security)

#### **Step 6: Normalization**
- ✅ Logs email before/after toLowerCase().trim()
- ✅ Logs name before/after trim()

#### **Step 6.5: DATABASE SCHEMA VERIFICATION** ⭐ NEW
- ✅ Queries information_schema to get actual table columns
- ✅ Lists all columns in users table
- ✅ Checks for `password_hash` column (required)
- ✅ Checks for `password` column (should NOT exist)
- ✅ Fails registration if schema is wrong
- ✅ **This will catch mock server schema conflicts!**

#### **Step 7: Existing User Check**
- ✅ Logs the exact SQL query
- ✅ Logs query parameters
- ✅ Logs number of rows returned
- ✅ Shows existing user ID if found

#### **Step 8: Password Hashing**
- ✅ Logs bcrypt rounds (10)
- ✅ Measures hash generation time (ms)
- ✅ Validates hash length
- ✅ Dedicated try-catch for hash errors
- ✅ Full error logging if hash fails

#### **Step 9: Database INSERT** ⭐ CRITICAL
- ✅ Logs exact SQL query (sanitized)
- ✅ Logs all parameters with types/lengths
- ✅ Dedicated try-catch for INSERT operation
- ✅ Logs PostgreSQL error codes
- ✅ Logs error details, hints, constraints
- ✅ Full stack trace on failure
- ✅ **This is where most issues are caught!**

#### **Step 10: User Creation Verification**
- ✅ Logs returned user object
- ✅ Shows user ID, email, name, created_at

#### **Step 11: JWT Token Generation**
- ✅ Checks JWT_SECRET exists and length
- ✅ Logs user data being signed
- ✅ Dedicated try-catch for JWT errors
- ✅ Validates token was created

#### **Step 12: Welcome Email**
- ✅ Logs email service availability
- ✅ Non-blocking (won't fail registration)
- ✅ Separate error logging

#### **Step 13: Success Response**
- ✅ Logs response preparation
- ✅ Shows final response structure
- ✅ Success banner with user details

### **Enhanced Error Handling**
The outer catch block now includes:
- ✅ Detailed error name, message, code
- ✅ PostgreSQL-specific error details
- ✅ Full error object (JSON stringified)
- ✅ Complete stack trace
- ✅ Specific handling for:
  - `23505` - Duplicate email (unique violation)
  - `42703` - Missing column (schema mismatch)
  - `ECONNREFUSED` - Database connection failed
  - `ENOTFOUND` - Database host not found

## 🔍 How to Use This Debugging

### **1. Deploy the Changes**
```bash
# Commit and push to trigger deployment
git add routes/auth.js
git commit -m "Add extensive debugging to registration endpoint"
git push
```

### **2. Wait for Deployment**
- Go to Render dashboard
- Wait for deployment to complete
- Check deploy logs for any errors

### **3. Test Registration**
Try to register a new user:
```bash
# Example test
curl -X POST https://your-api.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"debug@test.com","password":"test123","name":"Debug User"}'
```

### **4. Check Server Logs**
In Render dashboard, go to **Logs** tab and look for:

**Success Pattern:**
```
========================================
📝 REGISTRATION REQUEST RECEIVED
========================================
🔍 Step 1: Checking database connection...
✅ Database pool exists
🔍 Step 2: Extracted fields from body:
...
✅ REGISTRATION SUCCESSFUL
========================================
```

**Failure Pattern:**
Look for the **FIRST ❌** or **LAST ✅** to identify where it fails:
```
✅ Step 7: User does not exist
🔍 Step 8: Hashing password...
✅ Password hashed successfully
🔍 Step 9: Inserting user into database...
❌ Database INSERT failed: <--- FAILURE POINT!
   - Error code: XXXXX
   - Error message: <exact error>
```

## 🎯 What to Look For

### **Schema Mismatch (Most Likely)**
```
🔍 Step 6.5: Verifying database schema...
   - Has 'password_hash' column: ❌ NO
   OR
   - Has 'password' column: ⚠️  YES (BAD!)
```
**Solution:** Database still has old schema. Run migrations.

### **Database Permission Error**
```
❌ Database INSERT failed
   - Error code: 42501
   - Error message: permission denied for table users
```
**Solution:** Database user needs INSERT permission.

### **Hash Generation Failure**
```
🔍 Step 8: Hashing password...
❌ Password hashing error
```
**Solution:** bcrypt issue, check Node.js version.

### **Connection Issues**
```
🔍 Step 1: Checking database connection...
❌ Database pool is null!
```
**Solution:** DATABASE_URL not set or database not connected.

## 📊 Log Levels

- `📝` Initial request
- `🔍` Step start
- `✅` Success/validation passed
- `❌` Error/failure
- `⚠️` Warning (non-critical)
- `📋` Data/details

## 🚀 Next Steps

1. **Deploy** these changes to Render
2. **Test** registration with a new email
3. **Capture** the full log output from Render
4. **Share** the logs to identify exact failure point
5. **Fix** based on what the logs reveal

## 📌 Important Notes

- All sensitive data (passwords, hashes) are sanitized in logs
- Only password **length** is logged, never the actual password
- Database queries show parameters separately for security
- Email service failures won't block registration
- Each step is atomic and clearly marked

## 🔧 If Registration Still Fails

Share the complete log output starting from:
```
========================================
📝 REGISTRATION REQUEST RECEIVED
========================================
```

And ending with either:
```
✅ REGISTRATION SUCCESSFUL
```
or
```
❌ REGISTRATION FAILED - OUTER CATCH
```

This will show **EXACTLY** where and why registration is failing.
