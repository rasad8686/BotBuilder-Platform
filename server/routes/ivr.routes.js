/**
 * IVR API Routes
 * Handles IVR flow CRUD operations and management
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ivrService = require('../services/ivr.service');

/**
 * @route GET /api/voice/ivr
 * @desc Get all IVR flows for organization
 * @access Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.org_id;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'Organization ID required' });
    }

    const { page, limit, status, search } = req.query;

    const result = await ivrService.getFlowsByOrganization(organizationId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status,
      search
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting IVR flows:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr
 * @desc Create new IVR flow
 * @access Private
 */
router.post('/', auth, async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.org_id;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'Organization ID required' });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Flow name is required' });
    }

    const flow = await ivrService.createFlow(organizationId, req.body, req.user.id);

    res.status(201).json({
      success: true,
      flow
    });
  } catch (error) {
    console.error('Error creating IVR flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/voice/ivr/:id
 * @desc Get IVR flow by ID
 * @access Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const flow = await ivrService.getFlowById(req.params.id);

    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    // Verify organization access
    const organizationId = req.user.organization_id || req.user.org_id;
    if (flow.organization_id !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({
      success: true,
      flow
    });
  } catch (error) {
    console.error('Error getting IVR flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route PUT /api/voice/ivr/:id
 * @desc Update IVR flow
 * @access Private
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const flow = await ivrService.getFlowById(req.params.id);

    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    // Verify organization access
    const organizationId = req.user.organization_id || req.user.org_id;
    if (flow.organization_id !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const updatedFlow = await ivrService.updateFlow(req.params.id, req.body, req.user.id);

    res.json({
      success: true,
      flow: updatedFlow
    });
  } catch (error) {
    console.error('Error updating IVR flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route DELETE /api/voice/ivr/:id
 * @desc Delete IVR flow
 * @access Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const flow = await ivrService.getFlowById(req.params.id);

    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    // Verify organization access
    const organizationId = req.user.organization_id || req.user.org_id;
    if (flow.organization_id !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await ivrService.deleteFlow(req.params.id);

    res.json({
      success: true,
      message: 'Flow deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting IVR flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/duplicate
 * @desc Duplicate IVR flow
 * @access Private
 */
router.post('/:id/duplicate', auth, async (req, res) => {
  try {
    const flow = await ivrService.getFlowById(req.params.id);

    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    // Verify organization access
    const organizationId = req.user.organization_id || req.user.org_id;
    if (flow.organization_id !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { name } = req.body;
    const duplicatedFlow = await ivrService.duplicateFlow(req.params.id, req.user.id, name);

    res.status(201).json({
      success: true,
      flow: duplicatedFlow
    });
  } catch (error) {
    console.error('Error duplicating IVR flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/activate
 * @desc Activate IVR flow
 * @access Private
 */
router.post('/:id/activate', auth, async (req, res) => {
  try {
    const flow = await ivrService.getFlowById(req.params.id);

    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    // Verify organization access
    const organizationId = req.user.organization_id || req.user.org_id;
    if (flow.organization_id !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const activatedFlow = await ivrService.activateFlow(req.params.id, req.user.id);

    res.json({
      success: true,
      flow: activatedFlow
    });
  } catch (error) {
    console.error('Error activating IVR flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/deactivate
 * @desc Deactivate IVR flow
 * @access Private
 */
router.post('/:id/deactivate', auth, async (req, res) => {
  try {
    const flow = await ivrService.getFlowById(req.params.id);

    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    // Verify organization access
    const organizationId = req.user.organization_id || req.user.org_id;
    if (flow.organization_id !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const deactivatedFlow = await ivrService.deactivateFlow(req.params.id, req.user.id);

    res.json({
      success: true,
      flow: deactivatedFlow
    });
  } catch (error) {
    console.error('Error deactivating IVR flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/validate
 * @desc Validate IVR flow
 * @access Private
 */
router.post('/:id/validate', auth, async (req, res) => {
  try {
    const flow = await ivrService.getFlowById(req.params.id);

    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    // Verify organization access
    const organizationId = req.user.organization_id || req.user.org_id;
    if (flow.organization_id !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const validation = await ivrService.validateFlow(req.params.id);

    res.json({
      success: true,
      validation
    });
  } catch (error) {
    console.error('Error validating IVR flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/voice/ivr/:id/analytics
 * @desc Get IVR flow analytics
 * @access Private
 */
router.get('/:id/analytics', auth, async (req, res) => {
  try {
    const flow = await ivrService.getFlowById(req.params.id);

    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    // Verify organization access
    const organizationId = req.user.organization_id || req.user.org_id;
    if (flow.organization_id !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { startDate, endDate } = req.query;
    const analytics = await ivrService.getFlowAnalytics(req.params.id, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error getting IVR analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/voice/ivr/:id/versions
 * @desc Get IVR flow version history
 * @access Private
 */
router.get('/:id/versions', auth, async (req, res) => {
  try {
    const flow = await ivrService.getFlowById(req.params.id);

    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    // Verify organization access
    const organizationId = req.user.organization_id || req.user.org_id;
    if (flow.organization_id !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const versions = await ivrService.getFlowVersions(req.params.id);

    res.json({
      success: true,
      versions
    });
  } catch (error) {
    console.error('Error getting IVR versions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/:id/restore/:version
 * @desc Restore IVR flow to a specific version
 * @access Private
 */
router.post('/:id/restore/:version', auth, async (req, res) => {
  try {
    const flow = await ivrService.getFlowById(req.params.id);

    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }

    // Verify organization access
    const organizationId = req.user.organization_id || req.user.org_id;
    if (flow.organization_id !== organizationId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const restoredFlow = await ivrService.restoreFlowVersion(
      req.params.id,
      parseInt(req.params.version),
      req.user.id
    );

    res.json({
      success: true,
      flow: restoredFlow
    });
  } catch (error) {
    console.error('Error restoring IVR version:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
