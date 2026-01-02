/**
 * Blog and Tutorials Routes
 * API endpoints for blog posts, comments, tutorials, and progress tracking
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Helper: Generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 150);
}

// Helper: Calculate reading time (words per minute)
function calculateReadingTime(content) {
  const wordsPerMinute = 200;
  const words = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

// =====================
// BLOG ROUTES (Public)
// =====================

/**
 * GET /api/blog
 * Get blog post list
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, category, tag, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('blog_posts')
      .leftJoin('users', 'blog_posts.author_id', 'users.id')
      .where('blog_posts.status', 'published')
      .select(
        'blog_posts.id',
        'blog_posts.title',
        'blog_posts.slug',
        'blog_posts.excerpt',
        'blog_posts.featured_image',
        'blog_posts.category',
        'blog_posts.tags',
        'blog_posts.views_count',
        'blog_posts.likes_count',
        'blog_posts.comments_count',
        'blog_posts.reading_time',
        'blog_posts.published_at',
        'users.name as author_name',
        'users.avatar as author_avatar'
      )
      .orderBy('blog_posts.published_at', 'desc');

    if (category) {
      query = query.where('blog_posts.category', category);
    }

    if (tag) {
      query = query.whereRaw("blog_posts.tags::jsonb ? ?", [tag]);
    }

    if (search) {
      query = query.where(function() {
        this.where('blog_posts.title', 'ilike', `%${search}%`)
          .orWhere('blog_posts.excerpt', 'ilike', `%${search}%`);
      });
    }

    const totalQuery = query.clone().count('* as count').first();
    const postsQuery = query.clone().limit(parseInt(limit)).offset(offset);

    const [total, posts] = await Promise.all([totalQuery, postsQuery]);

    res.json({
      success: true,
      data: posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count),
        pages: Math.ceil(parseInt(total.count) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get blog posts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get blog posts' });
  }
});

/**
 * GET /api/blog/featured
 * Get featured posts
 */
router.get('/featured', async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const posts = await db('blog_posts')
      .leftJoin('users', 'blog_posts.author_id', 'users.id')
      .where('blog_posts.status', 'published')
      .select(
        'blog_posts.id',
        'blog_posts.title',
        'blog_posts.slug',
        'blog_posts.excerpt',
        'blog_posts.featured_image',
        'blog_posts.category',
        'blog_posts.reading_time',
        'blog_posts.published_at',
        'users.name as author_name'
      )
      .orderBy('blog_posts.views_count', 'desc')
      .limit(parseInt(limit));

    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('Get featured posts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get featured posts' });
  }
});

/**
 * GET /api/blog/categories
 * Get categories with counts
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await db('blog_posts')
      .where('status', 'published')
      .select('category')
      .count('* as count')
      .groupBy('category')
      .orderBy('count', 'desc');

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, error: 'Failed to get categories' });
  }
});

/**
 * GET /api/blog/:slug
 * Get post detail
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const post = await db('blog_posts')
      .leftJoin('users', 'blog_posts.author_id', 'users.id')
      .where('blog_posts.slug', slug)
      .where('blog_posts.status', 'published')
      .select(
        'blog_posts.*',
        'users.name as author_name',
        'users.avatar as author_avatar',
        'users.email as author_email'
      )
      .first();

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Increment views
    await db('blog_posts').where('id', post.id).increment('views_count', 1);

    // Get related posts
    const relatedPosts = await db('blog_posts')
      .where('category', post.category)
      .where('id', '!=', post.id)
      .where('status', 'published')
      .select('id', 'title', 'slug', 'featured_image', 'reading_time')
      .limit(3);

    res.json({
      success: true,
      data: { ...post, views_count: post.views_count + 1 },
      relatedPosts
    });
  } catch (error) {
    console.error('Get post detail error:', error);
    res.status(500).json({ success: false, error: 'Failed to get post' });
  }
});

/**
 * GET /api/blog/:slug/comments
 * Get post comments
 */
router.get('/:slug/comments', async (req, res) => {
  try {
    const { slug } = req.params;

    const post = await db('blog_posts').where('slug', slug).first();
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const comments = await db('blog_comments')
      .leftJoin('users', 'blog_comments.user_id', 'users.id')
      .where('blog_comments.post_id', post.id)
      .where('blog_comments.is_approved', true)
      .select(
        'blog_comments.id',
        'blog_comments.content',
        'blog_comments.parent_comment_id',
        'blog_comments.created_at',
        'users.name as user_name',
        'users.avatar as user_avatar'
      )
      .orderBy('blog_comments.created_at', 'asc');

    // Build nested comments tree
    const commentMap = new Map();
    const rootComments = [];

    comments.forEach(comment => {
      comment.replies = [];
      commentMap.set(comment.id, comment);
    });

    comments.forEach(comment => {
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });

    res.json({ success: true, data: rootComments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ success: false, error: 'Failed to get comments' });
  }
});

/**
 * POST /api/blog/:slug/comments
 * Add comment (requires auth)
 */
router.post('/:slug/comments', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Comment content is required' });
    }

    const post = await db('blog_posts').where('slug', slug).first();
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const [comment] = await db('blog_comments').insert({
      post_id: post.id,
      user_id: userId,
      parent_comment_id: parentCommentId || null,
      content: content.trim()
    }).returning('*');

    // Update comment count
    await db('blog_posts').where('id', post.id).increment('comments_count', 1);

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
});

/**
 * POST /api/blog/:slug/like
 * Like post (requires auth)
 */
router.post('/:slug/like', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;

    const post = await db('blog_posts').where('slug', slug).first();
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    await db('blog_posts').where('id', post.id).increment('likes_count', 1);

    res.json({ success: true, likes_count: post.likes_count + 1 });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ success: false, error: 'Failed to like post' });
  }
});

// =====================
// TUTORIAL ROUTES (Public)
// =====================

/**
 * GET /api/tutorials
 * Get tutorial list
 */
router.get('/tutorials', async (req, res) => {
  try {
    const { page = 1, limit = 12, difficulty, series, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('tutorials')
      .leftJoin('users', 'tutorials.author_id', 'users.id')
      .where('tutorials.status', 'published')
      .select(
        'tutorials.id',
        'tutorials.title',
        'tutorials.slug',
        'tutorials.description',
        'tutorials.difficulty',
        'tutorials.estimated_time',
        'tutorials.series_id',
        'tutorials.views_count',
        'tutorials.completions_count',
        'tutorials.rating',
        'tutorials.published_at',
        'users.name as author_name'
      )
      .orderBy('tutorials.published_at', 'desc');

    if (difficulty) {
      query = query.where('tutorials.difficulty', difficulty);
    }

    if (series) {
      query = query.where('tutorials.series_id', series);
    }

    if (search) {
      query = query.where(function() {
        this.where('tutorials.title', 'ilike', `%${search}%`)
          .orWhere('tutorials.description', 'ilike', `%${search}%`);
      });
    }

    const totalQuery = query.clone().count('* as count').first();
    const tutorialsQuery = query.clone().limit(parseInt(limit)).offset(offset);

    const [total, tutorials] = await Promise.all([totalQuery, tutorialsQuery]);

    // Get step counts
    const tutorialIds = tutorials.map(t => t.id);
    const stepCounts = await db('tutorial_steps')
      .whereIn('tutorial_id', tutorialIds)
      .select('tutorial_id')
      .count('* as steps')
      .groupBy('tutorial_id');

    const stepCountMap = new Map(stepCounts.map(s => [s.tutorial_id, parseInt(s.steps)]));
    tutorials.forEach(t => {
      t.steps_count = stepCountMap.get(t.id) || 0;
    });

    res.json({
      success: true,
      data: tutorials,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count),
        pages: Math.ceil(parseInt(total.count) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get tutorials error:', error);
    res.status(500).json({ success: false, error: 'Failed to get tutorials' });
  }
});

/**
 * GET /api/tutorials/series
 * Get tutorial series
 */
router.get('/tutorials/series', async (req, res) => {
  try {
    const series = await db('tutorials')
      .whereNotNull('series_id')
      .where('status', 'published')
      .select('series_id')
      .count('* as tutorials_count')
      .groupBy('series_id')
      .orderBy('series_id');

    res.json({ success: true, data: series });
  } catch (error) {
    console.error('Get series error:', error);
    res.status(500).json({ success: false, error: 'Failed to get series' });
  }
});

/**
 * GET /api/tutorials/:slug
 * Get tutorial detail
 */
router.get('/tutorials/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const tutorial = await db('tutorials')
      .leftJoin('users', 'tutorials.author_id', 'users.id')
      .where('tutorials.slug', slug)
      .where('tutorials.status', 'published')
      .select(
        'tutorials.*',
        'users.name as author_name',
        'users.avatar as author_avatar'
      )
      .first();

    if (!tutorial) {
      return res.status(404).json({ success: false, error: 'Tutorial not found' });
    }

    // Increment views
    await db('tutorials').where('id', tutorial.id).increment('views_count', 1);

    // Get steps
    const steps = await db('tutorial_steps')
      .where('tutorial_id', tutorial.id)
      .orderBy('step_number', 'asc');

    // Get series tutorials if part of series
    let seriesTutorials = [];
    if (tutorial.series_id) {
      seriesTutorials = await db('tutorials')
        .where('series_id', tutorial.series_id)
        .where('status', 'published')
        .orderBy('series_order', 'asc')
        .select('id', 'title', 'slug', 'series_order');
    }

    res.json({
      success: true,
      data: {
        ...tutorial,
        views_count: tutorial.views_count + 1,
        steps,
        seriesTutorials
      }
    });
  } catch (error) {
    console.error('Get tutorial detail error:', error);
    res.status(500).json({ success: false, error: 'Failed to get tutorial' });
  }
});

/**
 * GET /api/tutorials/:slug/steps
 * Get tutorial steps
 */
router.get('/tutorials/:slug/steps', async (req, res) => {
  try {
    const { slug } = req.params;

    const tutorial = await db('tutorials').where('slug', slug).first();
    if (!tutorial) {
      return res.status(404).json({ success: false, error: 'Tutorial not found' });
    }

    const steps = await db('tutorial_steps')
      .where('tutorial_id', tutorial.id)
      .orderBy('step_number', 'asc');

    res.json({ success: true, data: steps });
  } catch (error) {
    console.error('Get steps error:', error);
    res.status(500).json({ success: false, error: 'Failed to get steps' });
  }
});

/**
 * POST /api/tutorials/:slug/progress
 * Update tutorial progress (requires auth)
 */
router.post('/tutorials/:slug/progress', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const { stepNumber, completed } = req.body;
    const userId = req.user.id;

    const tutorial = await db('tutorials').where('slug', slug).first();
    if (!tutorial) {
      return res.status(404).json({ success: false, error: 'Tutorial not found' });
    }

    // Get or create progress record
    let progress = await db('tutorial_progress')
      .where('tutorial_id', tutorial.id)
      .where('user_id', userId)
      .first();

    if (!progress) {
      [progress] = await db('tutorial_progress').insert({
        tutorial_id: tutorial.id,
        user_id: userId,
        completed_steps: JSON.stringify([])
      }).returning('*');
    }

    // Update completed steps
    let completedSteps = typeof progress.completed_steps === 'string'
      ? JSON.parse(progress.completed_steps)
      : progress.completed_steps || [];

    if (completed && !completedSteps.includes(stepNumber)) {
      completedSteps.push(stepNumber);
    } else if (!completed) {
      completedSteps = completedSteps.filter(s => s !== stepNumber);
    }

    // Check if tutorial is completed
    const totalSteps = await db('tutorial_steps')
      .where('tutorial_id', tutorial.id)
      .count('* as count')
      .first();

    const isCompleted = completedSteps.length >= parseInt(totalSteps.count);

    await db('tutorial_progress')
      .where('id', progress.id)
      .update({
        completed_steps: JSON.stringify(completedSteps),
        is_completed: isCompleted,
        completed_at: isCompleted ? db.fn.now() : null
      });

    // Update tutorial completions count if just completed
    if (isCompleted && !progress.is_completed) {
      await db('tutorials').where('id', tutorial.id).increment('completions_count', 1);
    }

    res.json({
      success: true,
      data: {
        completedSteps,
        isCompleted,
        progress: (completedSteps.length / parseInt(totalSteps.count)) * 100
      }
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ success: false, error: 'Failed to update progress' });
  }
});

/**
 * GET /api/tutorials/my/progress
 * Get user's tutorial progress (requires auth)
 */
router.get('/tutorials/my/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const progress = await db('tutorial_progress')
      .leftJoin('tutorials', 'tutorial_progress.tutorial_id', 'tutorials.id')
      .where('tutorial_progress.user_id', userId)
      .select(
        'tutorial_progress.*',
        'tutorials.title',
        'tutorials.slug',
        'tutorials.difficulty',
        'tutorials.estimated_time'
      )
      .orderBy('tutorial_progress.created_at', 'desc');

    // Get step counts for each tutorial
    const tutorialIds = progress.map(p => p.tutorial_id);
    const stepCounts = await db('tutorial_steps')
      .whereIn('tutorial_id', tutorialIds)
      .select('tutorial_id')
      .count('* as total_steps')
      .groupBy('tutorial_id');

    const stepCountMap = new Map(stepCounts.map(s => [s.tutorial_id, parseInt(s.total_steps)]));

    const progressWithDetails = progress.map(p => {
      const completedSteps = typeof p.completed_steps === 'string'
        ? JSON.parse(p.completed_steps)
        : p.completed_steps || [];
      const totalSteps = stepCountMap.get(p.tutorial_id) || 0;

      return {
        ...p,
        completed_steps_count: completedSteps.length,
        total_steps: totalSteps,
        progress_percent: totalSteps > 0 ? (completedSteps.length / totalSteps) * 100 : 0
      };
    });

    res.json({ success: true, data: progressWithDetails });
  } catch (error) {
    console.error('Get my progress error:', error);
    res.status(500).json({ success: false, error: 'Failed to get progress' });
  }
});

// =====================
// ADMIN ROUTES
// =====================

/**
 * POST /api/admin/blog
 * Create blog post (requires auth + admin)
 */
router.post('/admin/blog', authenticateToken, async (req, res) => {
  try {
    const { title, content, excerpt, category, tags, featuredImage, metaTitle, metaDescription, status } = req.body;
    const authorId = req.user.id;

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    let slug = generateSlug(title);

    // Ensure unique slug
    const existing = await db('blog_posts').where('slug', slug).first();
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const readingTime = calculateReadingTime(content);

    const [post] = await db('blog_posts').insert({
      author_id: authorId,
      title,
      slug,
      excerpt,
      content,
      featured_image: featuredImage,
      category,
      tags: JSON.stringify(tags || []),
      meta_title: metaTitle || title,
      meta_description: metaDescription || excerpt,
      reading_time: readingTime,
      status: status || 'draft',
      published_at: status === 'published' ? db.fn.now() : null
    }).returning('*');

    res.status(201).json({ success: true, data: post });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, error: 'Failed to create post' });
  }
});

/**
 * PUT /api/admin/blog/:id
 * Update blog post (requires auth + admin)
 */
router.put('/admin/blog/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, excerpt, category, tags, featuredImage, metaTitle, metaDescription, status } = req.body;

    const post = await db('blog_posts').where('id', id).first();
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const updates = { updated_at: db.fn.now() };

    if (title) {
      updates.title = title;
      if (title !== post.title) {
        let slug = generateSlug(title);
        const existing = await db('blog_posts').where('slug', slug).whereNot('id', id).first();
        if (existing) {
          slug = `${slug}-${Date.now()}`;
        }
        updates.slug = slug;
      }
    }

    if (content) {
      updates.content = content;
      updates.reading_time = calculateReadingTime(content);
    }

    if (excerpt !== undefined) updates.excerpt = excerpt;
    if (category !== undefined) updates.category = category;
    if (tags !== undefined) updates.tags = JSON.stringify(tags);
    if (featuredImage !== undefined) updates.featured_image = featuredImage;
    if (metaTitle !== undefined) updates.meta_title = metaTitle;
    if (metaDescription !== undefined) updates.meta_description = metaDescription;

    if (status) {
      updates.status = status;
      if (status === 'published' && !post.published_at) {
        updates.published_at = db.fn.now();
      }
    }

    await db('blog_posts').where('id', id).update(updates);
    const updatedPost = await db('blog_posts').where('id', id).first();

    res.json({ success: true, data: updatedPost });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, error: 'Failed to update post' });
  }
});

/**
 * DELETE /api/admin/blog/:id
 * Delete blog post (requires auth + admin)
 */
router.delete('/admin/blog/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const post = await db('blog_posts').where('id', id).first();
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    await db('blog_posts').where('id', id).delete();

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete post' });
  }
});

/**
 * GET /api/admin/blog
 * Get all posts for admin (requires auth)
 */
router.get('/admin/blog', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('blog_posts')
      .leftJoin('users', 'blog_posts.author_id', 'users.id')
      .select(
        'blog_posts.*',
        'users.name as author_name'
      )
      .orderBy('blog_posts.created_at', 'desc');

    if (status) {
      query = query.where('blog_posts.status', status);
    }

    const total = await query.clone().count('* as count').first();
    const posts = await query.clone().limit(parseInt(limit)).offset(offset);

    res.json({
      success: true,
      data: posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count)
      }
    });
  } catch (error) {
    console.error('Get admin posts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get posts' });
  }
});

/**
 * POST /api/admin/tutorials
 * Create tutorial (requires auth + admin)
 */
router.post('/admin/tutorials', authenticateToken, async (req, res) => {
  try {
    const { title, description, difficulty, estimatedTime, prerequisites, seriesId, seriesOrder, steps, status } = req.body;
    const authorId = req.user.id;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    let slug = generateSlug(title);
    const existing = await db('tutorials').where('slug', slug).first();
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const [tutorial] = await db('tutorials').insert({
      author_id: authorId,
      title,
      slug,
      description,
      difficulty: difficulty || 'beginner',
      estimated_time: estimatedTime,
      prerequisites: JSON.stringify(prerequisites || []),
      series_id: seriesId,
      series_order: seriesOrder,
      status: status || 'draft',
      published_at: status === 'published' ? db.fn.now() : null
    }).returning('*');

    // Add steps if provided
    if (steps && steps.length > 0) {
      const stepsToInsert = steps.map((step, index) => ({
        tutorial_id: tutorial.id,
        step_number: index + 1,
        title: step.title,
        content: step.content,
        code_snippet: step.codeSnippet,
        code_language: step.codeLanguage
      }));

      await db('tutorial_steps').insert(stepsToInsert);
    }

    res.status(201).json({ success: true, data: tutorial });
  } catch (error) {
    console.error('Create tutorial error:', error);
    res.status(500).json({ success: false, error: 'Failed to create tutorial' });
  }
});

/**
 * PUT /api/admin/tutorials/:id
 * Update tutorial (requires auth + admin)
 */
router.put('/admin/tutorials/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, difficulty, estimatedTime, prerequisites, seriesId, seriesOrder, steps, status } = req.body;

    const tutorial = await db('tutorials').where('id', id).first();
    if (!tutorial) {
      return res.status(404).json({ success: false, error: 'Tutorial not found' });
    }

    const updates = {};

    if (title) {
      updates.title = title;
      if (title !== tutorial.title) {
        let slug = generateSlug(title);
        const existing = await db('tutorials').where('slug', slug).whereNot('id', id).first();
        if (existing) {
          slug = `${slug}-${Date.now()}`;
        }
        updates.slug = slug;
      }
    }

    if (description !== undefined) updates.description = description;
    if (difficulty !== undefined) updates.difficulty = difficulty;
    if (estimatedTime !== undefined) updates.estimated_time = estimatedTime;
    if (prerequisites !== undefined) updates.prerequisites = JSON.stringify(prerequisites);
    if (seriesId !== undefined) updates.series_id = seriesId;
    if (seriesOrder !== undefined) updates.series_order = seriesOrder;

    if (status) {
      updates.status = status;
      if (status === 'published' && !tutorial.published_at) {
        updates.published_at = db.fn.now();
      }
    }

    if (Object.keys(updates).length > 0) {
      await db('tutorials').where('id', id).update(updates);
    }

    // Update steps if provided
    if (steps) {
      await db('tutorial_steps').where('tutorial_id', id).delete();

      if (steps.length > 0) {
        const stepsToInsert = steps.map((step, index) => ({
          tutorial_id: parseInt(id),
          step_number: index + 1,
          title: step.title,
          content: step.content,
          code_snippet: step.codeSnippet,
          code_language: step.codeLanguage
        }));

        await db('tutorial_steps').insert(stepsToInsert);
      }
    }

    const updatedTutorial = await db('tutorials').where('id', id).first();
    const updatedSteps = await db('tutorial_steps').where('tutorial_id', id).orderBy('step_number');

    res.json({ success: true, data: { ...updatedTutorial, steps: updatedSteps } });
  } catch (error) {
    console.error('Update tutorial error:', error);
    res.status(500).json({ success: false, error: 'Failed to update tutorial' });
  }
});

/**
 * DELETE /api/admin/tutorials/:id
 * Delete tutorial (requires auth + admin)
 */
router.delete('/admin/tutorials/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const tutorial = await db('tutorials').where('id', id).first();
    if (!tutorial) {
      return res.status(404).json({ success: false, error: 'Tutorial not found' });
    }

    await db('tutorials').where('id', id).delete();

    res.json({ success: true, message: 'Tutorial deleted successfully' });
  } catch (error) {
    console.error('Delete tutorial error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete tutorial' });
  }
});

/**
 * GET /api/admin/tutorials
 * Get all tutorials for admin (requires auth)
 */
router.get('/admin/tutorials', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('tutorials')
      .leftJoin('users', 'tutorials.author_id', 'users.id')
      .select(
        'tutorials.*',
        'users.name as author_name'
      )
      .orderBy('tutorials.created_at', 'desc');

    if (status) {
      query = query.where('tutorials.status', status);
    }

    const total = await query.clone().count('* as count').first();
    const tutorials = await query.clone().limit(parseInt(limit)).offset(offset);

    res.json({
      success: true,
      data: tutorials,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count)
      }
    });
  } catch (error) {
    console.error('Get admin tutorials error:', error);
    res.status(500).json({ success: false, error: 'Failed to get tutorials' });
  }
});

module.exports = router;
