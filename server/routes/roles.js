/**
 * Roles API Routes
 * Enterprise RBAC - Custom roles and permissions management
 */

const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const { checkPermission } = require('../middleware/checkPermission');
const log = require('../utils/logger');

// Apply authentication to all routes
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

/**
 * GET /api/roles
 * Get all roles
 */
router.get('/', checkPermission('admin'), async (req, res) => {
  try {
    const roles = await Role.findAll();

    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    log.error('Error fetching roles', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roles',
      error: error.message
    });
  }
});

/**
 * GET /api/roles/permissions
 * Get all available permissions
 */
router.get('/permissions', checkPermission('admin'), async (req, res) => {
  try {
    const permissions = Role.getAvailablePermissions();

    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    log.error('Error fetching permissions', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permissions',
      error: error.message
    });
  }
});

/**
 * GET /api/roles/:id
 * Get role by ID
 */
router.get('/:id', checkPermission('admin'), async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    res.json({
      success: true,
      data: role
    });
  } catch (error) {
    log.error('Error fetching role', { error: error.message, roleId: req.params.id });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role',
      error: error.message
    });
  }
});

/**
 * POST /api/roles
 * Create a new custom role
 */
router.post('/', checkPermission('admin'), async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required'
      });
    }

    // Check if role name already exists
    const existingRole = await Role.findByName(name);
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: 'A role with this name already exists'
      });
    }

    // Prevent creating system role names
    if (['admin', 'member', 'viewer', 'owner'].includes(name.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create a role with a reserved name'
      });
    }

    const role = await Role.create({
      name: name.trim(),
      description: description || '',
      permissions: permissions || {}
    });

    log.info('Role created', {
      roleId: role.id,
      roleName: role.name,
      userId: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: role
    });
  } catch (error) {
    log.error('Error creating role', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create role',
      error: error.message
    });
  }
});

/**
 * PUT /api/roles/:id
 * Update a role
 */
router.put('/:id', checkPermission('admin'), async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const roleId = req.params.id;

    // Check if role exists
    const existingRole = await Role.findById(roleId);
    if (!existingRole) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Prevent renaming system roles
    if (existingRole.is_system && name && name !== existingRole.name) {
      return res.status(400).json({
        success: false,
        message: 'Cannot rename system roles'
      });
    }

    // Check for duplicate name
    if (name && name !== existingRole.name) {
      const duplicateRole = await Role.findByName(name);
      if (duplicateRole) {
        return res.status(400).json({
          success: false,
          message: 'A role with this name already exists'
        });
      }
    }

    const updatedRole = await Role.update(roleId, {
      name: name !== undefined ? name.trim() : undefined,
      description,
      permissions
    });

    log.info('Role updated', {
      roleId: updatedRole.id,
      roleName: updatedRole.name,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Role updated successfully',
      data: updatedRole
    });
  } catch (error) {
    log.error('Error updating role', { error: error.message, roleId: req.params.id });
    res.status(500).json({
      success: false,
      message: 'Failed to update role',
      error: error.message
    });
  }
});

/**
 * DELETE /api/roles/:id
 * Delete a custom role
 */
router.delete('/:id', checkPermission('admin'), async (req, res) => {
  try {
    const roleId = req.params.id;

    // Check if role exists
    const existingRole = await Role.findById(roleId);
    if (!existingRole) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Prevent deleting system roles
    if (existingRole.is_system) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete system roles'
      });
    }

    await Role.delete(roleId);

    log.info('Role deleted', {
      roleId,
      roleName: existingRole.name,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting role', { error: error.message, roleId: req.params.id });
    res.status(500).json({
      success: false,
      message: 'Failed to delete role',
      error: error.message
    });
  }
});

/**
 * GET /api/roles/:id/users
 * Get users with a specific role in the organization
 */
router.get('/:id/users', checkPermission('admin'), async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    const users = await Role.getUsersByRole(role.name, req.organization.id);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    log.error('Error fetching role users', { error: error.message, roleId: req.params.id });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

/**
 * POST /api/roles/assign
 * Assign role to a user
 */
router.post('/assign', checkPermission('admin'), async (req, res) => {
  try {
    const { user_id, role_name } = req.body;

    if (!user_id || !role_name) {
      return res.status(400).json({
        success: false,
        message: 'user_id and role_name are required'
      });
    }

    const result = await Role.assignRoleToUser(user_id, req.organization.id, role_name);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'User not found in organization'
      });
    }

    log.info('Role assigned', {
      targetUserId: user_id,
      roleName: role_name,
      orgId: req.organization.id,
      assignedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Role assigned successfully',
      data: result
    });
  } catch (error) {
    log.error('Error assigning role', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to assign role',
      error: error.message
    });
  }
});

module.exports = router;
