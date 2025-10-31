# BotBuilder API Testing Guide

## Overview
Comprehensive API endpoint testing for BotBuilder RBAC Multi-Tenant System.

**Base URL**: `http://localhost:5000` (Development)
**Production URL**: `https://botbuilder-platform.onrender.com`

---

## Authentication Flow

### 1. Register New User

**Endpoint**: `POST /auth/register`

**Request**:
```json
{
  "username": "TestUser",
  "email": "testuser@example.com",
  "password": "Test123!"
}
```

**Expected Response** (201 Created):
```json
{
  "success": true,
  "message": "User registered successfully!",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 123,
    "username": "TestUser",
    "email": "testuser@example.com",
    "isVerified": false,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "currentOrganizationId": 456
  }
}
```

**Backend Console Should Show**:
```
========== NEW REGISTRATION ATTEMPT ==========
[REGISTER] Step 1: Checking if email exists...
[REGISTER] ✓ Email is available
[REGISTER] Step 2: Hashing password...
[REGISTER] ✓ Password hashed
[REGISTER] Step 3: Creating user in database...
[REGISTER] ✓ User created successfully!
[REGISTER] Step 4: Creating organization...
[REGISTER] ✓ Organization created successfully!
[REGISTER] Step 5: Adding user to organization as admin...
[REGISTER] ✓ User added to organization successfully!
[REGISTER] Step 6: Generating JWT token...
[REGISTER] ✓ JWT token generated
[REGISTER] Step 7: Final verification...
[REGISTER] ✓✓✓ FINAL VERIFICATION PASSED ✓✓✓
========== REGISTRATION SUCCESS ==========
```

**Error Scenarios**:

```json
// Missing fields (400)
{
  "message": "All fields required",
  "required": ["username", "email", "password"]
}

// Invalid email (400)
{
  "message": "Invalid email format"
}

// Password too short (400)
{
  "message": "Password must be at least 6 characters"
}

// Email already exists (400)
{
  "success": false,
  "message": "Email already registered"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "TestUser",
    "email": "testuser@example.com",
    "password": "Test123!"
  }'
```

---

### 2. Login User

**Endpoint**: `POST /auth/login`

**Request**:
```json
{
  "email": "testuser@example.com",
  "password": "Test123!"
}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Login successful!",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 123,
    "username": "TestUser",
    "email": "testuser@example.com",
    "currentOrganizationId": 456
  }
}
```

**Error Scenarios**:
```json
// Invalid credentials (401)
{
  "success": false,
  "message": "Invalid email or password"
}

// Missing fields (400)
{
  "message": "Email and password required"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "testuser@example.com",
    "password": "Test123!"
  }'
```

---

## Organization Endpoints

### 3. Get User's Organizations

**Endpoint**: `GET /api/organizations`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "organizations": [
    {
      "id": 456,
      "name": "TestUser's Organization",
      "slug": "testuser-123",
      "owner_id": 123,
      "plan_tier": "free",
      "settings": {},
      "created_at": "2025-01-15T10:30:00.000Z",
      "updated_at": "2025-01-15T10:30:00.000Z",
      "role": "admin",
      "joined_at": "2025-01-15T10:30:00.000Z",
      "status": "active",
      "member_count": 1,
      "bot_count": 0
    }
  ]
}
```

**Backend Console Should Show**:
```
[Organizations] Fetched 1 organizations for user 123
[Organizations] Organizations: [{ id: 456, name: "TestUser's Organization", role: "admin" }]
```

**Error Scenarios**:
```json
// No token (401)
{
  "success": false,
  "message": "Authentication required"
}

// Invalid token (401)
{
  "success": false,
  "message": "Invalid token"
}
```

**cURL Example**:
```bash
curl -X GET http://localhost:5000/api/organizations \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

---

### 4. Get Organization Details

**Endpoint**: `GET /api/organizations/:id`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
X-Organization-ID: 456
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 456,
    "name": "TestUser's Organization",
    "slug": "testuser-123",
    "owner_id": 123,
    "plan_tier": "free",
    "settings": {},
    "owner_name": "TestUser",
    "owner_email": "testuser@example.com",
    "member_count": 1,
    "bot_count": 0,
    "current_user_role": "admin",
    "current_user_is_owner": true
  }
}
```

**Error Scenarios**:
```json
// Not a member (403)
{
  "success": false,
  "message": "Access denied to this organization"
}

// Organization not found (404)
{
  "success": false,
  "message": "Organization not found"
}
```

**cURL Example**:
```bash
curl -X GET http://localhost:5000/api/organizations/456 \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'X-Organization-ID: 456'
```

---

### 5. Update Organization

**Endpoint**: `PUT /api/organizations/:id`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
X-Organization-ID: 456
```

**Permissions**: Admin only

**Request**:
```json
{
  "name": "Updated Organization Name",
  "plan_tier": "pro"
}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Organization updated successfully",
  "data": {
    "id": 456,
    "name": "Updated Organization Name",
    "slug": "testuser-123",
    "owner_id": 123,
    "plan_tier": "pro",
    "updated_at": "2025-01-15T11:00:00.000Z"
  }
}
```

**Error Scenarios**:
```json
// Not admin (403)
{
  "success": false,
  "message": "Insufficient permissions"
}

// No updates provided (400)
{
  "success": false,
  "message": "No updates provided"
}
```

---

### 6. Delete Organization

**Endpoint**: `DELETE /api/organizations/:id`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
X-Organization-ID: 456
```

**Permissions**: Owner only

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Organization deleted successfully",
  "data": {
    "id": 456,
    "name": "TestUser's Organization"
  }
}
```

**Error Scenarios**:
```json
// Not owner (403)
{
  "success": false,
  "message": "Insufficient permissions"
}
```

---

## Member Management Endpoints

### 7. Get Organization Members

**Endpoint**: `GET /api/organizations/:id/members`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
X-Organization-ID: 456
```

**Permissions**: Any member

**Expected Response** (200 OK):
```json
{
  "success": true,
  "members": [
    {
      "id": 1,
      "org_id": 456,
      "user_id": 123,
      "role": "admin",
      "status": "active",
      "joined_at": "2025-01-15T10:30:00.000Z",
      "name": "TestUser",
      "email": "testuser@example.com",
      "invited_by_name": null
    }
  ]
}
```

**Backend Console Should Show**:
```
[Organizations] Fetched 1 members for organization 456
```

**cURL Example**:
```bash
curl -X GET http://localhost:5000/api/organizations/456/members \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'X-Organization-ID: 456'
```

---

### 8. Invite Member to Organization

**Endpoint**: `POST /api/organizations/:id/invite`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
X-Organization-ID: 456
```

**Permissions**: Admin only

**Request**:
```json
{
  "email": "newmember@example.com",
  "role": "member"
}
```

**Expected Response** (201 Created):
```json
{
  "success": true,
  "message": "User invited successfully",
  "data": {
    "id": 2,
    "org_id": 456,
    "user_id": 789,
    "role": "member",
    "invited_by": 123,
    "status": "active",
    "joined_at": "2025-01-15T11:00:00.000Z"
  }
}
```

**Error Scenarios**:
```json
// User not found (404)
{
  "success": false,
  "message": "User with this email not found"
}

// Already a member (400)
{
  "success": false,
  "message": "User is already a member of this organization"
}

// Invalid role (400)
{
  "success": false,
  "message": "Invalid role. Must be admin, member, or viewer"
}

// Not admin (403)
{
  "success": false,
  "message": "Insufficient permissions"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/organizations/456/invite \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'X-Organization-ID: 456' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "newmember@example.com",
    "role": "member"
  }'
```

---

### 9. Update Member Role

**Endpoint**: `PUT /api/organizations/:id/members/:userId/role`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
X-Organization-ID: 456
```

**Permissions**: Admin only

**Request**:
```json
{
  "role": "viewer"
}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Member role updated successfully",
  "data": {
    "id": 2,
    "org_id": 456,
    "user_id": 789,
    "role": "viewer"
  }
}
```

**Error Scenarios**:
```json
// Cannot change owner role (400)
{
  "success": false,
  "message": "Cannot change organization owner role"
}

// Member not found (404)
{
  "success": false,
  "message": "Member not found"
}
```

---

### 10. Remove Member from Organization

**Endpoint**: `DELETE /api/organizations/:id/members/:userId`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
X-Organization-ID: 456
```

**Permissions**: Admin only

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Member removed successfully",
  "data": {
    "id": 2,
    "user_id": 789
  }
}
```

**Error Scenarios**:
```json
// Cannot remove owner (400)
{
  "success": false,
  "message": "Cannot remove organization owner"
}
```

---

## Bot Endpoints

### 11. Create Bot

**Endpoint**: `POST /api/bots`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
X-Organization-ID: 456
```

**Permissions**: Member or higher

**Request**:
```json
{
  "name": "My Test Bot",
  "platform": "telegram",
  "description": "A test bot for RBAC system",
  "webhook_url": "https://example.com/webhook"
}
```

**Expected Response** (201 Created):
```json
{
  "success": true,
  "bot": {
    "id": 1,
    "name": "My Test Bot",
    "platform": "telegram",
    "description": "A test bot for RBAC system",
    "webhook_url": "https://example.com/webhook",
    "user_id": 123,
    "organization_id": 456,
    "is_active": true,
    "created_at": "2025-01-15T11:00:00.000Z"
  }
}
```

**Error Scenarios**:
```json
// Not member (403)
{
  "success": false,
  "message": "Insufficient permissions"
}
```

---

### 12. Get All Bots (Organization-Scoped)

**Endpoint**: `GET /api/bots`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
X-Organization-ID: 456
```

**Query Parameters**:
- `page` (optional): Page number for pagination
- `limit` (optional): Items per page

**Expected Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "My Test Bot",
      "platform": "telegram",
      "description": "A test bot for RBAC system",
      "user_id": 123,
      "organization_id": 456,
      "is_active": true,
      "created_at": "2025-01-15T11:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

**Important**: Only bots from the current organization (456) should be returned.

---

### 13. Delete Bot

**Endpoint**: `DELETE /api/bots/:id`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
X-Organization-ID: 456
```

**Permissions**: Admin only

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Bot deleted successfully"
}
```

**Error Scenarios**:
```json
// Not admin (403)
{
  "success": false,
  "message": "Insufficient permissions"
}

// Bot not in current organization (403)
{
  "success": false,
  "message": "Access denied"
}
```

---

## Cross-Organization Access Tests

### 14. Test: Access Bot from Different Organization

**Setup**:
1. User A in Org A creates Bot X
2. User B in Org B tries to access Bot X

**Request** (User B):
```bash
GET /api/bots/:botX_id
Headers:
  Authorization: Bearer USER_B_TOKEN
  X-Organization-ID: ORG_B_ID
```

**Expected Response** (403 Forbidden):
```json
{
  "success": false,
  "message": "Access denied to this resource"
}
```

**Pass Criteria**: User B CANNOT access Bot X from Org A

---

### 15. Test: Member List Isolation

**Setup**:
1. User A in Org A
2. User A tries to get members of Org B (where they are not a member)

**Request**:
```bash
GET /api/organizations/:orgB_id/members
Headers:
  Authorization: Bearer USER_A_TOKEN
  X-Organization-ID: ORG_A_ID
```

**Expected Response** (403 Forbidden):
```json
{
  "success": false,
  "message": "Access denied to this organization"
}
```

**Pass Criteria**: Cannot access other organization's members

---

## Testing Tools

### Postman Collection
Import this collection structure:

```
BotBuilder API Tests
├── Auth
│   ├── Register
│   ├── Login
│   └── Login (Invalid)
├── Organizations
│   ├── Get Organizations
│   ├── Get Organization Details
│   ├── Update Organization
│   └── Delete Organization
├── Members
│   ├── Get Members
│   ├── Invite Member
│   ├── Update Member Role
│   └── Remove Member
└── Bots
    ├── Create Bot
    ├── Get Bots
    ├── Update Bot
    └── Delete Bot
```

### Environment Variables
```
BASE_URL=http://localhost:5000
JWT_TOKEN=<obtained from login>
ORG_ID=<current organization id>
USER_ID=<current user id>
```

---

## Automated Testing Script

### Quick Test Script (Bash)
```bash
#!/bin/bash

BASE_URL="http://localhost:5000"

echo "=== Testing BotBuilder API ==="

# 1. Register
echo "1. Testing Registration..."
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "AutoTest",
    "email": "autotest@example.com",
    "password": "Test123!"
  }')

TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.token')
USER_ID=$(echo $REGISTER_RESPONSE | jq -r '.user.id')
ORG_ID=$(echo $REGISTER_RESPONSE | jq -r '.user.currentOrganizationId')

echo "✓ User registered: ID=$USER_ID, Org=$ORG_ID"

# 2. Get Organizations
echo "2. Testing Get Organizations..."
curl -s -X GET $BASE_URL/api/organizations \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. Get Members
echo "3. Testing Get Members..."
curl -s -X GET $BASE_URL/api/organizations/$ORG_ID/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $ORG_ID" | jq

# 4. Create Bot
echo "4. Testing Create Bot..."
curl -s -X POST $BASE_URL/api/bots \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $ORG_ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test Bot",
    "platform": "telegram",
    "description": "Automated test bot"
  }' | jq

echo "=== All Tests Complete ==="
```

---

## Test Coverage Matrix

| Endpoint | Success Case | Auth Fail | Permission Fail | Not Found | Validation Fail |
|----------|-------------|-----------|----------------|-----------|----------------|
| POST /auth/register | ✅ | N/A | N/A | N/A | ✅ |
| POST /auth/login | ✅ | ✅ | N/A | ✅ | ✅ |
| GET /api/organizations | ✅ | ✅ | N/A | N/A | N/A |
| GET /api/organizations/:id | ✅ | ✅ | ✅ | ✅ | N/A |
| PUT /api/organizations/:id | ✅ | ✅ | ✅ | ✅ | ✅ |
| DELETE /api/organizations/:id | ✅ | ✅ | ✅ | ✅ | N/A |
| GET /api/organizations/:id/members | ✅ | ✅ | ✅ | N/A | N/A |
| POST /api/organizations/:id/invite | ✅ | ✅ | ✅ | ✅ | ✅ |
| PUT /api/organizations/:id/members/:userId | ✅ | ✅ | ✅ | ✅ | ✅ |
| DELETE /api/organizations/:id/members/:userId | ✅ | ✅ | ✅ | ✅ | N/A |
| POST /api/bots | ✅ | ✅ | ✅ | N/A | ✅ |
| GET /api/bots | ✅ | ✅ | N/A | N/A | N/A |
| DELETE /api/bots/:id | ✅ | ✅ | ✅ | ✅ | N/A |

---

**Last Updated**: 2025-01-XX
**Version**: 1.0
**RBAC System Version**: Phase 3 Complete
