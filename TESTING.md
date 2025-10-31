# BotBuilder RBAC Multi-Tenant Testing Guide

## Overview
This document provides comprehensive manual testing procedures for the BotBuilder RBAC Multi-Tenant System.

---

## 1. User Registration Flow

### Test Case 1.1: Successful Registration
**Prerequisites**: None

**Steps**:
1. Navigate to `/register`
2. Fill in the form:
   - Username: `TestUser`
   - Email: `testuser@example.com`
   - Password: `Test123!`
3. Click "Register"

**Expected Results**:
- ✅ User redirected to `/dashboard`
- ✅ JWT token stored in localStorage
- ✅ User data stored in localStorage
- ✅ Backend console shows all 7 registration steps
- ✅ Database verification:
  ```sql
  SELECT * FROM users WHERE email = 'testuser@example.com';
  SELECT * FROM organizations WHERE owner_id = <user_id>;
  SELECT * FROM organization_members WHERE user_id = <user_id> AND role = 'admin';
  ```

**Pass Criteria**: User created, organization created, membership with admin role exists

---

### Test Case 1.2: Registration Validation
**Prerequisites**: None

**Steps**:
1. Try registering with invalid data:
   - Empty username
   - Invalid email format
   - Password < 6 characters

**Expected Results**:
- ✅ Error message displayed
- ✅ Registration prevented
- ✅ No database entries created

**Pass Criteria**: Validation errors shown, no partial data created

---

### Test Case 1.3: Duplicate Email Registration
**Prerequisites**: User already exists with `existing@example.com`

**Steps**:
1. Try to register with `existing@example.com`

**Expected Results**:
- ✅ Error: "Email already registered"
- ✅ HTTP 400 status
- ✅ No duplicate user created

**Pass Criteria**: Clear error message, registration blocked

---

## 2. Login Flow

### Test Case 2.1: Successful Login
**Prerequisites**: User exists: `testuser@example.com` / `Test123!`

**Steps**:
1. Navigate to `/login`
2. Enter email: `testuser@example.com`
3. Enter password: `Test123!`
4. Click "Login"

**Expected Results**:
- ✅ User redirected to `/dashboard`
- ✅ JWT token stored in localStorage
- ✅ Token includes `current_organization_id`
- ✅ OrganizationContext loads user's organizations

**Pass Criteria**: Successful authentication, organization context loaded

---

### Test Case 2.2: Login with Invalid Credentials
**Prerequisites**: None

**Steps**:
1. Try logging in with wrong password
2. Try logging in with non-existent email

**Expected Results**:
- ✅ Error: "Invalid email or password"
- ✅ HTTP 401 status
- ✅ No token stored
- ✅ User stays on login page

**Pass Criteria**: Clear error message, authentication denied

---

## 3. Organization Context Loading

### Test Case 3.1: Organization Context After Login
**Prerequisites**: Logged in user with organizations

**Steps**:
1. Log in successfully
2. Open browser console
3. Check OrganizationContext logs

**Expected Results**:
- ✅ Console shows: `[OrganizationContext] Fetching organizations...`
- ✅ Console shows: `[OrganizationContext] Found N organizations`
- ✅ OrganizationSwitcher displays current organization
- ✅ Role badge shows correct role (Admin)

**Pass Criteria**: Organization context loads, current org set

---

### Test Case 3.2: No Organizations Scenario
**Prerequisites**: User with no organizations (manual DB setup)

**Steps**:
1. Log in as user with no organizations
2. Check frontend behavior

**Expected Results**:
- ✅ OrganizationSwitcher shows nothing or placeholder
- ✅ No errors thrown
- ✅ Console warns: "No organizations found for user"

**Pass Criteria**: Graceful handling of missing organizations

---

## 4. Organization Settings Page

### Test Case 4.1: Access Organization Settings (Admin)
**Prerequisites**: Logged in as admin of organization

**Steps**:
1. Click "Organization" in sidebar
2. Navigate to `/organizations/settings`

**Expected Results**:
- ✅ Page loads successfully
- ✅ Organization name displayed
- ✅ Organization slug displayed
- ✅ Member list displayed
- ✅ "Invite Member" button visible
- ✅ Edit organization button visible (if owner)

**Pass Criteria**: Full access to organization settings

---

### Test Case 4.2: Access Denied (Viewer)
**Prerequisites**: Logged in as viewer

**Steps**:
1. Try to access `/organizations/settings`

**Expected Results**:
- ✅ Error message: "You do not have permission"
- ✅ Redirected to `/dashboard` after 2 seconds
- ✅ HTTP 403 or frontend guard prevents access

**Pass Criteria**: Access denied, redirect occurs

---

## 5. Team Member Management

### Test Case 5.1: Invite New Member (Admin)
**Prerequisites**: Logged in as admin, target user exists

**Steps**:
1. Go to Organization Settings
2. Click "Invite Member"
3. Enter email: `newmember@example.com`
4. Select role: "Member"
5. Click "Send Invitation"

**Expected Results**:
- ✅ Success message displayed
- ✅ Member added to list immediately
- ✅ Database entry created:
  ```sql
  SELECT * FROM organization_members WHERE user_id = <target_user_id>;
  ```
- ✅ Console shows: `[Organizations] User invited successfully`

**Pass Criteria**: Member added with correct role

---

### Test Case 5.2: Update Member Role (Admin)
**Prerequisites**: Organization has members

**Steps**:
1. Go to Organization Settings
2. Find a member (not owner)
3. Change role from dropdown
4. Verify change

**Expected Results**:
- ✅ Success message displayed
- ✅ Role updated in database
- ✅ Member sees new role immediately

**Pass Criteria**: Role updated successfully

---

### Test Case 5.3: Remove Member (Admin)
**Prerequisites**: Organization has non-owner members

**Steps**:
1. Click "Remove" on a member
2. Confirm deletion

**Expected Results**:
- ✅ Confirmation modal shown
- ✅ Member removed from list
- ✅ Database entry deleted
- ✅ Cannot remove owner

**Pass Criteria**: Member removed, owner protected

---

### Test Case 5.4: Invite Non-Admin Attempt (Member)
**Prerequisites**: Logged in as member (not admin)

**Steps**:
1. Try to access Organization Settings

**Expected Results**:
- ✅ Access denied or button hidden
- ✅ PermissionGuard prevents access

**Pass Criteria**: Non-admin cannot invite members

---

## 6. Bot CRUD Operations with Organizations

### Test Case 6.1: Create Bot (Member+)
**Prerequisites**: Logged in as member or admin

**Steps**:
1. Click "Create New Bot"
2. Fill in bot details
3. Submit

**Expected Results**:
- ✅ Bot created with current `organization_id`
- ✅ Bot appears in bot list
- ✅ Database verification:
  ```sql
  SELECT * FROM bots WHERE organization_id = <current_org_id>;
  ```

**Pass Criteria**: Bot created in current organization

---

### Test Case 6.2: View Bots (All Roles)
**Prerequisites**: Organization has bots

**Steps**:
1. Navigate to "My Bots"
2. View bot list

**Expected Results**:
- ✅ Only bots from current organization shown
- ✅ Bots from other organizations NOT shown
- ✅ Organization isolation verified

**Pass Criteria**: Organization-scoped bot list

---

### Test Case 6.3: Delete Bot (Admin Only)
**Prerequisites**: Logged in as admin, bots exist

**Steps**:
1. Try to delete a bot as admin
2. Try to delete a bot as member
3. Try to delete a bot as viewer

**Expected Results**:
- ✅ Admin: Delete button visible, deletion works
- ✅ Member: Delete button hidden (PermissionGuard)
- ✅ Viewer: Delete button hidden

**Pass Criteria**: Only admins can delete bots

---

### Test Case 6.4: Create Bot Denied (Viewer)
**Prerequisites**: Logged in as viewer

**Steps**:
1. Try to access create bot page

**Expected Results**:
- ✅ Create button hidden by PermissionGuard
- ✅ If URL accessed directly, show error

**Pass Criteria**: Viewers cannot create bots

---

## 7. Permission Guards (UI Level)

### Test Case 7.1: PermissionGuard Component
**Prerequisites**: Multiple test users with different roles

**Test as Admin**:
- ✅ See delete buttons on bots
- ✅ See "Invite Member" button
- ✅ See "Edit Organization" button

**Test as Member**:
- ✅ See "Create Bot" button
- ✅ Do NOT see delete buttons on bots
- ✅ Do NOT see "Invite Member" button

**Test as Viewer**:
- ✅ Do NOT see "Create Bot" button
- ✅ Do NOT see delete buttons
- ✅ Do NOT see "Invite Member" button

**Pass Criteria**: UI adapts correctly to role

---

## 8. Organization Switching

### Test Case 8.1: Switch Between Organizations
**Prerequisites**: User is member of multiple organizations

**Steps**:
1. Open OrganizationSwitcher dropdown
2. Click different organization
3. Page reloads

**Expected Results**:
- ✅ Page reloads
- ✅ New organization set as current
- ✅ Bot list updates to new organization's bots
- ✅ Role badge updates to role in new organization
- ✅ localStorage updated with new org ID

**Pass Criteria**: Clean switch, all data scoped to new org

---

### Test Case 8.2: Role Changes After Switch
**Prerequisites**: User is admin in Org A, member in Org B

**Steps**:
1. In Org A, verify admin permissions (can delete bots)
2. Switch to Org B
3. Verify member permissions (cannot delete bots)

**Expected Results**:
- ✅ Permissions change based on role in each org
- ✅ UI updates accordingly
- ✅ API calls use correct organization context

**Pass Criteria**: Role correctly scoped per organization

---

## 9. Backend API Authorization

### Test Case 9.1: Organization Header Required
**Prerequisites**: Valid JWT token

**Steps**:
1. Make API call without `X-Organization-ID` header
2. Make API call with wrong `X-Organization-ID`
3. Make API call with correct `X-Organization-ID`

**Expected Results**:
- ✅ Without header: Request succeeds (uses JWT org_id)
- ✅ With wrong org: Access denied if not member
- ✅ With correct org: Request succeeds

**Pass Criteria**: Organization context enforced

---

### Test Case 9.2: Cross-Organization Access Prevention
**Prerequisites**: User in Org A, trying to access Org B resources

**Steps**:
1. Get bot ID from Org B
2. Try to access/modify/delete that bot while in Org A context

**Expected Results**:
- ✅ HTTP 403 Forbidden
- ✅ Error: "Access denied to this organization"
- ✅ Resource not modified

**Pass Criteria**: Cross-org access blocked

---

## 10. Edge Cases and Error Handling

### Test Case 10.1: Expired JWT Token
**Prerequisites**: Expired token in localStorage

**Steps**:
1. Try to access protected page with expired token

**Expected Results**:
- ✅ HTTP 401 Unauthorized
- ✅ Redirected to `/login`
- ✅ Token cleared from localStorage

**Pass Criteria**: Expired tokens rejected

---

### Test Case 10.2: Invalid JWT Token
**Prerequisites**: Malformed token in localStorage

**Steps**:
1. Manually set invalid token
2. Refresh page

**Expected Results**:
- ✅ Authentication fails
- ✅ Redirected to `/login`
- ✅ Token cleared

**Pass Criteria**: Invalid tokens rejected

---

### Test Case 10.3: Database Connection Lost
**Prerequisites**: Stop database

**Steps**:
1. Try to perform operations

**Expected Results**:
- ✅ Error message displayed
- ✅ No data corruption
- ✅ Graceful error handling

**Pass Criteria**: Errors handled gracefully

---

### Test Case 10.4: Concurrent Updates
**Prerequisites**: Two users in same organization

**Steps**:
1. User A updates organization name
2. User B updates organization name at same time

**Expected Results**:
- ✅ Last write wins (or conflict resolution)
- ✅ Both users see updated data
- ✅ No data loss

**Pass Criteria**: Concurrent updates handled

---

### Test Case 10.5: Delete Organization (Owner Only)
**Prerequisites**: Logged in as organization owner

**Steps**:
1. Go to Organization Settings
2. Scroll to "Danger Zone"
3. Click "Delete Organization"
4. Confirm deletion

**Expected Results**:
- ✅ Confirmation modal shown
- ✅ Organization deleted from database
- ✅ All members removed
- ✅ All bots deleted (CASCADE)
- ✅ User redirected to dashboard
- ✅ LocalStorage cleared of deleted org

**Pass Criteria**: Organization and all related data deleted

---

## 11. Logout and Session Management

### Test Case 11.1: Normal Logout
**Prerequisites**: Logged in user

**Steps**:
1. Click logout button
2. Confirm logout

**Expected Results**:
- ✅ Confirmation prompt shown
- ✅ All localStorage cleared
- ✅ Redirected to `/login`
- ✅ Cannot access protected routes

**Pass Criteria**: Complete logout, session cleared

---

### Test Case 11.2: Session Persistence
**Prerequisites**: Logged in user

**Steps**:
1. Close browser
2. Reopen and navigate to app
3. Check if still logged in

**Expected Results**:
- ✅ User still logged in (24h token)
- ✅ Organization context restored
- ✅ Same organization selected

**Pass Criteria**: Session persists across browser restarts

---

## 12. Multi-Language Support

### Test Case 12.1: Language Switching
**Prerequisites**: Logged in user

**Steps**:
1. Click language selector in sidebar
2. Switch to Russian
3. Verify UI updates
4. Switch back to English

**Expected Results**:
- ✅ Sidebar labels change
- ✅ Organization link shows "Организация" in Russian
- ✅ All UI text translated
- ✅ Language persists on reload

**Pass Criteria**: Complete translation support

---

## Test Summary Checklist

### Critical Path Tests (Must Pass)
- [ ] 1.1 - User Registration
- [ ] 2.1 - User Login
- [ ] 3.1 - Organization Context Loading
- [ ] 4.1 - Organization Settings Access
- [ ] 5.1 - Invite Team Member
- [ ] 6.1 - Create Bot in Organization
- [ ] 6.3 - Permission-based Bot Deletion
- [ ] 7.1 - Permission Guards
- [ ] 8.1 - Organization Switching
- [ ] 9.2 - Cross-Organization Access Prevention

### Security Tests (Must Pass)
- [ ] 2.2 - Invalid Login Attempts
- [ ] 4.2 - Unauthorized Access Prevention
- [ ] 5.4 - Non-Admin Action Prevention
- [ ] 6.4 - Viewer Create Prevention
- [ ] 9.2 - Cross-Organization Isolation
- [ ] 10.1 - Expired Token Handling
- [ ] 10.2 - Invalid Token Handling

### Edge Cases (Should Pass)
- [ ] 1.3 - Duplicate Email Registration
- [ ] 3.2 - No Organizations Handling
- [ ] 10.3 - Database Connection Lost
- [ ] 10.4 - Concurrent Updates
- [ ] 10.5 - Organization Deletion

---

## Testing Tools

### Browser DevTools
- Console: Check for errors and logs
- Network: Verify API calls and responses
- Application: Inspect localStorage

### Database Queries
```sql
-- Check user
SELECT * FROM users WHERE email = 'test@example.com';

-- Check organizations
SELECT * FROM organizations WHERE owner_id = <user_id>;

-- Check memberships
SELECT * FROM organization_members WHERE user_id = <user_id>;

-- Check bots
SELECT * FROM bots WHERE organization_id = <org_id>;

-- Full relationship check
SELECT u.email, o.name as org_name, om.role
FROM users u
JOIN organization_members om ON om.user_id = u.id
JOIN organizations o ON o.id = om.org_id
WHERE u.email = 'test@example.com';
```

### Backend Console
Watch for detailed logs:
- `[REGISTER]` - Registration steps
- `[Organizations]` - Organization operations
- `[OrganizationContext]` - Frontend context operations

---

## Bug Reporting

When reporting bugs, include:
1. Test case number and name
2. Steps to reproduce
3. Expected vs actual results
4. Screenshots or console logs
5. Browser and version
6. Database state before and after

---

**Last Updated**: 2025-01-XX
**Version**: 1.0
**RBAC System Version**: Phase 3 Complete
