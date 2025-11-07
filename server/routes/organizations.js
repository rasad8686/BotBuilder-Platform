const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const { checkPermission } = require('../middleware/checkPermission');
const {
  logOrganizationCreated,
  logOrganizationUpdated,
  logOrganizationDeleted,
  logOrganizationSwitched,
  logMemberInvited,
  logMemberRoleChanged,
  logMemberRemoved
} = require('../middleware/audit');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * POST /api/organizations
 * Create a new organization
 * Any authenticated user can create an organization
 */
router.post('/', async (req, res) => {
  try {
    const { name, slug } = req.body;
    const userId = req.user.id;

    // Validation
    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: 'Organization name and slug are required'
      });
    }

    // Check if slug is already taken
    const slugCheck = await db.query('SELECT id FROM organizations WHERE slug = $1', [slug]);
    if (slugCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Organization slug is already taken'
      });
    }

    // Create organization
    const orgQuery = `
      INSERT INTO organizations (name, slug, owner_id, plan_tier, settings)
      VALUES ($1, $2, $3, 'free', '{}')
      RETURNING *
    `;
    const orgResult = await db.query(orgQuery, [name, slug, userId]);
    const organization = orgResult.rows[0];

    // Add creator as admin
    const memberQuery = `
      INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
      VALUES ($1, $2, 'admin', 'active', NOW())
    `;
    await db.query(memberQuery, [organization.id, userId]);

    // Log organization creation to audit trail
    await logOrganizationCreated(req, organization.id, {
      name: organization.name,
      slug: organization.slug,
      plan_tier: organization.plan_tier
    });

    return res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: organization
    });
  } catch (error) {
    console.error('Create organization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating organization',
      error: error.message
    });
  }
});

/**
 * GET /api/organizations
 * List all organizations user is a member of
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT
        o.*,
        om.role,
        om.joined_at,
        om.status,
        (SELECT COUNT(*) FROM organization_members WHERE org_id = o.id AND status = 'active') as member_count,
        (SELECT COUNT(*) FROM bots WHERE organization_id = o.id) as bot_count
      FROM organizations o
      JOIN organization_members om ON om.org_id = o.id
      WHERE om.user_id = $1 AND om.status = 'active'
      ORDER BY om.joined_at ASC
    `;

    const result = await db.query(query, [userId]);

    console.log(`[Organizations] Fetched ${result.rows.length} organizations for user ${userId}`);
    console.log(`[Organizations] Organizations:`, result.rows.map(o => ({ id: o.id, name: o.name, role: o.role })));

    return res.status(200).json({
      success: true,
      organizations: result.rows  // Changed from 'data' to 'organizations' to match frontend expectation
    });
  } catch (error) {
    console.error('List organizations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching organizations',
      error: error.message
    });
  }
});

/**
 * GET /api/organizations/:id
 * Get organization details
 * Must be a member of the organization
 */
router.get('/:id', organizationContext, requireOrganization, async (req, res) => {
  try {
    const orgId = req.params.id;

    // Verify access
    if (req.organization.id != orgId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this organization'
      });
    }

    const query = `
      SELECT
        o.*,
        u.name as owner_name,
        u.email as owner_email,
        (SELECT COUNT(*) FROM organization_members WHERE org_id = o.id AND status = 'active') as member_count,
        (SELECT COUNT(*) FROM bots WHERE organization_id = o.id) as bot_count
      FROM organizations o
      LEFT JOIN users u ON u.id = o.owner_id
      WHERE o.id = $1
    `;

    const result = await db.query(query, [orgId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...result.rows[0],
        current_user_role: req.organization.role,
        current_user_is_owner: req.organization.is_owner
      }
    });
  } catch (error) {
    console.error('Get organization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching organization',
      error: error.message
    });
  }
});

/**
 * PUT /api/organizations/:id
 * Update organization details
 * Admin only
 */
router.put('/:id', organizationContext, requireOrganization, checkPermission('admin'), async (req, res) => {
  try {
    const orgId = req.params.id;
    const { name, plan_tier, settings } = req.body;

    // Verify access
    if (req.organization.id != orgId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this organization'
      });
    }

    // Get current values for audit log
    const currentOrg = await db.query('SELECT name, plan_tier, settings FROM organizations WHERE id = $1', [orgId]);
    const oldValues = currentOrg.rows[0];

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (plan_tier) {
      updates.push(`plan_tier = $${paramCount}`);
      values.push(plan_tier);
      paramCount++;
    }

    if (settings) {
      updates.push(`settings = $${paramCount}`);
      values.push(JSON.stringify(settings));
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(orgId);

    const query = `
      UPDATE organizations
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    // Log organization update to audit trail
    const newValues = {
      name: result.rows[0].name,
      plan_tier: result.rows[0].plan_tier,
      settings: result.rows[0].settings
    };
    await logOrganizationUpdated(req, orgId, oldValues, newValues);

    return res.status(200).json({
      success: true,
      message: 'Organization updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update organization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating organization',
      error: error.message
    });
  }
});

/**
 * DELETE /api/organizations/:id
 * Delete organization (owner only)
 * This will CASCADE delete all related data
 */
router.delete('/:id', organizationContext, requireOrganization, checkPermission('owner'), async (req, res) => {
  try {
    const orgId = req.params.id;

    // Verify access
    if (req.organization.id != orgId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this organization'
      });
    }

    // Delete organization (CASCADE will handle members, bots, messages, etc.)
    const query = 'DELETE FROM organizations WHERE id = $1 RETURNING *';
    const result = await db.query(query, [orgId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Log organization deletion to audit trail
    await logOrganizationDeleted(req, orgId, {
      name: result.rows[0].name,
      slug: result.rows[0].slug,
      plan_tier: result.rows[0].plan_tier
    });

    return res.status(200).json({
      success: true,
      message: 'Organization deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Delete organization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting organization',
      error: error.message
    });
  }
});

/**
 * GET /api/organizations/:id/members
 * List organization members
 * Any member can view
 */
router.get('/:id/members', organizationContext, requireOrganization, async (req, res) => {
  try {
    const orgId = req.params.id;

    // Verify access
    if (req.organization.id != orgId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this organization'
      });
    }

    const query = `
      SELECT
        om.id,
        om.org_id,
        om.user_id,
        om.role,
        om.status,
        om.joined_at,
        u.name,
        u.email,
        inviter.name as invited_by_name
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      LEFT JOIN users inviter ON inviter.id = om.invited_by
      WHERE om.org_id = $1
      ORDER BY om.joined_at ASC
    `;

    const result = await db.query(query, [orgId]);

    console.log(`[Organizations] Fetched ${result.rows.length} members for organization ${orgId}`);

    return res.status(200).json({
      success: true,
      members: result.rows  // Changed from 'data' to 'members' to match frontend expectation
    });
  } catch (error) {
    console.error('List members error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching members',
      error: error.message
    });
  }
});

/**
 * POST /api/organizations/:id/members
 * Invite user to organization
 * Admin only
 */
router.post('/:id/members', organizationContext, requireOrganization, checkPermission('admin'), async (req, res) => {
  try {
    const orgId = req.params.id;
    const { email, role } = req.body;
    const inviterId = req.user.id;

    // Verify access
    if (req.organization.id != orgId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this organization'
      });
    }

    // Validation
    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email and role are required'
      });
    }

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, member, or viewer'
      });
    }

    // Check if user exists
    const userQuery = 'SELECT id FROM users WHERE email = $1';
    const userResult = await db.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User with this email not found'
      });
    }

    const userId = userResult.rows[0].id;

    // Check if already a member
    const memberCheck = await db.query(
      'SELECT id FROM organization_members WHERE org_id = $1 AND user_id = $2',
      [orgId, userId]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this organization'
      });
    }

    // Add member
    const insertQuery = `
      INSERT INTO organization_members (org_id, user_id, role, invited_by, status, joined_at)
      VALUES ($1, $2, $3, $4, 'active', NOW())
      RETURNING *
    `;
    const result = await db.query(insertQuery, [orgId, userId, role, inviterId]);

    // Log member invitation to audit trail
    await logMemberInvited(req, orgId, userId, role);

    return res.status(201).json({
      success: true,
      message: 'User invited successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Invite user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error inviting user',
      error: error.message
    });
  }
});

/**
 * PUT /api/organizations/:id/members/:userId
 * Update member role
 * Admin only
 */
router.put('/:id/members/:userId', organizationContext, requireOrganization, checkPermission('admin'), async (req, res) => {
  try {
    const orgId = req.params.id;
    const targetUserId = req.params.userId;
    const { role } = req.body;

    // Verify access
    if (req.organization.id != orgId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this organization'
      });
    }

    // Validation
    if (!role || !['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, member, or viewer'
      });
    }

    // Cannot change owner role
    if (targetUserId == req.organization.owner_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change organization owner role'
      });
    }

    // Get current role for audit log
    const currentMember = await db.query(
      'SELECT role FROM organization_members WHERE org_id = $1 AND user_id = $2',
      [orgId, targetUserId]
    );
    const oldRole = currentMember.rows[0]?.role;

    const query = `
      UPDATE organization_members
      SET role = $1
      WHERE org_id = $2 AND user_id = $3
      RETURNING *
    `;

    const result = await db.query(query, [role, orgId, targetUserId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Log member role change to audit trail
    await logMemberRoleChanged(req, orgId, targetUserId, oldRole, role);

    return res.status(200).json({
      success: true,
      message: 'Member role updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update member error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating member',
      error: error.message
    });
  }
});

/**
 * PUT /api/organizations/:id/members/:userId/role
 * Update member role (alternative route with /role suffix)
 * Admin only
 */
router.put('/:id/members/:userId/role', organizationContext, requireOrganization, checkPermission('admin'), async (req, res) => {
  try {
    const orgId = req.params.id;
    const targetUserId = req.params.userId;
    const { role } = req.body;

    // Verify access
    if (req.organization.id != orgId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this organization'
      });
    }

    // Validation
    if (!role || !['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, member, or viewer'
      });
    }

    // Cannot change owner role
    if (targetUserId == req.organization.owner_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change organization owner role'
      });
    }

    // Get current role for audit log
    const currentMember = await db.query(
      'SELECT role FROM organization_members WHERE org_id = $1 AND user_id = $2',
      [orgId, targetUserId]
    );
    const oldRole = currentMember.rows[0]?.role;

    const query = `
      UPDATE organization_members
      SET role = $1
      WHERE org_id = $2 AND user_id = $3
      RETURNING *
    `;

    const result = await db.query(query, [role, orgId, targetUserId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Log member role change to audit trail
    await logMemberRoleChanged(req, orgId, targetUserId, oldRole, role);

    return res.status(200).json({
      success: true,
      message: 'Member role updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update member role error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating member role',
      error: error.message
    });
  }
});

/**
 * DELETE /api/organizations/:id/members/:userId
 * Remove member from organization
 * Admin only (cannot remove owner)
 */
router.delete('/:id/members/:userId', organizationContext, requireOrganization, checkPermission('admin'), async (req, res) => {
  try {
    const orgId = req.params.id;
    const targetUserId = req.params.userId;

    // Verify access
    if (req.organization.id != orgId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this organization'
      });
    }

    // Cannot remove owner
    if (targetUserId == req.organization.owner_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove organization owner'
      });
    }

    const query = `
      DELETE FROM organization_members
      WHERE org_id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [orgId, targetUserId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Log member removal to audit trail
    await logMemberRemoved(req, orgId, targetUserId, {
      role: result.rows[0].role,
      status: result.rows[0].status
    });

    return res.status(200).json({
      success: true,
      message: 'Member removed successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error removing member',
      error: error.message
    });
  }
});

/**
 * POST /api/organizations/:id/switch
 * Switch active organization context
 * Returns updated JWT with new organization ID
 */
router.post('/:id/switch', async (req, res) => {
  try {
    const orgId = req.params.id;
    const userId = req.user.id;

    // Verify user is member of organization
    const memberQuery = `
      SELECT om.role, o.name, o.slug
      FROM organization_members om
      JOIN organizations o ON o.id = om.org_id
      WHERE om.user_id = $1 AND om.org_id = $2 AND om.status = 'active'
    `;
    const result = await db.query(memberQuery, [userId, orgId]);

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this organization'
      });
    }

    // Generate new JWT with updated organization
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        id: userId,
        email: req.user.email,
        current_organization_id: orgId
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log organization switch to audit trail
    await logOrganizationSwitched(req, orgId);

    return res.status(200).json({
      success: true,
      message: 'Switched to organization successfully',
      data: {
        organization: result.rows[0],
        token
      }
    });
  } catch (error) {
    console.error('Switch organization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error switching organization',
      error: error.message
    });
  }
});

module.exports = router;
