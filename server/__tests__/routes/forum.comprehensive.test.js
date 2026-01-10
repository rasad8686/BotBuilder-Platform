/**
 * Forum Routes Comprehensive Tests
 * Tests for forum.js routes
 */

const request = require('supertest');
const express = require('express');

// Mock forumService
const mockForumService = {
  getCategories: jest.fn(),
  getCategoryBySlug: jest.fn(),
  getTopics: jest.fn(),
  getPopularTopics: jest.fn(),
  getTopicBySlug: jest.fn(),
  checkUserLike: jest.fn(),
  getReplies: jest.fn(),
  searchTopics: jest.fn(),
  getUserProfile: jest.fn(),
  getForumStats: jest.fn(),
  createTopic: jest.fn(),
  updateTopic: jest.fn(),
  deleteTopic: jest.fn(),
  createReply: jest.fn(),
  updateReply: jest.fn(),
  deleteReply: jest.fn(),
  markAsSolution: jest.fn(),
  toggleLike: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  getUserSubscriptions: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn()
};

jest.mock('../../services/forumService', () => mockForumService);

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'admin', is_admin: true };
    next();
  },
  optionalAuth: (req, res, next) => {
    // Simulate optional auth - user may or may not be present
    if (req.headers.authorization) {
      req.user = { id: 1, email: 'test@example.com' };
    }
    next();
  }
}));

const forumRoutes = require('../../routes/forum');

const app = express();
app.use(express.json());
app.use('/api/forum', forumRoutes);

describe('Forum Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================
  // PUBLIC ROUTES
  // =====================

  describe('GET /api/forum/categories', () => {
    it('should get all categories', async () => {
      const mockCategories = [
        { id: 1, name: 'General', slug: 'general' },
        { id: 2, name: 'Help', slug: 'help' }
      ];
      mockForumService.getCategories.mockResolvedValueOnce(mockCategories);

      const res = await request(app).get('/api/forum/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockCategories);
    });

    it('should return 500 on error', async () => {
      mockForumService.getCategories.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/categories');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/forum/categories/:slug', () => {
    it('should get category by slug', async () => {
      const mockCategory = { id: 1, name: 'General', slug: 'general' };
      mockForumService.getCategoryBySlug.mockResolvedValueOnce(mockCategory);

      const res = await request(app).get('/api/forum/categories/general');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockCategory);
    });

    it('should return 404 if category not found', async () => {
      mockForumService.getCategoryBySlug.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/forum/categories/non-existent');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('should return 500 on error', async () => {
      mockForumService.getCategoryBySlug.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/categories/general');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/forum/topics', () => {
    it('should get topics with pagination', async () => {
      const mockResult = {
        topics: [{ id: 1, title: 'Topic 1' }],
        pagination: { page: 1, limit: 20, total: 1 }
      };
      mockForumService.getTopics.mockResolvedValueOnce(mockResult);

      const res = await request(app).get('/api/forum/topics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult.topics);
    });

    it('should filter by category', async () => {
      mockForumService.getCategoryBySlug.mockResolvedValueOnce({ id: 1, slug: 'general' });
      mockForumService.getTopics.mockResolvedValueOnce({
        topics: [],
        pagination: { page: 1, limit: 20, total: 0 }
      });

      const res = await request(app).get('/api/forum/topics?category=general');

      expect(res.status).toBe(200);
      expect(mockForumService.getTopics).toHaveBeenCalledWith(expect.objectContaining({
        categoryId: 1
      }));
    });

    it('should handle sort and filter parameters', async () => {
      mockForumService.getTopics.mockResolvedValueOnce({
        topics: [],
        pagination: { page: 1, limit: 20, total: 0 }
      });

      const res = await request(app).get('/api/forum/topics?sort=popular&filter=solved');

      expect(res.status).toBe(200);
      expect(mockForumService.getTopics).toHaveBeenCalledWith(expect.objectContaining({
        sort: 'popular',
        filter: 'solved'
      }));
    });

    it('should return 500 on error', async () => {
      mockForumService.getTopics.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/topics');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/forum/topics/popular', () => {
    it('should get popular topics', async () => {
      const mockTopics = [{ id: 1, title: 'Popular Topic', views: 1000 }];
      mockForumService.getPopularTopics.mockResolvedValueOnce(mockTopics);

      const res = await request(app).get('/api/forum/topics/popular');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should respect limit parameter', async () => {
      mockForumService.getPopularTopics.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/forum/topics/popular?limit=5');

      expect(res.status).toBe(200);
      expect(mockForumService.getPopularTopics).toHaveBeenCalledWith(5);
    });

    it('should return 500 on error', async () => {
      mockForumService.getPopularTopics.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/topics/popular');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/forum/topics/unanswered', () => {
    it('should get unanswered topics', async () => {
      mockForumService.getTopics.mockResolvedValueOnce({
        topics: [{ id: 1, title: 'Unanswered' }],
        pagination: { page: 1, limit: 20, total: 1 }
      });

      const res = await request(app).get('/api/forum/topics/unanswered');

      expect(res.status).toBe(200);
      expect(mockForumService.getTopics).toHaveBeenCalledWith(expect.objectContaining({
        filter: 'unanswered'
      }));
    });

    it('should return 500 on error', async () => {
      mockForumService.getTopics.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/topics/unanswered');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/forum/topics/:slug', () => {
    it('should get topic by slug', async () => {
      const mockTopic = { id: 1, title: 'Test Topic', slug: 'test-topic' };
      mockForumService.getTopicBySlug.mockResolvedValueOnce(mockTopic);

      const res = await request(app).get('/api/forum/topics/test-topic');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should include userLiked when authenticated', async () => {
      const mockTopic = { id: 1, title: 'Test Topic' };
      mockForumService.getTopicBySlug.mockResolvedValueOnce(mockTopic);
      mockForumService.checkUserLike.mockResolvedValueOnce(true);

      const res = await request(app)
        .get('/api/forum/topics/test-topic')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data.userLiked).toBe(true);
    });

    it('should return 404 if topic not found', async () => {
      mockForumService.getTopicBySlug.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/forum/topics/non-existent');

      expect(res.status).toBe(404);
    });

    it('should return 500 on error', async () => {
      mockForumService.getTopicBySlug.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/topics/test-topic');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/forum/topics/:topicId/replies', () => {
    it('should get topic replies', async () => {
      mockForumService.getReplies.mockResolvedValueOnce({
        replies: [{ id: 1, content: 'Reply 1' }],
        pagination: { page: 1, limit: 50, total: 1 }
      });

      const res = await request(app).get('/api/forum/topics/1/replies');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.getReplies.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/topics/1/replies');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/forum/search', () => {
    it('should search topics', async () => {
      mockForumService.searchTopics.mockResolvedValueOnce({
        topics: [{ id: 1, title: 'Search Result' }],
        pagination: { page: 1, limit: 20, total: 1 }
      });

      const res = await request(app).get('/api/forum/search?q=test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if query too short', async () => {
      const res = await request(app).get('/api/forum/search?q=a');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at least 2 characters');
    });

    it('should filter by category', async () => {
      mockForumService.getCategoryBySlug.mockResolvedValueOnce({ id: 1 });
      mockForumService.searchTopics.mockResolvedValueOnce({
        topics: [],
        pagination: { page: 1, limit: 20, total: 0 }
      });

      const res = await request(app).get('/api/forum/search?q=test&category=general');

      expect(res.status).toBe(200);
    });

    it('should return 500 on error', async () => {
      mockForumService.searchTopics.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/search?q=test');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/forum/user/:userId', () => {
    it('should get user forum profile', async () => {
      mockForumService.getUserProfile.mockResolvedValueOnce({
        user: { id: 1, name: 'Test User' },
        topics: [],
        replies: []
      });

      const res = await request(app).get('/api/forum/user/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if user not found', async () => {
      mockForumService.getUserProfile.mockResolvedValueOnce({ user: null });

      const res = await request(app).get('/api/forum/user/999');

      expect(res.status).toBe(404);
    });

    it('should return 500 on error', async () => {
      mockForumService.getUserProfile.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/user/1');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/forum/stats', () => {
    it('should get forum stats', async () => {
      mockForumService.getForumStats.mockResolvedValueOnce({
        totalTopics: 100,
        totalReplies: 500,
        totalUsers: 50
      });

      const res = await request(app).get('/api/forum/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.getForumStats.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/stats');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // AUTHENTICATED ROUTES
  // =====================

  describe('POST /api/forum/topics', () => {
    it('should create topic', async () => {
      const mockTopic = { id: 1, title: 'New Topic' };
      mockForumService.createTopic.mockResolvedValueOnce(mockTopic);

      const res = await request(app)
        .post('/api/forum/topics')
        .send({ category_id: 1, title: 'New Topic', content: 'Content here' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if fields missing', async () => {
      const res = await request(app)
        .post('/api/forum/topics')
        .send({ title: 'Only title' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('required');
    });

    it('should return 500 on error', async () => {
      mockForumService.createTopic.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .post('/api/forum/topics')
        .send({ category_id: 1, title: 'New Topic', content: 'Content' });

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/forum/topics/:id', () => {
    it('should update topic', async () => {
      mockForumService.updateTopic.mockResolvedValueOnce({ id: 1, title: 'Updated' });

      const res = await request(app)
        .put('/api/forum/topics/1')
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 if not authorized', async () => {
      mockForumService.updateTopic.mockRejectedValueOnce(new Error('Not authorized'));

      const res = await request(app)
        .put('/api/forum/topics/1')
        .send({ title: 'Updated' });

      expect(res.status).toBe(403);
    });

    it('should return 500 on other errors', async () => {
      mockForumService.updateTopic.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .put('/api/forum/topics/1')
        .send({ title: 'Updated' });

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/forum/topics/:id', () => {
    it('should delete topic', async () => {
      mockForumService.deleteTopic.mockResolvedValueOnce();

      const res = await request(app).delete('/api/forum/topics/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 if not authorized', async () => {
      mockForumService.deleteTopic.mockRejectedValueOnce(new Error('Not authorized'));

      const res = await request(app).delete('/api/forum/topics/1');

      expect(res.status).toBe(403);
    });

    it('should return 500 on other errors', async () => {
      mockForumService.deleteTopic.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).delete('/api/forum/topics/1');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/forum/topics/:topicId/replies', () => {
    it('should create reply', async () => {
      mockForumService.createReply.mockResolvedValueOnce({ id: 1, content: 'Reply' });

      const res = await request(app)
        .post('/api/forum/topics/1/replies')
        .send({ content: 'My reply' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if content missing', async () => {
      const res = await request(app)
        .post('/api/forum/topics/1/replies')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('required');
    });

    it('should return 403 if topic locked', async () => {
      mockForumService.createReply.mockRejectedValueOnce(new Error('Topic is locked'));

      const res = await request(app)
        .post('/api/forum/topics/1/replies')
        .send({ content: 'Reply' });

      expect(res.status).toBe(403);
    });

    it('should return 500 on other errors', async () => {
      mockForumService.createReply.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .post('/api/forum/topics/1/replies')
        .send({ content: 'Reply' });

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/forum/replies/:id', () => {
    it('should update reply', async () => {
      mockForumService.updateReply.mockResolvedValueOnce({ id: 1, content: 'Updated' });

      const res = await request(app)
        .put('/api/forum/replies/1')
        .send({ content: 'Updated content' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if content missing', async () => {
      const res = await request(app)
        .put('/api/forum/replies/1')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 403 if not authorized', async () => {
      mockForumService.updateReply.mockRejectedValueOnce(new Error('Not authorized'));

      const res = await request(app)
        .put('/api/forum/replies/1')
        .send({ content: 'Updated' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/forum/replies/:id', () => {
    it('should delete reply', async () => {
      mockForumService.deleteReply.mockResolvedValueOnce();

      const res = await request(app).delete('/api/forum/replies/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 if not authorized', async () => {
      mockForumService.deleteReply.mockRejectedValueOnce(new Error('Not authorized'));

      const res = await request(app).delete('/api/forum/replies/1');

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/forum/topics/:topicId/solution/:replyId', () => {
    it('should mark reply as solution', async () => {
      mockForumService.markAsSolution.mockResolvedValueOnce();

      const res = await request(app).post('/api/forum/topics/1/solution/2');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 if not topic author', async () => {
      mockForumService.markAsSolution.mockRejectedValueOnce(new Error('Only topic author can mark solution'));

      const res = await request(app).post('/api/forum/topics/1/solution/2');

      expect(res.status).toBe(403);
    });

    it('should return 500 on other errors', async () => {
      mockForumService.markAsSolution.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).post('/api/forum/topics/1/solution/2');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/forum/topics/:id/like', () => {
    it('should toggle topic like', async () => {
      mockForumService.toggleLike.mockResolvedValueOnce({ liked: true, likes: 10 });

      const res = await request(app).post('/api/forum/topics/1/like');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.toggleLike.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).post('/api/forum/topics/1/like');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/forum/replies/:id/like', () => {
    it('should toggle reply like', async () => {
      mockForumService.toggleLike.mockResolvedValueOnce({ liked: true, likes: 5 });

      const res = await request(app).post('/api/forum/replies/1/like');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.toggleLike.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).post('/api/forum/replies/1/like');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/forum/topics/:id/subscribe', () => {
    it('should subscribe to topic', async () => {
      mockForumService.subscribe.mockResolvedValueOnce();

      const res = await request(app)
        .post('/api/forum/topics/1/subscribe')
        .send({ email_notifications: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.subscribe.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).post('/api/forum/topics/1/subscribe');

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/forum/topics/:id/subscribe', () => {
    it('should unsubscribe from topic', async () => {
      mockForumService.unsubscribe.mockResolvedValueOnce();

      const res = await request(app).delete('/api/forum/topics/1/subscribe');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.unsubscribe.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).delete('/api/forum/topics/1/subscribe');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/forum/categories/:id/subscribe', () => {
    it('should subscribe to category', async () => {
      mockForumService.subscribe.mockResolvedValueOnce();

      const res = await request(app).post('/api/forum/categories/1/subscribe');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.subscribe.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).post('/api/forum/categories/1/subscribe');

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/forum/categories/:id/subscribe', () => {
    it('should unsubscribe from category', async () => {
      mockForumService.unsubscribe.mockResolvedValueOnce();

      const res = await request(app).delete('/api/forum/categories/1/subscribe');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.unsubscribe.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).delete('/api/forum/categories/1/subscribe');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/forum/me/subscriptions', () => {
    it('should get user subscriptions', async () => {
      mockForumService.getUserSubscriptions.mockResolvedValueOnce([
        { type: 'topic', id: 1 },
        { type: 'category', id: 2 }
      ]);

      const res = await request(app).get('/api/forum/me/subscriptions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.getUserSubscriptions.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/me/subscriptions');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/forum/me/topics', () => {
    it('should get user topics', async () => {
      mockForumService.getTopics.mockResolvedValueOnce({
        topics: [{ id: 1, title: 'My Topic' }],
        pagination: { page: 1, limit: 20, total: 1 }
      });

      const res = await request(app).get('/api/forum/me/topics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.getTopics.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/me/topics');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/forum/me/profile', () => {
    it('should get current user profile', async () => {
      mockForumService.getUserProfile.mockResolvedValueOnce({
        user: { id: 1, name: 'Test' },
        topics: [],
        replies: []
      });

      const res = await request(app).get('/api/forum/me/profile');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.getUserProfile.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/forum/me/profile');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // ADMIN ROUTES
  // =====================

  describe('POST /api/forum/admin/categories', () => {
    it('should create category (admin)', async () => {
      mockForumService.createCategory.mockResolvedValueOnce({ id: 1, name: 'New Category' });

      const res = await request(app)
        .post('/api/forum/admin/categories')
        .send({ name: 'New Category', slug: 'new-category' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.createCategory.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .post('/api/forum/admin/categories')
        .send({ name: 'New Category' });

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/forum/admin/categories/:id', () => {
    it('should update category (admin)', async () => {
      mockForumService.updateCategory.mockResolvedValueOnce({ id: 1, name: 'Updated' });

      const res = await request(app)
        .put('/api/forum/admin/categories/1')
        .send({ name: 'Updated Category' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.updateCategory.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .put('/api/forum/admin/categories/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/forum/admin/categories/:id', () => {
    it('should delete category (admin)', async () => {
      mockForumService.deleteCategory.mockResolvedValueOnce();

      const res = await request(app).delete('/api/forum/admin/categories/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.deleteCategory.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).delete('/api/forum/admin/categories/1');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/forum/admin/topics/:id/pin', () => {
    it('should pin topic (admin)', async () => {
      mockForumService.updateTopic.mockResolvedValueOnce({ id: 1, is_pinned: true });

      const res = await request(app)
        .post('/api/forum/admin/topics/1/pin')
        .send({ pinned: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.updateTopic.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).post('/api/forum/admin/topics/1/pin');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/forum/admin/topics/:id/lock', () => {
    it('should lock topic (admin)', async () => {
      mockForumService.updateTopic.mockResolvedValueOnce({ id: 1, is_locked: true });

      const res = await request(app)
        .post('/api/forum/admin/topics/1/lock')
        .send({ locked: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on error', async () => {
      mockForumService.updateTopic.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).post('/api/forum/admin/topics/1/lock');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // HELPER FUNCTION TESTS
  // =====================

  describe('isAdmin helper', () => {
    it('should identify admin by role', async () => {
      // Already tested via admin routes - they pass for admin users
      mockForumService.createCategory.mockResolvedValueOnce({ id: 1 });

      const res = await request(app)
        .post('/api/forum/admin/categories')
        .send({ name: 'Test' });

      expect(res.status).toBe(201);
    });
  });
});
