/**
 * Fine-Tuning Cost & Notification API Routes
 * Handles cost tracking, budget management, and notifications
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const fineTuningCostService = require('../services/fine-tuning-cost.service');
const fineTuningNotificationService = require('../services/fine-tuning-notification.service');
const log = require('../utils/logger');

// ==================== COST ROUTES ====================

/**
 * GET /api/fine-tuning/costs
 * Get cost history for organization
 */
router.get('/costs', auth, async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.org_id;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'Organization ID required' });
    }

    const { page, limit, start_date, end_date, status, model } = req.query;

    const result = await fineTuningCostService.getCostHistory(organizationId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      startDate: start_date,
      endDate: end_date,
      status,
      model
    });

    res.json({ success: true, ...result });
  } catch (error) {
    log.error('Get cost history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/fine-tuning/costs/estimate
 * Get cost estimate for training
 */
router.get('/costs/estimate', auth, async (req, res) => {
  try {
    const { tokens, model, epochs, file_size } = req.query;

    let estimation;
    if (tokens) {
      estimation = fineTuningCostService.calculateTrainingCost(
        parseInt(tokens),
        model || 'gpt-3.5-turbo',
        parseInt(epochs) || 3
      );
    } else if (file_size) {
      estimation = fineTuningCostService.estimateCostFromFileSize(
        parseInt(file_size),
        model || 'gpt-3.5-turbo',
        parseInt(epochs) || 3
      );
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either tokens or file_size is required'
      });
    }

    res.json({ success: true, estimation });
  } catch (error) {
    log.error('Get cost estimate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/fine-tuning/costs/by-model
 * Get cost breakdown by model
 */
router.get('/costs/by-model', auth, async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.org_id;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'Organization ID required' });
    }

    const { start_date, end_date } = req.query;

    const costByModel = await fineTuningCostService.getCostByModel(organizationId, {
      startDate: start_date,
      endDate: end_date
    });

    res.json({ success: true, costByModel });
  } catch (error) {
    log.error('Get cost by model error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/fine-tuning/costs/monthly
 * Get monthly cost summary
 */
router.get('/costs/monthly', auth, async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.org_id;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'Organization ID required' });
    }

    const { months } = req.query;

    const monthlySummary = await fineTuningCostService.getMonthlyCostSummary(
      organizationId,
      parseInt(months) || 6
    );

    res.json({ success: true, monthlySummary });
  } catch (error) {
    log.error('Get monthly cost summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/fine-tuning/costs/pricing
 * Get model pricing information
 */
router.get('/costs/pricing', auth, async (req, res) => {
  try {
    const { model } = req.query;

    if (model) {
      const pricing = fineTuningCostService.getModelPricing(model);
      res.json({ success: true, pricing });
    } else {
      const allPricing = fineTuningCostService.getAllModelPricing();
      res.json({ success: true, pricing: allPricing });
    }
  } catch (error) {
    log.error('Get pricing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== BUDGET ROUTES ====================

/**
 * GET /api/fine-tuning/budget
 * Get budget for organization
 */
router.get('/budget', auth, async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.org_id;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'Organization ID required' });
    }

    const budget = await fineTuningCostService.getBudget(organizationId);
    const alert = await fineTuningCostService.getBudgetAlert(organizationId);

    res.json({ success: true, budget, alert });
  } catch (error) {
    log.error('Get budget error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/fine-tuning/budget
 * Set budget limit
 */
router.post('/budget', auth, async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.org_id;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'Organization ID required' });
    }

    const { monthly_limit, alert_threshold, alert_enabled, auto_stop } = req.body;

    const budget = await fineTuningCostService.setBudget(organizationId, {
      monthlyLimit: monthly_limit,
      alertThreshold: alert_threshold,
      alertEnabled: alert_enabled,
      autoStop: auto_stop
    });

    res.json({ success: true, budget });
  } catch (error) {
    log.error('Set budget error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/fine-tuning/budget/check
 * Check if budget allows training
 */
router.post('/budget/check', auth, async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.org_id;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'Organization ID required' });
    }

    const { estimated_cost } = req.body;
    if (!estimated_cost) {
      return res.status(400).json({ success: false, error: 'estimated_cost is required' });
    }

    const result = await fineTuningCostService.checkBudgetForTraining(
      organizationId,
      parseFloat(estimated_cost)
    );

    res.json({ success: true, ...result });
  } catch (error) {
    log.error('Budget check error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/fine-tuning/budget/reset
 * Reset budget for new period
 */
router.post('/budget/reset', auth, async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.org_id;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'Organization ID required' });
    }

    await fineTuningCostService.resetBudget(organizationId);

    res.json({ success: true, message: 'Budget reset successfully' });
  } catch (error) {
    log.error('Reset budget error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== NOTIFICATION ROUTES ====================

/**
 * GET /api/fine-tuning/notifications
 * Get notifications for user
 */
router.get('/notifications', auth, async (req, res) => {
  try {
    const { page, limit, unread_only, type } = req.query;

    const result = await fineTuningNotificationService.getNotifications(req.user.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      unreadOnly: unread_only === 'true',
      type
    });

    res.json({ success: true, ...result });
  } catch (error) {
    log.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/fine-tuning/notifications/:id/read
 * Mark notification as read
 */
router.post('/notifications/:id/read', auth, async (req, res) => {
  try {
    await fineTuningNotificationService.markAsRead(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    log.error('Mark notification read error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/fine-tuning/notifications/read-all
 * Mark all notifications as read
 */
router.post('/notifications/read-all', auth, async (req, res) => {
  try {
    await fineTuningNotificationService.markAllAsRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    log.error('Mark all notifications read error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/fine-tuning/notifications/:id
 * Delete notification
 */
router.delete('/notifications/:id', auth, async (req, res) => {
  try {
    await fineTuningNotificationService.deleteNotification(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    log.error('Delete notification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/fine-tuning/notifications/settings
 * Get notification settings
 */
router.get('/notifications/settings', auth, async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.org_id;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'Organization ID required' });
    }

    const settings = await fineTuningNotificationService.getNotificationSettings(
      organizationId,
      req.user.id
    );

    res.json({ success: true, settings });
  } catch (error) {
    log.error('Get notification settings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/fine-tuning/notifications/settings
 * Update notification settings
 */
router.put('/notifications/settings', auth, async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.org_id;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'Organization ID required' });
    }

    const settings = await fineTuningNotificationService.updateNotificationSettings(
      organizationId,
      req.user.id,
      req.body
    );

    res.json({ success: true, settings });
  } catch (error) {
    log.error('Update notification settings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
