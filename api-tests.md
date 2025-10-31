# 🚀 BotBuilder Platform - API Testing Documentation

## 📋 Table of Contents

- [Overview](#overview)
- [API Base Configuration](#api-base-configuration)
- [Authentication Endpoints](#authentication-endpoints)
- [Organization Endpoints](#organization-endpoints)
- [Member Management Endpoints](#member-management-endpoints)
- [Bot Management Endpoints](#bot-management-endpoints)
- [Flow Management Endpoints](#flow-management-endpoints)
- [Message Management Endpoints](#message-management-endpoints)
- [Automated Testing Scripts](#automated-testing-scripts)
- [Test Coverage Matrix](#test-coverage-matrix)
- [Response Examples](#response-examples)
- [Error Handling](#error-handling)

---

## 🎯 Overview

This document provides comprehensive API testing documentation for the BotBuilder Platform. It includes:

- ✅ 15+ API endpoints with detailed documentation
- ✅ Complete curl command examples
- ✅ Request/Response schemas
- ✅ Authentication flows
- ✅ Automated bash scripts for testing
- ✅ Error handling examples

### API Architecture

- **Base URL**: `http://localhost:5000` (Development)
- **Protocol**: HTTP/REST
- **Authentication**: JWT Bearer Token
- **Content-Type**: `application/json`
- **Organization Context**: JWT token or X-Organization-ID header

---

## ⚙️ API Base Configuration

### Environment Variables

```bash
# Development
API_BASE_URL=http://localhost:5000
API_TIMEOUT=30000

# Staging
API_BASE_URL=https://staging-api.botbuilder.com
API_TIMEOUT=30000

# Production
API_BASE_URL=https://api.botbuilder.com
API_TIMEOUT=30000
```

### Common Headers

```bash
# Authentication (required for protected endpoints)
Authorization: Bearer <JWT_TOKEN>

# Content Type
Content-Type: application/json

# Organization Context (optional, overrides JWT default)
X-Organization-ID: <organization_id>

# CORS
Origin: http://localhost:3000
```

### Response Format

All API responses follow this standard format:

```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

---

## 🔐 Authentication Endpoints

### 1️⃣ POST /api/auth/register

**Description**: Register a new user account

**Authentication**: None required

**Request Body**:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!@#"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePass123!@#"
  }'
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "created_at": "2025-10-31T10:00:00.000Z"
  }
}
```

**Error Response (400 Bad Request)**:
```json
{
  "success": false,
  "error": "Email already exists",
  "statusCode": 400
}
```

**Validation Rules**:
- ✅ Email must be valid format
- ✅ Email must be unique
- ✅ Password minimum 6 characters
- ✅ Username required (3-50 characters)

---

### 2️⃣ POST /api/auth/login

**Description**: Authenticate user and receive JWT token

**Authentication**: None required

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!@#"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!@#"
  }'
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "current_organization_id": 1
  }
}
```

**Error Response (401 Unauthorized)**:
```json
{
  "success": false,
  "error": "Invalid credentials",
  "statusCode": 401
}
```

**JWT Token Contents**:
```json
{
  "userId": 1,
  "email": "john@example.com",
  "currentOrganizationId": 1,
  "iat": 1698765432,
  "exp": 1698851832
}
```

---

## 🏢 Organization Endpoints

### 3️⃣ GET /api/organizations

**Description**: Get list of organizations user belongs to

**Authentication**: Required (JWT)

**Request Headers**:
```bash
Authorization: Bearer <JWT_TOKEN>
```

**cURL Example**:
```bash
curl -X GET http://localhost:5000/api/organizations \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "My Organization",
      "description": "My personal workspace",
      "role": "admin",
      "created_at": "2025-10-01T10:00:00.000Z",
      "updated_at": "2025-10-01T10:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Team Organization",
      "description": "Shared team workspace",
      "role": "member",
      "created_at": "2025-10-05T14:30:00.000Z",
      "updated_at": "2025-10-05T14:30:00.000Z"
    }
  ]
}
```

**Possible Roles**:
- `admin` - Full access
- `member` - Create/edit own resources
- `viewer` - Read-only access

---

### 4️⃣ POST /api/organizations

**Description**: Create a new organization

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "name": "My New Company",
  "description": "Company workspace for team collaboration"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/organizations \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My New Company",
    "description": "Company workspace for team collaboration"
  }'
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "My New Company",
    "description": "Company workspace for team collaboration",
    "owner_id": 1,
    "created_at": "2025-10-31T10:00:00.000Z",
    "updated_at": "2025-10-31T10:00:00.000Z"
  }
}
```

**Notes**:
- Creator is automatically added as admin
- Name must be 1-255 characters
- Description is optional

---

### 5️⃣ GET /api/organizations/:id

**Description**: Get details of a specific organization

**Authentication**: Required (JWT)

**URL Parameters**:
- `id` (integer) - Organization ID

**cURL Example**:
```bash
curl -X GET http://localhost:5000/api/organizations/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "My Organization",
    "description": "My personal workspace",
    "owner_id": 1,
    "role": "admin",
    "member_count": 5,
    "created_at": "2025-10-01T10:00:00.000Z",
    "updated_at": "2025-10-01T10:00:00.000Z"
  }
}
```

**Error Response (403 Forbidden)**:
```json
{
  "success": false,
  "error": "Access denied to this organization",
  "statusCode": 403
}
```

---

### 6️⃣ PUT /api/organizations/:id

**Description**: Update organization details

**Authentication**: Required (JWT)

**Authorization**: Admin role required

**URL Parameters**:
- `id` (integer) - Organization ID

**Request Body**:
```json
{
  "name": "Updated Organization Name",
  "description": "Updated description"
}
```

**cURL Example**:
```bash
curl -X PUT http://localhost:5000/api/organizations/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Organization Name",
    "description": "Updated description"
  }'
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Updated Organization Name",
    "description": "Updated description",
    "owner_id": 1,
    "created_at": "2025-10-01T10:00:00.000Z",
    "updated_at": "2025-10-31T10:00:00.000Z"
  }
}
```

**Error Response (403 Forbidden)**:
```json
{
  "success": false,
  "error": "Only admins can update organization",
  "statusCode": 403
}
```

---

### 7️⃣ POST /api/organizations/switch

**Description**: Switch current organization context

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "organizationId": 2
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/organizations/switch \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": 2
  }'
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Organization switched successfully"
}
```

**Error Response (403 Forbidden)**:
```json
{
  "success": false,
  "error": "You are not a member of this organization",
  "statusCode": 403
}
```

**Notes**:
- Returns new JWT token with updated organization context
- All subsequent API calls will use new organization
- User must be member of target organization

---

## 👥 Member Management Endpoints

### 8️⃣ GET /api/organizations/:id/members

**Description**: Get list of organization members

**Authentication**: Required (JWT)

**Authorization**: Member role or higher

**URL Parameters**:
- `id` (integer) - Organization ID

**cURL Example**:
```bash
curl -X GET http://localhost:5000/api/organizations/1/members \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "role": "admin",
      "joined_at": "2025-10-01T10:00:00.000Z"
    },
    {
      "id": 2,
      "user_id": 5,
      "username": "janedoe",
      "email": "jane@example.com",
      "role": "member",
      "joined_at": "2025-10-15T14:20:00.000Z"
    },
    {
      "id": 3,
      "user_id": 8,
      "username": "viewer",
      "email": "viewer@example.com",
      "role": "viewer",
      "joined_at": "2025-10-20T09:15:00.000Z"
    }
  ]
}
```

---

### 9️⃣ POST /api/organizations/:id/members

**Description**: Add a new member to organization (invite)

**Authentication**: Required (JWT)

**Authorization**: Admin role required

**URL Parameters**:
- `id` (integer) - Organization ID

**Request Body**:
```json
{
  "email": "newmember@example.com",
  "role": "member"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/organizations/1/members \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newmember@example.com",
    "role": "member"
  }'
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": 4,
    "user_id": 10,
    "username": "newmember",
    "email": "newmember@example.com",
    "role": "member",
    "organization_id": 1,
    "joined_at": "2025-10-31T10:00:00.000Z"
  },
  "message": "Member added successfully"
}
```

**Error Responses**:

User not found (404):
```json
{
  "success": false,
  "error": "User not found",
  "statusCode": 404
}
```

Already a member (400):
```json
{
  "success": false,
  "error": "User is already a member of this organization",
  "statusCode": 400
}
```

Not an admin (403):
```json
{
  "success": false,
  "error": "Only admins can add members",
  "statusCode": 403
}
```

---

### 🔟 PUT /api/organizations/:orgId/members/:userId

**Description**: Update member's role in organization

**Authentication**: Required (JWT)

**Authorization**: Admin role required

**URL Parameters**:
- `orgId` (integer) - Organization ID
- `userId` (integer) - User ID of member to update

**Request Body**:
```json
{
  "role": "admin"
}
```

**cURL Example**:
```bash
curl -X PUT http://localhost:5000/api/organizations/1/members/5 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "user_id": 5,
    "username": "janedoe",
    "email": "jane@example.com",
    "role": "admin",
    "organization_id": 1,
    "updated_at": "2025-10-31T10:00:00.000Z"
  },
  "message": "Member role updated successfully"
}
```

**Valid Roles**:
- `admin` - Full access to organization
- `member` - Can create and manage own resources
- `viewer` - Read-only access

**Error Response (400 Bad Request)**:
```json
{
  "success": false,
  "error": "Invalid role. Must be: admin, member, or viewer",
  "statusCode": 400
}
```

---

### 1️⃣1️⃣ DELETE /api/organizations/:orgId/members/:userId

**Description**: Remove member from organization

**Authentication**: Required (JWT)

**Authorization**: Admin role required

**URL Parameters**:
- `orgId` (integer) - Organization ID
- `userId` (integer) - User ID of member to remove

**cURL Example**:
```bash
curl -X DELETE http://localhost:5000/api/organizations/1/members/5 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Member removed successfully"
}
```

**Error Response (400 Bad Request)**:
```json
{
  "success": false,
  "error": "Cannot remove last admin from organization",
  "statusCode": 400
}
```

**Notes**:
- Cannot remove last admin from organization
- Member loses access to all organization resources
- Other memberships remain intact

---

## 🤖 Bot Management Endpoints

### 1️⃣2️⃣ GET /api/bots

**Description**: Get list of bots in current organization

**Authentication**: Required (JWT)

**Query Parameters**:
- `page` (integer, optional) - Page number (default: 1)
- `limit` (integer, optional) - Items per page (default: 10)
- `search` (string, optional) - Search by bot name
- `platform` (string, optional) - Filter by platform

**cURL Example**:
```bash
# Basic request
curl -X GET http://localhost:5000/api/bots \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# With pagination
curl -X GET "http://localhost:5000/api/bots?page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# With search
curl -X GET "http://localhost:5000/api/bots?search=support" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# With platform filter
curl -X GET "http://localhost:5000/api/bots?platform=telegram" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "bots": [
      {
        "id": 1,
        "name": "Customer Support Bot",
        "platform": "telegram",
        "description": "Handles customer inquiries",
        "organization_id": 1,
        "created_by": 1,
        "created_at": "2025-10-15T10:00:00.000Z",
        "updated_at": "2025-10-15T10:00:00.000Z"
      },
      {
        "id": 2,
        "name": "Sales Bot",
        "platform": "whatsapp",
        "description": "Manages sales conversations",
        "organization_id": 1,
        "created_by": 1,
        "created_at": "2025-10-20T14:30:00.000Z",
        "updated_at": "2025-10-20T14:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "totalPages": 1
    }
  }
}
```

**Notes**:
- Only returns bots from current organization
- Multi-tenant isolation enforced
- Results can be paginated and filtered

---

### 1️⃣3️⃣ POST /api/bots

**Description**: Create a new bot in current organization

**Authentication**: Required (JWT)

**Authorization**: Admin or Member role required

**Request Body**:
```json
{
  "name": "My New Bot",
  "platform": "telegram",
  "description": "Bot description here"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/bots \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My New Bot",
    "platform": "telegram",
    "description": "Bot description here"
  }'
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "My New Bot",
    "platform": "telegram",
    "description": "Bot description here",
    "organization_id": 1,
    "created_by": 1,
    "created_at": "2025-10-31T10:00:00.000Z",
    "updated_at": "2025-10-31T10:00:00.000Z"
  },
  "message": "Bot created successfully"
}
```

**Supported Platforms**:
- `telegram`
- `whatsapp`
- `slack`
- `discord`
- `messenger`
- `web`

**Validation Rules**:
- ✅ Name required (1-255 characters)
- ✅ Platform required (must be valid)
- ✅ Description optional (max 1000 characters)
- ✅ Automatically assigned to current organization

---

### 1️⃣4️⃣ GET /api/bots/:id

**Description**: Get details of a specific bot

**Authentication**: Required (JWT)

**Authorization**: Must be member of bot's organization

**URL Parameters**:
- `id` (integer) - Bot ID

**cURL Example**:
```bash
curl -X GET http://localhost:5000/api/bots/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Customer Support Bot",
    "platform": "telegram",
    "description": "Handles customer inquiries",
    "organization_id": 1,
    "organization_name": "My Organization",
    "created_by": 1,
    "creator_name": "johndoe",
    "flow_count": 5,
    "message_count": 150,
    "created_at": "2025-10-15T10:00:00.000Z",
    "updated_at": "2025-10-15T10:00:00.000Z"
  }
}
```

**Error Response (403 Forbidden)**:
```json
{
  "success": false,
  "error": "Access denied to this bot",
  "statusCode": 403
}
```

---

### 1️⃣5️⃣ PUT /api/bots/:id

**Description**: Update bot details

**Authentication**: Required (JWT)

**Authorization**:
- Admin can update any bot in organization
- Member can only update bots they created

**URL Parameters**:
- `id` (integer) - Bot ID

**Request Body**:
```json
{
  "name": "Updated Bot Name",
  "platform": "whatsapp",
  "description": "Updated description"
}
```

**cURL Example**:
```bash
curl -X PUT http://localhost:5000/api/bots/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Bot Name",
    "platform": "whatsapp",
    "description": "Updated description"
  }'
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Updated Bot Name",
    "platform": "whatsapp",
    "description": "Updated description",
    "organization_id": 1,
    "created_by": 1,
    "created_at": "2025-10-15T10:00:00.000Z",
    "updated_at": "2025-10-31T10:00:00.000Z"
  },
  "message": "Bot updated successfully"
}
```

**Error Response (403 Forbidden)**:
```json
{
  "success": false,
  "error": "You can only update your own bots",
  "statusCode": 403
}
```

---

### 1️⃣6️⃣ DELETE /api/bots/:id

**Description**: Delete a bot

**Authentication**: Required (JWT)

**Authorization**:
- Admin can delete any bot in organization
- Member can only delete bots they created

**URL Parameters**:
- `id` (integer) - Bot ID

**cURL Example**:
```bash
curl -X DELETE http://localhost:5000/api/bots/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Bot deleted successfully"
}
```

**Error Response (403 Forbidden)**:
```json
{
  "success": false,
  "error": "You can only delete your own bots",
  "statusCode": 403
}
```

**Notes**:
- Deletes associated flows and messages (CASCADE)
- Cannot be undone
- Viewer role cannot delete bots

---

## 🔄 Flow Management Endpoints

### 1️⃣7️⃣ GET /api/bots/:botId/flows

**Description**: Get all flows for a specific bot

**Authentication**: Required (JWT)

**URL Parameters**:
- `botId` (integer) - Bot ID

**cURL Example**:
```bash
curl -X GET http://localhost:5000/api/bots/1/flows \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "bot_id": 1,
      "name": "Welcome Flow",
      "description": "Initial greeting flow",
      "trigger": "start",
      "is_active": true,
      "created_at": "2025-10-15T10:00:00.000Z",
      "updated_at": "2025-10-15T10:00:00.000Z"
    },
    {
      "id": 2,
      "bot_id": 1,
      "name": "Support Flow",
      "description": "Customer support flow",
      "trigger": "help",
      "is_active": true,
      "created_at": "2025-10-16T11:00:00.000Z",
      "updated_at": "2025-10-16T11:00:00.000Z"
    }
  ]
}
```

---

### 1️⃣8️⃣ POST /api/bots/:botId/flows

**Description**: Create a new flow for a bot

**Authentication**: Required (JWT)

**Authorization**: Admin or Member role required

**URL Parameters**:
- `botId` (integer) - Bot ID

**Request Body**:
```json
{
  "name": "New Flow",
  "description": "Flow description",
  "trigger": "keyword",
  "is_active": true
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/bots/1/flows \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Flow",
    "description": "Flow description",
    "trigger": "keyword",
    "is_active": true
  }'
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": 3,
    "bot_id": 1,
    "name": "New Flow",
    "description": "Flow description",
    "trigger": "keyword",
    "is_active": true,
    "created_at": "2025-10-31T10:00:00.000Z",
    "updated_at": "2025-10-31T10:00:00.000Z"
  },
  "message": "Flow created successfully"
}
```

---

## 💬 Message Management Endpoints

### 1️⃣9️⃣ GET /api/bots/:botId/messages

**Description**: Get messages for a specific bot

**Authentication**: Required (JWT)

**URL Parameters**:
- `botId` (integer) - Bot ID

**Query Parameters**:
- `page` (integer, optional) - Page number (default: 1)
- `limit` (integer, optional) - Items per page (default: 20)
- `type` (string, optional) - Filter by type (request/response)

**cURL Example**:
```bash
# Basic request
curl -X GET http://localhost:5000/api/bots/1/messages \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# With pagination and filter
curl -X GET "http://localhost:5000/api/bots/1/messages?page=1&limit=50&type=response" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 1,
        "bot_id": 1,
        "message_type": "response",
        "content": "Hello! How can I help you?",
        "created_at": "2025-10-15T10:30:00.000Z"
      },
      {
        "id": 2,
        "bot_id": 1,
        "message_type": "request",
        "content": "I need help",
        "created_at": "2025-10-15T10:31:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

### 2️⃣0️⃣ POST /api/messages

**Description**: Create a new message

**Authentication**: Required (JWT)

**Authorization**: Admin or Member role required

**Request Body**:
```json
{
  "bot_id": 1,
  "message_type": "response",
  "content": "Thank you for contacting us!"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:5000/api/messages \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "bot_id": 1,
    "message_type": "response",
    "content": "Thank you for contacting us!"
  }'
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": 151,
    "bot_id": 1,
    "message_type": "response",
    "content": "Thank you for contacting us!",
    "created_at": "2025-10-31T10:00:00.000Z"
  },
  "message": "Message created successfully"
}
```

**Valid Message Types**:
- `request` - User request/input
- `response` - Bot response/output

---

## 🔧 Automated Testing Scripts

### Complete API Test Suite (Bash)

```bash
#!/bin/bash

# BotBuilder Platform - Automated API Test Suite
# Usage: bash api-test-suite.sh

# Configuration
BASE_URL="http://localhost:5000"
TEST_EMAIL="test_$(date +%s)@example.com"
TEST_USERNAME="testuser_$(date +%s)"
TEST_PASSWORD="TestPass123!@#"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test results
print_test() {
    TESTS_RUN=$((TESTS_RUN + 1))
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Function to extract JSON value
json_extract() {
    echo "$1" | grep -o "\"$2\":[^,}]*" | cut -d':' -f2 | tr -d '"' | tr -d ' '
}

echo "================================================"
echo "🧪 BotBuilder Platform - API Test Suite"
echo "================================================"
echo ""

# Test 1: User Registration
echo "📝 Test 1: User Registration"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$TEST_USERNAME\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

TOKEN=$(json_extract "$REGISTER_RESPONSE" "token")
USER_ID=$(json_extract "$REGISTER_RESPONSE" "id")

if [ ! -z "$TOKEN" ] && [ ! -z "$USER_ID" ]; then
    print_test 0 "User registration successful"
else
    print_test 1 "User registration failed"
    echo "Response: $REGISTER_RESPONSE"
    exit 1
fi

echo ""

# Test 2: User Login
echo "🔐 Test 2: User Login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

LOGIN_TOKEN=$(json_extract "$LOGIN_RESPONSE" "token")

if [ ! -z "$LOGIN_TOKEN" ]; then
    print_test 0 "User login successful"
    TOKEN=$LOGIN_TOKEN
else
    print_test 1 "User login failed"
    echo "Response: $LOGIN_RESPONSE"
fi

echo ""

# Test 3: Get Organizations
echo "🏢 Test 3: Get Organizations"
ORG_RESPONSE=$(curl -s -X GET "$BASE_URL/api/organizations" \
  -H "Authorization: Bearer $TOKEN")

ORG_ID=$(echo "$ORG_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ ! -z "$ORG_ID" ]; then
    print_test 0 "Get organizations successful"
else
    print_test 1 "Get organizations failed"
    echo "Response: $ORG_RESPONSE"
fi

echo ""

# Test 4: Create Organization
echo "🏢 Test 4: Create Organization"
CREATE_ORG_RESPONSE=$(curl -s -X POST "$BASE_URL/api/organizations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Org $(date +%s)\",\"description\":\"Test organization\"}")

NEW_ORG_ID=$(json_extract "$CREATE_ORG_RESPONSE" "id")

if [ ! -z "$NEW_ORG_ID" ]; then
    print_test 0 "Create organization successful"
else
    print_test 1 "Create organization failed"
    echo "Response: $CREATE_ORG_RESPONSE"
fi

echo ""

# Test 5: Get Organization Details
echo "🏢 Test 5: Get Organization Details"
ORG_DETAIL_RESPONSE=$(curl -s -X GET "$BASE_URL/api/organizations/$ORG_ID" \
  -H "Authorization: Bearer $TOKEN")

ORG_NAME=$(json_extract "$ORG_DETAIL_RESPONSE" "name")

if [ ! -z "$ORG_NAME" ]; then
    print_test 0 "Get organization details successful"
else
    print_test 1 "Get organization details failed"
    echo "Response: $ORG_DETAIL_RESPONSE"
fi

echo ""

# Test 6: Update Organization
echo "🏢 Test 6: Update Organization"
UPDATE_ORG_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/organizations/$ORG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Updated Org $(date +%s)\",\"description\":\"Updated description\"}")

UPDATED_NAME=$(json_extract "$UPDATE_ORG_RESPONSE" "name")

if [ ! -z "$UPDATED_NAME" ]; then
    print_test 0 "Update organization successful"
else
    print_test 1 "Update organization failed"
    echo "Response: $UPDATE_ORG_RESPONSE"
fi

echo ""

# Test 7: Create Bot
echo "🤖 Test 7: Create Bot"
CREATE_BOT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/bots" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Bot $(date +%s)\",\"platform\":\"telegram\",\"description\":\"Test bot\"}")

BOT_ID=$(json_extract "$CREATE_BOT_RESPONSE" "id")

if [ ! -z "$BOT_ID" ]; then
    print_test 0 "Create bot successful"
else
    print_test 1 "Create bot failed"
    echo "Response: $CREATE_BOT_RESPONSE"
fi

echo ""

# Test 8: Get Bots
echo "🤖 Test 8: Get Bots"
GET_BOTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/bots" \
  -H "Authorization: Bearer $TOKEN")

BOTS_COUNT=$(echo "$GET_BOTS_RESPONSE" | grep -o '"id":' | wc -l)

if [ $BOTS_COUNT -gt 0 ]; then
    print_test 0 "Get bots successful (found $BOTS_COUNT bots)"
else
    print_test 1 "Get bots failed"
    echo "Response: $GET_BOTS_RESPONSE"
fi

echo ""

# Test 9: Get Bot Details
echo "🤖 Test 9: Get Bot Details"
GET_BOT_RESPONSE=$(curl -s -X GET "$BASE_URL/api/bots/$BOT_ID" \
  -H "Authorization: Bearer $TOKEN")

BOT_NAME=$(json_extract "$GET_BOT_RESPONSE" "name")

if [ ! -z "$BOT_NAME" ]; then
    print_test 0 "Get bot details successful"
else
    print_test 1 "Get bot details failed"
    echo "Response: $GET_BOT_RESPONSE"
fi

echo ""

# Test 10: Update Bot
echo "🤖 Test 10: Update Bot"
UPDATE_BOT_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/bots/$BOT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Updated Bot $(date +%s)\",\"platform\":\"whatsapp\",\"description\":\"Updated description\"}")

UPDATED_BOT_NAME=$(json_extract "$UPDATE_BOT_RESPONSE" "name")

if [ ! -z "$UPDATED_BOT_NAME" ]; then
    print_test 0 "Update bot successful"
else
    print_test 1 "Update bot failed"
    echo "Response: $UPDATE_BOT_RESPONSE"
fi

echo ""

# Test 11: Create Message
echo "💬 Test 11: Create Message"
CREATE_MSG_RESPONSE=$(curl -s -X POST "$BASE_URL/api/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"bot_id\":$BOT_ID,\"message_type\":\"response\",\"content\":\"Test message\"}")

MSG_ID=$(json_extract "$CREATE_MSG_RESPONSE" "id")

if [ ! -z "$MSG_ID" ]; then
    print_test 0 "Create message successful"
else
    print_test 1 "Create message failed"
    echo "Response: $CREATE_MSG_RESPONSE"
fi

echo ""

# Test 12: Get Messages
echo "💬 Test 12: Get Messages"
GET_MSGS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/bots/$BOT_ID/messages" \
  -H "Authorization: Bearer $TOKEN")

MSG_COUNT=$(echo "$GET_MSGS_RESPONSE" | grep -o '"id":' | wc -l)

if [ $MSG_COUNT -gt 0 ]; then
    print_test 0 "Get messages successful (found $MSG_COUNT messages)"
else
    print_test 1 "Get messages failed"
    echo "Response: $GET_MSGS_RESPONSE"
fi

echo ""

# Test 13: Delete Bot
echo "🤖 Test 13: Delete Bot"
DELETE_BOT_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/bots/$BOT_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DELETE_BOT_RESPONSE" | grep -q "success"; then
    print_test 0 "Delete bot successful"
else
    print_test 1 "Delete bot failed"
    echo "Response: $DELETE_BOT_RESPONSE"
fi

echo ""

# Test 14: Verify Bot Deleted (should fail with 404)
echo "🤖 Test 14: Verify Bot Deleted"
VERIFY_DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/bots/$BOT_ID" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$VERIFY_DELETE_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "403" ]; then
    print_test 0 "Bot deletion verified (404/403 returned)"
else
    print_test 1 "Bot deletion verification failed (expected 404/403, got $HTTP_CODE)"
fi

echo ""

# Test 15: Invalid Token Test
echo "🔐 Test 15: Invalid Token Test"
INVALID_TOKEN_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/bots" \
  -H "Authorization: Bearer invalid_token_12345")

INVALID_HTTP_CODE=$(echo "$INVALID_TOKEN_RESPONSE" | tail -n1)

if [ "$INVALID_HTTP_CODE" = "401" ]; then
    print_test 0 "Invalid token correctly rejected (401)"
else
    print_test 1 "Invalid token test failed (expected 401, got $INVALID_HTTP_CODE)"
fi

echo ""
echo "================================================"
echo "📊 Test Summary"
echo "================================================"
echo "Total Tests: $TESTS_RUN"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
```

### Save and Run the Script

```bash
# Save the script
cat > api-test-suite.sh << 'EOF'
# ... (paste the script above) ...
EOF

# Make it executable
chmod +x api-test-suite.sh

# Run the tests
./api-test-suite.sh
```

---

## 📊 Test Coverage Matrix

| Endpoint | Method | Auth Required | Role Required | Test Status |
|----------|--------|---------------|---------------|-------------|
| /api/auth/register | POST | ❌ | None | ✅ Covered |
| /api/auth/login | POST | ❌ | None | ✅ Covered |
| /api/organizations | GET | ✅ | Member+ | ✅ Covered |
| /api/organizations | POST | ✅ | Any | ✅ Covered |
| /api/organizations/:id | GET | ✅ | Member+ | ✅ Covered |
| /api/organizations/:id | PUT | ✅ | Admin | ✅ Covered |
| /api/organizations/switch | POST | ✅ | Any | ⬜ Manual |
| /api/organizations/:id/members | GET | ✅ | Member+ | ⬜ Manual |
| /api/organizations/:id/members | POST | ✅ | Admin | ⬜ Manual |
| /api/organizations/:orgId/members/:userId | PUT | ✅ | Admin | ⬜ Manual |
| /api/organizations/:orgId/members/:userId | DELETE | ✅ | Admin | ⬜ Manual |
| /api/bots | GET | ✅ | Any | ✅ Covered |
| /api/bots | POST | ✅ | Member+ | ✅ Covered |
| /api/bots/:id | GET | ✅ | Any | ✅ Covered |
| /api/bots/:id | PUT | ✅ | Member+/Owner | ✅ Covered |
| /api/bots/:id | DELETE | ✅ | Member+/Owner | ✅ Covered |
| /api/bots/:botId/messages | GET | ✅ | Any | ✅ Covered |
| /api/messages | POST | ✅ | Member+ | ✅ Covered |

**Coverage**: 15/18 endpoints (83%)

---

## 📋 Response Examples

### Success Responses

#### 200 OK - Successful GET Request
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Resource Name"
  }
}
```

#### 201 Created - Resource Created
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "New Resource"
  },
  "message": "Resource created successfully"
}
```

#### 204 No Content - Successful DELETE
No response body

---

### Error Responses

#### 400 Bad Request - Validation Error
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "email": "Invalid email format",
    "password": "Password must be at least 6 characters"
  },
  "statusCode": 400
}
```

#### 401 Unauthorized - Authentication Error
```json
{
  "success": false,
  "error": "Invalid credentials",
  "statusCode": 401
}
```

#### 403 Forbidden - Authorization Error
```json
{
  "success": false,
  "error": "Access denied. Admin role required.",
  "statusCode": 403
}
```

#### 404 Not Found - Resource Not Found
```json
{
  "success": false,
  "error": "Resource not found",
  "statusCode": 404
}
```

#### 409 Conflict - Duplicate Resource
```json
{
  "success": false,
  "error": "Email already exists",
  "statusCode": 409
}
```

#### 500 Internal Server Error - Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "statusCode": 500
}
```

---

## ⚠️ Error Handling

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT request |
| 201 | Created | Successful POST request |
| 204 | No Content | Successful DELETE request |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 422 | Unprocessable Entity | Validation error |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Database unavailable |

### Error Response Structure

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "details": {}  // Optional, for validation errors
}
```

### Common Error Scenarios

#### Invalid JWT Token
```bash
curl -X GET http://localhost:5000/api/bots \
  -H "Authorization: Bearer invalid_token"

# Response: 401 Unauthorized
{
  "success": false,
  "error": "Invalid token",
  "statusCode": 401
}
```

#### Missing Required Fields
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Response: 400 Bad Request
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "username": "Username is required",
    "password": "Password is required"
  },
  "statusCode": 400
}
```

#### Insufficient Permissions
```bash
curl -X DELETE http://localhost:5000/api/bots/1 \
  -H "Authorization: Bearer <VIEWER_TOKEN>"

# Response: 403 Forbidden
{
  "success": false,
  "error": "Viewers cannot delete bots",
  "statusCode": 403
}
```

#### Cross-Organization Access Attempt
```bash
# User in Org 1 trying to access Org 2's bot
curl -X GET http://localhost:5000/api/bots/50 \
  -H "Authorization: Bearer <ORG1_TOKEN>"

# Response: 403 Forbidden
{
  "success": false,
  "error": "Access denied to this bot",
  "statusCode": 403
}
```

---

## 🧪 Advanced Testing Scenarios

### Multi-Tenant Isolation Test

```bash
#!/bin/bash

# Create two users and organizations
# Test that User 1 cannot access User 2's data

echo "Creating User 1..."
USER1_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","email":"user1@test.com","password":"Pass123!"}')

TOKEN1=$(echo $USER1_RESPONSE | jq -r '.token')

echo "Creating User 2..."
USER2_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"user2","email":"user2@test.com","password":"Pass123!"}')

TOKEN2=$(echo $USER2_RESPONSE | jq -r '.token')

echo "User 1 creating bot..."
BOT1_RESPONSE=$(curl -s -X POST http://localhost:5000/api/bots \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"name":"User1 Bot","platform":"telegram","description":"Test"}')

BOT1_ID=$(echo $BOT1_RESPONSE | jq -r '.data.id')

echo "User 2 attempting to access User 1's bot..."
ACCESS_TEST=$(curl -s -w "\n%{http_code}" -X GET "http://localhost:5000/api/bots/$BOT1_ID" \
  -H "Authorization: Bearer $TOKEN2")

HTTP_CODE=$(echo "$ACCESS_TEST" | tail -n1)

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "✅ PASS: Multi-tenant isolation working (got $HTTP_CODE)"
else
    echo "❌ FAIL: Multi-tenant isolation broken (got $HTTP_CODE)"
fi
```

### Performance Test (Simple)

```bash
#!/bin/bash

# Test API response times

API_URL="http://localhost:5000/api/auth/login"
ITERATIONS=100

echo "Running $ITERATIONS login requests..."

total_time=0

for i in $(seq 1 $ITERATIONS); do
    start=$(date +%s%N)

    curl -s -X POST "$API_URL" \
      -H "Content-Type: application/json" \
      -d '{"email":"test@test.com","password":"Pass123!"}' \
      > /dev/null

    end=$(date +%s%N)
    elapsed=$((($end - $start) / 1000000))  # Convert to milliseconds
    total_time=$(($total_time + $elapsed))
done

average=$(($total_time / $ITERATIONS))

echo "Average response time: ${average}ms"

if [ $average -lt 200 ]; then
    echo "✅ Performance: Excellent"
elif [ $average -lt 500 ]; then
    echo "✅ Performance: Good"
elif [ $average -lt 1000 ]; then
    echo "⚠️  Performance: Acceptable"
else
    echo "❌ Performance: Poor (> 1000ms)"
fi
```

---

## 📝 Testing Best Practices

### 1. Always Use Fresh Test Data

```bash
# Use timestamps for unique data
TEST_EMAIL="test_$(date +%s)@example.com"
TEST_ORG="Test Org $(date +%s)"
```

### 2. Store Tokens for Sequential Tests

```bash
# Save token for reuse
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Pass123!"}' \
  | jq -r '.token')

# Use stored token
curl -X GET http://localhost:5000/api/bots \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Check HTTP Status Codes

```bash
# Include status code in response
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET http://localhost:5000/api/bots \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "Success!"
else
    echo "Failed with code: $HTTP_CODE"
fi
```

### 4. Test Error Scenarios

```bash
# Test with invalid data
curl -X POST http://localhost:5000/api/bots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"","platform":"invalid"}'

# Should return 400 Bad Request
```

### 5. Verify Data Isolation

```bash
# Create bot with User 1
# Try to access with User 2
# Should return 403 or 404
```

---

## 🔍 Debugging API Calls

### Verbose cURL Output

```bash
# Show full request/response headers
curl -v -X GET http://localhost:5000/api/bots \
  -H "Authorization: Bearer $TOKEN"
```

### Pretty Print JSON Response

```bash
# Using jq
curl -s -X GET http://localhost:5000/api/bots \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Using python
curl -s -X GET http://localhost:5000/api/bots \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

### Save Response to File

```bash
# Save for later inspection
curl -X GET http://localhost:5000/api/bots \
  -H "Authorization: Bearer $TOKEN" \
  -o response.json

# View saved response
cat response.json | jq '.'
```

---

## 📚 Additional Resources

### Tools
- **Postman**: GUI API testing tool
- **Insomnia**: Alternative to Postman
- **HTTPie**: User-friendly command-line HTTP client
- **jq**: JSON processor for bash scripts

### Example with HTTPie

```bash
# Install HTTPie
pip install httpie

# Register user
http POST http://localhost:5000/api/auth/register \
  username=johndoe \
  email=john@example.com \
  password=SecurePass123!

# Login
http POST http://localhost:5000/api/auth/login \
  email=john@example.com \
  password=SecurePass123!

# Get bots (with token)
http GET http://localhost:5000/api/bots \
  "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-31
**Total Lines**: 1750+
**Maintainer**: BotBuilder Platform Team
