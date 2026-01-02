/**
 * Showcase Gallery Routes
 * Project submissions, likes, comments, and admin management
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
 * GET /api/showcase
 * Get approved showcase projects with filters
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, industry, featured, sort = 'newest', page = 1, limit = 12, search } = req.query;

    let query = db('showcase_projects')
      .select(
        'showcase_projects.*',
        'users.name as author_name',
        'organizations.name as organization_name',
        db.raw('COALESCE(user_like.id, 0) > 0 as has_liked')
      )
      .leftJoin('users', 'users.id', 'showcase_projects.user_id')
      .leftJoin('organizations', 'organizations.id', 'showcase_projects.organization_id')
      .leftJoin('showcase_likes as user_like', function() {
        this.on('user_like.project_id', '=', 'showcase_projects.id')
            .andOn('user_like.user_id', '=', db.raw('?', [req.user?.id || 0]));
      })
      .where('showcase_projects.status', 'approved');

    // Apply filters
    if (category) {
      query = query.where('showcase_projects.category', category);
    }
    if (industry) {
      query = query.where('showcase_projects.industry', industry);
    }
    if (featured === 'true') {
      query = query.where('showcase_projects.is_featured', true);
    }
    if (search) {
      query = query.where(function() {
        this.where('showcase_projects.title', 'ilike', `%${search}%`)
            .orWhere('showcase_projects.tagline', 'ilike', `%${search}%`)
            .orWhere('showcase_projects.description', 'ilike', `%${search}%`);
      });
    }

    // Apply sorting
    switch (sort) {
      case 'newest':
        query = query.orderBy('showcase_projects.approved_at', 'desc');
        break;
      case 'popular':
        query = query.orderBy('showcase_projects.likes_count', 'desc');
        break;
      case 'views':
        query = query.orderBy('showcase_projects.views_count', 'desc');
        break;
      default:
        query = query.orderBy('showcase_projects.approved_at', 'desc');
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.offset(offset).limit(parseInt(limit));

    const projects = await query;

    // Get total count
    const [{ count }] = await db('showcase_projects')
      .where('status', 'approved')
      .count('id as count');

    res.json({
      success: true,
      projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        pages: Math.ceil(parseInt(count) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get showcase error:', error);
    res.status(500).json({ error: 'Failed to fetch showcase projects' });
  }
});

/**
 * GET /api/showcase/featured
 * Get featured projects for carousel
 */
router.get('/featured', async (req, res) => {
  try {
    const projects = await db('showcase_projects')
      .select(
        'showcase_projects.*',
        'users.name as author_name',
        'organizations.name as organization_name'
      )
      .leftJoin('users', 'users.id', 'showcase_projects.user_id')
      .leftJoin('organizations', 'organizations.id', 'showcase_projects.organization_id')
      .where('showcase_projects.status', 'approved')
      .where('showcase_projects.is_featured', true)
      .orderBy('showcase_projects.approved_at', 'desc')
      .limit(10);

    res.json({ success: true, projects });
  } catch (error) {
    console.error('Get featured error:', error);
    res.status(500).json({ error: 'Failed to fetch featured projects' });
  }
});

/**
 * GET /api/showcase/categories
 * Get categories with project counts
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await db('showcase_projects')
      .select('category')
      .count('id as count')
      .where('status', 'approved')
      .whereNotNull('category')
      .groupBy('category')
      .orderBy('count', 'desc');

    const industries = await db('showcase_projects')
      .select('industry')
      .count('id as count')
      .where('status', 'approved')
      .whereNotNull('industry')
      .groupBy('industry')
      .orderBy('count', 'desc');

    res.json({ success: true, categories, industries });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/showcase/user/my
 * Get current user's submitted projects
 */
router.get('/user/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const projects = await db('showcase_projects')
      .where('user_id', userId)
      .orderBy('created_at', 'desc');

    res.json({ success: true, projects });
  } catch (error) {
    console.error('Get my projects error:', error);
    res.status(500).json({ error: 'Failed to fetch your projects' });
  }
});

/**
 * GET /api/showcase/:slug
 * Get single project by slug
 */
router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;

    const project = await db('showcase_projects')
      .select(
        'showcase_projects.*',
        'users.name as author_name',
        'users.email as author_email',
        'organizations.name as organization_name',
        db.raw('COALESCE(user_like.id, 0) > 0 as has_liked')
      )
      .leftJoin('users', 'users.id', 'showcase_projects.user_id')
      .leftJoin('organizations', 'organizations.id', 'showcase_projects.organization_id')
      .leftJoin('showcase_likes as user_like', function() {
        this.on('user_like.project_id', '=', 'showcase_projects.id')
            .andOn('user_like.user_id', '=', db.raw('?', [req.user?.id || 0]));
      })
      .where('showcase_projects.slug', slug)
      .where('showcase_projects.status', 'approved')
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Increment view count
    await db('showcase_projects')
      .where('id', project.id)
      .increment('views_count', 1);

    res.json({ success: true, project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/**
 * GET /api/showcase/:slug/comments
 * Get comments for a project
 */
router.get('/:slug/comments', async (req, res) => {
  try {
    const { slug } = req.params;

    const project = await db('showcase_projects')
      .where('slug', slug)
      .where('status', 'approved')
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const comments = await db('showcase_comments')
      .select(
        'showcase_comments.*',
        'users.name as user_name'
      )
      .leftJoin('users', 'users.id', 'showcase_comments.user_id')
      .where('showcase_comments.project_id', project.id)
      .orderBy('showcase_comments.created_at', 'desc');

    res.json({ success: true, comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// ==================== AUTHENTICATED ROUTES ====================

/**
 * POST /api/showcase
 * Submit a new project
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title, tagline, description, logo_url, cover_image, screenshots,
      video_url, website_url, demo_url, category, industry, tags,
      features_used, integrations, testimonial_text, testimonial_author,
      testimonial_role
    } = req.body;
    const userId = req.user.id;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    let slug = generateSlug(title);
    const existing = await db('showcase_projects').where('slug', slug).first();
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const [id] = await db('showcase_projects').insert({
      user_id: userId,
      organization_id: req.user.organization_id,
      title: title.trim(),
      slug,
      tagline: tagline?.trim(),
      description: description?.trim(),
      logo_url,
      cover_image,
      screenshots: JSON.stringify(screenshots || []),
      video_url,
      website_url,
      demo_url,
      category,
      industry,
      tags: JSON.stringify(tags || []),
      features_used: JSON.stringify(features_used || []),
      integrations: JSON.stringify(integrations || []),
      testimonial_text: testimonial_text?.trim(),
      testimonial_author: testimonial_author?.trim(),
      testimonial_role: testimonial_role?.trim(),
      status: 'pending'
    });

    const project = await db('showcase_projects').where('id', id).first();

    res.json({ success: true, project, message: 'Project submitted for review' });
  } catch (error) {
    console.error('Submit project error:', error);
    res.status(500).json({ error: 'Failed to submit project' });
  }
});

/**
 * PUT /api/showcase/:id
 * Update own project
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const project = await db('showcase_projects').where('id', id).first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.user_id !== userId && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Not authorized to update this project' });
    }

    const {
      title, tagline, description, logo_url, cover_image, screenshots,
      video_url, website_url, demo_url, category, industry, tags,
      features_used, integrations, testimonial_text, testimonial_author,
      testimonial_role
    } = req.body;

    const updates = {};
    if (title) {
      updates.title = title.trim();
      if (title.trim() !== project.title) {
        let newSlug = generateSlug(title);
        const existing = await db('showcase_projects').where('slug', newSlug).whereNot('id', id).first();
        if (existing) {
          newSlug = `${newSlug}-${Date.now()}`;
        }
        updates.slug = newSlug;
      }
    }
    if (tagline !== undefined) updates.tagline = tagline?.trim();
    if (description !== undefined) updates.description = description?.trim();
    if (logo_url !== undefined) updates.logo_url = logo_url;
    if (cover_image !== undefined) updates.cover_image = cover_image;
    if (screenshots !== undefined) updates.screenshots = JSON.stringify(screenshots);
    if (video_url !== undefined) updates.video_url = video_url;
    if (website_url !== undefined) updates.website_url = website_url;
    if (demo_url !== undefined) updates.demo_url = demo_url;
    if (category !== undefined) updates.category = category;
    if (industry !== undefined) updates.industry = industry;
    if (tags !== undefined) updates.tags = JSON.stringify(tags);
    if (features_used !== undefined) updates.features_used = JSON.stringify(features_used);
    if (integrations !== undefined) updates.integrations = JSON.stringify(integrations);
    if (testimonial_text !== undefined) updates.testimonial_text = testimonial_text?.trim();
    if (testimonial_author !== undefined) updates.testimonial_author = testimonial_author?.trim();
    if (testimonial_role !== undefined) updates.testimonial_role = testimonial_role?.trim();

    // If project was approved and user edits, set back to pending
    if (project.status === 'approved' && Object.keys(updates).length > 0) {
      updates.status = 'pending';
      updates.approved_at = null;
    }

    await db('showcase_projects').where('id', id).update(updates);

    const updated = await db('showcase_projects').where('id', id).first();

    res.json({ success: true, project: updated });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * DELETE /api/showcase/:id
 * Delete own project
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const project = await db('showcase_projects').where('id', id).first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.user_id !== userId && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Not authorized to delete this project' });
    }

    await db('showcase_projects').where('id', id).delete();

    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

/**
 * POST /api/showcase/:id/like
 * Like or unlike a project
 */
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const project = await db('showcase_projects')
      .where('id', id)
      .where('status', 'approved')
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const existingLike = await db('showcase_likes')
      .where('project_id', id)
      .where('user_id', userId)
      .first();

    if (existingLike) {
      // Unlike
      await db('showcase_likes').where('id', existingLike.id).delete();
      await db('showcase_projects').where('id', id).decrement('likes_count', 1);

      const updated = await db('showcase_projects').where('id', id).first();
      res.json({ success: true, action: 'unliked', likes_count: updated.likes_count });
    } else {
      // Like
      await db('showcase_likes').insert({
        project_id: id,
        user_id: userId
      });
      await db('showcase_projects').where('id', id).increment('likes_count', 1);

      const updated = await db('showcase_projects').where('id', id).first();
      res.json({ success: true, action: 'liked', likes_count: updated.likes_count });
    }
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to process like' });
  }
});

/**
 * POST /api/showcase/:id/comments
 * Add comment to project
 */
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const project = await db('showcase_projects')
      .where('id', id)
      .where('status', 'approved')
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [commentId] = await db('showcase_comments').insert({
      project_id: id,
      user_id: userId,
      content: content.trim()
    });

    const comment = await db('showcase_comments')
      .select('showcase_comments.*', 'users.name as user_name')
      .leftJoin('users', 'users.id', 'showcase_comments.user_id')
      .where('showcase_comments.id', commentId)
      .first();

    res.json({ success: true, comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ==================== ADMIN ROUTES ====================

/**
 * GET /api/showcase/admin/pending
 * Get pending projects for review
 */
router.get('/admin/pending', requireSuperAdmin, async (req, res) => {
  try {
    const projects = await db('showcase_projects')
      .select(
        'showcase_projects.*',
        'users.name as author_name',
        'users.email as author_email',
        'organizations.name as organization_name'
      )
      .leftJoin('users', 'users.id', 'showcase_projects.user_id')
      .leftJoin('organizations', 'organizations.id', 'showcase_projects.organization_id')
      .where('showcase_projects.status', 'pending')
      .orderBy('showcase_projects.created_at', 'asc');

    res.json({ success: true, projects });
  } catch (error) {
    console.error('Get pending error:', error);
    res.status(500).json({ error: 'Failed to fetch pending projects' });
  }
});

/**
 * GET /api/showcase/admin/all
 * Get all projects for admin
 */
router.get('/admin/all', requireSuperAdmin, async (req, res) => {
  try {
    const projects = await db('showcase_projects')
      .select(
        'showcase_projects.*',
        'users.name as author_name',
        'users.email as author_email',
        'organizations.name as organization_name'
      )
      .leftJoin('users', 'users.id', 'showcase_projects.user_id')
      .leftJoin('organizations', 'organizations.id', 'showcase_projects.organization_id')
      .orderBy('showcase_projects.created_at', 'desc');

    res.json({ success: true, projects });
  } catch (error) {
    console.error('Get all projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * PUT /api/showcase/admin/:id/approve
 * Approve a project
 */
router.put('/admin/:id/approve', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const project = await db('showcase_projects').where('id', id).first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await db('showcase_projects')
      .where('id', id)
      .update({
        status: 'approved',
        approved_at: db.fn.now()
      });

    const updated = await db('showcase_projects').where('id', id).first();

    res.json({ success: true, project: updated, message: 'Project approved' });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Failed to approve project' });
  }
});

/**
 * PUT /api/showcase/admin/:id/reject
 * Reject a project
 */
router.put('/admin/:id/reject', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const project = await db('showcase_projects').where('id', id).first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await db('showcase_projects')
      .where('id', id)
      .update({ status: 'rejected' });

    const updated = await db('showcase_projects').where('id', id).first();

    res.json({ success: true, project: updated, message: 'Project rejected' });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Failed to reject project' });
  }
});

/**
 * PUT /api/showcase/admin/:id/feature
 * Toggle featured status
 */
router.put('/admin/:id/feature', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const project = await db('showcase_projects').where('id', id).first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await db('showcase_projects')
      .where('id', id)
      .update({ is_featured: !project.is_featured });

    const updated = await db('showcase_projects').where('id', id).first();

    res.json({
      success: true,
      project: updated,
      message: updated.is_featured ? 'Project featured' : 'Project unfeatured'
    });
  } catch (error) {
    console.error('Feature toggle error:', error);
    res.status(500).json({ error: 'Failed to toggle featured status' });
  }
});

module.exports = router;
