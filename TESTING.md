# 🧪 BotBuilder Platform - Comprehensive Testing Guide

## 📋 Table of Contents

- [Overview](#overview)
- [Test Environment Setup](#test-environment-setup)
- [Test Data Preparation](#test-data-preparation)
- [User Registration & Login Testing](#user-registration--login-testing)
- [Organization Management Testing](#organization-management-testing)
- [Organization Switching Testing](#organization-switching-testing)
- [Member Management Testing](#member-management-testing)
- [Role-Based Access Control Testing](#role-based-access-control-testing)
- [Bot CRUD Operations Testing](#bot-crud-operations-testing)
- [Multi-Tenant Data Isolation Testing](#multi-tenant-data-isolation-testing)
- [Edge Cases & Error Scenarios](#edge-cases--error-scenarios)
- [Performance Testing](#performance-testing)
- [Test Coverage Matrix](#test-coverage-matrix)
- [Test Results Documentation](#test-results-documentation)

---

## 🎯 Overview

This document provides comprehensive manual testing procedures for the BotBuilder Platform's RBAC (Role-Based Access Control) and Multi-Tenant system. The testing suite ensures that:

- ✅ Users can register and authenticate securely
- ✅ Organizations are created and managed properly
- ✅ Multi-tenant data isolation is enforced
- ✅ Role-based permissions are correctly applied
- ✅ Organization members can be managed effectively
- ✅ Bot operations respect organizational boundaries
- ✅ Edge cases and error scenarios are handled gracefully

### Testing Methodology

- **Black Box Testing**: Testing from user perspective without knowledge of internal implementation
- **White Box Testing**: Testing with knowledge of code structure and database schema
- **Integration Testing**: Testing interactions between different system components
- **Security Testing**: Ensuring proper access control and data isolation

---

## 🔧 Test Environment Setup

### Prerequisites

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env

# 3. Configure database
DATABASE_URL=postgresql://user:password@localhost:5432/botbuilder_test

# 4. Run migrations
npm run migrate

# 5. Start the server
npm start
```

### Required Tools

- **Postman** or **Insomnia** - API testing
- **Browser DevTools** - Network inspection
- **Database Client** - pgAdmin or DBeaver
- **Terminal** - Command-line testing with curl

### Test Database Setup

```sql
-- Create test database
CREATE DATABASE botbuilder_test;

-- Verify tables exist
\dt

-- Expected tables:
-- - users
-- - organizations
-- - organization_members
-- - bots
-- - messages
-- - flows
```

### Environment Configuration

```env
NODE_ENV=test
PORT=5000
JWT_SECRET=your-test-secret-key
DATABASE_URL=postgresql://user:password@localhost:5432/botbuilder_test
CORS_ORIGIN=http://localhost:3000
```

---

## 📊 Test Data Preparation

### Create Test Users

Prepare multiple test user accounts with different roles:

```javascript
// Test Users Data
const testUsers = [
  {
    username: "admin_user",
    email: "admin@test.com",
    password: "Admin123!@#"
  },
  {
    username: "member_user",
    email: "member@test.com",
    password: "Member123!@#"
  },
  {
    username: "viewer_user",
    email: "viewer@test.com",
    password: "Viewer123!@#"
  },
  {
    username: "owner_user",
    email: "owner@test.com",
    password: "Owner123!@#"
  },
  {
    username: "isolated_user",
    email: "isolated@test.com",
    password: "Isolated123!@#"
  }
];
```

### Create Test Organizations

```javascript
// Test Organizations Data
const testOrganizations = [
  {
    name: "Test Org Alpha",
    description: "Primary test organization"
  },
  {
    name: "Test Org Beta",
    description: "Secondary test organization"
  },
  {
    name: "Test Org Gamma",
    description: "Isolation test organization"
  }
];
```

### Create Test Bots

```javascript
// Test Bots Data
const testBots = [
  {
    name: "Customer Support Bot",
    platform: "telegram",
    description: "Handles customer inquiries"
  },
  {
    name: "Sales Bot",
    platform: "whatsapp",
    description: "Manages sales conversations"
  },
  {
    name: "Marketing Bot",
    platform: "slack",
    description: "Automates marketing tasks"
  }
];
```

---

## 👤 User Registration & Login Testing

### Test Case 1.1: Successful User Registration

**Test ID**: AUTH-REG-001
**Priority**: High
**Category**: Authentication

**Preconditions**:
- Server is running
- Database is accessible
- Email does not exist in database

**Test Steps**:
1. Send POST request to `/api/auth/register`
2. Include valid user data:
   ```json
   {
     "username": "newuser123",
     "email": "newuser@test.com",
     "password": "SecurePass123!@#"
   }
   ```
3. Check response status code
4. Verify response contains JWT token
5. Check database for new user record
6. Verify default organization was created
7. Verify user is added as admin to default organization

**Expected Results**:
- ✅ Status Code: 201 Created
- ✅ Response contains: `{ token, user { id, username, email } }`
- ✅ User record exists in `users` table
- ✅ Default organization created with pattern: `{username}'s Organization`
- ✅ Organization member record created with role 'admin'
- ✅ Password is hashed (not stored in plain text)
- ✅ JWT token is valid and can be decoded

**Validation Queries**:
```sql
-- Check user was created
SELECT * FROM users WHERE email = 'newuser@test.com';

-- Check default organization
SELECT * FROM organizations WHERE name LIKE '%newuser123%';

-- Check membership
SELECT om.*, o.name
FROM organization_members om
JOIN organizations o ON om.organization_id = o.id
WHERE om.user_id = (SELECT id FROM users WHERE email = 'newuser@test.com');
```

---

### Test Case 1.2: Registration with Duplicate Email

**Test ID**: AUTH-REG-002
**Priority**: High
**Category**: Authentication - Validation

**Preconditions**:
- User with email `existing@test.com` already exists

**Test Steps**:
1. Attempt to register with existing email
2. Send POST request with duplicate email
3. Check response status and error message

**Test Data**:
```json
{
  "username": "differentuser",
  "email": "existing@test.com",
  "password": "AnotherPass123!@#"
}
```

**Expected Results**:
- ✅ Status Code: 400 Bad Request
- ✅ Error message: "Email already exists" or similar
- ✅ No new user created in database
- ✅ No new organization created

---

### Test Case 1.3: Registration with Invalid Email Format

**Test ID**: AUTH-REG-003
**Priority**: Medium
**Category**: Authentication - Input Validation

**Test Steps**:
1. Attempt registration with invalid email formats
2. Test multiple invalid formats

**Test Data**:
```json
// Invalid formats to test
[
  { "email": "notanemail" },
  { "email": "missing@domain" },
  { "email": "@nodomain.com" },
  { "email": "spaces in@email.com" },
  { "email": "" }
]
```

**Expected Results**:
- ✅ Status Code: 400 Bad Request
- ✅ Error indicates invalid email format
- ✅ No user created in database

---

### Test Case 1.4: Registration with Weak Password

**Test ID**: AUTH-REG-004
**Priority**: High
**Category**: Authentication - Security

**Test Steps**:
1. Attempt registration with passwords that don't meet requirements
2. Test various weak password patterns

**Test Data**:
```json
// Weak passwords to test
[
  { "password": "12345" },           // Too short
  { "password": "password" },        // No numbers/special chars
  { "password": "Pass1" },           // Too short
  { "password": "          " }       // Only spaces
]
```

**Expected Results**:
- ✅ Status Code: 400 Bad Request
- ✅ Error message describes password requirements
- ✅ Password requirements: minimum 6 characters (or as configured)
- ✅ No user created

---

### Test Case 1.5: Successful User Login

**Test ID**: AUTH-LOGIN-001
**Priority**: High
**Category**: Authentication

**Preconditions**:
- User exists with email `testuser@test.com` and password `TestPass123!@#`

**Test Steps**:
1. Send POST request to `/api/auth/login`
2. Provide valid credentials
3. Verify response

**Test Data**:
```json
{
  "email": "testuser@test.com",
  "password": "TestPass123!@#"
}
```

**Expected Results**:
- ✅ Status Code: 200 OK
- ✅ Response contains JWT token
- ✅ Response contains user data (id, username, email)
- ✅ Token can be decoded and contains user ID
- ✅ Token expiration is set appropriately
- ✅ No password returned in response

---

### Test Case 1.6: Login with Incorrect Password

**Test ID**: AUTH-LOGIN-002
**Priority**: High
**Category**: Authentication - Security

**Test Steps**:
1. Attempt login with correct email but wrong password
2. Verify error handling

**Test Data**:
```json
{
  "email": "testuser@test.com",
  "password": "WrongPassword123"
}
```

**Expected Results**:
- ✅ Status Code: 401 Unauthorized
- ✅ Error message: "Invalid credentials" (generic, not revealing which is wrong)
- ✅ No token issued
- ✅ Response time similar to successful login (prevent timing attacks)

---

### Test Case 1.7: Login with Non-existent Email

**Test ID**: AUTH-LOGIN-003
**Priority**: Medium
**Category**: Authentication - Security

**Test Data**:
```json
{
  "email": "nonexistent@test.com",
  "password": "SomePassword123"
}
```

**Expected Results**:
- ✅ Status Code: 401 Unauthorized
- ✅ Generic error message (same as wrong password)
- ✅ No user enumeration possible

---

### Test Case 1.8: Login with Missing Credentials

**Test ID**: AUTH-LOGIN-004
**Priority**: Medium
**Category**: Authentication - Input Validation

**Test Data to Test**:
```json
// Test each scenario separately
{ "email": "user@test.com" }              // Missing password
{ "password": "Pass123" }                  // Missing email
{}                                         // Missing both
```

**Expected Results**:
- ✅ Status Code: 400 Bad Request
- ✅ Error indicates missing required fields
- ✅ No authentication attempted

---

## 🏢 Organization Management Testing

### Test Case 2.1: View User's Organizations

**Test ID**: ORG-LIST-001
**Priority**: High
**Category**: Organization Management

**Preconditions**:
- User is logged in
- User belongs to at least one organization

**Test Steps**:
1. Send GET request to `/api/organizations`
2. Include valid JWT token in Authorization header
3. Verify response contains organizations

**Request**:
```bash
curl -X GET http://localhost:5000/api/organizations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Results**:
- ✅ Status Code: 200 OK
- ✅ Response is array of organizations
- ✅ Each organization includes:
  - id, name, description
  - role (admin/member/viewer)
  - created_at, updated_at
- ✅ Only organizations user belongs to are returned
- ✅ Results sorted by name or creation date

---

### Test Case 2.2: Create New Organization

**Test ID**: ORG-CREATE-001
**Priority**: High
**Category**: Organization Management

**Preconditions**:
- User is authenticated

**Test Steps**:
1. Send POST request to `/api/organizations`
2. Provide organization details
3. Verify organization is created
4. Verify user is added as admin

**Test Data**:
```json
{
  "name": "My New Company",
  "description": "A test organization for our team"
}
```

**Expected Results**:
- ✅ Status Code: 201 Created
- ✅ Response contains new organization object
- ✅ Organization has unique ID
- ✅ Creator is automatically added as admin
- ✅ Organization exists in database
- ✅ Membership record created with role 'admin'

**Validation**:
```sql
-- Check organization
SELECT * FROM organizations WHERE name = 'My New Company';

-- Check membership
SELECT * FROM organization_members
WHERE organization_id = ? AND user_id = ? AND role = 'admin';
```

---

### Test Case 2.3: Create Organization with Duplicate Name

**Test ID**: ORG-CREATE-002
**Priority**: Medium
**Category**: Organization Management - Validation

**Preconditions**:
- Organization named "Existing Org" already exists

**Test Steps**:
1. Attempt to create organization with same name
2. Verify error or success (depending on business rules)

**Test Data**:
```json
{
  "name": "Existing Org",
  "description": "Duplicate name test"
}
```

**Expected Results** (Choose based on requirements):
- **Option A** (Unique names required):
  - ✅ Status Code: 400 Bad Request
  - ✅ Error: "Organization name already exists"
- **Option B** (Duplicate names allowed):
  - ✅ Status Code: 201 Created
  - ✅ New organization created with same name but different ID

---

### Test Case 2.4: Create Organization with Invalid Data

**Test ID**: ORG-CREATE-003
**Priority**: Medium
**Category**: Organization Management - Input Validation

**Test Data to Test**:
```json
// Test each separately
{ "name": "" }                             // Empty name
{ "name": "   " }                          // Only whitespace
{ "description": "Missing name" }          // No name field
{ "name": "A" }                            // Too short (if min length enforced)
{ "name": "X".repeat(256) }                // Too long
```

**Expected Results**:
- ✅ Status Code: 400 Bad Request
- ✅ Descriptive validation error message
- ✅ No organization created

---

### Test Case 2.5: Get Organization Details

**Test ID**: ORG-GET-001
**Priority**: High
**Category**: Organization Management

**Preconditions**:
- User is member of organization with ID 5

**Test Steps**:
1. Send GET request to `/api/organizations/:id`
2. Verify response contains full organization details

**Request**:
```bash
curl -X GET http://localhost:5000/api/organizations/5 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Results**:
- ✅ Status Code: 200 OK
- ✅ Response contains organization details:
  - id, name, description
  - created_at, updated_at
  - User's role in organization
  - Member count (optional)

---

### Test Case 2.6: Get Organization Details - Unauthorized

**Test ID**: ORG-GET-002
**Priority**: High
**Category**: Organization Management - Security

**Preconditions**:
- User is NOT a member of organization with ID 99

**Test Steps**:
1. Attempt to access organization details
2. Verify access is denied

**Expected Results**:
- ✅ Status Code: 403 Forbidden
- ✅ Error message: "Access denied" or "Not a member"
- ✅ No organization data leaked

---

### Test Case 2.7: Update Organization Details

**Test ID**: ORG-UPDATE-001
**Priority**: High
**Category**: Organization Management

**Preconditions**:
- User is admin of organization
- Organization ID is 5

**Test Steps**:
1. Send PUT request to `/api/organizations/:id`
2. Update organization name and description
3. Verify changes are saved

**Test Data**:
```json
{
  "name": "Updated Organization Name",
  "description": "Updated description for testing"
}
```

**Expected Results**:
- ✅ Status Code: 200 OK
- ✅ Response contains updated organization
- ✅ Changes persisted in database
- ✅ updated_at timestamp changed

---

### Test Case 2.8: Update Organization - Non-Admin User

**Test ID**: ORG-UPDATE-002
**Priority**: High
**Category**: Organization Management - Authorization

**Preconditions**:
- User has 'member' or 'viewer' role (not admin)

**Test Steps**:
1. Attempt to update organization as non-admin
2. Verify operation is rejected

**Expected Results**:
- ✅ Status Code: 403 Forbidden
- ✅ Error: "Insufficient permissions" or "Admin access required"
- ✅ No changes made to organization

---

### Test Case 2.9: Delete Organization

**Test ID**: ORG-DELETE-001
**Priority**: Medium
**Category**: Organization Management

**Note**: Implement only if deletion is supported

**Preconditions**:
- User is admin/owner of organization
- Organization has ID 10

**Test Steps**:
1. Send DELETE request to `/api/organizations/:id`
2. Verify organization is deleted or archived
3. Check cascading effects

**Expected Results**:
- ✅ Status Code: 200 OK or 204 No Content
- ✅ Organization marked as deleted/archived
- ✅ Members notified (if applicable)
- ✅ Associated bots handled appropriately (deleted/archived/reassigned)
- ✅ Data retention policies followed

---

## 🔄 Organization Switching Testing

### Test Case 3.1: Switch to Valid Organization

**Test ID**: ORG-SWITCH-001
**Priority**: High
**Category**: Organization Context

**Preconditions**:
- User is member of multiple organizations
- User has organizationId 5 available

**Test Steps**:
1. Send POST request to `/api/organizations/switch`
2. Provide target organization ID
3. Verify context switch is successful

**Test Data**:
```json
{
  "organizationId": 5
}
```

**Expected Results**:
- ✅ Status Code: 200 OK
- ✅ Response confirms successful switch
- ✅ New JWT token issued with updated context (if token-based)
- ✅ Session updated with new organization (if session-based)
- ✅ Subsequent API calls use new organization context

**Validation**:
```bash
# After switching, verify context
curl -X GET http://localhost:5000/api/bots \
  -H "Authorization: Bearer NEW_TOKEN"

# Should return bots from organizationId 5 only
```

---

### Test Case 3.2: Switch to Unauthorized Organization

**Test ID**: ORG-SWITCH-002
**Priority**: High
**Category**: Organization Context - Security

**Preconditions**:
- User is NOT a member of organization ID 99

**Test Steps**:
1. Attempt to switch to organization user doesn't belong to
2. Verify operation is rejected

**Test Data**:
```json
{
  "organizationId": 99
}
```

**Expected Results**:
- ✅ Status Code: 403 Forbidden
- ✅ Error: "Access denied" or "Not a member of this organization"
- ✅ Context remains unchanged
- ✅ No new token issued

---

### Test Case 3.3: Switch to Non-existent Organization

**Test ID**: ORG-SWITCH-003
**Priority**: Medium
**Category**: Organization Context - Validation

**Test Data**:
```json
{
  "organizationId": 999999
}
```

**Expected Results**:
- ✅ Status Code: 404 Not Found
- ✅ Error: "Organization not found"
- ✅ Context unchanged

---

### Test Case 3.4: Switch with Invalid Organization ID

**Test ID**: ORG-SWITCH-004
**Priority**: Low
**Category**: Organization Context - Input Validation

**Test Data to Test**:
```json
// Test each separately
{ "organizationId": "not-a-number" }
{ "organizationId": -1 }
{ "organizationId": null }
{ }  // Missing organizationId
```

**Expected Results**:
- ✅ Status Code: 400 Bad Request
- ✅ Error describes validation issue
- ✅ Context unchanged

---

## 👥 Member Management Testing

### Test Case 4.1: List Organization Members

**Test ID**: MEMBER-LIST-001
**Priority**: High
**Category**: Member Management

**Preconditions**:
- User is member of organization ID 5
- Organization has multiple members

**Test Steps**:
1. Send GET request to `/api/organizations/:id/members`
2. Verify all members are listed

**Request**:
```bash
curl -X GET http://localhost:5000/api/organizations/5/members \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Results**:
- ✅ Status Code: 200 OK
- ✅ Response is array of member objects
- ✅ Each member includes:
  - user_id, username, email
  - role (admin/member/viewer)
  - joined_at
- ✅ Sensitive data (passwords) not included
- ✅ Results sorted by role or join date

---

### Test Case 4.2: Invite New Member (Add Member)

**Test ID**: MEMBER-ADD-001
**Priority**: High
**Category**: Member Management

**Preconditions**:
- User is admin of organization
- Target user exists with email `newmember@test.com`

**Test Steps**:
1. Send POST request to `/api/organizations/:id/members`
2. Specify user email and role
3. Verify member is added

**Test Data**:
```json
{
  "email": "newmember@test.com",
  "role": "member"
}
```

**Expected Results**:
- ✅ Status Code: 201 Created
- ✅ Response contains new membership details
- ✅ Member added to organization_members table
- ✅ User receives invitation notification (if implemented)
- ✅ User can now access organization

**Validation**:
```sql
SELECT * FROM organization_members
WHERE organization_id = 5
  AND user_id = (SELECT id FROM users WHERE email = 'newmember@test.com');
```

---

### Test Case 4.3: Invite Member - Non-Admin User

**Test ID**: MEMBER-ADD-002
**Priority**: High
**Category**: Member Management - Authorization

**Preconditions**:
- User has 'member' or 'viewer' role (not admin)

**Test Steps**:
1. Attempt to add member as non-admin
2. Verify operation is rejected

**Expected Results**:
- ✅ Status Code: 403 Forbidden
- ✅ Error: "Only admins can add members"
- ✅ No member added

---

### Test Case 4.4: Invite Non-existent User

**Test ID**: MEMBER-ADD-003
**Priority**: Medium
**Category**: Member Management - Validation

**Test Data**:
```json
{
  "email": "nonexistent@test.com",
  "role": "member"
}
```

**Expected Results** (Choose based on implementation):
- **Option A** (User must exist):
  - ✅ Status Code: 404 Not Found
  - ✅ Error: "User not found"
- **Option B** (Invitation system):
  - ✅ Status Code: 201 Created
  - ✅ Invitation sent to email
  - ✅ Pending invitation record created

---

### Test Case 4.5: Invite Duplicate Member

**Test ID**: MEMBER-ADD-004
**Priority**: Medium
**Category**: Member Management - Validation

**Preconditions**:
- User `existing@test.com` is already member of organization

**Test Steps**:
1. Attempt to add same user again
2. Verify duplicate is prevented

**Test Data**:
```json
{
  "email": "existing@test.com",
  "role": "member"
}
```

**Expected Results**:
- ✅ Status Code: 400 Bad Request
- ✅ Error: "User is already a member"
- ✅ No duplicate membership created

---

### Test Case 4.6: Update Member Role

**Test ID**: MEMBER-UPDATE-001
**Priority**: High
**Category**: Member Management

**Preconditions**:
- User is admin of organization
- Target member exists with user ID 15

**Test Steps**:
1. Send PUT request to `/api/organizations/:orgId/members/:userId`
2. Update member's role
3. Verify role change is applied

**Test Data**:
```json
{
  "role": "admin"
}
```

**Expected Results**:
- ✅ Status Code: 200 OK
- ✅ Response contains updated membership
- ✅ Role updated in database
- ✅ Member's permissions updated immediately
- ✅ Audit log created (if implemented)

---

### Test Case 4.7: Update Member Role - Invalid Role

**Test ID**: MEMBER-UPDATE-002
**Priority**: Medium
**Category**: Member Management - Validation

**Test Data to Test**:
```json
// Test each separately
{ "role": "superadmin" }    // Invalid role name
{ "role": "ADMIN" }         // Wrong case (if case-sensitive)
{ "role": "" }              // Empty role
{ "role": null }            // Null role
```

**Expected Results**:
- ✅ Status Code: 400 Bad Request
- ✅ Error describes valid role options
- ✅ Valid roles: admin, member, viewer
- ✅ No changes made

---

### Test Case 4.8: Update Member Role - Non-Admin

**Test ID**: MEMBER-UPDATE-003
**Priority**: High
**Category**: Member Management - Authorization

**Preconditions**:
- User is 'member' or 'viewer' (not admin)

**Test Steps**:
1. Attempt to update another member's role
2. Verify operation is rejected

**Expected Results**:
- ✅ Status Code: 403 Forbidden
- ✅ Error: "Only admins can update roles"
- ✅ No changes made

---

### Test Case 4.9: Remove Organization Member

**Test ID**: MEMBER-REMOVE-001
**Priority**: High
**Category**: Member Management

**Preconditions**:
- User is admin of organization
- Target member exists with user ID 20

**Test Steps**:
1. Send DELETE request to `/api/organizations/:orgId/members/:userId`
2. Verify member is removed
3. Check member loses access

**Request**:
```bash
curl -X DELETE http://localhost:5000/api/organizations/5/members/20 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Expected Results**:
- ✅ Status Code: 200 OK or 204 No Content
- ✅ Membership record deleted from database
- ✅ User can no longer access organization
- ✅ User's other memberships unaffected
- ✅ Notification sent to removed user (if implemented)

**Validation**:
```sql
-- Verify membership removed
SELECT * FROM organization_members
WHERE organization_id = 5 AND user_id = 20;
-- Should return 0 rows
```

---

### Test Case 4.10: Remove Last Admin

**Test ID**: MEMBER-REMOVE-002
**Priority**: High
**Category**: Member Management - Business Logic

**Preconditions**:
- Organization has only one admin
- Attempting to remove that admin

**Test Steps**:
1. Attempt to remove the last admin
2. Verify operation is prevented

**Expected Results**:
- ✅ Status Code: 400 Bad Request
- ✅ Error: "Cannot remove last admin" or similar
- ✅ Admin remains in organization
- ✅ Suggestion to transfer ownership or add another admin first

---

### Test Case 4.11: Member Self-Removal

**Test ID**: MEMBER-REMOVE-003
**Priority**: Medium
**Category**: Member Management

**Test Steps**:
1. User attempts to remove themselves from organization
2. Verify behavior based on role

**Expected Results** (Choose based on requirements):
- **If user is not last admin**:
  - ✅ Status Code: 200 OK
  - ✅ User successfully leaves organization
- **If user is last admin**:
  - ✅ Status Code: 400 Bad Request
  - ✅ Error: "Transfer ownership before leaving"

---

## 🔐 Role-Based Access Control Testing

### Test Case 5.1: Admin Role - Full Access

**Test ID**: RBAC-ADMIN-001
**Priority**: High
**Category**: RBAC

**Preconditions**:
- User has 'admin' role in organization

**Test Steps** - Verify admin can:
1. ✅ View all organization bots
2. ✅ Create new bots
3. ✅ Update existing bots
4. ✅ Delete bots
5. ✅ View organization members
6. ✅ Add new members
7. ✅ Update member roles
8. ✅ Remove members
9. ✅ Update organization settings
10. ✅ View flows and messages

**Verification Method**:
- Perform each action listed above
- All should return success (200/201)
- No 403 Forbidden errors

---

### Test Case 5.2: Member Role - Limited Access

**Test ID**: RBAC-MEMBER-001
**Priority**: High
**Category**: RBAC

**Preconditions**:
- User has 'member' role in organization

**Test Steps** - Verify member can:
1. ✅ View organization bots
2. ✅ Create new bots
3. ✅ Update bots they created
4. ✅ Delete bots they created
5. ✅ View flows and messages for their bots

**Test Steps** - Verify member CANNOT:
1. ❌ Delete other members' bots (403)
2. ❌ Add new organization members (403)
3. ❌ Update member roles (403)
4. ❌ Remove organization members (403)
5. ❌ Update organization settings (403)

---

### Test Case 5.3: Viewer Role - Read-Only Access

**Test ID**: RBAC-VIEWER-001
**Priority**: High
**Category**: RBAC

**Preconditions**:
- User has 'viewer' role in organization

**Test Steps** - Verify viewer can:
1. ✅ View organization bots (200)
2. ✅ View bot details (200)
3. ✅ View flows (200)
4. ✅ View messages (200)

**Test Steps** - Verify viewer CANNOT:
1. ❌ Create bots (403)
2. ❌ Update bots (403)
3. ❌ Delete bots (403)
4. ❌ Create flows (403)
5. ❌ Update flows (403)
6. ❌ Delete flows (403)
7. ❌ Manage members (403)
8. ❌ Update organization (403)

---

### Test Case 5.4: Permission Enforcement Across All Endpoints

**Test ID**: RBAC-ENFORCE-001
**Priority**: Critical
**Category**: RBAC - Comprehensive

**Test Matrix**:

| Endpoint | Admin | Member | Viewer |
|----------|-------|--------|--------|
| GET /api/bots | ✅ | ✅ | ✅ |
| POST /api/bots | ✅ | ✅ | ❌ |
| PUT /api/bots/:id (own) | ✅ | ✅ | ❌ |
| PUT /api/bots/:id (others') | ✅ | ❌ | ❌ |
| DELETE /api/bots/:id (own) | ✅ | ✅ | ❌ |
| DELETE /api/bots/:id (others') | ✅ | ❌ | ❌ |
| GET /api/organizations/:id/members | ✅ | ✅ | ✅ |
| POST /api/organizations/:id/members | ✅ | ❌ | ❌ |
| PUT /api/organizations/:id/members/:uid | ✅ | ❌ | ❌ |
| DELETE /api/organizations/:id/members/:uid | ✅ | ❌ | ❌ |
| PUT /api/organizations/:id | ✅ | ❌ | ❌ |

**Test each cell in the matrix**

---

## 🤖 Bot CRUD Operations Testing

### Test Case 6.1: Create Bot in Current Organization

**Test ID**: BOT-CREATE-001
**Priority**: High
**Category**: Bot Management

**Preconditions**:
- User is authenticated
- User has 'admin' or 'member' role
- Current organization context set

**Test Steps**:
1. Send POST request to `/api/bots`
2. Include bot details
3. Verify bot is created in correct organization

**Test Data**:
```json
{
  "name": "Support Bot Alpha",
  "platform": "telegram",
  "description": "Handles level 1 support queries"
}
```

**Expected Results**:
- ✅ Status Code: 201 Created
- ✅ Response contains bot object with ID
- ✅ Bot associated with current organization
- ✅ Bot owner is current user
- ✅ Bot exists in database with correct organization_id

**Validation**:
```sql
SELECT b.*, o.name as org_name
FROM bots b
JOIN organizations o ON b.organization_id = o.id
WHERE b.id = ?;
```

---

### Test Case 6.2: List Bots - Organization Isolation

**Test ID**: BOT-LIST-001
**Priority**: Critical
**Category**: Multi-Tenant Isolation

**Preconditions**:
- Multiple organizations exist with bots
- User belongs to organization ID 5
- Organization 5 has 3 bots
- Organization 6 has 5 bots

**Test Steps**:
1. Set context to organization 5
2. Send GET request to `/api/bots`
3. Verify only organization 5's bots returned

**Expected Results**:
- ✅ Status Code: 200 OK
- ✅ Response contains exactly 3 bots
- ✅ All bots have organization_id = 5
- ✅ No bots from organization 6 included
- ✅ No cross-tenant data leakage

**Critical Security Check**:
```sql
-- Manual verification
SELECT COUNT(*) FROM bots WHERE organization_id = 5;  -- Should match response count
SELECT COUNT(*) FROM bots WHERE organization_id = 6;  -- Should NOT be in response
```

---

### Test Case 6.3: Get Bot Details - Same Organization

**Test ID**: BOT-GET-001
**Priority**: High
**Category**: Bot Management

**Preconditions**:
- Bot with ID 10 belongs to user's current organization

**Test Steps**:
1. Send GET request to `/api/bots/:id`
2. Verify bot details returned

**Expected Results**:
- ✅ Status Code: 200 OK
- ✅ Response contains full bot details
- ✅ Includes: id, name, platform, description, organization_id, created_at

---

### Test Case 6.4: Get Bot Details - Different Organization

**Test ID**: BOT-GET-002
**Priority**: Critical
**Category**: Multi-Tenant Isolation

**Preconditions**:
- Bot with ID 50 belongs to different organization
- User is NOT member of that organization

**Test Steps**:
1. Attempt to access bot from different organization
2. Verify access is denied

**Expected Results**:
- ✅ Status Code: 403 Forbidden or 404 Not Found
- ✅ Error: "Access denied" or "Bot not found"
- ✅ No bot details leaked
- ✅ Cannot infer bot existence in other organization

---

### Test Case 6.5: Update Bot - Owner

**Test ID**: BOT-UPDATE-001
**Priority**: High
**Category**: Bot Management

**Preconditions**:
- User created bot with ID 15
- Bot belongs to current organization

**Test Steps**:
1. Send PUT request to `/api/bots/:id`
2. Update bot details
3. Verify changes saved

**Test Data**:
```json
{
  "name": "Updated Bot Name",
  "platform": "whatsapp",
  "description": "Updated description"
}
```

**Expected Results**:
- ✅ Status Code: 200 OK
- ✅ Response contains updated bot
- ✅ Changes persisted in database
- ✅ updated_at timestamp changed

---

### Test Case 6.6: Update Bot - Admin (Not Owner)

**Test ID**: BOT-UPDATE-002
**Priority**: High
**Category**: Bot Management - Authorization

**Preconditions**:
- User is admin of organization
- Bot created by different user in same organization

**Test Steps**:
1. Admin attempts to update bot they didn't create
2. Verify admin can update

**Expected Results**:
- ✅ Status Code: 200 OK
- ✅ Admins can update any bot in their organization
- ✅ Changes applied successfully

---

### Test Case 6.7: Update Bot - Member (Not Owner)

**Test ID**: BOT-UPDATE-003
**Priority**: High
**Category**: Bot Management - Authorization

**Preconditions**:
- User is member (not admin)
- Bot created by different user

**Test Steps**:
1. Member attempts to update bot they didn't create
2. Verify operation is rejected

**Expected Results**:
- ✅ Status Code: 403 Forbidden
- ✅ Error: "You can only update your own bots" or similar
- ✅ No changes made

---

### Test Case 6.8: Delete Bot - Owner

**Test ID**: BOT-DELETE-001
**Priority**: High
**Category**: Bot Management

**Preconditions**:
- User created bot with ID 20

**Test Steps**:
1. Send DELETE request to `/api/bots/:id`
2. Verify bot is deleted
3. Check cascading effects

**Expected Results**:
- ✅ Status Code: 200 OK or 204 No Content
- ✅ Bot removed from database (or marked as deleted)
- ✅ Associated flows handled (deleted/archived)
- ✅ Associated messages handled (deleted/archived)
- ✅ Cannot access bot after deletion (404)

---

### Test Case 6.9: Delete Bot - Cross-Organization Attack

**Test ID**: BOT-DELETE-002
**Priority**: Critical
**Category**: Multi-Tenant Security

**Preconditions**:
- Bot with ID 100 belongs to organization A
- User belongs to organization B
- User attempts to delete bot from org A

**Test Steps**:
1. Switch to organization B context
2. Attempt to delete bot from organization A
3. Verify attack is prevented

**Expected Results**:
- ✅ Status Code: 403 Forbidden or 404 Not Found
- ✅ Bot NOT deleted
- ✅ Error logged for security monitoring
- ✅ No information about bot leaked

---

## 🔒 Multi-Tenant Data Isolation Testing

### Test Case 7.1: Complete Data Isolation Verification

**Test ID**: ISOLATION-001
**Priority**: Critical
**Category**: Multi-Tenant Security

**Setup**:
```sql
-- Create test scenario
-- Org 1: Alice (admin), Bob (member)
-- Org 2: Charlie (admin), David (member)
-- Each org has 3 bots
```

**Test Matrix**:

| User | Org | Can Access Org 1 Bots | Can Access Org 2 Bots |
|------|-----|----------------------|----------------------|
| Alice | 1 | ✅ All 3 | ❌ None |
| Bob | 1 | ✅ All 3 | ❌ None |
| Charlie | 2 | ❌ None | ✅ All 3 |
| David | 2 | ❌ None | ✅ All 3 |

**Verification Steps for Each User**:
1. Login as user
2. List all bots
3. Attempt to access each bot from their org (should succeed)
4. Attempt to access each bot from other org (should fail)
5. Attempt to update bot from other org (should fail)
6. Attempt to delete bot from other org (should fail)

---

### Test Case 7.2: Organization Switching Data Isolation

**Test ID**: ISOLATION-002
**Priority**: Critical
**Category**: Multi-Tenant Security

**Preconditions**:
- User Alice is member of both Org 1 and Org 2
- Org 1 has bot ID 10
- Org 2 has bot ID 20

**Test Steps**:
1. Login as Alice
2. Switch to Org 1 context
3. List bots (should see bot 10 only)
4. Switch to Org 2 context
5. List bots (should see bot 20 only)
6. Verify bot 10 is NOT accessible while in Org 2 context

**Expected Results**:
- ✅ Context switch correctly filters data
- ✅ No cross-contamination between organizations
- ✅ Each API call respects current organization context

---

### Test Case 7.3: SQL Injection Protection in Multi-Tenant Queries

**Test ID**: ISOLATION-003
**Priority**: Critical
**Category**: Security

**Attack Vectors to Test**:

```json
// Test each injection attempt
{
  "organizationId": "1 OR 1=1"
}
{
  "organizationId": "1; DROP TABLE bots; --"
}
{
  "bot_id": "10 UNION SELECT * FROM bots WHERE organization_id != 1"
}
```

**Expected Results**:
- ✅ All injection attempts rejected
- ✅ Parameterized queries prevent SQL injection
- ✅ Error handling doesn't reveal SQL structure
- ✅ No data from other organizations accessed

---

## ⚠️ Edge Cases & Error Scenarios

### Test Case 8.1: Expired JWT Token

**Test ID**: EDGE-AUTH-001
**Priority**: High
**Category**: Authentication Edge Cases

**Test Steps**:
1. Use expired JWT token
2. Attempt to access protected endpoint

**Expected Results**:
- ✅ Status Code: 401 Unauthorized
- ✅ Error: "Token expired" or similar
- ✅ Prompt to re-authenticate

---

### Test Case 8.2: Malformed JWT Token

**Test ID**: EDGE-AUTH-002
**Priority**: Medium
**Category**: Authentication Edge Cases

**Test Data**:
```bash
# Test with malformed tokens
Authorization: Bearer invalid.token.here
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid
Authorization: Bearer
Authorization: InvalidToken
```

**Expected Results**:
- ✅ Status Code: 401 Unauthorized
- ✅ Error: "Invalid token"
- ✅ No server crash or unhandled exception

---

### Test Case 8.3: Concurrent Organization Modifications

**Test ID**: EDGE-CONCURRENCY-001
**Priority**: Medium
**Category**: Concurrency

**Test Steps**:
1. Two admins attempt to update same organization simultaneously
2. Verify data consistency

**Expected Results**:
- ✅ Both requests processed without error
- ✅ Last write wins (or optimistic locking implemented)
- ✅ No data corruption
- ✅ Consistent database state

---

### Test Case 8.4: Large Payload Handling

**Test ID**: EDGE-PAYLOAD-001
**Priority**: Medium
**Category**: Input Validation

**Test Data**:
```json
{
  "name": "A".repeat(10000),
  "description": "B".repeat(100000)
}
```

**Expected Results**:
- ✅ Request rejected if exceeds limits
- ✅ Status Code: 413 Payload Too Large or 400 Bad Request
- ✅ Clear error message about size limits
- ✅ No server crash or memory issues

---

### Test Case 8.5: Special Characters in Input

**Test ID**: EDGE-INPUT-001
**Priority**: Medium
**Category**: Input Validation

**Test Data**:
```json
{
  "name": "<script>alert('xss')</script>",
  "description": "'; DROP TABLE bots; --",
  "platform": "../../etc/passwd"
}
```

**Expected Results**:
- ✅ Input sanitized appropriately
- ✅ No XSS vulnerabilities
- ✅ No SQL injection
- ✅ No path traversal
- ✅ Data stored safely and displayed safely

---

### Test Case 8.6: Network Timeout Handling

**Test ID**: EDGE-NETWORK-001
**Priority**: Low
**Category**: Network Resilience

**Test Steps**:
1. Simulate slow network connection
2. Send request that takes long time
3. Verify timeout handling

**Expected Results**:
- ✅ Request times out after configured period
- ✅ Status Code: 408 Request Timeout or 504 Gateway Timeout
- ✅ Partial operations rolled back
- ✅ Clear error message to user

---

### Test Case 8.7: Database Connection Loss

**Test ID**: EDGE-DB-001
**Priority**: High
**Category**: Database Resilience

**Test Steps**:
1. Stop database server mid-request
2. Verify error handling

**Expected Results**:
- ✅ Status Code: 503 Service Unavailable
- ✅ Error: "Database unavailable" or similar
- ✅ No sensitive information in error message
- ✅ Application remains stable
- ✅ Automatic reconnection attempted

---

## 📊 Performance Testing

### Test Case 9.1: Load Testing - Concurrent Users

**Test ID**: PERF-LOAD-001
**Priority**: Medium
**Category**: Performance

**Test Parameters**:
- 100 concurrent users
- Each performing 10 requests
- Mix of read/write operations

**Metrics to Measure**:
- ✅ Average response time < 500ms
- ✅ 95th percentile < 1000ms
- ✅ 99th percentile < 2000ms
- ✅ Error rate < 1%
- ✅ No memory leaks
- ✅ Database connection pool stable

---

### Test Case 9.2: Pagination Performance

**Test ID**: PERF-PAGE-001
**Priority**: Medium
**Category**: Performance

**Test Steps**:
1. Create organization with 1000 bots
2. Test pagination with different page sizes
3. Measure response times

**Expected Results**:
- ✅ Page size 10: < 100ms
- ✅ Page size 50: < 200ms
- ✅ Page size 100: < 300ms
- ✅ Consistent performance across pages
- ✅ No N+1 query problems

---

## ✅ Test Coverage Matrix

| Feature Area | Test Cases | Priority | Status |
|--------------|-----------|----------|--------|
| Authentication | 8 | High | ⬜ |
| Organization Management | 9 | High | ⬜ |
| Organization Switching | 4 | High | ⬜ |
| Member Management | 11 | High | ⬜ |
| RBAC | 4 | Critical | ⬜ |
| Bot CRUD | 9 | High | ⬜ |
| Multi-Tenant Isolation | 3 | Critical | ⬜ |
| Edge Cases | 7 | Medium-High | ⬜ |
| Performance | 2 | Medium | ⬜ |

**Total Test Cases**: 57

---

## 📝 Test Results Documentation

### Test Execution Template

```markdown
## Test Run: [Date]
**Tester**: [Name]
**Environment**: [Production/Staging/Development]
**Build**: [Version/Commit]

### Results Summary
- Total Tests: 57
- Passed: __
- Failed: __
- Skipped: __
- Pass Rate: ___%

### Failed Tests
| Test ID | Test Name | Failure Reason | Severity | Action Required |
|---------|-----------|----------------|----------|-----------------|
| | | | | |

### Notes
- [Any observations]
- [Performance issues]
- [Recommendations]
```

### Bug Report Template

```markdown
## Bug Report

**Bug ID**: BUG-XXX
**Test Case**: AUTH-REG-001
**Severity**: High/Medium/Low
**Priority**: Critical/High/Medium/Low

### Description
[Clear description of the bug]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Result
[What should happen]

### Actual Result
[What actually happened]

### Environment
- OS: [Operating System]
- Browser: [If applicable]
- Database: [Version]
- Server: [Version]

### Screenshots/Logs
[Attach relevant information]

### Impact
[How this affects users]

### Suggested Fix
[If known]
```

---

## 🎯 Testing Best Practices

### Before Testing
1. ✅ Back up database
2. ✅ Review test plan
3. ✅ Set up clean test environment
4. ✅ Prepare test data
5. ✅ Document baseline metrics

### During Testing
1. ✅ Follow test cases exactly
2. ✅ Document all observations
3. ✅ Take screenshots of failures
4. ✅ Save request/response logs
5. ✅ Note any deviations from expected behavior

### After Testing
1. ✅ Compile test results
2. ✅ File bug reports for failures
3. ✅ Update test cases if needed
4. ✅ Share results with team
5. ✅ Schedule retesting for failed cases

### Continuous Testing
1. ✅ Automate regression tests
2. ✅ Run tests before each deployment
3. ✅ Monitor production metrics
4. ✅ Update test cases when features change
5. ✅ Review and improve test coverage regularly

---

## 🚀 Next Steps

After completing manual testing:

1. **Automate Critical Tests**: Convert critical test cases to automated tests
2. **CI/CD Integration**: Add tests to deployment pipeline
3. **Monitor in Production**: Set up monitoring for key metrics
4. **User Acceptance Testing**: Involve stakeholders in UAT
5. **Performance Optimization**: Address any performance issues found
6. **Security Audit**: Conduct professional security audit
7. **Documentation**: Keep test documentation up to date

---

**Document Version**: 1.0
**Last Updated**: 2025-10-31
**Total Lines**: 1400+
**Maintainer**: BotBuilder Platform Team
