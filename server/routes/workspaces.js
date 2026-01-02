const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const log = require('../utils/logger');

/**
 * Generate slug from name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

/**
 * GET /api/workspaces
 * Get all workspaces for user's organization
 */
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's organization
    const orgResult = await db.query(
      `SELECT o.id FROM organizations o
       JOIN organization_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (orgResult.rows.length === 0) {
      return res.json({ success: true, workspaces: [] });
    }

    const orgId = orgResult.rows[0].id;

    // Get workspaces where user is a member
    const result = await db.query(`
      SELECT w.*, wm.role as user_role,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as member_count,
             (SELECT COUNT(*) FROM workspace_resources WHERE workspace_id = w.id) as resource_count
      FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      LEFT JOIN users u ON u.id = w.created_by
      WHERE w.organization_id = $1 AND wm.user_id = $2
      ORDER BY w.is_default DESC, w.name ASC
    `, [orgId, userId]);

    res.json({
      success: true,
      workspaces: result.rows.map(w => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        description: w.description,
        settings: w.settings,
        isDefault: w.is_default,
        userRole: w.user_role,
        createdBy: w.created_by_name,
        memberCount: parseInt(w.member_count),
        resourceCount: parseInt(w.resource_count),
        createdAt: w.created_at
      }))
    });
  } catch (error) {
    log.error('Get workspaces error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get workspaces'
    });
  }
});

/**
 * POST /api/workspaces
 * Create new workspace
 */
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, settings } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name is required'
      });
    }

    // Get user's organization
    const orgResult = await db.query(
      `SELECT o.id FROM organizations o
       JOIN organization_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (orgResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Organization not found'
      });
    }

    const orgId = orgResult.rows[0].id;

    // Generate unique slug
    let slug = generateSlug(name);
    let slugExists = true;
    let counter = 0;

    while (slugExists) {
      const checkSlug = counter > 0 ? `${slug}-${counter}` : slug;
      const slugCheck = await db.query('SELECT id FROM workspaces WHERE slug = $1', [checkSlug]);
      if (slugCheck.rows.length === 0) {
        slug = checkSlug;
        slugExists = false;
      } else {
        counter++;
      }
    }

    // Check if this is the first workspace (make it default)
    const existingCheck = await db.query(
      'SELECT COUNT(*) as count FROM workspaces WHERE organization_id = $1',
      [orgId]
    );
    const isDefault = parseInt(existingCheck.rows[0].count) === 0;

    // Create workspace
    const result = await db.query(`
      INSERT INTO workspaces (organization_id, name, slug, description, settings, is_default, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [orgId, name, slug, description || '', JSON.stringify(settings || {}), isDefault, userId]);

    const workspace = result.rows[0];

    // Add creator as owner
    await db.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1, $2, 'owner')
    `, [workspace.id, userId]);

    log.info('Workspace created', { workspaceId: workspace.id, name });

    res.status(201).json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        settings: workspace.settings,
        isDefault: workspace.is_default
      }
    });
  } catch (error) {
    log.error('Create workspace error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create workspace'
    });
  }
});

/**
 * GET /api/workspaces/:id
 * Get workspace details
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check access
    const accessCheck = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get workspace
    const result = await db.query(`
      SELECT w.*, u.name as created_by_name
      FROM workspaces w
      LEFT JOIN users u ON u.id = w.created_by
      WHERE w.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    const workspace = result.rows[0];

    // Get members
    const membersResult = await db.query(`
      SELECT wm.*, u.name, u.email
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = $1
      ORDER BY wm.role, u.name
    `, [id]);

    // Get resources
    const resourcesResult = await db.query(`
      SELECT * FROM workspace_resources WHERE workspace_id = $1
    `, [id]);

    res.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        settings: workspace.settings,
        isDefault: workspace.is_default,
        createdBy: workspace.created_by_name,
        createdAt: workspace.created_at,
        userRole: accessCheck.rows[0].role,
        members: membersResult.rows.map(m => ({
          userId: m.user_id,
          name: m.name,
          email: m.email,
          role: m.role,
          joinedAt: m.joined_at
        })),
        resources: resourcesResult.rows.map(r => ({
          id: r.id,
          resourceType: r.resource_type,
          resourceId: r.resource_id,
          createdAt: r.created_at
        }))
      }
    });
  } catch (error) {
    log.error('Get workspace error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get workspace'
    });
  }
});

/**
 * PUT /api/workspaces/:id
 * Update workspace
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, description, settings } = req.body;

    // Check access (admin or owner only)
    const accessCheck = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (accessCheck.rows.length === 0 || !['owner', 'admin'].includes(accessCheck.rows[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (settings) {
      updates.push(`settings = $${paramCount++}`);
      values.push(JSON.stringify(settings));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    values.push(id);
    const result = await db.query(`
      UPDATE workspaces SET ${updates.join(', ')} WHERE id = $${paramCount}
      RETURNING *
    `, values);

    log.info('Workspace updated', { workspaceId: id });

    res.json({
      success: true,
      workspace: result.rows[0]
    });
  } catch (error) {
    log.error('Update workspace error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update workspace'
    });
  }
});

/**
 * DELETE /api/workspaces/:id
 * Delete workspace
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is owner
    const accessCheck = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (accessCheck.rows.length === 0 || accessCheck.rows[0].role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owner can delete'
      });
    }

    // Check if it's the default workspace
    const workspaceCheck = await db.query('SELECT is_default FROM workspaces WHERE id = $1', [id]);
    if (workspaceCheck.rows[0]?.is_default) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default workspace'
      });
    }

    // Delete workspace (cascade will handle members and resources)
    await db.query('DELETE FROM workspaces WHERE id = $1', [id]);

    log.info('Workspace deleted', { workspaceId: id });

    res.json({
      success: true,
      message: 'Workspace deleted'
    });
  } catch (error) {
    log.error('Delete workspace error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete workspace'
    });
  }
});

/**
 * POST /api/workspaces/:id/members
 * Add member to workspace
 */
router.post('/:id/members', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { email, role } = req.body;

    // Check access (admin or owner)
    const accessCheck = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (accessCheck.rows.length === 0 || !['owner', 'admin'].includes(accessCheck.rows[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Find user by email
    const userResult = await db.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const newMember = userResult.rows[0];

    // Check if already a member
    const memberCheck = await db.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, newMember.id]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member'
      });
    }

    // Validate role
    const validRoles = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    // Add member
    await db.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1, $2, $3)
    `, [id, newMember.id, role]);

    log.info('Workspace member added', { workspaceId: id, userId: newMember.id, role });

    res.status(201).json({
      success: true,
      member: {
        userId: newMember.id,
        name: newMember.name,
        email: newMember.email,
        role
      }
    });
  } catch (error) {
    log.error('Add workspace member error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to add member'
    });
  }
});

/**
 * PUT /api/workspaces/:id/members/:userId
 * Update member role
 */
router.put('/:id/members/:memberId', auth, async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.user.id;
    const { role } = req.body;

    // Check access (owner only for role changes)
    const accessCheck = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (accessCheck.rows.length === 0 || accessCheck.rows[0].role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Owner access required'
      });
    }

    // Cannot change owner role
    const targetCheck = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, memberId]
    );

    if (targetCheck.rows[0]?.role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change owner role'
      });
    }

    // Validate role
    const validRoles = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    await db.query(`
      UPDATE workspace_members SET role = $1
      WHERE workspace_id = $2 AND user_id = $3
    `, [role, id, memberId]);

    log.info('Workspace member role updated', { workspaceId: id, memberId, role });

    res.json({
      success: true,
      message: 'Member role updated'
    });
  } catch (error) {
    log.error('Update member role error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update member role'
    });
  }
});

/**
 * DELETE /api/workspaces/:id/members/:userId
 * Remove member from workspace
 */
router.delete('/:id/members/:memberId', auth, async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.user.id;

    // Check access
    const accessCheck = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, userId]
    );

    // Owner can remove anyone, admins can remove editors/viewers, users can remove themselves
    const userRole = accessCheck.rows[0]?.role;
    const isSelf = parseInt(memberId) === userId;

    if (!isSelf && userRole !== 'owner' && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Cannot remove owner
    const targetCheck = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, memberId]
    );

    if (targetCheck.rows[0]?.role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove workspace owner'
      });
    }

    await db.query(
      'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, memberId]
    );

    log.info('Workspace member removed', { workspaceId: id, memberId });

    res.json({
      success: true,
      message: 'Member removed'
    });
  } catch (error) {
    log.error('Remove member error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to remove member'
    });
  }
});

/**
 * POST /api/workspaces/:id/resources
 * Add resource to workspace
 */
router.post('/:id/resources', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { resourceType, resourceId } = req.body;

    // Check access
    const accessCheck = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (accessCheck.rows.length === 0 || !['owner', 'admin', 'editor'].includes(accessCheck.rows[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'Editor access required'
      });
    }

    // Validate resource type
    const validTypes = ['bot', 'api_token', 'webhook', 'integration'];
    if (!validTypes.includes(resourceType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid resource type'
      });
    }

    // Check if already added
    const existingCheck = await db.query(
      'SELECT id FROM workspace_resources WHERE workspace_id = $1 AND resource_type = $2 AND resource_id = $3',
      [id, resourceType, resourceId]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Resource already in workspace'
      });
    }

    // Add resource
    const result = await db.query(`
      INSERT INTO workspace_resources (workspace_id, resource_type, resource_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, resourceType, resourceId]);

    // Also update the resource's workspace_id
    if (resourceType === 'bot') {
      await db.query('UPDATE bots SET workspace_id = $1 WHERE id = $2', [id, resourceId]);
    } else if (resourceType === 'api_token') {
      await db.query('UPDATE api_tokens SET workspace_id = $1 WHERE id = $2', [id, resourceId]);
    }

    log.info('Resource added to workspace', { workspaceId: id, resourceType, resourceId });

    res.status(201).json({
      success: true,
      resource: result.rows[0]
    });
  } catch (error) {
    log.error('Add resource error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to add resource'
    });
  }
});

/**
 * DELETE /api/workspaces/:id/resources/:resourceId
 * Remove resource from workspace
 */
router.delete('/:id/resources/:resourceId', auth, async (req, res) => {
  try {
    const { id, resourceId } = req.params;
    const userId = req.user.id;

    // Check access
    const accessCheck = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (accessCheck.rows.length === 0 || !['owner', 'admin', 'editor'].includes(accessCheck.rows[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'Editor access required'
      });
    }

    // Get resource info before deleting
    const resourceInfo = await db.query(
      'SELECT resource_type, resource_id FROM workspace_resources WHERE id = $1 AND workspace_id = $2',
      [resourceId, id]
    );

    if (resourceInfo.rows.length > 0) {
      const { resource_type, resource_id } = resourceInfo.rows[0];

      // Clear workspace_id from resource
      if (resource_type === 'bot') {
        await db.query('UPDATE bots SET workspace_id = NULL WHERE id = $1', [resource_id]);
      } else if (resource_type === 'api_token') {
        await db.query('UPDATE api_tokens SET workspace_id = NULL WHERE id = $1', [resource_id]);
      }
    }

    await db.query(
      'DELETE FROM workspace_resources WHERE id = $1 AND workspace_id = $2',
      [resourceId, id]
    );

    log.info('Resource removed from workspace', { workspaceId: id, resourceId });

    res.json({
      success: true,
      message: 'Resource removed'
    });
  } catch (error) {
    log.error('Remove resource error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to remove resource'
    });
  }
});

module.exports = router;
