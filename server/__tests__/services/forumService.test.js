/**
 * Forum Service Tests
 * Tests for server/services/forumService.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const forumService = require('../../services/forumService');

describe('Forum Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCategories', () => {
    it('should return all active categories', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'General', slug: 'general', is_active: true },
          { id: 2, name: 'Help', slug: 'help', is_active: true }
        ]
      });

      const categories = await forumService.getCategories();

      expect(categories).toHaveLength(2);
      expect(categories[0].name).toBe('General');
    });
  });

  describe('getCategoryBySlug', () => {
    it('should return category by slug', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'General', slug: 'general' }]
      });

      const category = await forumService.getCategoryBySlug('general');

      expect(category.name).toBe('General');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const category = await forumService.getCategoryBySlug('nonexistent');

      expect(category).toBeNull();
    });
  });

  describe('createCategory', () => {
    it('should create a new category', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'New Category',
          slug: 'new-category',
          description: 'Test description'
        }]
      });

      const category = await forumService.createCategory({
        name: 'New Category',
        slug: 'new-category',
        description: 'Test description'
      });

      expect(category.name).toBe('New Category');
      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('getTopics', () => {
    it('should return paginated topics', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '10' }] });
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Topic 1', slug: 'topic-1' },
          { id: 2, title: 'Topic 2', slug: 'topic-2' }
        ]
      });

      const result = await forumService.getTopics({ page: 1, limit: 20 });

      expect(result.topics).toHaveLength(2);
      expect(result.pagination.total).toBe(10);
    });

    it('should filter by category', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '5' }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      await forumService.getTopics({ categoryId: 1 });

      expect(db.query).toHaveBeenCalled();
    });

    it('should filter unanswered topics', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '3' }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      await forumService.getTopics({ filter: 'unanswered' });

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('getPopularTopics', () => {
    it('should return popular topics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Popular 1', views_count: 100 },
          { id: 2, title: 'Popular 2', views_count: 50 }
        ]
      });

      const topics = await forumService.getPopularTopics(10);

      expect(topics).toHaveLength(2);
      expect(topics[0].views_count).toBe(100);
    });
  });

  describe('getTopicBySlug', () => {
    it('should return topic and increment views', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Test Topic', views_count: 5 }]
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      const topic = await forumService.getTopicBySlug('test-topic', true);

      expect(topic.title).toBe('Test Topic');
      expect(topic.views_count).toBe(6);
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should not increment views if disabled', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Test Topic', views_count: 5 }]
      });

      const topic = await forumService.getTopicBySlug('test-topic', false);

      expect(topic.views_count).toBe(5);
      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('createTopic', () => {
    it('should create a new topic', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'New Topic',
          slug: 'new-topic-abc123',
          content: 'Test content'
        }]
      });
      db.query.mockResolvedValueOnce({ rows: [] }); // Update category count
      db.query.mockResolvedValueOnce({ rows: [] }); // Update user stats insert
      db.query.mockResolvedValueOnce({ rows: [] }); // Update user stats
      db.query.mockResolvedValueOnce({ rows: [{ reputation: 5 }] }); // Get reputation
      db.query.mockResolvedValueOnce({ rows: [] }); // Update badge

      const topic = await forumService.createTopic(1, {
        category_id: 1,
        title: 'New Topic',
        content: 'Test content',
        tags: ['test', 'new']
      });

      expect(topic.title).toBe('New Topic');
    });
  });

  describe('createReply', () => {
    it('should create a reply', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_locked: false, category_id: 1 }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, content: 'Reply content' }]
      });
      db.query.mockResolvedValueOnce({ rows: [] }); // Update topic
      db.query.mockResolvedValueOnce({ rows: [] }); // Update category
      db.query.mockResolvedValueOnce({ rows: [] }); // User stats insert
      db.query.mockResolvedValueOnce({ rows: [] }); // User stats update
      db.query.mockResolvedValueOnce({ rows: [{ reputation: 2 }] }); // Get reputation
      db.query.mockResolvedValueOnce({ rows: [] }); // Update badge

      const reply = await forumService.createReply(1, 1, {
        content: 'Reply content'
      });

      expect(reply.content).toBe('Reply content');
    });

    it('should throw error if topic is locked', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_locked: true }]
      });

      await expect(forumService.createReply(1, 1, { content: 'Test' }))
        .rejects.toThrow('Topic is locked');
    });
  });

  describe('markAsSolution', () => {
    it('should mark reply as solution', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 1 }] }); // Topic
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 2 }] }); // Reply
      db.query.mockResolvedValueOnce({ rows: [] }); // Unmark previous
      db.query.mockResolvedValueOnce({ rows: [] }); // Mark new
      db.query.mockResolvedValueOnce({ rows: [] }); // Update topic
      db.query.mockResolvedValueOnce({ rows: [] }); // User stats insert
      db.query.mockResolvedValueOnce({ rows: [] }); // User stats update
      db.query.mockResolvedValueOnce({ rows: [{ reputation: 25 }] }); // Get reputation
      db.query.mockResolvedValueOnce({ rows: [] }); // Update badge

      const result = await forumService.markAsSolution(1, 1, 1);

      expect(result).toBe(true);
    });

    it('should throw if not topic author', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 2 }] });

      await expect(forumService.markAsSolution(1, 1, 1))
        .rejects.toThrow('Only topic author can mark solutions');
    });
  });

  describe('toggleLike', () => {
    it('should add like if not exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 2 }] }); // Target
      db.query.mockResolvedValueOnce({ rows: [] }); // No existing like
      db.query.mockResolvedValueOnce({ rows: [] }); // Insert like
      db.query.mockResolvedValueOnce({ rows: [] }); // Update count
      db.query.mockResolvedValueOnce({ rows: [] }); // Target user reputation
      db.query.mockResolvedValueOnce({ rows: [{ reputation: 3 }] }); // Get reputation
      db.query.mockResolvedValueOnce({ rows: [] }); // Update badge
      db.query.mockResolvedValueOnce({ rows: [] }); // Liker reputation
      db.query.mockResolvedValueOnce({ rows: [{ reputation: 1 }] }); // Get reputation
      db.query.mockResolvedValueOnce({ rows: [] }); // Update badge

      const result = await forumService.toggleLike(1, 'topic', 1);

      expect(result.liked).toBe(true);
    });

    it('should remove like if exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 2 }] }); // Target
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Existing like
      db.query.mockResolvedValueOnce({ rows: [] }); // Delete like
      db.query.mockResolvedValueOnce({ rows: [] }); // Update count
      db.query.mockResolvedValueOnce({ rows: [] }); // Target user reputation
      db.query.mockResolvedValueOnce({ rows: [{ reputation: 0 }] }); // Get reputation
      db.query.mockResolvedValueOnce({ rows: [] }); // Update badge
      db.query.mockResolvedValueOnce({ rows: [] }); // Liker reputation
      db.query.mockResolvedValueOnce({ rows: [{ reputation: 0 }] }); // Get reputation
      db.query.mockResolvedValueOnce({ rows: [] }); // Update badge

      const result = await forumService.toggleLike(1, 'topic', 1);

      expect(result.liked).toBe(false);
    });
  });

  describe('searchTopics', () => {
    it('should search topics by query', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '5' }] });
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'JavaScript help', content: 'Need help' }
        ]
      });

      const result = await forumService.searchTopics('javascript');

      expect(result.topics).toHaveLength(1);
      expect(result.pagination.total).toBe(5);
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile with stats', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ user_id: 1, topics_count: 5, reputation: 100 }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test User', email: 'test@test.com' }]
      });
      db.query.mockResolvedValueOnce({ rows: [] }); // Recent topics
      db.query.mockResolvedValueOnce({ rows: [] }); // Recent solutions

      const profile = await forumService.getUserProfile(1);

      expect(profile.user.name).toBe('Test User');
      expect(profile.stats.reputation).toBe(100);
    });

    it('should create stats if not exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No stats
      db.query.mockResolvedValueOnce({ rows: [] }); // Insert stats
      db.query.mockResolvedValueOnce({
        rows: [{ user_id: 1, topics_count: 0, reputation: 0 }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'New User' }]
      });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const profile = await forumService.getUserProfile(1);

      expect(profile.stats.reputation).toBe(0);
    });
  });

  describe('getReplies', () => {
    it('should return paginated replies', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '25' }] });
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, content: 'Reply 1', is_solution: false },
          { id: 2, content: 'Reply 2', is_solution: true }
        ]
      });

      const result = await forumService.getReplies(1, { page: 1, limit: 50 });

      expect(result.replies).toHaveLength(2);
      expect(result.pagination.total).toBe(25);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to topic', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await forumService.subscribe(1, 'topic', 1, true);

      expect(result).toBe(true);
    });

    it('should subscribe to category', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await forumService.subscribe(1, 'category', 1, true);

      expect(result).toBe(true);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from topic', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await forumService.unsubscribe(1, 'topic', 1);

      expect(result).toBe(true);
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return user subscriptions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ topic_id: 1, title: 'Subscribed Topic' }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ category_id: 1, name: 'Subscribed Category' }]
      });

      const subs = await forumService.getUserSubscriptions(1);

      expect(subs.topics).toHaveLength(1);
      expect(subs.categories).toHaveLength(1);
    });
  });

  describe('getForumStats', () => {
    it('should return forum statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_topics: '100',
          total_replies: '500',
          solved_topics: '75',
          unique_authors: '25'
        }]
      });

      const stats = await forumService.getForumStats();

      expect(stats.total_topics).toBe('100');
      expect(stats.solved_topics).toBe('75');
    });
  });

  describe('BADGE_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(forumService.BADGE_THRESHOLDS).toHaveProperty('newcomer', 0);
      expect(forumService.BADGE_THRESHOLDS).toHaveProperty('contributor', 50);
      expect(forumService.BADGE_THRESHOLDS).toHaveProperty('active', 150);
      expect(forumService.BADGE_THRESHOLDS).toHaveProperty('trusted', 500);
      expect(forumService.BADGE_THRESHOLDS).toHaveProperty('expert', 1500);
      expect(forumService.BADGE_THRESHOLDS).toHaveProperty('legend', 5000);
    });
  });

  describe('REPUTATION_POINTS', () => {
    it('should have correct point values', () => {
      expect(forumService.REPUTATION_POINTS).toHaveProperty('topic_created', 5);
      expect(forumService.REPUTATION_POINTS).toHaveProperty('reply_created', 2);
      expect(forumService.REPUTATION_POINTS).toHaveProperty('solution_marked', 25);
      expect(forumService.REPUTATION_POINTS).toHaveProperty('like_received', 3);
    });
  });
});
