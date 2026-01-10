const express = require('express');
const router = express.Router();
const bannerService = require('../services/bannerService');
const { authenticateToken, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const log = require('../utils/logger');

// ========================================
// USER API ROUTES
// ========================================

/**
 * GET /api/banners
 * Get active banners for the current user (dismissed ones excluded)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPlan = req.user.plan || 'free';
    const organizationId = req.user.current_organization_id || req.user.organizationId || null;

    const banners = await bannerService.getActiveBannersForUser(userId, userPlan, organizationId);

    res.json({
      success: true,
      banners
    });
  } catch (error) {
    log.error('Error fetching banners for user', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners'
    });
  }
});

/**
 * POST /api/banners/:id/dismiss
 * Dismiss a banner for the current user
 */
router.post('/:id/dismiss', authenticateToken, async (req, res) => {
  try {
    const bannerId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(bannerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid banner ID'
      });
    }

    await bannerService.dismissBanner(bannerId, userId);

    res.json({
      success: true,
      message: 'Banner dismissed successfully'
    });
  } catch (error) {
    log.error('Error dismissing banner', { error: error.message, bannerId: req.params.id, userId: req.user?.id });

    if (error.message === 'Banner not found') {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    if (error.message === 'This banner cannot be dismissed') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to dismiss banner'
    });
  }
});

// ========================================
// ADMIN API ROUTES
// ========================================

/**
 * GET /api/banners/admin
 * Get all banners (admin only)
 */
router.get('/admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const filters = {
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      type: req.query.type,
      target_audience: req.query.target_audience,
      organization_id: req.query.organization_id ? parseInt(req.query.organization_id, 10) : undefined,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20
    };

    const result = await bannerService.getAllBanners(filters);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Error fetching all banners', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners'
    });
  }
});

/**
 * GET /api/banners/admin/:id
 * Get a single banner by ID (admin only)
 */
router.get('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const bannerId = parseInt(req.params.id, 10);

    if (isNaN(bannerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid banner ID'
      });
    }

    const banner = await bannerService.getBannerById(bannerId);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.json({
      success: true,
      banner
    });
  } catch (error) {
    log.error('Error fetching banner', { error: error.message, bannerId: req.params.id });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner'
    });
  }
});

/**
 * POST /api/banners/admin
 * Create a new banner (admin only)
 */
router.post('/admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      bg_color,
      text_color,
      link_url,
      link_text,
      target_audience,
      start_date,
      end_date,
      is_dismissible,
      is_active,
      priority,
      organization_id
    } = req.body;

    // Validation
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    // Validate type
    const validTypes = ['info', 'warning', 'success', 'error', 'promo'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Validate target_audience
    const validAudiences = ['all', 'free', 'paid', 'trial'];
    if (target_audience && !validAudiences.includes(target_audience)) {
      return res.status(400).json({
        success: false,
        message: `Invalid target_audience. Must be one of: ${validAudiences.join(', ')}`
      });
    }

    const banner = await bannerService.createBanner({
      title,
      message,
      type,
      bg_color,
      text_color,
      link_url,
      link_text,
      target_audience,
      start_date,
      end_date,
      is_dismissible,
      is_active,
      priority,
      organization_id
    }, req.user.id);

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      banner
    });
  } catch (error) {
    log.error('Error creating banner', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Failed to create banner'
    });
  }
});

/**
 * PUT /api/banners/admin/:id
 * Update a banner (admin only)
 */
router.put('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const bannerId = parseInt(req.params.id, 10);

    if (isNaN(bannerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid banner ID'
      });
    }

    const {
      title,
      message,
      type,
      bg_color,
      text_color,
      link_url,
      link_text,
      target_audience,
      start_date,
      end_date,
      is_dismissible,
      is_active,
      priority,
      organization_id
    } = req.body;

    // Validate type if provided
    const validTypes = ['info', 'warning', 'success', 'error', 'promo'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Validate target_audience if provided
    const validAudiences = ['all', 'free', 'paid', 'trial'];
    if (target_audience && !validAudiences.includes(target_audience)) {
      return res.status(400).json({
        success: false,
        message: `Invalid target_audience. Must be one of: ${validAudiences.join(', ')}`
      });
    }

    const banner = await bannerService.updateBanner(bannerId, {
      title,
      message,
      type,
      bg_color,
      text_color,
      link_url,
      link_text,
      target_audience,
      start_date,
      end_date,
      is_dismissible,
      is_active,
      priority,
      organization_id
    });

    res.json({
      success: true,
      message: 'Banner updated successfully',
      banner
    });
  } catch (error) {
    log.error('Error updating banner', { error: error.message, bannerId: req.params.id });

    if (error.message === 'Banner not found') {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update banner'
    });
  }
});

/**
 * POST /api/banners/admin/:id/toggle
 * Toggle banner active status (admin only)
 */
router.post('/admin/:id/toggle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const bannerId = parseInt(req.params.id, 10);

    if (isNaN(bannerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid banner ID'
      });
    }

    // Get current banner
    const currentBanner = await bannerService.getBannerById(bannerId);
    if (!currentBanner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Toggle is_active
    const banner = await bannerService.updateBanner(bannerId, {
      is_active: !currentBanner.is_active
    });

    res.json({
      success: true,
      message: `Banner ${banner.is_active ? 'activated' : 'deactivated'} successfully`,
      banner
    });
  } catch (error) {
    log.error('Error toggling banner status', { error: error.message, bannerId: req.params.id });
    res.status(500).json({
      success: false,
      message: 'Failed to toggle banner status'
    });
  }
});

/**
 * DELETE /api/banners/admin/:id
 * Delete a banner (admin only)
 */
router.delete('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const bannerId = parseInt(req.params.id, 10);

    if (isNaN(bannerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid banner ID'
      });
    }

    await bannerService.deleteBanner(bannerId);

    res.json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting banner', { error: error.message, bannerId: req.params.id });

    if (error.message === 'Banner not found') {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete banner'
    });
  }
});

module.exports = router;
