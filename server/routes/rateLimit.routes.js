const express = require('express');
const router = express.Router();
const rateLimitService = require('../services/rateLimitService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const log = require('../utils/logger');

// All routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/rate-limit/settings
 * Get all rate limit settings
 */
router.get('/settings', async (req, res) => {
  try {
    const settings = await rateLimitService.getSettings();

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    log.error('Error fetching rate limit settings', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
});

/**
 * POST /api/admin/rate-limit/settings
 * Create a new rate limit setting
 */
router.post('/settings', async (req, res) => {
  try {
    const { key, max_attempts, window_ms, block_duration_ms, is_enabled } = req.body;

    if (!key || key.length < 2 || key.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Key must be between 2 and 50 characters'
      });
    }

    // Validation
    if (max_attempts !== undefined && (max_attempts < 1 || max_attempts > 1000)) {
      return res.status(400).json({
        success: false,
        message: 'max_attempts must be between 1 and 1000'
      });
    }

    if (window_ms !== undefined && (window_ms < 1000 || window_ms > 86400000)) {
      return res.status(400).json({
        success: false,
        message: 'window_ms must be between 1000 (1s) and 86400000 (24h)'
      });
    }

    if (block_duration_ms !== undefined && (block_duration_ms < 1000 || block_duration_ms > 604800000)) {
      return res.status(400).json({
        success: false,
        message: 'block_duration_ms must be between 1000 (1s) and 604800000 (7 days)'
      });
    }

    const setting = await rateLimitService.createSetting({
      key,
      max_attempts: max_attempts || 10,
      window_ms: window_ms || 900000,
      block_duration_ms: block_duration_ms || 1800000,
      is_enabled: is_enabled !== false
    }, req.user.id);

    res.status(201).json({
      success: true,
      message: 'Setting created successfully',
      setting
    });
  } catch (error) {
    log.error('Error creating rate limit setting', { error: error.message });

    if (error.message === 'Setting already exists') {
      return res.status(409).json({
        success: false,
        message: 'A setting with this key already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create setting'
    });
  }
});

/**
 * PUT /api/admin/rate-limit/settings/:key
 * Update a rate limit setting
 */
router.put('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;

    const { max_attempts, window_ms, block_duration_ms, is_enabled } = req.body;

    // Validation
    if (max_attempts !== undefined && (max_attempts < 1 || max_attempts > 1000)) {
      return res.status(400).json({
        success: false,
        message: 'max_attempts must be between 1 and 1000'
      });
    }

    if (window_ms !== undefined && (window_ms < 1000 || window_ms > 86400000)) {
      return res.status(400).json({
        success: false,
        message: 'window_ms must be between 1000 (1s) and 86400000 (24h)'
      });
    }

    if (block_duration_ms !== undefined && (block_duration_ms < 1000 || block_duration_ms > 604800000)) {
      return res.status(400).json({
        success: false,
        message: 'block_duration_ms must be between 1000 (1s) and 604800000 (7 days)'
      });
    }

    const setting = await rateLimitService.updateSetting(key, {
      max_attempts,
      window_ms,
      block_duration_ms,
      is_enabled
    }, req.user.id);

    res.json({
      success: true,
      message: 'Setting updated successfully',
      setting
    });
  } catch (error) {
    log.error('Error updating rate limit setting', { error: error.message, key: req.params.key });

    if (error.message === 'Setting not found') {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update setting'
    });
  }
});

/**
 * DELETE /api/admin/rate-limit/settings/:key
 * Delete a rate limit setting
 */
router.delete('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;

    await rateLimitService.deleteSetting(key, req.user.id);

    res.json({
      success: true,
      message: 'Setting deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting rate limit setting', { error: error.message, key: req.params.key });

    if (error.message === 'Setting not found') {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete setting'
    });
  }
});

/**
 * GET /api/admin/rate-limit/blocked
 * Get blocked IPs
 */
router.get('/blocked', async (req, res) => {
  try {
    const filters = {
      reason: req.query.reason,
      is_permanent: req.query.is_permanent === 'true' ? true : req.query.is_permanent === 'false' ? false : undefined,
      include_expired: req.query.include_expired === 'true',
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20
    };

    const result = await rateLimitService.getBlockedIps(filters);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Error fetching blocked IPs', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocked IPs'
    });
  }
});

/**
 * POST /api/admin/rate-limit/block
 * Manually block an IP
 */
router.post('/block', async (req, res) => {
  try {
    const { ip_address, reason, duration_ms, is_permanent } = req.body;

    if (!ip_address) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required'
      });
    }

    // Validate IP format (basic validation)
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([a-fA-F0-9:]+)$/;
    if (!ipRegex.test(ip_address)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid IP address format'
      });
    }

    const durationToUse = is_permanent ? null : (duration_ms || 3600000); // Default 1 hour

    const block = await rateLimitService.blockIpManually(
      ip_address,
      reason || 'manual',
      durationToUse,
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: 'IP blocked successfully',
      block
    });
  } catch (error) {
    log.error('Error blocking IP', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to block IP'
    });
  }
});

/**
 * PUT /api/admin/rate-limit/blocked/:id
 * Update a blocked IP record
 */
router.put('/blocked/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid block ID'
      });
    }

    const { reason, duration_ms, is_permanent } = req.body;

    const updated = await rateLimitService.updateBlock(id, {
      reason,
      duration_ms,
      is_permanent
    }, req.user.id);

    res.json({
      success: true,
      message: 'Block updated successfully',
      block: updated
    });
  } catch (error) {
    log.error('Error updating block', { error: error.message, id: req.params.id });

    if (error.message === 'Block record not found') {
      return res.status(404).json({
        success: false,
        message: 'Block record not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update block'
    });
  }
});

/**
 * DELETE /api/admin/rate-limit/blocked/:id
 * Unblock an IP
 */
router.delete('/blocked/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid block ID'
      });
    }

    await rateLimitService.unblockIp(id, req.user.id);

    res.json({
      success: true,
      message: 'IP unblocked successfully'
    });
  } catch (error) {
    log.error('Error unblocking IP', { error: error.message, id: req.params.id });

    if (error.message === 'Block record not found') {
      return res.status(404).json({
        success: false,
        message: 'Block record not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to unblock IP'
    });
  }
});

/**
 * GET /api/admin/rate-limit/logs
 * Get audit logs
 */
router.get('/logs', async (req, res) => {
  try {
    const filters = {
      action: req.query.action,
      endpoint: req.query.endpoint,
      ip_address: req.query.ip_address,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 50
    };

    const result = await rateLimitService.getAuditLogs(filters);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Error fetching audit logs', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs'
    });
  }
});

/**
 * GET /api/admin/rate-limit/stats
 * Get rate limit statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await rateLimitService.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    log.error('Error fetching rate limit stats', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

/**
 * POST /api/admin/rate-limit/cleanup
 * Cleanup expired blocks (can be called by cron)
 */
router.post('/cleanup', async (req, res) => {
  try {
    const count = await rateLimitService.cleanupExpiredBlocks();

    res.json({
      success: true,
      message: `Cleaned up ${count} expired block(s)`,
      cleaned: count
    });
  } catch (error) {
    log.error('Error cleaning up expired blocks', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup expired blocks'
    });
  }
});

module.exports = router;
