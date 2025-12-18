/**
 * SCIM 2.0 API Routes
 * Implements RFC 7643 (SCIM Core Schema) and RFC 7644 (SCIM Protocol)
 */

const express = require('express');
const router = express.Router();
const log = require('../utils/logger');
const SCIMService = require('../services/scimService');

// SCIM Bearer Token Authentication Middleware
const scimAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
        detail: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7);
    const config = await SCIMService.validateToken(token);

    if (!config) {
      return res.status(401).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
        detail: 'Invalid or expired token'
      });
    }

    if (!config.scim_enabled) {
      return res.status(403).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '403',
        detail: 'SCIM is not enabled for this configuration'
      });
    }

    req.ssoConfig = config;
    next();
  } catch (error) {
    log.error('SCIM auth error:', { error: error.message });
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Authentication error'
    });
  }
};

// Set SCIM content type for all responses
router.use((req, res, next) => {
  res.set('Content-Type', 'application/scim+json');
  next();
});

// ==================== SERVICE PROVIDER CONFIG ====================

// GET /scim/v2/ServiceProviderConfig
router.get('/ServiceProviderConfig', (req, res) => {
  res.json(SCIMService.getServiceProviderConfig());
});

// GET /scim/v2/ResourceTypes
router.get('/ResourceTypes', (req, res) => {
  res.json(SCIMService.getResourceTypes());
});

// GET /scim/v2/Schemas
router.get('/Schemas', (req, res) => {
  res.json(SCIMService.getSchemas());
});

// ==================== USERS ====================

// GET /scim/v2/Users - List users
router.get('/Users', scimAuth, async (req, res) => {
  try {
    const { filter, startIndex, count } = req.query;

    const result = await SCIMService.listUsers(req.ssoConfig.id, {
      filter,
      startIndex: parseInt(startIndex) || 1,
      count: parseInt(count) || 100
    });

    res.json(result);
  } catch (error) {
    log.error('SCIM list users error:', { error: error.message });
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: error.message
    });
  }
});

// GET /scim/v2/Users/:id - Get user
router.get('/Users/:id', scimAuth, async (req, res) => {
  try {
    const user = await SCIMService.getUser(req.ssoConfig.id, req.params.id);

    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'User not found'
      });
    }

    res.json(user);
  } catch (error) {
    log.error('SCIM get user error:', { error: error.message });
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: error.message
    });
  }
});

// POST /scim/v2/Users - Create user
router.post('/Users', scimAuth, async (req, res) => {
  try {
    const user = await SCIMService.createUser(req.ssoConfig.id, req.body);

    res.status(201).json(user);
  } catch (error) {
    log.error('SCIM create user error:', { error: error.message });

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '409',
        scimType: 'uniqueness',
        detail: error.message
      });
    }

    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '400',
      detail: error.message
    });
  }
});

// PUT /scim/v2/Users/:id - Replace user
router.put('/Users/:id', scimAuth, async (req, res) => {
  try {
    const user = await SCIMService.updateUser(req.ssoConfig.id, req.params.id, req.body);

    res.json(user);
  } catch (error) {
    log.error('SCIM update user error:', { error: error.message });

    if (error.message === 'User not found') {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'User not found'
      });
    }

    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '400',
      detail: error.message
    });
  }
});

// PATCH /scim/v2/Users/:id - Modify user
router.patch('/Users/:id', scimAuth, async (req, res) => {
  try {
    const { Operations } = req.body;

    if (!Operations || !Array.isArray(Operations)) {
      return res.status(400).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '400',
        detail: 'Invalid PATCH request - Operations array required'
      });
    }

    // Convert PATCH operations to user update
    let currentUser = await SCIMService.getUser(req.ssoConfig.id, req.params.id);

    if (!currentUser) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'User not found'
      });
    }

    // Apply operations
    for (const op of Operations) {
      switch (op.op.toLowerCase()) {
        case 'replace':
          if (op.path === 'active') {
            currentUser.active = op.value;
          } else if (op.path === 'name.givenName') {
            currentUser.name = currentUser.name || {};
            currentUser.name.givenName = op.value;
          } else if (op.path === 'name.familyName') {
            currentUser.name = currentUser.name || {};
            currentUser.name.familyName = op.value;
          } else if (op.path === 'displayName') {
            currentUser.displayName = op.value;
          } else if (!op.path && typeof op.value === 'object') {
            // Bulk replace
            Object.assign(currentUser, op.value);
          }
          break;
        case 'add':
          if (!op.path && typeof op.value === 'object') {
            Object.assign(currentUser, op.value);
          }
          break;
        case 'remove':
          // Handle remove operations
          break;
      }
    }

    const user = await SCIMService.updateUser(req.ssoConfig.id, req.params.id, currentUser);

    res.json(user);
  } catch (error) {
    log.error('SCIM patch user error:', { error: error.message });
    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '400',
      detail: error.message
    });
  }
});

// DELETE /scim/v2/Users/:id - Delete user
router.delete('/Users/:id', scimAuth, async (req, res) => {
  try {
    await SCIMService.deleteUser(req.ssoConfig.id, req.params.id);

    res.status(204).send();
  } catch (error) {
    log.error('SCIM delete user error:', { error: error.message });

    if (error.message === 'User not found') {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'User not found'
      });
    }

    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '400',
      detail: error.message
    });
  }
});

// ==================== GROUPS ====================

// GET /scim/v2/Groups - List groups
router.get('/Groups', scimAuth, async (req, res) => {
  try {
    const { filter, startIndex, count } = req.query;

    const result = await SCIMService.listGroups(req.ssoConfig.id, {
      filter,
      startIndex: parseInt(startIndex) || 1,
      count: parseInt(count) || 100
    });

    res.json(result);
  } catch (error) {
    log.error('SCIM list groups error:', { error: error.message });
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: error.message
    });
  }
});

// GET /scim/v2/Groups/:id - Get single group
router.get('/Groups/:id', scimAuth, async (req, res) => {
  try {
    const group = await SCIMService.getGroup(req.ssoConfig.id, req.params.id);

    if (!group) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'Group not found'
      });
    }

    res.json(group);
  } catch (error) {
    log.error('SCIM get group error:', { error: error.message });
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: error.message
    });
  }
});

// POST /scim/v2/Groups - Create group
router.post('/Groups', scimAuth, async (req, res) => {
  try {
    const group = await SCIMService.createGroup(req.ssoConfig.id, req.body);

    res.status(201).json(group);
  } catch (error) {
    log.error('SCIM create group error:', { error: error.message });

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '409',
        scimType: 'uniqueness',
        detail: error.message
      });
    }

    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '400',
      detail: error.message
    });
  }
});

// PUT /scim/v2/Groups/:id - Replace group
router.put('/Groups/:id', scimAuth, async (req, res) => {
  try {
    const group = await SCIMService.updateGroup(req.ssoConfig.id, req.params.id, req.body);

    res.json(group);
  } catch (error) {
    log.error('SCIM update group error:', { error: error.message });

    if (error.message === 'Group not found') {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'Group not found'
      });
    }

    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '400',
      detail: error.message
    });
  }
});

// PATCH /scim/v2/Groups/:id - Update group (members)
router.patch('/Groups/:id', scimAuth, async (req, res) => {
  try {
    const { Operations } = req.body;

    if (!Operations || !Array.isArray(Operations)) {
      return res.status(400).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '400',
        detail: 'Invalid PATCH request - Operations array required'
      });
    }

    let currentGroup = await SCIMService.getGroup(req.ssoConfig.id, req.params.id);

    if (!currentGroup) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'Group not found'
      });
    }

    // Apply operations
    for (const op of Operations) {
      const opType = op.op.toLowerCase();

      if (opType === 'add' && op.path === 'members') {
        // Add members
        const newMembers = Array.isArray(op.value) ? op.value : [op.value];
        currentGroup.members = currentGroup.members || [];
        for (const member of newMembers) {
          if (!currentGroup.members.find(m => m.value === member.value)) {
            currentGroup.members.push(member);
          }
        }
      } else if (opType === 'remove' && op.path?.startsWith('members')) {
        // Remove member - path format: members[value eq "userId"]
        const match = op.path.match(/members\[value eq "(.+)"\]/);
        if (match) {
          const userIdToRemove = match[1];
          currentGroup.members = (currentGroup.members || []).filter(m => m.value !== userIdToRemove);
        }
      } else if (opType === 'replace') {
        if (op.path === 'displayName') {
          currentGroup.displayName = op.value;
        } else if (op.path === 'members') {
          currentGroup.members = op.value;
        } else if (!op.path && typeof op.value === 'object') {
          Object.assign(currentGroup, op.value);
        }
      }
    }

    const group = await SCIMService.updateGroup(req.ssoConfig.id, req.params.id, currentGroup);

    res.json(group);
  } catch (error) {
    log.error('SCIM patch group error:', { error: error.message });
    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '400',
      detail: error.message
    });
  }
});

// DELETE /scim/v2/Groups/:id - Delete group
router.delete('/Groups/:id', scimAuth, async (req, res) => {
  try {
    await SCIMService.deleteGroup(req.ssoConfig.id, req.params.id);

    res.status(204).send();
  } catch (error) {
    log.error('SCIM delete group error:', { error: error.message });

    if (error.message === 'Group not found') {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'Group not found'
      });
    }

    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '400',
      detail: error.message
    });
  }
});

// ==================== BULK ====================

// POST /scim/v2/Bulk - Bulk operations (not supported)
router.post('/Bulk', scimAuth, (req, res) => {
  res.status(501).json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    status: '501',
    detail: 'Bulk operations not supported'
  });
});

module.exports = router;
