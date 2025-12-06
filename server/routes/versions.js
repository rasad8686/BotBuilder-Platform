const express = require('express');
const router = express.Router();
const VersionControl = require('../collaboration/core/VersionControl');
const EntityVersion = require('../models/EntityVersion');
const ActivityLog = require('../models/ActivityLog');
const authenticateToken = require('../middleware/auth');
const log = require('../utils/logger');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/versions/:entityType/:entityId - versiya tarixi
router.get('/:entityType/:entityId', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { entityType, entityId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const versions = await EntityVersion.findByEntity(tenantId, entityType, parseInt(entityId), {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const count = await EntityVersion.countByEntity(tenantId, entityType, parseInt(entityId));

    res.json({
      versions,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    log.error('Error fetching versions:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// POST /api/versions/:entityType/:entityId - yeni versiya
router.post('/:entityType/:entityId', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { entityType, entityId } = req.params;
    const { data, commitMessage } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'data is required' });
    }

    const versionControl = new VersionControl(tenantId);
    const version = await versionControl.createVersion(
      entityType,
      parseInt(entityId),
      data,
      req.user.id,
      commitMessage
    );

    await ActivityLog.create({
      tenantId,
      userId: req.user.id,
      action: 'version_created',
      entityType,
      entityId: parseInt(entityId),
      changes: { versionNumber: version.version_number, commitMessage },
      ipAddress: req.ip
    });

    res.status(201).json(version);
  } catch (error) {
    log.error('Error creating version:', { error: error.message });
    res.status(500).json({ error: 'Failed to create version' });
  }
});

// GET /api/versions/:entityType/:entityId/latest - son versiya
router.get('/:entityType/:entityId/latest', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { entityType, entityId } = req.params;

    const version = await EntityVersion.getLatest(tenantId, entityType, parseInt(entityId));

    if (!version) {
      return res.status(404).json({ error: 'No versions found' });
    }

    res.json(version);
  } catch (error) {
    log.error('Error fetching latest version:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch latest version' });
  }
});

// GET /api/versions/:entityType/:entityId/:versionNumber - spesifik versiya
router.get('/:entityType/:entityId/:versionNumber', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { entityType, entityId, versionNumber } = req.params;

    const version = await EntityVersion.getByVersionNumber(
      tenantId,
      entityType,
      parseInt(entityId),
      parseInt(versionNumber)
    );

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json(version);
  } catch (error) {
    log.error('Error fetching version:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch version' });
  }
});

// POST /api/versions/:entityType/:entityId/rollback - rollback
router.post('/:entityType/:entityId/rollback', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { entityType, entityId } = req.params;
    const { targetVersion, commitMessage } = req.body;

    if (!targetVersion) {
      return res.status(400).json({ error: 'targetVersion is required' });
    }

    const versionControl = new VersionControl(tenantId);
    const result = await versionControl.rollback(
      entityType,
      parseInt(entityId),
      parseInt(targetVersion),
      req.user.id,
      commitMessage
    );

    await ActivityLog.create({
      tenantId,
      userId: req.user.id,
      action: 'version_rollback',
      entityType,
      entityId: parseInt(entityId),
      changes: {
        rolledBackTo: result.rolledBackTo,
        newVersionNumber: result.newVersion.version_number
      },
      ipAddress: req.ip
    });

    res.json(result);
  } catch (error) {
    log.error('Error rolling back version:', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// GET /api/versions/:entityType/:entityId/diff - diff görüntülə
router.get('/:entityType/:entityId/diff', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { entityType, entityId } = req.params;
    const { from, to } = req.query;

    const versionControl = new VersionControl(tenantId);
    const diff = await versionControl.getDiff(
      entityType,
      parseInt(entityId),
      from ? parseInt(from) : null,
      to ? parseInt(to) : null
    );

    res.json(diff);
  } catch (error) {
    log.error('Error getting diff:', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// POST /api/versions/:entityType/:entityId/compare - iki versiya müqayisəsi
router.post('/:entityType/:entityId/compare', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { entityType, entityId } = req.params;
    const { versionA, versionB } = req.body;

    if (!versionA || !versionB) {
      return res.status(400).json({ error: 'versionA and versionB are required' });
    }

    const comparison = await EntityVersion.compare(
      tenantId,
      entityType,
      parseInt(entityId),
      parseInt(versionA),
      parseInt(versionB)
    );

    res.json(comparison);
  } catch (error) {
    log.error('Error comparing versions:', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// GET /api/versions/:entityType/:entityId/branches - branch-lar
router.get('/:entityType/:entityId/branches', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { entityType, entityId } = req.params;

    const versionControl = new VersionControl(tenantId);
    const branches = await versionControl.getBranches(entityType, parseInt(entityId));

    res.json(branches);
  } catch (error) {
    log.error('Error fetching branches:', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

// POST /api/versions/:entityType/:entityId/branches - branch yarat
router.post('/:entityType/:entityId/branches', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { entityType, entityId } = req.params;
    const { branchName, baseVersionId } = req.body;

    if (!branchName || !baseVersionId) {
      return res.status(400).json({ error: 'branchName and baseVersionId are required' });
    }

    const versionControl = new VersionControl(tenantId);
    const branch = await versionControl.createBranch(
      entityType,
      parseInt(entityId),
      branchName,
      parseInt(baseVersionId),
      req.user.id
    );

    await ActivityLog.create({
      tenantId,
      userId: req.user.id,
      action: 'branch_created',
      entityType,
      entityId: parseInt(entityId),
      changes: { branchName, baseVersionId },
      ipAddress: req.ip
    });

    res.status(201).json(branch);
  } catch (error) {
    log.error('Error creating branch:', { error: error.message });
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// POST /api/versions/:entityType/:entityId/branches/merge - branch merge
router.post('/:entityType/:entityId/branches/merge', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { entityType, entityId } = req.params;
    const { sourceBranch, targetBranch, commitMessage } = req.body;

    if (!sourceBranch || !targetBranch) {
      return res.status(400).json({ error: 'sourceBranch and targetBranch are required' });
    }

    const versionControl = new VersionControl(tenantId);
    const result = await versionControl.mergeBranch(
      entityType,
      parseInt(entityId),
      sourceBranch,
      targetBranch,
      req.user.id,
      commitMessage
    );

    await ActivityLog.create({
      tenantId,
      userId: req.user.id,
      action: 'branch_merged',
      entityType,
      entityId: parseInt(entityId),
      changes: { sourceBranch, targetBranch },
      ipAddress: req.ip
    });

    res.json(result);
  } catch (error) {
    log.error('Error merging branch:', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/versions/:entityType/:entityId/branches/:branchName - branch sil
router.delete('/:entityType/:entityId/branches/:branchName', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.organization_id;
    const { entityType, entityId, branchName } = req.params;

    const versionControl = new VersionControl(tenantId);
    const branch = await versionControl.deleteBranch(entityType, parseInt(entityId), branchName);

    await ActivityLog.create({
      tenantId,
      userId: req.user.id,
      action: 'branch_deleted',
      entityType,
      entityId: parseInt(entityId),
      changes: { branchName },
      ipAddress: req.ip
    });

    res.json({ message: 'Branch deleted', branch });
  } catch (error) {
    log.error('Error deleting branch:', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
