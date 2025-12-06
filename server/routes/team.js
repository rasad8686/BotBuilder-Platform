const express = require('express');
const router = express.Router();
const log = require('../utils/logger');
const TeamManager = require('../collaboration/core/TeamManager');
const RoleManager = require('../collaboration/core/RoleManager');
const TeamMember = require('../models/TeamMember');
const TeamInvitation = require('../models/TeamInvitation');
const ActivityLog = require('../models/ActivityLog');
const { PermissionChecker, PERMISSIONS, requirePermission } = require('../collaboration/core/PermissionChecker');
const authenticateToken = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/team/members - üzvlər siyahısı
router.get('/members', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { status, limit = 100, offset = 0 } = req.query;

    const members = await TeamMember.findByTenant(tenantId, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(members);
  } catch (error) {
    log.error('Error fetching team members', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// POST /api/team/members - üzv əlavə et
router.post('/members', requirePermission(PERMISSIONS.TEAM_MANAGE), async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { userId, roleId } = req.body;

    if (!userId || !roleId) {
      return res.status(400).json({ error: 'userId and roleId are required' });
    }

    const exists = await TeamMember.exists(userId, tenantId);
    if (exists) {
      return res.status(400).json({ error: 'User is already a team member' });
    }

    const member = await TeamMember.create({
      tenantId,
      userId,
      roleId,
      invitedBy: req.user.id
    });

    await ActivityLog.create({
      tenantId,
      userId: req.user.id,
      action: 'team_member_added',
      entityType: 'team_member',
      entityId: member.id,
      changes: { userId, roleId },
      ipAddress: req.ip
    });

    res.status(201).json(member);
  } catch (error) {
    log.error('Error adding team member', { error: error.message });
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// PUT /api/team/members/:id - üzv yenilə
router.put('/members/:id', requirePermission(PERMISSIONS.TEAM_MANAGE), async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { id } = req.params;
    const { roleId, status } = req.body;

    const existingMember = await TeamMember.findById(id);
    if (!existingMember || existingMember.tenant_id !== tenantId) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const member = await TeamMember.update(id, { role_id: roleId, status });

    await ActivityLog.create({
      tenantId,
      userId: req.user.id,
      action: 'team_member_updated',
      entityType: 'team_member',
      entityId: parseInt(id),
      changes: { roleId, status },
      ipAddress: req.ip
    });

    res.json(member);
  } catch (error) {
    log.error('Error updating team member', { error: error.message });
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

// DELETE /api/team/members/:id - üzv sil
router.delete('/members/:id', requirePermission(PERMISSIONS.TEAM_MANAGE), async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { id } = req.params;

    const existingMember = await TeamMember.findById(id);
    if (!existingMember || existingMember.tenant_id !== tenantId) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    if (existingMember.user_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot remove yourself from the team' });
    }

    const member = await TeamMember.delete(id);

    await ActivityLog.create({
      tenantId,
      userId: req.user.id,
      action: 'team_member_removed',
      entityType: 'team_member',
      entityId: parseInt(id),
      changes: { removedUserId: existingMember.user_id },
      ipAddress: req.ip
    });

    res.json({ message: 'Team member removed', member });
  } catch (error) {
    log.error('Error removing team member', { error: error.message });
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// POST /api/team/invite - dəvət göndər
router.post('/invite', requirePermission(PERMISSIONS.TEAM_INVITE), async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { email, roleId } = req.body;

    if (!email || !roleId) {
      return res.status(400).json({ error: 'email and roleId are required' });
    }

    const hasPending = await TeamInvitation.hasPendingInvitation(email, tenantId);
    if (hasPending) {
      return res.status(400).json({ error: 'Pending invitation already exists for this email' });
    }

    const invitation = await TeamInvitation.create({
      tenantId,
      email,
      roleId,
      invitedBy: req.user.id
    });

    await ActivityLog.create({
      tenantId,
      userId: req.user.id,
      action: 'team_invitation_sent',
      entityType: 'team_invitation',
      entityId: invitation.id,
      changes: { email, roleId },
      ipAddress: req.ip
    });

    res.status(201).json({
      message: 'Invitation sent',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expires_at
      }
    });
  } catch (error) {
    log.error('Error sending invitation', { error: error.message });
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// POST /api/team/invite/:token/accept - dəvəti qəbul et
router.post('/invite/:token/accept', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await TeamInvitation.accept(token);

    if (req.user) {
      await TeamMember.create({
        tenantId: result.tenantId,
        userId: req.user.id,
        roleId: result.roleId,
        invitedBy: result.invitation.invited_by
      });

      await ActivityLog.create({
        tenantId: result.tenantId,
        userId: req.user.id,
        action: 'team_invitation_accepted',
        entityType: 'team_invitation',
        entityId: result.invitation.id,
        ipAddress: req.ip
      });
    }

    res.json({
      message: 'Invitation accepted',
      tenantId: result.tenantId,
      roleId: result.roleId
    });
  } catch (error) {
    log.error('Error accepting invitation', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// GET /api/team/invitations - pending dəvətlər
router.get('/invitations', requirePermission(PERMISSIONS.TEAM_VIEW), async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const invitations = await TeamInvitation.findPendingByTenant(tenantId);
    res.json(invitations);
  } catch (error) {
    log.error('Error fetching invitations', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// GET /api/team/roles - rollar siyahısı
router.get('/roles', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const roleManager = new RoleManager(tenantId);
    const roles = await roleManager.getRoles();
    res.json(roles);
  } catch (error) {
    log.error('Error fetching roles', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// POST /api/team/roles - rol yarat
router.post('/roles', requirePermission(PERMISSIONS.TEAM_MANAGE), async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { name, permissions, isDefault = false } = req.body;

    if (!name || !permissions) {
      return res.status(400).json({ error: 'name and permissions are required' });
    }

    const roleManager = new RoleManager(tenantId);
    const role = await roleManager.createRole(name, permissions, isDefault);

    await ActivityLog.create({
      tenantId,
      userId: req.user.id,
      action: 'role_created',
      entityType: 'team_role',
      entityId: role.id,
      changes: { name, permissions },
      ipAddress: req.ip
    });

    res.status(201).json(role);
  } catch (error) {
    log.error('Error creating role', { error: error.message });
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// PUT /api/team/roles/:id - rol yenilə
router.put('/roles/:id', requirePermission(PERMISSIONS.TEAM_MANAGE), async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { id } = req.params;
    const { name, permissions, isDefault } = req.body;

    const roleManager = new RoleManager(tenantId);
    const role = await roleManager.updateRole(parseInt(id), { name, permissions, isDefault });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    await ActivityLog.create({
      tenantId,
      userId: req.user.id,
      action: 'role_updated',
      entityType: 'team_role',
      entityId: parseInt(id),
      changes: { name, permissions, isDefault },
      ipAddress: req.ip
    });

    res.json(role);
  } catch (error) {
    log.error('Error updating role', { error: error.message });
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/team/roles/:id - rol sil
router.delete('/roles/:id', requirePermission(PERMISSIONS.TEAM_MANAGE), async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { id } = req.params;

    const roleManager = new RoleManager(tenantId);
    const role = await roleManager.deleteRole(parseInt(id));

    await ActivityLog.create({
      tenantId,
      userId: req.user.id,
      action: 'role_deleted',
      entityType: 'team_role',
      entityId: parseInt(id),
      ipAddress: req.ip
    });

    res.json({ message: 'Role deleted', role });
  } catch (error) {
    log.error('Error deleting role', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// GET /api/team/activity - activity log
router.get('/activity', requirePermission(PERMISSIONS.TEAM_VIEW), async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { limit = 50, offset = 0, action, entityType, startDate, endDate } = req.query;

    const activities = await ActivityLog.findByTenant(tenantId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      action,
      entityType,
      startDate,
      endDate
    });

    res.json(activities);
  } catch (error) {
    log.error('Error fetching activity log', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// GET /api/team/stats - team statistikası
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const teamManager = new TeamManager(tenantId);
    const stats = await teamManager.getTeamStats();
    res.json(stats);
  } catch (error) {
    log.error('Error fetching team stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch team stats' });
  }
});

// GET /api/team/permissions - current user permissions
router.get('/permissions', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const permissions = await PermissionChecker.getAllUserPermissions(req.user.id, tenantId);
    res.json(permissions);
  } catch (error) {
    log.error('Error fetching permissions', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

module.exports = router;
