/**
 * Roadmap Routes
 * Public roadmap, feature requests, voting, and admin management
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, optionalAuth, requireSuperAdmin } = require('../middleware/auth');

// Helper: Generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 150);
}

// ==================== PUBLIC ROUTES ====================

/**
 * GET /api/roadmap
 * Get all public roadmap items with optional filters
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { status, category, quarter, sort = 'votes' } = req.query;

    let query = db('roadmap_items')
      .select(
        'roadmap_items.*',
        db.raw('COALESCE(user_vote.id, 0) > 0 as has_voted')
      )
      .leftJoin('roadmap_votes as user_vote', function() {
        this.on('user_vote.roadmap_item_id', '=', 'roadmap_items.id')
            .andOn('user_vote.user_id', '=', db.raw('?', [req.user?.id || 0]));
      })
      .where('roadmap_items.is_public', true);

    // Apply filters
    if (status) {
      query = query.where('roadmap_items.status', status);
    }
    if (category) {
      query = query.where('roadmap_items.category', category);
    }
    if (quarter) {
      query = query.where('roadmap_items.quarter', quarter);
    }

    // Apply sorting
    switch (sort) {
      case 'votes':
        query = query.orderBy('roadmap_items.votes_count', 'desc');
        break;
      case 'newest':
        query = query.orderBy('roadmap_items.created_at', 'desc');
        break;
      case 'priority':
        query = query.orderByRaw(`
          CASE roadmap_items.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END
        `);
        break;
      default:
        query = query.orderBy('roadmap_items.votes_count', 'desc');
    }

    const items = await query;

    // Group by status for board view
    const grouped = {
      planned: items.filter(i => i.status === 'planned'),
      in_progress: items.filter(i => i.status === 'in_progress'),
      completed: items.filter(i => i.status === 'completed')
    };

    res.json({
      success: true,
      items,
      grouped,
      total: items.length
    });
  } catch (error) {
    console.error('Get roadmap error:', error);
    res.status(500).json({ error: 'Failed to fetch roadmap' });
  }
});

/**
 * GET /api/roadmap/:slug
 * Get single roadmap item by slug
 */
router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;

    const item = await db('roadmap_items')
      .select(
        'roadmap_items.*',
        db.raw('COALESCE(user_vote.id, 0) > 0 as has_voted')
      )
      .leftJoin('roadmap_votes as user_vote', function() {
        this.on('user_vote.roadmap_item_id', '=', 'roadmap_items.id')
            .andOn('user_vote.user_id', '=', db.raw('?', [req.user?.id || 0]));
      })
      .where('roadmap_items.slug', slug)
      .where('roadmap_items.is_public', true)
      .first();

    if (!item) {
      return res.status(404).json({ error: 'Roadmap item not found' });
    }

    res.json({ success: true, item });
  } catch (error) {
    console.error('Get roadmap item error:', error);
    res.status(500).json({ error: 'Failed to fetch roadmap item' });
  }
});

/**
 * GET /api/roadmap/:slug/comments
 * Get comments for a roadmap item
 */
router.get('/:slug/comments', async (req, res) => {
  try {
    const { slug } = req.params;

    // Get item by slug
    const item = await db('roadmap_items')
      .where('slug', slug)
      .where('is_public', true)
      .first();

    if (!item) {
      return res.status(404).json({ error: 'Roadmap item not found' });
    }

    const comments = await db('roadmap_comments')
      .select(
        'roadmap_comments.*',
        'users.name as user_name',
        'users.email as user_email'
      )
      .leftJoin('users', 'users.id', 'roadmap_comments.user_id')
      .where('roadmap_comments.roadmap_item_id', item.id)
      .orderBy('roadmap_comments.created_at', 'asc');

    res.json({ success: true, comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// ==================== AUTHENTICATED ROUTES ====================

/**
 * POST /api/roadmap/:id/vote
 * Vote or unvote for a roadmap item
 */
router.post('/:id/vote', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if item exists and is public
    const item = await db('roadmap_items')
      .where('id', id)
      .where('is_public', true)
      .first();

    if (!item) {
      return res.status(404).json({ error: 'Roadmap item not found' });
    }

    // Check if already voted
    const existingVote = await db('roadmap_votes')
      .where('roadmap_item_id', id)
      .where('user_id', userId)
      .first();

    if (existingVote) {
      // Remove vote
      await db('roadmap_votes')
        .where('id', existingVote.id)
        .delete();

      await db('roadmap_items')
        .where('id', id)
        .decrement('votes_count', 1);

      const updatedItem = await db('roadmap_items').where('id', id).first();

      res.json({
        success: true,
        action: 'unvoted',
        votes_count: updatedItem.votes_count
      });
    } else {
      // Add vote
      await db('roadmap_votes').insert({
        roadmap_item_id: id,
        user_id: userId
      });

      await db('roadmap_items')
        .where('id', id)
        .increment('votes_count', 1);

      const updatedItem = await db('roadmap_items').where('id', id).first();

      res.json({
        success: true,
        action: 'voted',
        votes_count: updatedItem.votes_count
      });
    }
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to process vote' });
  }
});

/**
 * POST /api/roadmap/:id/comments
 * Add a comment to a roadmap item
 */
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Check if item exists and is public
    const item = await db('roadmap_items')
      .where('id', id)
      .where('is_public', true)
      .first();

    if (!item) {
      return res.status(404).json({ error: 'Roadmap item not found' });
    }

    const [commentId] = await db('roadmap_comments').insert({
      roadmap_item_id: id,
      user_id: userId,
      content: content.trim(),
      is_official: req.user.role === 'super_admin'
    });

    // Update comment count
    await db('roadmap_items')
      .where('id', id)
      .increment('comments_count', 1);

    const comment = await db('roadmap_comments')
      .select(
        'roadmap_comments.*',
        'users.name as user_name',
        'users.email as user_email'
      )
      .leftJoin('users', 'users.id', 'roadmap_comments.user_id')
      .where('roadmap_comments.id', commentId)
      .first();

    res.json({ success: true, comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ==================== FEATURE REQUESTS ====================

/**
 * GET /api/feature-requests
 * Get all feature requests
 */
router.get('/feature-requests/list', optionalAuth, async (req, res) => {
  try {
    const { status, category, sort = 'votes' } = req.query;

    let query = db('feature_requests')
      .select(
        'feature_requests.*',
        'users.name as user_name',
        db.raw('COALESCE(user_vote.id, 0) > 0 as has_voted')
      )
      .leftJoin('users', 'users.id', 'feature_requests.user_id')
      .leftJoin('feature_request_votes as user_vote', function() {
        this.on('user_vote.feature_request_id', '=', 'feature_requests.id')
            .andOn('user_vote.user_id', '=', db.raw('?', [req.user?.id || 0]));
      });

    if (status) {
      query = query.where('feature_requests.status', status);
    }
    if (category) {
      query = query.where('feature_requests.category', category);
    }

    switch (sort) {
      case 'votes':
        query = query.orderBy('feature_requests.votes_count', 'desc');
        break;
      case 'newest':
        query = query.orderBy('feature_requests.created_at', 'desc');
        break;
      default:
        query = query.orderBy('feature_requests.votes_count', 'desc');
    }

    const requests = await query;

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get feature requests error:', error);
    res.status(500).json({ error: 'Failed to fetch feature requests' });
  }
});

/**
 * POST /api/feature-requests
 * Submit a new feature request
 */
router.post('/feature-requests', authenticateToken, async (req, res) => {
  try {
    const { title, description, category } = req.body;
    const userId = req.user.id;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const [id] = await db('feature_requests').insert({
      user_id: userId,
      title: title.trim(),
      description: description.trim(),
      category: category || 'feature',
      status: 'pending',
      votes_count: 1 // Auto-vote for creator
    });

    // Auto-vote for creator
    await db('feature_request_votes').insert({
      feature_request_id: id,
      user_id: userId
    });

    const request = await db('feature_requests')
      .select('feature_requests.*', 'users.name as user_name')
      .leftJoin('users', 'users.id', 'feature_requests.user_id')
      .where('feature_requests.id', id)
      .first();

    res.json({ success: true, request });
  } catch (error) {
    console.error('Submit feature request error:', error);
    res.status(500).json({ error: 'Failed to submit feature request' });
  }
});

/**
 * GET /api/feature-requests/:id
 * Get single feature request
 */
router.get('/feature-requests/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await db('feature_requests')
      .select(
        'feature_requests.*',
        'users.name as user_name',
        db.raw('COALESCE(user_vote.id, 0) > 0 as has_voted')
      )
      .leftJoin('users', 'users.id', 'feature_requests.user_id')
      .leftJoin('feature_request_votes as user_vote', function() {
        this.on('user_vote.feature_request_id', '=', 'feature_requests.id')
            .andOn('user_vote.user_id', '=', db.raw('?', [req.user?.id || 0]));
      })
      .where('feature_requests.id', id)
      .first();

    if (!request) {
      return res.status(404).json({ error: 'Feature request not found' });
    }

    res.json({ success: true, request });
  } catch (error) {
    console.error('Get feature request error:', error);
    res.status(500).json({ error: 'Failed to fetch feature request' });
  }
});

/**
 * POST /api/feature-requests/:id/vote
 * Vote for a feature request
 */
router.post('/feature-requests/:id/vote', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const request = await db('feature_requests').where('id', id).first();

    if (!request) {
      return res.status(404).json({ error: 'Feature request not found' });
    }

    const existingVote = await db('feature_request_votes')
      .where('feature_request_id', id)
      .where('user_id', userId)
      .first();

    if (existingVote) {
      // Remove vote
      await db('feature_request_votes')
        .where('id', existingVote.id)
        .delete();

      await db('feature_requests')
        .where('id', id)
        .decrement('votes_count', 1);

      const updated = await db('feature_requests').where('id', id).first();

      res.json({
        success: true,
        action: 'unvoted',
        votes_count: updated.votes_count
      });
    } else {
      // Add vote
      await db('feature_request_votes').insert({
        feature_request_id: id,
        user_id: userId
      });

      await db('feature_requests')
        .where('id', id)
        .increment('votes_count', 1);

      const updated = await db('feature_requests').where('id', id).first();

      res.json({
        success: true,
        action: 'voted',
        votes_count: updated.votes_count
      });
    }
  } catch (error) {
    console.error('Vote feature request error:', error);
    res.status(500).json({ error: 'Failed to process vote' });
  }
});

// ==================== ADMIN ROUTES ====================

/**
 * POST /api/admin/roadmap
 * Create a new roadmap item
 */
router.post('/admin/items', requireSuperAdmin, async (req, res) => {
  try {
    const { title, description, detailed_description, status, priority, category, quarter, estimated_date, is_public } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    let slug = generateSlug(title);

    // Ensure unique slug
    const existing = await db('roadmap_items').where('slug', slug).first();
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const [id] = await db('roadmap_items').insert({
      title: title.trim(),
      slug,
      description: description?.trim(),
      detailed_description: detailed_description?.trim(),
      status: status || 'planned',
      priority: priority || 'medium',
      category: category || 'feature',
      quarter,
      estimated_date,
      is_public: is_public !== false
    });

    const item = await db('roadmap_items').where('id', id).first();

    res.json({ success: true, item });
  } catch (error) {
    console.error('Create roadmap item error:', error);
    res.status(500).json({ error: 'Failed to create roadmap item' });
  }
});

/**
 * PUT /api/admin/roadmap/:id
 * Update a roadmap item
 */
router.put('/admin/items/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, detailed_description, status, priority, category, quarter, estimated_date, completed_date, is_public } = req.body;

    const item = await db('roadmap_items').where('id', id).first();

    if (!item) {
      return res.status(404).json({ error: 'Roadmap item not found' });
    }

    const updates = { updated_at: db.fn.now() };

    if (title) {
      updates.title = title.trim();
      // Update slug if title changed
      if (title.trim() !== item.title) {
        let newSlug = generateSlug(title);
        const existing = await db('roadmap_items').where('slug', newSlug).whereNot('id', id).first();
        if (existing) {
          newSlug = `${newSlug}-${Date.now()}`;
        }
        updates.slug = newSlug;
      }
    }
    if (description !== undefined) updates.description = description?.trim();
    if (detailed_description !== undefined) updates.detailed_description = detailed_description?.trim();
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (category) updates.category = category;
    if (quarter !== undefined) updates.quarter = quarter;
    if (estimated_date !== undefined) updates.estimated_date = estimated_date;
    if (completed_date !== undefined) updates.completed_date = completed_date;
    if (is_public !== undefined) updates.is_public = is_public;

    // Auto-set completed_date when status changes to completed
    if (status === 'completed' && item.status !== 'completed' && !completed_date) {
      updates.completed_date = new Date().toISOString().split('T')[0];
    }

    await db('roadmap_items').where('id', id).update(updates);

    const updated = await db('roadmap_items').where('id', id).first();

    res.json({ success: true, item: updated });
  } catch (error) {
    console.error('Update roadmap item error:', error);
    res.status(500).json({ error: 'Failed to update roadmap item' });
  }
});

/**
 * DELETE /api/admin/roadmap/:id
 * Delete a roadmap item
 */
router.delete('/admin/items/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const item = await db('roadmap_items').where('id', id).first();

    if (!item) {
      return res.status(404).json({ error: 'Roadmap item not found' });
    }

    await db('roadmap_items').where('id', id).delete();

    res.json({ success: true, message: 'Roadmap item deleted' });
  } catch (error) {
    console.error('Delete roadmap item error:', error);
    res.status(500).json({ error: 'Failed to delete roadmap item' });
  }
});

/**
 * POST /api/admin/feature-requests/:id/convert
 * Convert a feature request to a roadmap item
 */
router.post('/admin/feature-requests/:id/convert', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { priority, quarter, estimated_date } = req.body;

    const request = await db('feature_requests').where('id', id).first();

    if (!request) {
      return res.status(404).json({ error: 'Feature request not found' });
    }

    if (request.roadmap_item_id) {
      return res.status(400).json({ error: 'Feature request already converted' });
    }

    // Create roadmap item
    let slug = generateSlug(request.title);
    const existing = await db('roadmap_items').where('slug', slug).first();
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const [roadmapId] = await db('roadmap_items').insert({
      title: request.title,
      slug,
      description: request.description,
      status: 'planned',
      priority: priority || 'medium',
      category: request.category || 'feature',
      quarter,
      estimated_date,
      votes_count: request.votes_count,
      is_public: true
    });

    // Update feature request
    await db('feature_requests')
      .where('id', id)
      .update({
        status: 'planned',
        roadmap_item_id: roadmapId
      });

    // Copy votes to roadmap item
    const votes = await db('feature_request_votes')
      .where('feature_request_id', id);

    for (const vote of votes) {
      await db('roadmap_votes')
        .insert({
          roadmap_item_id: roadmapId,
          user_id: vote.user_id
        })
        .onConflict(['roadmap_item_id', 'user_id'])
        .ignore();
    }

    const item = await db('roadmap_items').where('id', roadmapId).first();

    res.json({ success: true, item, message: 'Feature request converted to roadmap item' });
  } catch (error) {
    console.error('Convert feature request error:', error);
    res.status(500).json({ error: 'Failed to convert feature request' });
  }
});

/**
 * PUT /api/admin/feature-requests/:id/status
 * Update feature request status
 */
router.put('/admin/feature-requests/:id/status', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'reviewing', 'planned', 'declined'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const request = await db('feature_requests').where('id', id).first();

    if (!request) {
      return res.status(404).json({ error: 'Feature request not found' });
    }

    await db('feature_requests')
      .where('id', id)
      .update({ status });

    const updated = await db('feature_requests').where('id', id).first();

    res.json({ success: true, request: updated });
  } catch (error) {
    console.error('Update feature request status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

/**
 * GET /api/admin/roadmap
 * Get all roadmap items (including private) for admin
 */
router.get('/admin/items', requireSuperAdmin, async (req, res) => {
  try {
    const items = await db('roadmap_items')
      .orderBy('created_at', 'desc');

    res.json({ success: true, items });
  } catch (error) {
    console.error('Get admin roadmap error:', error);
    res.status(500).json({ error: 'Failed to fetch roadmap items' });
  }
});

/**
 * GET /api/admin/feature-requests
 * Get all feature requests for admin
 */
router.get('/admin/feature-requests', requireSuperAdmin, async (req, res) => {
  try {
    const requests = await db('feature_requests')
      .select('feature_requests.*', 'users.name as user_name', 'users.email as user_email')
      .leftJoin('users', 'users.id', 'feature_requests.user_id')
      .orderBy('feature_requests.created_at', 'desc');

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get admin feature requests error:', error);
    res.status(500).json({ error: 'Failed to fetch feature requests' });
  }
});

module.exports = router;
