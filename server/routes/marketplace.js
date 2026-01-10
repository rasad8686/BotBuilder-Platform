/**
 * Marketplace Routes
 * Public and authenticated endpoints for marketplace browsing, purchasing, and selling
 */

const express = require('express');
const router = express.Router();
const marketplaceService = require('../services/marketplaceService');
const authenticateToken = require('../middleware/auth');
const logger = require('../utils/logger');

// ============ Public Routes ============

/**
 * GET /api/marketplace
 * Browse marketplace items
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      query: req.query.q,
      type: req.query.type,
      category: req.query.category,
      priceType: req.query.priceType,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100)
    };

    const result = await marketplaceService.searchItems(filters);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Error browsing marketplace:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to browse marketplace'
    });
  }
});

/**
 * GET /api/marketplace/featured
 * Get featured items
 */
router.get('/featured', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const items = await marketplaceService.getFeaturedItems(limit);

    res.json({
      success: true,
      items
    });
  } catch (error) {
    logger.error('Error getting featured items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get featured items'
    });
  }
});

/**
 * GET /api/marketplace/categories
 * Get marketplace categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await marketplaceService.getCategories();

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    logger.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get categories'
    });
  }
});

/**
 * GET /api/marketplace/:slug
 * Get item detail by slug
 */
router.get('/:slug', async (req, res) => {
  try {
    const item = await marketplaceService.getItemBySlug(req.params.slug);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    res.json({
      success: true,
      item
    });
  } catch (error) {
    logger.error('Error getting item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get item'
    });
  }
});

/**
 * GET /api/marketplace/:slug/reviews
 * Get item reviews
 */
router.get('/:slug/reviews', async (req, res) => {
  try {
    const item = await marketplaceService.getItemBySlug(req.params.slug);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    const result = await marketplaceService.getItemReviews(item.id, {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 10, 50)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Error getting reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reviews'
    });
  }
});

// ============ Authenticated Routes ============

/**
 * POST /api/marketplace/:slug/purchase
 * Purchase an item
 */
router.post('/:slug/purchase', authenticateToken, async (req, res) => {
  try {
    const item = await marketplaceService.getItemBySlug(req.params.slug);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    const organizationId = req.user.organization_id || req.body.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const purchase = await marketplaceService.purchaseItem(
      req.user.id,
      item.id,
      organizationId,
      req.body.stripe_payment_id
    );

    res.json({
      success: true,
      purchase
    });
  } catch (error) {
    logger.error('Error purchasing item:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to purchase item'
    });
  }
});

/**
 * POST /api/marketplace/:slug/install
 * Install an item
 */
router.post('/:slug/install', authenticateToken, async (req, res) => {
  try {
    const item = await marketplaceService.getItemBySlug(req.params.slug);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    const organizationId = req.user.organization_id || req.body.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const installation = await marketplaceService.installItem(
      organizationId,
      item.id,
      req.user.id
    );

    res.json({
      success: true,
      installation
    });
  } catch (error) {
    logger.error('Error installing item:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to install item'
    });
  }
});

/**
 * DELETE /api/marketplace/:slug/install
 * Uninstall an item
 */
router.delete('/:slug/install', authenticateToken, async (req, res) => {
  try {
    const item = await marketplaceService.getItemBySlug(req.params.slug);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    const organizationId = req.user.organization_id || req.body.organization_id;

    const installation = await marketplaceService.uninstallItem(
      organizationId,
      item.id
    );

    res.json({
      success: true,
      installation
    });
  } catch (error) {
    logger.error('Error uninstalling item:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to uninstall item'
    });
  }
});

/**
 * POST /api/marketplace/:slug/review
 * Write a review
 */
router.post('/:slug/review', authenticateToken, async (req, res) => {
  try {
    const item = await marketplaceService.getItemBySlug(req.params.slug);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    const { rating, title, content } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    const review = await marketplaceService.writeReview(req.user.id, item.id, {
      rating,
      title,
      content
    });

    res.json({
      success: true,
      review
    });
  } catch (error) {
    logger.error('Error writing review:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to write review'
    });
  }
});

/**
 * GET /api/marketplace/my/purchases
 * Get user's purchases
 */
router.get('/my/purchases', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.query.organization_id || req.user.organization_id;
    const purchases = await marketplaceService.getUserPurchases(req.user.id, organizationId);

    res.json({
      success: true,
      purchases
    });
  } catch (error) {
    logger.error('Error getting purchases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get purchases'
    });
  }
});

/**
 * GET /api/marketplace/my/installed
 * Get installed items
 */
router.get('/my/installed', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.query.organization_id || req.user.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID required'
      });
    }

    const installations = await marketplaceService.getInstalledItems(organizationId);

    res.json({
      success: true,
      installations
    });
  } catch (error) {
    logger.error('Error getting installed items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get installed items'
    });
  }
});

// ============ Seller Routes ============

/**
 * GET /api/marketplace/seller/items
 * Get seller's items
 */
router.get('/seller/items', authenticateToken, async (req, res) => {
  try {
    const items = await marketplaceService.getSellerItems(req.user.id);

    res.json({
      success: true,
      items
    });
  } catch (error) {
    logger.error('Error getting seller items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get items'
    });
  }
});

/**
 * POST /api/marketplace/seller/items
 * Create a new item
 */
router.post('/seller/items', authenticateToken, async (req, res) => {
  try {
    const {
      type, name, description, long_description, price_type, price,
      currency, icon_url, screenshots, demo_url, version,
      min_platform_version, categories, tags
    } = req.body;

    if (!type || !name) {
      return res.status(400).json({
        success: false,
        error: 'Type and name are required'
      });
    }

    const validTypes = ['plugin', 'template', 'integration', 'theme'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item type'
      });
    }

    const item = await marketplaceService.createItem(req.user.id, {
      type,
      name,
      description,
      long_description,
      price_type,
      price,
      currency,
      icon_url,
      screenshots,
      demo_url,
      version,
      min_platform_version,
      categories,
      tags
    });

    res.status(201).json({
      success: true,
      item
    });
  } catch (error) {
    logger.error('Error creating item:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create item'
    });
  }
});

/**
 * PUT /api/marketplace/seller/items/:id
 * Update an item
 */
router.put('/seller/items/:id', authenticateToken, async (req, res) => {
  try {
    const item = await marketplaceService.updateItem(
      req.user.id,
      parseInt(req.params.id),
      req.body
    );

    res.json({
      success: true,
      item
    });
  } catch (error) {
    logger.error('Error updating item:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update item'
    });
  }
});

/**
 * POST /api/marketplace/seller/items/:id/submit
 * Submit item for review
 */
router.post('/seller/items/:id/submit', authenticateToken, async (req, res) => {
  try {
    const item = await marketplaceService.submitForReview(
      req.user.id,
      parseInt(req.params.id)
    );

    res.json({
      success: true,
      item
    });
  } catch (error) {
    logger.error('Error submitting item:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to submit item'
    });
  }
});

/**
 * GET /api/marketplace/seller/earnings
 * Get seller earnings
 */
router.get('/seller/earnings', authenticateToken, async (req, res) => {
  try {
    const earnings = await marketplaceService.calculateEarnings(req.user.id);

    res.json({
      success: true,
      ...earnings
    });
  } catch (error) {
    logger.error('Error getting earnings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get earnings'
    });
  }
});

/**
 * GET /api/marketplace/seller/payouts
 * Get seller payout history
 */
router.get('/seller/payouts', authenticateToken, async (req, res) => {
  try {
    const payouts = await marketplaceService.getSellerPayouts(req.user.id);

    res.json({
      success: true,
      payouts
    });
  } catch (error) {
    logger.error('Error getting payouts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payouts'
    });
  }
});

/**
 * POST /api/marketplace/seller/payout
 * Request a payout
 */
router.post('/seller/payout', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount required'
      });
    }

    const payout = await marketplaceService.requestPayout(req.user.id, amount);

    res.json({
      success: true,
      payout
    });
  } catch (error) {
    logger.error('Error requesting payout:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to request payout'
    });
  }
});

/**
 * PUT /api/marketplace/seller/payout-info
 * Update payout information
 */
router.put('/seller/payout-info', authenticateToken, async (req, res) => {
  try {
    const info = await marketplaceService.updatePayoutInfo(req.user.id, req.body);

    res.json({
      success: true,
      payout_info: info
    });
  } catch (error) {
    logger.error('Error updating payout info:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update payout info'
    });
  }
});

module.exports = router;
