/**
 * User Management Routes
 * Handles user CRUD operations, profile management, and invitations
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const log = require('../utils/logger');
const authenticateToken = require('../middleware/auth');
const { organizationContext } = require('../middleware/organizationContext');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/users - List users with pagination, search, and filtering
 */
router.get('/', organizationContext, async (req, res) => {
  try {
    const organizationId = req.user.current_organization_id || req.user.organization_id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const search = req.query.search || '';
    const role = req.query.role || '';
    const status = req.query.status || '';
    const offset = (page - 1) * limit;

    let conditions = ['om.org_id = $1'];
    let params = [organizationId, limit, offset];
    let paramIndex = 4;

    if (search) {
      conditions.push(`(u.email ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      conditions.push(`om.role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (status) {
      conditions.push(`om.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const users = await db.query(`
      SELECT u.id, u.name, u.email, u.email_verified, u.created_at, u.updated_at,
             om.role, om.status, om.joined_at
      FROM users u
      JOIN organization_members om ON om.user_id = u.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $2 OFFSET $3
    `, params);

    const countParams = params.filter((_, i) => i !== 1 && i !== 2);
    const countQuery = `
      SELECT COUNT(*) as count
      FROM users u
      JOIN organization_members om ON om.user_id = u.id
      ${whereClause}
    `;
    const totalResult = await db.query(countQuery, countParams);

    res.json({
      success: true,
      data: {
        users: users.rows,
        pagination: {
          page,
          limit,
          total: parseInt(totalResult.rows[0].count),
          pages: Math.ceil(totalResult.rows[0].count / limit)
        }
      }
    });
  } catch (error) {
    log.error('Error listing users', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to list users'
    });
  }
});

/**
 * GET /api/users/me - Get current user profile
 */
router.get('/me', async (req, res) => {
  try {
    const user = await db.query(`
      SELECT id, name, email, email_verified, avatar_url, timezone,
             language, two_factor_enabled, created_at, updated_at
      FROM users
      WHERE id = $1
    `, [req.user.id]);

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.rows[0]
    });
  } catch (error) {
    log.error('Error fetching current user', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
});

/**
 * PUT /api/users/me - Update current user profile
 */
router.put('/me', async (req, res) => {
  try {
    const { name, avatar_url, timezone, language } = req.body;

    // Validate input
    if (name !== undefined && (!name || name.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Name cannot be empty'
      });
    }

    if (name && name.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Name is too long'
      });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(name.trim());
      paramIndex++;
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIndex}`);
      params.push(avatar_url);
      paramIndex++;
    }

    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIndex}`);
      params.push(timezone);
      paramIndex++;
    }

    if (language !== undefined) {
      updates.push(`language = $${paramIndex}`);
      params.push(language);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.user.id);

    const result = await db.query(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, avatar_url, timezone, language, updated_at
    `, params);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Error updating user profile', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update user profile'
    });
  }
});

/**
 * GET /api/users/:id - Get user by ID
 */
router.get('/:id', organizationContext, async (req, res) => {
  try {
    const userId = req.params.id;
    const organizationId = req.user.current_organization_id || req.user.organization_id;

    // Verify user belongs to organization
    const user = await db.query(`
      SELECT u.id, u.name, u.email, u.email_verified, u.avatar_url,
             u.created_at, u.updated_at, om.role, om.status, om.joined_at
      FROM users u
      JOIN organization_members om ON om.user_id = u.id
      WHERE u.id = $1 AND om.org_id = $2
    `, [userId, organizationId]);

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.rows[0]
    });
  } catch (error) {
    log.error('Error fetching user', { error: error.message, userId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

/**
 * PUT /api/users/:id - Update user
 */
router.put('/:id', organizationContext, async (req, res) => {
  try {
    const userId = req.params.id;
    const organizationId = req.user.current_organization_id || req.user.organization_id;
    const { name, email } = req.body;

    // Validate input
    if (name !== undefined && (!name || name.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Name cannot be empty'
      });
    }

    if (email !== undefined && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    // Verify user belongs to organization
    const checkUser = await db.query(`
      SELECT u.id FROM users u
      JOIN organization_members om ON om.user_id = u.id
      WHERE u.id = $1 AND om.org_id = $2
    `, [userId, organizationId]);

    if (checkUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if email already exists (if updating email)
    if (email) {
      const emailCheck = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Email already in use'
        });
      }
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(name.trim());
      paramIndex++;
    }

    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      params.push(email);
      paramIndex++;
      updates.push(`email_verified = false`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    const result = await db.query(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, email_verified, updated_at
    `, params);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Error updating user', { error: error.message, userId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

/**
 * DELETE /api/users/:id - Delete user
 */
router.delete('/:id', organizationContext, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const organizationId = req.user.current_organization_id || req.user.organization_id;

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete yourself'
      });
    }

    // Verify user belongs to organization
    const checkUser = await db.query(`
      SELECT u.id, om.role FROM users u
      JOIN organization_members om ON om.user_id = u.id
      WHERE u.id = $1 AND om.org_id = $2
    `, [userId, organizationId]);

    if (checkUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Remove user from organization (soft delete)
    await db.query(`
      UPDATE organization_members
      SET status = 'removed', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND org_id = $2
    `, [userId, organizationId]);

    res.json({
      success: true,
      message: 'User removed from organization'
    });
  } catch (error) {
    log.error('Error deleting user', { error: error.message, userId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

/**
 * POST /api/users/invite - Invite new user to organization
 */
router.post('/invite', organizationContext, async (req, res) => {
  try {
    const organizationId = req.user.current_organization_id || req.user.organization_id;
    const { email, role = 'member' } = req.body;

    // Validate input
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Valid email is required'
      });
    }

    const validRoles = ['admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      });
    }

    // Check if user already exists in organization
    const existingMember = await db.query(`
      SELECT u.id FROM users u
      JOIN organization_members om ON om.user_id = u.id
      WHERE u.email = $1 AND om.org_id = $2
    `, [email, organizationId]);

    if (existingMember.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User is already a member of this organization'
      });
    }

    // Check for pending invitation
    const pendingInvite = await db.query(`
      SELECT id FROM user_invitations
      WHERE email = $1 AND org_id = $2 AND status = 'pending'
      AND expires_at > CURRENT_TIMESTAMP
    `, [email, organizationId]);

    if (pendingInvite.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A pending invitation already exists for this email'
      });
    }

    // Create invitation
    const invitation = await db.query(`
      INSERT INTO user_invitations (email, org_id, role, invited_by, expires_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '7 days')
      RETURNING id, email, role, expires_at
    `, [email, organizationId, role, req.user.id]);

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      data: invitation.rows[0]
    });
  } catch (error) {
    log.error('Error inviting user', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to send invitation'
    });
  }
});

/**
 * PUT /api/users/:id/role - Change user role
 */
router.put('/:id/role', organizationContext, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const organizationId = req.user.current_organization_id || req.user.organization_id;
    const { role } = req.body;

    const validRoles = ['admin', 'member', 'viewer'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      });
    }

    // Prevent changing own role
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change your own role'
      });
    }

    // Verify user belongs to organization
    const checkUser = await db.query(`
      SELECT om.id, om.role FROM organization_members om
      WHERE om.user_id = $1 AND om.org_id = $2
    `, [userId, organizationId]);

    if (checkUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update role
    const result = await db.query(`
      UPDATE organization_members
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2 AND org_id = $3
      RETURNING user_id, role, updated_at
    `, [role, userId, organizationId]);

    res.json({
      success: true,
      message: 'Role updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Error changing user role', { error: error.message, userId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to change user role'
    });
  }
});

module.exports = router;
