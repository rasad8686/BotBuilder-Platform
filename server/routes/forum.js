/**
 * @fileoverview Forum Routes
 * @description API endpoints for developer forum
 * @module routes/forum
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const log = require('../utils/logger');
const forumService = require('../services/forumService');

/**
 * Check if user is admin
 */
function isAdmin(req) {
  return req.user && (req.user.role === 'admin' || req.user.is_admin);
}

// ============================================
// PUBLIC ROUTES (with optional auth)
// ============================================

/**
 * GET /api/forum/categories
 * Get all categories
 */
router.get('/categories', optionalAuth, async (req, res) => {
  try {
    const categories = await forumService.getCategories();

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    log.error('[Forum] Error fetching categories:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

/**
 * GET /api/forum/categories/:slug
 * Get category by slug
 */
router.get('/categories/:slug', optionalAuth, async (req, res) => {
  try {
    const category = await forumService.getCategoryBySlug(req.params.slug);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    log.error('[Forum] Error fetching category:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category'
    });
  }
});

/**
 * GET /api/forum/topics
 * Get topics with pagination and filters
 */
router.get('/topics', optionalAuth, async (req, res) => {
  try {
    const { category, page, limit, sort, filter } = req.query;

    let categoryId;
    if (category) {
      const cat = await forumService.getCategoryBySlug(category);
      if (cat) categoryId = cat.id;
    }

    const result = await forumService.getTopics({
      categoryId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sort: sort || 'latest',
      filter: filter || 'all'
    });

    res.json({
      success: true,
      data: result.topics,
      pagination: result.pagination
    });
  } catch (error) {
    log.error('[Forum] Error fetching topics:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch topics'
    });
  }
});

/**
 * GET /api/forum/topics/popular
 * Get popular topics
 */
router.get('/topics/popular', optionalAuth, async (req, res) => {
  try {
    const { limit } = req.query;
    const topics = await forumService.getPopularTopics(parseInt(limit) || 10);

    res.json({
      success: true,
      data: topics
    });
  } catch (error) {
    log.error('[Forum] Error fetching popular topics:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular topics'
    });
  }
});

/**
 * GET /api/forum/topics/unanswered
 * Get unanswered topics
 */
router.get('/topics/unanswered', optionalAuth, async (req, res) => {
  try {
    const { page, limit } = req.query;

    const result = await forumService.getTopics({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      filter: 'unanswered'
    });

    res.json({
      success: true,
      data: result.topics,
      pagination: result.pagination
    });
  } catch (error) {
    log.error('[Forum] Error fetching unanswered topics:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unanswered topics'
    });
  }
});

/**
 * GET /api/forum/topics/:slug
 * Get topic by slug
 */
router.get('/topics/:slug', optionalAuth, async (req, res) => {
  try {
    const topic = await forumService.getTopicBySlug(req.params.slug, true);

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    // Check if user liked topic
    let userLiked = false;
    if (req.user) {
      userLiked = await forumService.checkUserLike(req.user.id, 'topic', topic.id);
    }

    res.json({
      success: true,
      data: { ...topic, userLiked }
    });
  } catch (error) {
    log.error('[Forum] Error fetching topic:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch topic'
    });
  }
});

/**
 * GET /api/forum/topics/:topicId/replies
 * Get replies for a topic
 */
router.get('/topics/:topicId/replies', optionalAuth, async (req, res) => {
  try {
    const { page, limit } = req.query;

    const result = await forumService.getReplies(parseInt(req.params.topicId), {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });

    res.json({
      success: true,
      data: result.replies,
      pagination: result.pagination
    });
  } catch (error) {
    log.error('[Forum] Error fetching replies:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch replies'
    });
  }
});

/**
 * GET /api/forum/search
 * Search topics
 */
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { q, category, page, limit } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    let categoryId;
    if (category) {
      const cat = await forumService.getCategoryBySlug(category);
      if (cat) categoryId = cat.id;
    }

    const result = await forumService.searchTopics(q, {
      categoryId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: result.topics,
      pagination: result.pagination
    });
  } catch (error) {
    log.error('[Forum] Error searching:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to search topics'
    });
  }
});

/**
 * GET /api/forum/user/:userId
 * Get user forum profile
 */
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const profile = await forumService.getUserProfile(parseInt(req.params.userId));

    if (!profile.user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    log.error('[Forum] Error fetching user profile:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile'
    });
  }
});

/**
 * GET /api/forum/stats
 * Get forum stats
 */
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    const stats = await forumService.getForumStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    log.error('[Forum] Error fetching stats:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch forum stats'
    });
  }
});

// ============================================
// AUTHENTICATED ROUTES
// ============================================

/**
 * POST /api/forum/topics
 * Create a new topic
 */
router.post('/topics', authenticateToken, async (req, res) => {
  try {
    const { category_id, title, content, tags } = req.body;

    if (!category_id || !title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Category, title, and content are required'
      });
    }

    const topic = await forumService.createTopic(req.user.id, {
      category_id,
      title,
      content,
      tags
    });

    res.status(201).json({
      success: true,
      data: topic
    });
  } catch (error) {
    log.error('[Forum] Error creating topic:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create topic'
    });
  }
});

/**
 * PUT /api/forum/topics/:id
 * Update a topic
 */
router.put('/topics/:id', authenticateToken, async (req, res) => {
  try {
    const topic = await forumService.updateTopic(
      parseInt(req.params.id),
      req.user.id,
      req.body,
      isAdmin(req)
    );

    res.json({
      success: true,
      data: topic
    });
  } catch (error) {
    log.error('[Forum] Error updating topic:', { error: error.message });
    const status = error.message.includes('Not authorized') ? 403 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to update topic'
    });
  }
});

/**
 * DELETE /api/forum/topics/:id
 * Delete a topic
 */
router.delete('/topics/:id', authenticateToken, async (req, res) => {
  try {
    await forumService.deleteTopic(
      parseInt(req.params.id),
      req.user.id,
      isAdmin(req)
    );

    res.json({
      success: true,
      message: 'Topic deleted successfully'
    });
  } catch (error) {
    log.error('[Forum] Error deleting topic:', { error: error.message });
    const status = error.message.includes('Not authorized') ? 403 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to delete topic'
    });
  }
});

/**
 * POST /api/forum/topics/:topicId/replies
 * Create a reply
 */
router.post('/topics/:topicId/replies', authenticateToken, async (req, res) => {
  try {
    const { content, parent_reply_id } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    const reply = await forumService.createReply(
      req.user.id,
      parseInt(req.params.topicId),
      { content, parent_reply_id }
    );

    res.status(201).json({
      success: true,
      data: reply
    });
  } catch (error) {
    log.error('[Forum] Error creating reply:', { error: error.message });
    const status = error.message.includes('locked') ? 403 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to create reply'
    });
  }
});

/**
 * PUT /api/forum/replies/:id
 * Update a reply
 */
router.put('/replies/:id', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    const reply = await forumService.updateReply(
      parseInt(req.params.id),
      req.user.id,
      content,
      isAdmin(req)
    );

    res.json({
      success: true,
      data: reply
    });
  } catch (error) {
    log.error('[Forum] Error updating reply:', { error: error.message });
    const status = error.message.includes('Not authorized') ? 403 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to update reply'
    });
  }
});

/**
 * DELETE /api/forum/replies/:id
 * Delete a reply
 */
router.delete('/replies/:id', authenticateToken, async (req, res) => {
  try {
    await forumService.deleteReply(
      parseInt(req.params.id),
      req.user.id,
      isAdmin(req)
    );

    res.json({
      success: true,
      message: 'Reply deleted successfully'
    });
  } catch (error) {
    log.error('[Forum] Error deleting reply:', { error: error.message });
    const status = error.message.includes('Not authorized') ? 403 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to delete reply'
    });
  }
});

/**
 * POST /api/forum/topics/:topicId/solution/:replyId
 * Mark a reply as solution
 */
router.post('/topics/:topicId/solution/:replyId', authenticateToken, async (req, res) => {
  try {
    await forumService.markAsSolution(
      parseInt(req.params.topicId),
      parseInt(req.params.replyId),
      req.user.id
    );

    res.json({
      success: true,
      message: 'Reply marked as solution'
    });
  } catch (error) {
    log.error('[Forum] Error marking solution:', { error: error.message });
    const status = error.message.includes('Only topic author') ? 403 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to mark as solution'
    });
  }
});

/**
 * POST /api/forum/topics/:id/like
 * Toggle like on topic
 */
router.post('/topics/:id/like', authenticateToken, async (req, res) => {
  try {
    const result = await forumService.toggleLike(
      req.user.id,
      'topic',
      parseInt(req.params.id)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    log.error('[Forum] Error toggling topic like:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to toggle like'
    });
  }
});

/**
 * POST /api/forum/replies/:id/like
 * Toggle like on reply
 */
router.post('/replies/:id/like', authenticateToken, async (req, res) => {
  try {
    const result = await forumService.toggleLike(
      req.user.id,
      'reply',
      parseInt(req.params.id)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    log.error('[Forum] Error toggling reply like:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to toggle like'
    });
  }
});

/**
 * POST /api/forum/topics/:id/subscribe
 * Subscribe to topic
 */
router.post('/topics/:id/subscribe', authenticateToken, async (req, res) => {
  try {
    const { email_notifications } = req.body;

    await forumService.subscribe(
      req.user.id,
      'topic',
      parseInt(req.params.id),
      email_notifications !== false
    );

    res.json({
      success: true,
      message: 'Subscribed to topic'
    });
  } catch (error) {
    log.error('[Forum] Error subscribing:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe'
    });
  }
});

/**
 * DELETE /api/forum/topics/:id/subscribe
 * Unsubscribe from topic
 */
router.delete('/topics/:id/subscribe', authenticateToken, async (req, res) => {
  try {
    await forumService.unsubscribe(
      req.user.id,
      'topic',
      parseInt(req.params.id)
    );

    res.json({
      success: true,
      message: 'Unsubscribed from topic'
    });
  } catch (error) {
    log.error('[Forum] Error unsubscribing:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe'
    });
  }
});

/**
 * POST /api/forum/categories/:id/subscribe
 * Subscribe to category
 */
router.post('/categories/:id/subscribe', authenticateToken, async (req, res) => {
  try {
    const { email_notifications } = req.body;

    await forumService.subscribe(
      req.user.id,
      'category',
      parseInt(req.params.id),
      email_notifications !== false
    );

    res.json({
      success: true,
      message: 'Subscribed to category'
    });
  } catch (error) {
    log.error('[Forum] Error subscribing:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe'
    });
  }
});

/**
 * DELETE /api/forum/categories/:id/subscribe
 * Unsubscribe from category
 */
router.delete('/categories/:id/subscribe', authenticateToken, async (req, res) => {
  try {
    await forumService.unsubscribe(
      req.user.id,
      'category',
      parseInt(req.params.id)
    );

    res.json({
      success: true,
      message: 'Unsubscribed from category'
    });
  } catch (error) {
    log.error('[Forum] Error unsubscribing:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe'
    });
  }
});

/**
 * GET /api/forum/me/subscriptions
 * Get user subscriptions
 */
router.get('/me/subscriptions', authenticateToken, async (req, res) => {
  try {
    const subscriptions = await forumService.getUserSubscriptions(req.user.id);

    res.json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    log.error('[Forum] Error fetching subscriptions:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions'
    });
  }
});

/**
 * GET /api/forum/me/topics
 * Get user's topics
 */
router.get('/me/topics', authenticateToken, async (req, res) => {
  try {
    const { page, limit } = req.query;

    const result = await forumService.getTopics({
      userId: req.user.id,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({
      success: true,
      data: result.topics,
      pagination: result.pagination
    });
  } catch (error) {
    log.error('[Forum] Error fetching user topics:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch topics'
    });
  }
});

/**
 * GET /api/forum/me/profile
 * Get current user's forum profile
 */
router.get('/me/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await forumService.getUserProfile(req.user.id);

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    log.error('[Forum] Error fetching profile:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * POST /api/forum/admin/categories
 * Create category (admin)
 */
router.post('/admin/categories', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const category = await forumService.createCategory(req.body);

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    log.error('[Forum] Error creating category:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create category'
    });
  }
});

/**
 * PUT /api/forum/admin/categories/:id
 * Update category (admin)
 */
router.put('/admin/categories/:id', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const category = await forumService.updateCategory(
      parseInt(req.params.id),
      req.body
    );

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    log.error('[Forum] Error updating category:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update category'
    });
  }
});

/**
 * DELETE /api/forum/admin/categories/:id
 * Delete category (admin)
 */
router.delete('/admin/categories/:id', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    await forumService.deleteCategory(parseInt(req.params.id));

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    log.error('[Forum] Error deleting category:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete category'
    });
  }
});

/**
 * POST /api/forum/admin/topics/:id/pin
 * Pin/unpin topic (admin)
 */
router.post('/admin/topics/:id/pin', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const topic = await forumService.updateTopic(
      parseInt(req.params.id),
      req.user.id,
      { is_pinned: req.body.pinned !== false },
      true
    );

    res.json({
      success: true,
      data: topic
    });
  } catch (error) {
    log.error('[Forum] Error pinning topic:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to pin topic'
    });
  }
});

/**
 * POST /api/forum/admin/topics/:id/lock
 * Lock/unlock topic (admin)
 */
router.post('/admin/topics/:id/lock', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const topic = await forumService.updateTopic(
      parseInt(req.params.id),
      req.user.id,
      { is_locked: req.body.locked !== false },
      true
    );

    res.json({
      success: true,
      data: topic
    });
  } catch (error) {
    log.error('[Forum] Error locking topic:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to lock topic'
    });
  }
});

module.exports = router;
