/**
 * @fileoverview Forum Service
 * @description Business logic for developer forum
 * @module services/forumService
 */

const db = require('../db');
const log = require('../utils/logger');

/**
 * Badge thresholds based on reputation
 */
const BADGE_THRESHOLDS = {
  newcomer: 0,
  contributor: 50,
  active: 150,
  trusted: 500,
  expert: 1500,
  legend: 5000
};

/**
 * Reputation points for actions
 */
const REPUTATION_POINTS = {
  topic_created: 5,
  reply_created: 2,
  solution_marked: 25,
  like_received: 3,
  topic_liked: 1
};

/**
 * Get all categories
 */
async function getCategories() {
  const result = await db.query(`
    SELECT * FROM forum_categories
    WHERE is_active = true
    ORDER BY display_order ASC, name ASC
  `);
  return result.rows;
}

/**
 * Get category by slug
 */
async function getCategoryBySlug(slug) {
  const result = await db.query(
    'SELECT * FROM forum_categories WHERE slug = $1 AND is_active = true',
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * Create a new category (admin)
 */
async function createCategory(data) {
  const { name, slug, description, icon, color, display_order } = data;

  const result = await db.query(`
    INSERT INTO forum_categories (name, slug, description, icon, color, display_order)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [name, slug, description, icon, color, display_order || 0]);

  return result.rows[0];
}

/**
 * Update category (admin)
 */
async function updateCategory(id, data) {
  const { name, slug, description, icon, color, display_order, is_active } = data;

  const result = await db.query(`
    UPDATE forum_categories
    SET name = COALESCE($2, name),
        slug = COALESCE($3, slug),
        description = COALESCE($4, description),
        icon = COALESCE($5, icon),
        color = COALESCE($6, color),
        display_order = COALESCE($7, display_order),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, name, slug, description, icon, color, display_order, is_active]);

  return result.rows[0];
}

/**
 * Delete category (admin)
 */
async function deleteCategory(id) {
  await db.query('DELETE FROM forum_categories WHERE id = $1', [id]);
  return true;
}

/**
 * Get topics with pagination and filters
 */
async function getTopics(options = {}) {
  const {
    categoryId,
    userId,
    page = 1,
    limit = 20,
    sort = 'latest',
    filter = 'all'
  } = options;

  const offset = (page - 1) * limit;
  const params = [];
  let whereClause = 'WHERE 1=1';

  if (categoryId) {
    params.push(categoryId);
    whereClause += ` AND t.category_id = $${params.length}`;
  }

  if (userId) {
    params.push(userId);
    whereClause += ` AND t.user_id = $${params.length}`;
  }

  if (filter === 'solved') {
    whereClause += ' AND t.is_solved = true';
  } else if (filter === 'unsolved') {
    whereClause += ' AND t.is_solved = false';
  } else if (filter === 'unanswered') {
    whereClause += ' AND t.replies_count = 0';
  }

  let orderBy;
  switch (sort) {
    case 'popular':
      orderBy = 'ORDER BY t.is_pinned DESC, t.views_count DESC, t.created_at DESC';
      break;
    case 'most_replies':
      orderBy = 'ORDER BY t.is_pinned DESC, t.replies_count DESC, t.created_at DESC';
      break;
    case 'oldest':
      orderBy = 'ORDER BY t.is_pinned DESC, t.created_at ASC';
      break;
    case 'latest':
    default:
      orderBy = 'ORDER BY t.is_pinned DESC, t.last_reply_at DESC NULLS LAST, t.created_at DESC';
  }

  // Count query
  const countResult = await db.query(`
    SELECT COUNT(*) as total FROM forum_topics t ${whereClause}
  `, params);

  const total = parseInt(countResult.rows[0].total);

  // Main query
  params.push(limit, offset);
  const result = await db.query(`
    SELECT t.*,
           c.name as category_name, c.slug as category_slug, c.color as category_color,
           u.name as author_name, u.email as author_email,
           lu.name as last_reply_user_name
    FROM forum_topics t
    LEFT JOIN forum_categories c ON t.category_id = c.id
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN users lu ON t.last_reply_user_id = lu.id
    ${whereClause}
    ${orderBy}
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  return {
    topics: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get popular topics
 */
async function getPopularTopics(limit = 10) {
  const result = await db.query(`
    SELECT t.*,
           c.name as category_name, c.slug as category_slug,
           u.name as author_name
    FROM forum_topics t
    LEFT JOIN forum_categories c ON t.category_id = c.id
    LEFT JOIN users u ON t.user_id = u.id
    ORDER BY t.views_count DESC, t.likes_count DESC
    LIMIT $1
  `, [limit]);

  return result.rows;
}

/**
 * Get topic by slug
 */
async function getTopicBySlug(slug, incrementViews = true) {
  const result = await db.query(`
    SELECT t.*,
           c.name as category_name, c.slug as category_slug, c.color as category_color,
           u.name as author_name, u.email as author_email
    FROM forum_topics t
    LEFT JOIN forum_categories c ON t.category_id = c.id
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.slug = $1
  `, [slug]);

  const topic = result.rows[0];

  if (topic && incrementViews) {
    await db.query(
      'UPDATE forum_topics SET views_count = views_count + 1 WHERE id = $1',
      [topic.id]
    );
    topic.views_count++;
  }

  return topic || null;
}

/**
 * Create a new topic
 */
async function createTopic(userId, data) {
  const { category_id, title, content, tags } = data;

  // Generate slug from title
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Ensure unique slug
  const timestamp = Date.now().toString(36);
  const slug = `${baseSlug}-${timestamp}`;

  const result = await db.query(`
    INSERT INTO forum_topics (category_id, user_id, title, slug, content, tags)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [category_id, userId, title, slug, content, JSON.stringify(tags || [])]);

  const topic = result.rows[0];

  // Update category count
  await db.query(
    'UPDATE forum_categories SET topics_count = topics_count + 1 WHERE id = $1',
    [category_id]
  );

  // Update user stats
  await updateUserStats(userId, 'topic_created');

  return topic;
}

/**
 * Update topic
 */
async function updateTopic(topicId, userId, data, isAdmin = false) {
  // Check ownership or admin
  const check = await db.query(
    'SELECT user_id FROM forum_topics WHERE id = $1',
    [topicId]
  );

  if (!check.rows[0]) {
    throw new Error('Topic not found');
  }

  if (check.rows[0].user_id !== userId && !isAdmin) {
    throw new Error('Not authorized to edit this topic');
  }

  const { title, content, tags, is_pinned, is_locked } = data;

  const result = await db.query(`
    UPDATE forum_topics
    SET title = COALESCE($2, title),
        content = COALESCE($3, content),
        tags = COALESCE($4, tags),
        is_pinned = COALESCE($5, is_pinned),
        is_locked = COALESCE($6, is_locked),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [topicId, title, content, tags ? JSON.stringify(tags) : null, is_pinned, is_locked]);

  return result.rows[0];
}

/**
 * Delete topic
 */
async function deleteTopic(topicId, userId, isAdmin = false) {
  const check = await db.query(
    'SELECT user_id, category_id FROM forum_topics WHERE id = $1',
    [topicId]
  );

  if (!check.rows[0]) {
    throw new Error('Topic not found');
  }

  if (check.rows[0].user_id !== userId && !isAdmin) {
    throw new Error('Not authorized to delete this topic');
  }

  const { category_id } = check.rows[0];

  await db.query('DELETE FROM forum_topics WHERE id = $1', [topicId]);

  // Update category count
  await db.query(
    'UPDATE forum_categories SET topics_count = GREATEST(topics_count - 1, 0) WHERE id = $1',
    [category_id]
  );

  return true;
}

/**
 * Get replies for a topic
 */
async function getReplies(topicId, options = {}) {
  const { page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  // Count query
  const countResult = await db.query(
    'SELECT COUNT(*) as total FROM forum_replies WHERE topic_id = $1',
    [topicId]
  );

  const total = parseInt(countResult.rows[0].total);

  // Main query - get top-level replies with nested children
  const result = await db.query(`
    SELECT r.*,
           u.name as author_name, u.email as author_email,
           fus.reputation as author_reputation, fus.badge as author_badge
    FROM forum_replies r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN forum_user_stats fus ON r.user_id = fus.user_id
    WHERE r.topic_id = $1
    ORDER BY r.is_solution DESC, r.created_at ASC
    LIMIT $2 OFFSET $3
  `, [topicId, limit, offset]);

  return {
    replies: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Create a reply
 */
async function createReply(userId, topicId, data) {
  const { content, parent_reply_id } = data;

  // Check topic exists and not locked
  const topic = await db.query(
    'SELECT id, is_locked, category_id FROM forum_topics WHERE id = $1',
    [topicId]
  );

  if (!topic.rows[0]) {
    throw new Error('Topic not found');
  }

  if (topic.rows[0].is_locked) {
    throw new Error('Topic is locked');
  }

  const result = await db.query(`
    INSERT INTO forum_replies (topic_id, user_id, parent_reply_id, content)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [topicId, userId, parent_reply_id || null, content]);

  const reply = result.rows[0];

  // Update topic stats
  await db.query(`
    UPDATE forum_topics
    SET replies_count = replies_count + 1,
        last_reply_at = NOW(),
        last_reply_user_id = $2
    WHERE id = $1
  `, [topicId, userId]);

  // Update category replies count
  await db.query(
    'UPDATE forum_categories SET replies_count = replies_count + 1 WHERE id = $1',
    [topic.rows[0].category_id]
  );

  // Update user stats
  await updateUserStats(userId, 'reply_created');

  return reply;
}

/**
 * Update reply
 */
async function updateReply(replyId, userId, content, isAdmin = false) {
  const check = await db.query(
    'SELECT user_id FROM forum_replies WHERE id = $1',
    [replyId]
  );

  if (!check.rows[0]) {
    throw new Error('Reply not found');
  }

  if (check.rows[0].user_id !== userId && !isAdmin) {
    throw new Error('Not authorized to edit this reply');
  }

  const result = await db.query(`
    UPDATE forum_replies
    SET content = $2, is_edited = true, edited_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [replyId, content]);

  return result.rows[0];
}

/**
 * Delete reply
 */
async function deleteReply(replyId, userId, isAdmin = false) {
  const check = await db.query(
    'SELECT user_id, topic_id FROM forum_replies WHERE id = $1',
    [replyId]
  );

  if (!check.rows[0]) {
    throw new Error('Reply not found');
  }

  if (check.rows[0].user_id !== userId && !isAdmin) {
    throw new Error('Not authorized to delete this reply');
  }

  await db.query('DELETE FROM forum_replies WHERE id = $1', [replyId]);

  // Update topic count
  await db.query(
    'UPDATE forum_topics SET replies_count = GREATEST(replies_count - 1, 0) WHERE id = $1',
    [check.rows[0].topic_id]
  );

  return true;
}

/**
 * Mark reply as solution
 */
async function markAsSolution(topicId, replyId, userId) {
  // Check if user is topic owner
  const topic = await db.query(
    'SELECT user_id FROM forum_topics WHERE id = $1',
    [topicId]
  );

  if (!topic.rows[0]) {
    throw new Error('Topic not found');
  }

  if (topic.rows[0].user_id !== userId) {
    throw new Error('Only topic author can mark solutions');
  }

  // Get reply author
  const reply = await db.query(
    'SELECT user_id FROM forum_replies WHERE id = $1 AND topic_id = $2',
    [replyId, topicId]
  );

  if (!reply.rows[0]) {
    throw new Error('Reply not found in this topic');
  }

  // Unmark previous solution if any
  await db.query(
    'UPDATE forum_replies SET is_solution = false WHERE topic_id = $1',
    [topicId]
  );

  // Mark new solution
  await db.query(
    'UPDATE forum_replies SET is_solution = true WHERE id = $1',
    [replyId]
  );

  // Update topic
  await db.query(
    'UPDATE forum_topics SET is_solved = true, solution_reply_id = $2 WHERE id = $1',
    [topicId, replyId]
  );

  // Award reputation to solution author
  await updateUserStats(reply.rows[0].user_id, 'solution_marked');

  return true;
}

/**
 * Toggle like on topic or reply
 */
async function toggleLike(userId, targetType, targetId) {
  const table = targetType === 'topic' ? 'forum_topics' : 'forum_replies';
  const column = targetType === 'topic' ? 'topic_id' : 'reply_id';

  // Get target owner
  const target = await db.query(
    `SELECT user_id FROM ${table} WHERE id = $1`,
    [targetId]
  );

  if (!target.rows[0]) {
    throw new Error(`${targetType} not found`);
  }

  // Check if already liked
  const existing = await db.query(
    `SELECT id FROM forum_likes WHERE user_id = $1 AND ${column} = $2`,
    [userId, targetId]
  );

  let liked;
  if (existing.rows[0]) {
    // Unlike
    await db.query(
      `DELETE FROM forum_likes WHERE user_id = $1 AND ${column} = $2`,
      [userId, targetId]
    );

    await db.query(
      `UPDATE ${table} SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1`,
      [targetId]
    );

    // Decrease reputation
    await adjustReputation(target.rows[0].user_id, -REPUTATION_POINTS.like_received);
    await adjustReputation(userId, -REPUTATION_POINTS.topic_liked);

    liked = false;
  } else {
    // Like
    await db.query(
      `INSERT INTO forum_likes (user_id, ${column}) VALUES ($1, $2)`,
      [userId, targetId]
    );

    await db.query(
      `UPDATE ${table} SET likes_count = likes_count + 1 WHERE id = $1`,
      [targetId]
    );

    // Increase reputation
    await adjustReputation(target.rows[0].user_id, REPUTATION_POINTS.like_received);
    await adjustReputation(userId, REPUTATION_POINTS.topic_liked);

    liked = true;
  }

  return { liked };
}

/**
 * Check if user liked target
 */
async function checkUserLike(userId, targetType, targetId) {
  const column = targetType === 'topic' ? 'topic_id' : 'reply_id';

  const result = await db.query(
    `SELECT id FROM forum_likes WHERE user_id = $1 AND ${column} = $2`,
    [userId, targetId]
  );

  return result.rows.length > 0;
}

/**
 * Search topics
 */
async function searchTopics(query, options = {}) {
  const { page = 1, limit = 20, categoryId } = options;
  const offset = (page - 1) * limit;

  const params = [`%${query}%`, `%${query}%`];
  let whereClause = 'WHERE (t.title ILIKE $1 OR t.content ILIKE $2)';

  if (categoryId) {
    params.push(categoryId);
    whereClause += ` AND t.category_id = $${params.length}`;
  }

  // Count
  const countResult = await db.query(`
    SELECT COUNT(*) as total FROM forum_topics t ${whereClause}
  `, params);

  const total = parseInt(countResult.rows[0].total);

  // Search
  params.push(limit, offset);
  const result = await db.query(`
    SELECT t.*,
           c.name as category_name, c.slug as category_slug,
           u.name as author_name
    FROM forum_topics t
    LEFT JOIN forum_categories c ON t.category_id = c.id
    LEFT JOIN users u ON t.user_id = u.id
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  return {
    topics: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get user forum profile
 */
async function getUserProfile(userId) {
  // Get or create stats
  let stats = await db.query(
    'SELECT * FROM forum_user_stats WHERE user_id = $1',
    [userId]
  );

  if (!stats.rows[0]) {
    await db.query(
      'INSERT INTO forum_user_stats (user_id) VALUES ($1)',
      [userId]
    );
    stats = await db.query(
      'SELECT * FROM forum_user_stats WHERE user_id = $1',
      [userId]
    );
  }

  // Get user info
  const user = await db.query(
    'SELECT id, name, email, created_at FROM users WHERE id = $1',
    [userId]
  );

  // Get recent topics
  const recentTopics = await db.query(`
    SELECT t.id, t.title, t.slug, t.created_at, t.replies_count, t.is_solved,
           c.name as category_name
    FROM forum_topics t
    LEFT JOIN forum_categories c ON t.category_id = c.id
    WHERE t.user_id = $1
    ORDER BY t.created_at DESC
    LIMIT 5
  `, [userId]);

  // Get recent solutions
  const recentSolutions = await db.query(`
    SELECT r.id, r.content, r.created_at,
           t.title as topic_title, t.slug as topic_slug
    FROM forum_replies r
    LEFT JOIN forum_topics t ON r.topic_id = t.id
    WHERE r.user_id = $1 AND r.is_solution = true
    ORDER BY r.created_at DESC
    LIMIT 5
  `, [userId]);

  return {
    user: user.rows[0],
    stats: stats.rows[0],
    recentTopics: recentTopics.rows,
    recentSolutions: recentSolutions.rows
  };
}

/**
 * Update user stats after action
 */
async function updateUserStats(userId, action) {
  // Ensure stats record exists
  await db.query(`
    INSERT INTO forum_user_stats (user_id)
    VALUES ($1)
    ON CONFLICT (user_id) DO NOTHING
  `, [userId]);

  let query;
  let points = 0;

  switch (action) {
    case 'topic_created':
      query = 'UPDATE forum_user_stats SET topics_count = topics_count + 1, last_activity_at = NOW() WHERE user_id = $1';
      points = REPUTATION_POINTS.topic_created;
      break;
    case 'reply_created':
      query = 'UPDATE forum_user_stats SET replies_count = replies_count + 1, last_activity_at = NOW() WHERE user_id = $1';
      points = REPUTATION_POINTS.reply_created;
      break;
    case 'solution_marked':
      query = 'UPDATE forum_user_stats SET solutions_count = solutions_count + 1, last_activity_at = NOW() WHERE user_id = $1';
      points = REPUTATION_POINTS.solution_marked;
      break;
    default:
      return;
  }

  await db.query(query, [userId]);

  if (points > 0) {
    await adjustReputation(userId, points);
  }
}

/**
 * Adjust user reputation
 */
async function adjustReputation(userId, points) {
  await db.query(`
    INSERT INTO forum_user_stats (user_id, reputation)
    VALUES ($1, GREATEST(0, $2))
    ON CONFLICT (user_id)
    DO UPDATE SET
      reputation = GREATEST(0, forum_user_stats.reputation + $2),
      updated_at = NOW()
  `, [userId, points]);

  // Update badge based on new reputation
  const stats = await db.query(
    'SELECT reputation FROM forum_user_stats WHERE user_id = $1',
    [userId]
  );

  if (stats.rows[0]) {
    const reputation = stats.rows[0].reputation;
    let badge = 'newcomer';

    for (const [badgeName, threshold] of Object.entries(BADGE_THRESHOLDS)) {
      if (reputation >= threshold) {
        badge = badgeName;
      }
    }

    await db.query(
      'UPDATE forum_user_stats SET badge = $2 WHERE user_id = $1',
      [userId, badge]
    );
  }
}

/**
 * Subscribe to topic or category
 */
async function subscribe(userId, targetType, targetId, emailNotifications = true) {
  const column = targetType === 'topic' ? 'topic_id' : 'category_id';

  await db.query(`
    INSERT INTO forum_subscriptions (user_id, ${column}, email_notifications)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
  `, [userId, targetId, emailNotifications]);

  return true;
}

/**
 * Unsubscribe from topic or category
 */
async function unsubscribe(userId, targetType, targetId) {
  const column = targetType === 'topic' ? 'topic_id' : 'category_id';

  await db.query(
    `DELETE FROM forum_subscriptions WHERE user_id = $1 AND ${column} = $2`,
    [userId, targetId]
  );

  return true;
}

/**
 * Get user subscriptions
 */
async function getUserSubscriptions(userId) {
  const topics = await db.query(`
    SELECT s.*, t.title, t.slug
    FROM forum_subscriptions s
    LEFT JOIN forum_topics t ON s.topic_id = t.id
    WHERE s.user_id = $1 AND s.topic_id IS NOT NULL
  `, [userId]);

  const categories = await db.query(`
    SELECT s.*, c.name, c.slug
    FROM forum_subscriptions s
    LEFT JOIN forum_categories c ON s.category_id = c.id
    WHERE s.user_id = $1 AND s.category_id IS NOT NULL
  `, [userId]);

  return {
    topics: topics.rows,
    categories: categories.rows
  };
}

/**
 * Get forum stats
 */
async function getForumStats() {
  const stats = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM forum_topics) as total_topics,
      (SELECT COUNT(*) FROM forum_replies) as total_replies,
      (SELECT COUNT(*) FROM forum_topics WHERE is_solved = true) as solved_topics,
      (SELECT COUNT(DISTINCT user_id) FROM forum_topics) as unique_authors
  `);

  return stats.rows[0];
}

module.exports = {
  // Categories
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,

  // Topics
  getTopics,
  getPopularTopics,
  getTopicBySlug,
  createTopic,
  updateTopic,
  deleteTopic,

  // Replies
  getReplies,
  createReply,
  updateReply,
  deleteReply,
  markAsSolution,

  // Likes
  toggleLike,
  checkUserLike,

  // Search
  searchTopics,

  // User
  getUserProfile,
  updateUserStats,
  adjustReputation,

  // Subscriptions
  subscribe,
  unsubscribe,
  getUserSubscriptions,

  // Stats
  getForumStats,

  // Constants
  BADGE_THRESHOLDS,
  REPUTATION_POINTS
};
