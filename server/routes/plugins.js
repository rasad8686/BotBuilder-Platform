/**
 * Plugin Marketplace API Routes
 */

const express = require('express');
const router = express.Router();
const log = require('../utils/logger');
const Plugin = require('../models/Plugin');
const PluginInstallation = require('../models/PluginInstallation');
const PluginBilling = require('../plugins/billing/PluginBilling');
const RevenueShare = require('../plugins/billing/RevenueShare');
const authMiddleware = require('../middleware/auth');
const db = require('../db');

// Public routes (no auth required)

/**
 * GET /api/plugins
 * Get all published plugins
 */
router.get('/', async (req, res) => {
  try {
    const { category, orderBy = 'downloads', limit = 50, offset = 0 } = req.query;

    let plugins;
    if (category) {
      plugins = await Plugin.getByCategory(category, { limit: parseInt(limit), offset: parseInt(offset) });
    } else {
      plugins = await Plugin.findAll({ orderBy, limit: parseInt(limit), offset: parseInt(offset) });
    }

    res.json(plugins);
  } catch (error) {
    log.error('Error fetching plugins', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch plugins' });
  }
});

/**
 * GET /api/plugins/categories
 * Get all plugin categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await Plugin.getCategories();
    res.json(categories);
  } catch (error) {
    log.error('Error fetching categories', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/plugins/featured
 * Get featured plugins
 */
router.get('/featured', async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const plugins = await Plugin.getFeatured(parseInt(limit));
    res.json(plugins);
  } catch (error) {
    log.error('Error fetching featured plugins', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch featured plugins' });
  }
});

/**
 * GET /api/plugins/search
 * Search plugins
 */
router.get('/search', async (req, res) => {
  try {
    const { q, category_id, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const plugins = await Plugin.search(q.trim(), {
      category_id: category_id ? parseInt(category_id) : null,
      limit: parseInt(limit)
    });

    res.json(plugins);
  } catch (error) {
    log.error('Error searching plugins', { error: error.message });
    res.status(500).json({ error: 'Failed to search plugins' });
  }
});

/**
 * GET /api/plugins/:id
 * Get single plugin details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let plugin;
    if (isNaN(id)) {
      plugin = await Plugin.findBySlug(id);
    } else {
      plugin = await Plugin.findById(parseInt(id));
    }

    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    res.json(plugin);
  } catch (error) {
    log.error('Error fetching plugin', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch plugin' });
  }
});

/**
 * GET /api/plugins/:id/reviews
 * Get plugin reviews
 */
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT pr.*, u.username, u.email
       FROM plugin_reviews pr
       LEFT JOIN users u ON pr.user_id = u.id
       WHERE pr.plugin_id = $1
       ORDER BY pr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [parseInt(id), parseInt(limit), parseInt(offset)]
    );

    res.json(result.rows);
  } catch (error) {
    log.error('Error fetching reviews', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Protected routes (auth required)
router.use(authMiddleware);

/**
 * GET /api/plugins/installed
 * Get installed plugins for current tenant
 */
router.get('/user/installed', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const installations = await PluginInstallation.getByTenant(tenantId);
    res.json(installations);
  } catch (error) {
    log.error('Error fetching installed plugins', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch installed plugins' });
  }
});

/**
 * POST /api/plugins
 * Create a new plugin (developer)
 */
router.post('/', async (req, res) => {
  try {
    const developerId = req.user.id;
    const {
      name,
      slug,
      description,
      version,
      category_id,
      icon_url,
      banner_url,
      price,
      is_free,
      manifest,
      permissions
    } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    // Check slug uniqueness
    const existing = await Plugin.findBySlug(slug);
    if (existing) {
      return res.status(400).json({ error: 'Plugin with this slug already exists' });
    }

    const plugin = await Plugin.create({
      developer_id: developerId,
      name,
      slug,
      description,
      version,
      category_id,
      icon_url,
      banner_url,
      price: price || 0,
      is_free: is_free !== false,
      status: 'pending',
      manifest: manifest || {},
      permissions: permissions || []
    });

    res.status(201).json(plugin);
  } catch (error) {
    log.error('Error creating plugin', { error: error.message });
    res.status(500).json({ error: 'Failed to create plugin' });
  }
});

/**
 * PUT /api/plugins/:id
 * Update a plugin
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const developerId = req.user.id;

    const plugin = await Plugin.findById(parseInt(id));
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    if (plugin.developer_id !== developerId) {
      return res.status(403).json({ error: 'Not authorized to update this plugin' });
    }

    const updated = await Plugin.update(parseInt(id), req.body);
    res.json(updated);
  } catch (error) {
    log.error('Error updating plugin', { error: error.message });
    res.status(500).json({ error: 'Failed to update plugin' });
  }
});

/**
 * DELETE /api/plugins/:id
 * Delete a plugin
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const developerId = req.user.id;

    const plugin = await Plugin.findById(parseInt(id));
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    if (plugin.developer_id !== developerId) {
      return res.status(403).json({ error: 'Not authorized to delete this plugin' });
    }

    await Plugin.delete(parseInt(id));
    res.json({ message: 'Plugin deleted successfully' });
  } catch (error) {
    log.error('Error deleting plugin', { error: error.message });
    res.status(500).json({ error: 'Failed to delete plugin' });
  }
});

/**
 * POST /api/plugins/:id/install
 * Install a plugin
 */
router.post('/:id/install', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;
    const { settings } = req.body;

    const plugin = await Plugin.findById(parseInt(id));
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    if (plugin.status !== 'published') {
      return res.status(400).json({ error: 'Plugin is not available for installation' });
    }

    // Check if already installed
    const isInstalled = await PluginInstallation.isInstalled(parseInt(id), tenantId);
    if (isInstalled) {
      return res.status(400).json({ error: 'Plugin is already installed' });
    }

    const installation = await PluginInstallation.install(
      parseInt(id),
      tenantId,
      plugin.version,
      settings || {}
    );

    // Increment download count
    await Plugin.incrementDownloads(parseInt(id));

    res.status(201).json({
      message: 'Plugin installed successfully',
      installation
    });
  } catch (error) {
    log.error('Error installing plugin', { error: error.message });
    res.status(500).json({ error: 'Failed to install plugin' });
  }
});

/**
 * POST /api/plugins/:id/uninstall
 * Uninstall a plugin
 */
router.post('/:id/uninstall', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const installation = await PluginInstallation.getInstallation(parseInt(id), tenantId);
    if (!installation) {
      return res.status(404).json({ error: 'Plugin is not installed' });
    }

    await PluginInstallation.uninstall(parseInt(id), tenantId);

    res.json({ message: 'Plugin uninstalled successfully' });
  } catch (error) {
    log.error('Error uninstalling plugin', { error: error.message });
    res.status(500).json({ error: 'Failed to uninstall plugin' });
  }
});

/**
 * PUT /api/plugins/:id/settings
 * Update plugin installation settings
 */
router.put('/:id/settings', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;
    const { settings } = req.body;

    const installation = await PluginInstallation.getInstallation(parseInt(id), tenantId);
    if (!installation) {
      return res.status(404).json({ error: 'Plugin is not installed' });
    }

    const updated = await PluginInstallation.updateSettings(parseInt(id), tenantId, settings);
    res.json(updated);
  } catch (error) {
    log.error('Error updating plugin settings', { error: error.message });
    res.status(500).json({ error: 'Failed to update plugin settings' });
  }
});

/**
 * POST /api/plugins/:id/reviews
 * Add a review for a plugin
 */
router.post('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const plugin = await Plugin.findById(parseInt(id));
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    // Insert or update review
    const result = await db.query(
      `INSERT INTO plugin_reviews (plugin_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (plugin_id, user_id)
       DO UPDATE SET rating = $3, comment = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [parseInt(id), userId, rating, comment || null]
    );

    // Update plugin rating
    await Plugin.updateRating(parseInt(id));

    res.status(201).json(result.rows[0]);
  } catch (error) {
    log.error('Error adding review', { error: error.message });
    res.status(500).json({ error: 'Failed to add review' });
  }
});

/**
 * DELETE /api/plugins/:id/reviews
 * Delete own review
 */
router.delete('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `DELETE FROM plugin_reviews WHERE plugin_id = $1 AND user_id = $2 RETURNING *`,
      [parseInt(id), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Update plugin rating
    await Plugin.updateRating(parseInt(id));

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    log.error('Error deleting review', { error: error.message });
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

/**
 * GET /api/plugins/developer/my
 * Get plugins created by current user
 */
router.get('/developer/my', async (req, res) => {
  try {
    const developerId = req.user.id;
    const plugins = await Plugin.getByDeveloper(developerId);
    res.json(plugins);
  } catch (error) {
    log.error('Error fetching developer plugins', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch developer plugins' });
  }
});

/**
 * GET /api/plugins/developer/my-plugins
 * Alias for developer plugins (used by developer portal)
 */
router.get('/developer/my-plugins', async (req, res) => {
  try {
    const developerId = req.user.id;
    const plugins = await Plugin.getByDeveloper(developerId);
    res.json(plugins);
  } catch (error) {
    log.error('Error fetching developer plugins', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch developer plugins' });
  }
});

// =============================================
// BILLING ROUTES
// =============================================

/**
 * POST /api/plugins/:id/purchase
 * Purchase a paid plugin
 */
router.post('/:id/purchase', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { paymentMethodId, successUrl, cancelUrl } = req.body;

    const plugin = await Plugin.findById(parseInt(id));
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }

    if (plugin.is_free) {
      return res.status(400).json({ error: 'This plugin is free. Use install endpoint instead.' });
    }

    // Check if already purchased
    const hasPurchased = await PluginBilling.hasPurchased(userId, parseInt(id));
    if (hasPurchased) {
      return res.status(400).json({ error: 'You have already purchased this plugin' });
    }

    // Create checkout session
    if (successUrl && cancelUrl) {
      const session = await PluginBilling.createCheckoutSession(
        userId,
        parseInt(id),
        successUrl,
        cancelUrl
      );
      return res.json(session);
    }

    // Direct payment with payment method
    if (paymentMethodId) {
      const purchase = await PluginBilling.createPluginPurchase(userId, parseInt(id), {
        method: 'stripe'
      });

      const result = await PluginBilling.processPayment(purchase.id, paymentMethodId);
      return res.json(result);
    }

    return res.status(400).json({ error: 'Payment method or checkout URLs required' });

  } catch (error) {
    log.error('Error processing purchase', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to process purchase' });
  }
});

/**
 * POST /api/plugins/purchase/complete
 * Complete purchase after checkout (webhook or redirect)
 */
router.post('/purchase/complete', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const result = await PluginBilling.handleCheckoutComplete(sessionId);
    res.json(result);

  } catch (error) {
    log.error('Error completing purchase', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to complete purchase' });
  }
});

/**
 * GET /api/plugins/purchases
 * Get user's purchase history
 */
router.get('/purchases', async (req, res) => {
  try {
    const userId = req.user.id;
    const purchases = await PluginBilling.getPurchaseHistory(userId);
    res.json(purchases);
  } catch (error) {
    log.error('Error fetching purchases', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch purchase history' });
  }
});

/**
 * GET /api/plugins/:id/purchased
 * Check if user has purchased a plugin
 */
router.get('/:id/purchased', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const hasPurchased = await PluginBilling.hasPurchased(userId, parseInt(id));
    res.json({ purchased: hasPurchased });
  } catch (error) {
    log.error('Error checking purchase status', { error: error.message });
    res.status(500).json({ error: 'Failed to check purchase status' });
  }
});

// =============================================
// DEVELOPER EARNINGS ROUTES
// =============================================

/**
 * GET /api/plugins/developer/earnings
 * Get developer's earnings summary
 */
router.get('/developer/earnings', async (req, res) => {
  try {
    const developerId = req.user.id;
    const earnings = await PluginBilling.getEarnings(developerId);
    res.json(earnings);
  } catch (error) {
    log.error('Error fetching earnings', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

/**
 * GET /api/plugins/developer/revenue
 * Get detailed revenue breakdown
 */
router.get('/developer/revenue', async (req, res) => {
  try {
    const developerId = req.user.id;
    const { startDate, endDate } = req.query;

    const revenue = await PluginBilling.calculateRevenue(developerId, startDate, endDate);
    res.json(revenue);
  } catch (error) {
    log.error('Error calculating revenue', { error: error.message });
    res.status(500).json({ error: 'Failed to calculate revenue' });
  }
});

/**
 * GET /api/plugins/developer/payout-info
 * Get developer's payout information
 */
router.get('/developer/payout-info', async (req, res) => {
  try {
    const developerId = req.user.id;
    const payoutInfo = await RevenueShare.getPayoutInfo(developerId);
    const calculation = await RevenueShare.calculatePayout(developerId);

    res.json({
      payoutInfo,
      ...calculation
    });
  } catch (error) {
    log.error('Error fetching payout info', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch payout information' });
  }
});

/**
 * PUT /api/plugins/developer/payout-info
 * Update developer's payout information
 */
router.put('/developer/payout-info', async (req, res) => {
  try {
    const developerId = req.user.id;
    const payoutInfo = await RevenueShare.setPayoutInfo(developerId, req.body);
    res.json(payoutInfo);
  } catch (error) {
    log.error('Error updating payout info', { error: error.message });
    res.status(500).json({ error: 'Failed to update payout information' });
  }
});

/**
 * POST /api/plugins/developer/payout
 * Request a payout
 */
router.post('/developer/payout', async (req, res) => {
  try {
    const developerId = req.user.id;
    const { amount } = req.body;

    const payout = await RevenueShare.createPayout(developerId, amount);
    res.status(201).json(payout);
  } catch (error) {
    log.error('Error requesting payout', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to request payout' });
  }
});

/**
 * GET /api/plugins/developer/payouts
 * Get payout history
 */
router.get('/developer/payouts', async (req, res) => {
  try {
    const developerId = req.user.id;

    const result = await db.query(
      `SELECT * FROM developer_payouts
       WHERE developer_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [developerId]
    );

    res.json(result.rows);
  } catch (error) {
    log.error('Error fetching payouts', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch payout history' });
  }
});

module.exports = router;
