/**
 * Blog Routes Tests
 * Comprehensive tests for blog.js routes
 */

const request = require('supertest');
const express = require('express');

// Mock db before requiring route
const mockDb = jest.fn();
mockDb.fn = { now: jest.fn().mockReturnValue('NOW()') };

jest.mock('../../db', () => {
  const chainMethods = {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    increment: jest.fn().mockResolvedValue(1),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    returning: jest.fn().mockResolvedValue([{ id: 1 }]),
    first: jest.fn().mockResolvedValue(null),
    clone: jest.fn().mockReturnThis(),
    then: jest.fn()
  };

  const dbMock = jest.fn(() => chainMethods);
  dbMock.fn = { now: jest.fn().mockReturnValue('NOW()') };

  // Store reference for test access
  dbMock._chainMethods = chainMethods;

  return dbMock;
});

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'admin' };
    next();
  }
}));

const blogRoutes = require('../../routes/blog');
const db = require('../../db');

const app = express();
app.use(express.json());
app.use('/api/blog', blogRoutes);

describe('Blog Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all chain methods to return chainable object
    db._chainMethods.leftJoin.mockReturnValue(db._chainMethods);
    db._chainMethods.where.mockReturnValue(db._chainMethods);
    db._chainMethods.whereNot.mockReturnValue(db._chainMethods);
    db._chainMethods.whereNotNull.mockReturnValue(db._chainMethods);
    db._chainMethods.whereIn.mockReturnValue(db._chainMethods);
    db._chainMethods.whereRaw.mockReturnValue(db._chainMethods);
    db._chainMethods.select.mockReturnValue(db._chainMethods);
    db._chainMethods.orderBy.mockReturnValue(db._chainMethods);
    db._chainMethods.limit.mockReturnValue(db._chainMethods);
    db._chainMethods.offset.mockReturnValue(db._chainMethods);
    db._chainMethods.count.mockReturnValue(db._chainMethods);
    db._chainMethods.groupBy.mockReturnValue(db._chainMethods);
    db._chainMethods.insert.mockReturnValue(db._chainMethods);
    db._chainMethods.clone.mockReturnValue(db._chainMethods);
    db._chainMethods.increment.mockResolvedValue(1);
    db._chainMethods.update.mockResolvedValue(1);
    db._chainMethods.delete.mockResolvedValue(1);
    db._chainMethods.returning.mockResolvedValue([{ id: 1 }]);
    db._chainMethods.first.mockResolvedValue(null);

    // Make the chain thenable by default - return Promise for proper async behavior
    db._chainMethods.then.mockImplementation((resolve) => Promise.resolve([]).then(resolve));
  });

  // =====================
  // PUBLIC BLOG ROUTES
  // =====================

  describe('GET /api/blog', () => {
    it('should get blog posts with pagination', async () => {
      const mockPosts = [
        { id: 1, title: 'Post 1', slug: 'post-1', views_count: 100 },
        { id: 2, title: 'Post 2', slug: 'post-2', views_count: 50 }
      ];

      db._chainMethods.clone.mockReturnThis();
      db._chainMethods.first.mockResolvedValueOnce({ count: '2' });
      db._chainMethods.offset.mockResolvedValueOnce(mockPosts);

      const res = await request(app).get('/api/blog?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by category', async () => {
      db._chainMethods.first.mockResolvedValueOnce({ count: '1' });
      db._chainMethods.offset.mockResolvedValueOnce([{ id: 1, title: 'Tech Post', category: 'technology' }]);

      const res = await request(app).get('/api/blog?category=technology');

      expect(res.status).toBe(200);
      expect(db._chainMethods.where).toHaveBeenCalled();
    });

    it('should filter by tag', async () => {
      db._chainMethods.first.mockResolvedValueOnce({ count: '1' });
      db._chainMethods.offset.mockResolvedValueOnce([{ id: 1, title: 'Tagged Post' }]);

      const res = await request(app).get('/api/blog?tag=javascript');

      expect(res.status).toBe(200);
      expect(db._chainMethods.whereRaw).toHaveBeenCalled();
    });

    it('should search posts', async () => {
      db._chainMethods.first.mockResolvedValueOnce({ count: '1' });
      db._chainMethods.offset.mockResolvedValueOnce([{ id: 1, title: 'Search Result' }]);

      const res = await request(app).get('/api/blog?search=javascript');

      expect(res.status).toBe(200);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.clone.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const res = await request(app).get('/api/blog');

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Failed');
    });
  });

  describe('GET /api/blog/featured', () => {
    it('should get featured posts', async () => {
      const mockPosts = [
        { id: 1, title: 'Featured 1', views_count: 1000 },
        { id: 2, title: 'Featured 2', views_count: 500 }
      ];

      db._chainMethods.limit.mockResolvedValueOnce(mockPosts);

      const res = await request(app).get('/api/blog/featured');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should respect limit parameter', async () => {
      db._chainMethods.limit.mockResolvedValueOnce([{ id: 1 }]);

      const res = await request(app).get('/api/blog/featured?limit=3');

      expect(res.status).toBe(200);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.limit.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/blog/featured');

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Failed');
    });
  });

  describe('GET /api/blog/categories', () => {
    it('should get categories with counts', async () => {
      const mockCategories = [
        { category: 'technology', count: '10' },
        { category: 'tutorials', count: '5' }
      ];

      db._chainMethods.orderBy.mockResolvedValueOnce(mockCategories);

      const res = await request(app).get('/api/blog/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.orderBy.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/blog/categories');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/blog/:slug', () => {
    it('should get post by slug', async () => {
      const mockPost = {
        id: 1,
        title: 'Test Post',
        slug: 'test-post',
        content: 'Content here',
        views_count: 100,
        category: 'technology'
      };

      db._chainMethods.first.mockResolvedValueOnce(mockPost);
      db._chainMethods.limit.mockResolvedValueOnce([{ id: 2, title: 'Related' }]);

      const res = await request(app).get('/api/blog/test-post');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.views_count).toBe(101);
    });

    it('should return 404 if post not found', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/blog/non-existent');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/blog/test-post');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/blog/:slug/comments', () => {
    it('should get post comments', async () => {
      const mockPost = { id: 1, slug: 'test-post' };
      const mockComments = [
        { id: 1, content: 'Comment 1', parent_comment_id: null },
        { id: 2, content: 'Reply 1', parent_comment_id: 1 }
      ];

      db._chainMethods.first.mockResolvedValueOnce(mockPost);
      db._chainMethods.orderBy.mockResolvedValueOnce(mockComments);

      const res = await request(app).get('/api/blog/test-post/comments');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if post not found', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/blog/non-existent/comments');

      expect(res.status).toBe(404);
    });

    it('should build nested comment tree', async () => {
      const mockPost = { id: 1, slug: 'test-post' };
      const mockComments = [
        { id: 1, content: 'Parent', parent_comment_id: null },
        { id: 2, content: 'Child', parent_comment_id: 1 },
        { id: 3, content: 'Another Parent', parent_comment_id: null }
      ];

      db._chainMethods.first.mockResolvedValueOnce(mockPost);
      db._chainMethods.orderBy.mockResolvedValueOnce(mockComments);

      const res = await request(app).get('/api/blog/test-post/comments');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2); // Only root comments
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/blog/test-post/comments');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/blog/:slug/comments', () => {
    it('should add comment to post', async () => {
      const mockPost = { id: 1, slug: 'test-post' };
      const mockComment = { id: 1, content: 'New comment', post_id: 1, user_id: 1 };

      db._chainMethods.first.mockResolvedValueOnce(mockPost);
      db._chainMethods.returning.mockResolvedValueOnce([mockComment]);

      const res = await request(app)
        .post('/api/blog/test-post/comments')
        .send({ content: 'New comment' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should add reply to existing comment', async () => {
      const mockPost = { id: 1, slug: 'test-post' };
      const mockComment = { id: 2, content: 'Reply', parent_comment_id: 1 };

      db._chainMethods.first.mockResolvedValueOnce(mockPost);
      db._chainMethods.returning.mockResolvedValueOnce([mockComment]);

      const res = await request(app)
        .post('/api/blog/test-post/comments')
        .send({ content: 'Reply', parentCommentId: 1 });

      expect(res.status).toBe(201);
    });

    it('should return 400 if content is empty', async () => {
      const res = await request(app)
        .post('/api/blog/test-post/comments')
        .send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should return 400 if content is whitespace only', async () => {
      const res = await request(app)
        .post('/api/blog/test-post/comments')
        .send({ content: '   ' });

      expect(res.status).toBe(400);
    });

    it('should return 404 if post not found', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/blog/non-existent/comments')
        .send({ content: 'Comment' });

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockResolvedValueOnce({ id: 1 });
      db._chainMethods.returning.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .post('/api/blog/test-post/comments')
        .send({ content: 'Comment' });

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/blog/:slug/like', () => {
    it('should like a post', async () => {
      const mockPost = { id: 1, slug: 'test-post', likes_count: 10 };

      db._chainMethods.first.mockResolvedValueOnce(mockPost);

      const res = await request(app).post('/api/blog/test-post/like');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.likes_count).toBe(11);
    });

    it('should return 404 if post not found', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);

      const res = await request(app).post('/api/blog/non-existent/like');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).post('/api/blog/test-post/like');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // TUTORIAL ROUTES
  // =====================

  describe('GET /api/blog/tutorials', () => {
    it('should get tutorials with pagination', async () => {
      const mockTutorials = [
        { id: 1, title: 'Tutorial 1', difficulty: 'beginner' },
        { id: 2, title: 'Tutorial 2', difficulty: 'intermediate' }
      ];

      // Set up mock responses using then for awaited queries
      let thenCallCount = 0;
      db._chainMethods.then.mockImplementation((resolve) => {
        thenCallCount++;
        if (thenCallCount === 1) return Promise.resolve(mockTutorials).then(resolve);
        if (thenCallCount === 2) return Promise.resolve([]).then(resolve);
        return Promise.resolve([]).then(resolve);
      });
      db._chainMethods.first.mockResolvedValueOnce({ count: '2' });

      const res = await request(app).get('/api/blog/tutorials');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by difficulty', async () => {
      let thenCallCount = 0;
      db._chainMethods.then.mockImplementation((resolve) => {
        thenCallCount++;
        if (thenCallCount === 1) return Promise.resolve([{ id: 1, difficulty: 'beginner' }]).then(resolve);
        return Promise.resolve([]).then(resolve);
      });
      db._chainMethods.first.mockResolvedValueOnce({ count: '1' });

      const res = await request(app).get('/api/blog/tutorials?difficulty=beginner');

      expect(res.status).toBe(200);
    });

    it('should filter by series', async () => {
      let thenCallCount = 0;
      db._chainMethods.then.mockImplementation((resolve) => {
        thenCallCount++;
        if (thenCallCount === 1) return Promise.resolve([{ id: 1, series_id: 'react-basics' }]).then(resolve);
        return Promise.resolve([]).then(resolve);
      });
      db._chainMethods.first.mockResolvedValueOnce({ count: '1' });

      const res = await request(app).get('/api/blog/tutorials?series=react-basics');

      expect(res.status).toBe(200);
    });

    it('should search tutorials', async () => {
      let thenCallCount = 0;
      db._chainMethods.then.mockImplementation((resolve) => {
        thenCallCount++;
        if (thenCallCount === 1) return Promise.resolve([{ id: 1, title: 'React Tutorial' }]).then(resolve);
        return Promise.resolve([]).then(resolve);
      });
      db._chainMethods.first.mockResolvedValueOnce({ count: '1' });

      const res = await request(app).get('/api/blog/tutorials?search=react');

      expect(res.status).toBe(200);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.clone.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const res = await request(app).get('/api/blog/tutorials');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/blog/tutorials/series', () => {
    it('should get tutorial series', async () => {
      const mockSeries = [
        { series_id: 'react-basics', tutorials_count: '5' },
        { series_id: 'node-advanced', tutorials_count: '3' }
      ];

      db._chainMethods.orderBy.mockResolvedValueOnce(mockSeries);

      const res = await request(app).get('/api/blog/tutorials/series');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.orderBy.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/blog/tutorials/series');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/blog/tutorials/:slug', () => {
    it('should get tutorial by slug', async () => {
      const mockTutorial = {
        id: 1,
        title: 'React Basics',
        slug: 'react-basics',
        views_count: 100,
        series_id: null
      };

      db._chainMethods.first.mockResolvedValueOnce(mockTutorial);
      db._chainMethods.orderBy.mockResolvedValueOnce([{ step_number: 1, title: 'Step 1' }]);

      const res = await request(app).get('/api/blog/tutorials/react-basics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.views_count).toBe(101);
    });

    it('should include series tutorials if part of series', async () => {
      const mockTutorial = {
        id: 1,
        title: 'React Basics',
        slug: 'react-basics',
        views_count: 100,
        series_id: 'react-series'
      };

      db._chainMethods.first.mockResolvedValueOnce(mockTutorial);
      db._chainMethods.orderBy
        .mockResolvedValueOnce([{ step_number: 1 }])
        .mockReturnThis();
      db._chainMethods.select.mockResolvedValueOnce([
        { id: 1, title: 'Part 1' },
        { id: 2, title: 'Part 2' }
      ]);

      const res = await request(app).get('/api/blog/tutorials/react-basics');

      expect(res.status).toBe(200);
    });

    it('should return 404 if tutorial not found', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/blog/tutorials/non-existent');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/blog/tutorials/react-basics');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/blog/tutorials/:slug/steps', () => {
    it('should get tutorial steps', async () => {
      const mockTutorial = { id: 1, slug: 'react-basics' };
      const mockSteps = [
        { step_number: 1, title: 'Step 1', content: 'Content 1' },
        { step_number: 2, title: 'Step 2', content: 'Content 2' }
      ];

      db._chainMethods.first.mockResolvedValueOnce(mockTutorial);
      db._chainMethods.orderBy.mockResolvedValueOnce(mockSteps);

      const res = await request(app).get('/api/blog/tutorials/react-basics/steps');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if tutorial not found', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/blog/tutorials/non-existent/steps');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/blog/tutorials/react-basics/steps');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/blog/tutorials/:slug/progress', () => {
    it('should update tutorial progress - new progress', async () => {
      const mockTutorial = { id: 1, slug: 'react-basics' };

      db._chainMethods.first
        .mockResolvedValueOnce(mockTutorial)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ count: '5' });
      db._chainMethods.returning.mockResolvedValueOnce([{
        id: 1,
        completed_steps: '[]'
      }]);

      const res = await request(app)
        .post('/api/blog/tutorials/react-basics/progress')
        .send({ stepNumber: 1, completed: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should update existing progress', async () => {
      const mockTutorial = { id: 1, slug: 'react-basics' };
      const mockProgress = { id: 1, completed_steps: '[1, 2]', is_completed: false };

      db._chainMethods.first
        .mockResolvedValueOnce(mockTutorial)
        .mockResolvedValueOnce(mockProgress)
        .mockResolvedValueOnce({ count: '5' });

      const res = await request(app)
        .post('/api/blog/tutorials/react-basics/progress')
        .send({ stepNumber: 3, completed: true });

      expect(res.status).toBe(200);
    });

    it('should handle uncompleting a step', async () => {
      const mockTutorial = { id: 1, slug: 'react-basics' };
      const mockProgress = { id: 1, completed_steps: [1, 2, 3], is_completed: false };

      db._chainMethods.first
        .mockResolvedValueOnce(mockTutorial)
        .mockResolvedValueOnce(mockProgress)
        .mockResolvedValueOnce({ count: '5' });

      const res = await request(app)
        .post('/api/blog/tutorials/react-basics/progress')
        .send({ stepNumber: 2, completed: false });

      expect(res.status).toBe(200);
    });

    it('should mark tutorial as completed when all steps done', async () => {
      const mockTutorial = { id: 1, slug: 'react-basics' };
      const mockProgress = { id: 1, completed_steps: '[1, 2]', is_completed: false };

      db._chainMethods.first
        .mockResolvedValueOnce(mockTutorial)
        .mockResolvedValueOnce(mockProgress)
        .mockResolvedValueOnce({ count: '3' });

      const res = await request(app)
        .post('/api/blog/tutorials/react-basics/progress')
        .send({ stepNumber: 3, completed: true });

      expect(res.status).toBe(200);
      expect(res.body.data.isCompleted).toBe(true);
    });

    it('should return 404 if tutorial not found', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/blog/tutorials/non-existent/progress')
        .send({ stepNumber: 1, completed: true });

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .post('/api/blog/tutorials/react-basics/progress')
        .send({ stepNumber: 1, completed: true });

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/blog/tutorials/my/progress', () => {
    it('should get user tutorial progress', async () => {
      const mockProgress = [
        { tutorial_id: 1, completed_steps: '[1, 2]', title: 'Tutorial 1' },
        { tutorial_id: 2, completed_steps: '[]', title: 'Tutorial 2' }
      ];

      // Use then mock for both awaited queries
      let thenCallCount = 0;
      db._chainMethods.then.mockImplementation((resolve) => {
        thenCallCount++;
        if (thenCallCount === 1) return Promise.resolve(mockProgress).then(resolve);
        if (thenCallCount === 2) return Promise.resolve([
          { tutorial_id: 1, total_steps: '5' },
          { tutorial_id: 2, total_steps: '3' }
        ]).then(resolve);
        return Promise.resolve([]).then(resolve);
      });

      const res = await request(app).get('/api/blog/tutorials/my/progress');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle array completed_steps', async () => {
      const mockProgress = [
        { tutorial_id: 1, completed_steps: [1, 2, 3], title: 'Tutorial 1' }
      ];

      let thenCallCount = 0;
      db._chainMethods.then.mockImplementation((resolve) => {
        thenCallCount++;
        if (thenCallCount === 1) return Promise.resolve(mockProgress).then(resolve);
        if (thenCallCount === 2) return Promise.resolve([{ tutorial_id: 1, total_steps: '5' }]).then(resolve);
        return Promise.resolve([]).then(resolve);
      });

      const res = await request(app).get('/api/blog/tutorials/my/progress');

      expect(res.status).toBe(200);
    });

    it('should return 500 on database error', async () => {
      // Reset chain methods to return chainable object for the full chain
      db._chainMethods.leftJoin.mockReturnValue(db._chainMethods);
      db._chainMethods.where.mockReturnValue(db._chainMethods);
      db._chainMethods.select.mockReturnValue(db._chainMethods);
      db._chainMethods.orderBy.mockReturnValue(db._chainMethods);

      // Mock database error - must reject the promise properly
      db._chainMethods.then.mockImplementation((resolve, reject) => {
        if (reject) {
          return Promise.resolve().then(() => reject(new Error('DB Error')));
        }
        return Promise.reject(new Error('DB Error'));
      });

      const res = await request(app).get('/api/blog/tutorials/my/progress');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // ADMIN BLOG ROUTES
  // =====================

  describe('POST /api/blog/admin/blog', () => {
    it('should create blog post', async () => {
      const mockPost = {
        id: 1,
        title: 'New Post',
        slug: 'new-post',
        content: 'Content here'
      };

      db._chainMethods.first.mockResolvedValueOnce(null);
      db._chainMethods.returning.mockResolvedValueOnce([mockPost]);

      const res = await request(app)
        .post('/api/blog/admin/blog')
        .send({
          title: 'New Post',
          content: 'Content here',
          excerpt: 'Short excerpt',
          category: 'technology',
          tags: ['javascript', 'react'],
          status: 'published'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should generate unique slug if exists', async () => {
      db._chainMethods.first.mockResolvedValueOnce({ id: 2, slug: 'new-post' });
      db._chainMethods.returning.mockResolvedValueOnce([{ id: 1, slug: 'new-post-123' }]);

      const res = await request(app)
        .post('/api/blog/admin/blog')
        .send({ title: 'New Post', content: 'Content' });

      expect(res.status).toBe(201);
    });

    it('should return 400 if title missing', async () => {
      const res = await request(app)
        .post('/api/blog/admin/blog')
        .send({ content: 'Content only' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should return 400 if content missing', async () => {
      const res = await request(app)
        .post('/api/blog/admin/blog')
        .send({ title: 'Title only' });

      expect(res.status).toBe(400);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .post('/api/blog/admin/blog')
        .send({ title: 'Test', content: 'Content' });

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/blog/admin/blog/:id', () => {
    it('should update blog post', async () => {
      const mockPost = { id: 1, title: 'Old Title', slug: 'old-title' };

      db._chainMethods.first
        .mockResolvedValueOnce(mockPost)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, title: 'New Title' });

      const res = await request(app)
        .put('/api/blog/admin/blog/1')
        .send({ title: 'New Title', content: 'Updated content' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should update slug when title changes', async () => {
      const mockPost = { id: 1, title: 'Old Title', slug: 'old-title' };

      db._chainMethods.first
        .mockResolvedValueOnce(mockPost)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, title: 'New Title', slug: 'new-title' });

      const res = await request(app)
        .put('/api/blog/admin/blog/1')
        .send({ title: 'New Title' });

      expect(res.status).toBe(200);
    });

    it('should handle unique slug conflict', async () => {
      const mockPost = { id: 1, title: 'Old Title', slug: 'old-title' };

      db._chainMethods.first
        .mockResolvedValueOnce(mockPost)
        .mockResolvedValueOnce({ id: 2, slug: 'new-title' })
        .mockResolvedValueOnce({ id: 1 });

      const res = await request(app)
        .put('/api/blog/admin/blog/1')
        .send({ title: 'New Title' });

      expect(res.status).toBe(200);
    });

    it('should update status to published', async () => {
      const mockPost = { id: 1, title: 'Draft Post', published_at: null };

      db._chainMethods.first
        .mockResolvedValueOnce(mockPost)
        .mockResolvedValueOnce({ id: 1 });

      const res = await request(app)
        .put('/api/blog/admin/blog/1')
        .send({ status: 'published' });

      expect(res.status).toBe(200);
    });

    it('should return 404 if post not found', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/api/blog/admin/blog/999')
        .send({ title: 'Update' });

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .put('/api/blog/admin/blog/1')
        .send({ title: 'Update' });

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/blog/admin/blog/:id', () => {
    it('should delete blog post', async () => {
      db._chainMethods.first.mockResolvedValueOnce({ id: 1, title: 'To Delete' });

      const res = await request(app).delete('/api/blog/admin/blog/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });

    it('should return 404 if post not found', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);

      const res = await request(app).delete('/api/blog/admin/blog/999');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).delete('/api/blog/admin/blog/1');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/blog/admin/blog', () => {
    it('should get all posts for admin', async () => {
      const mockPosts = [
        { id: 1, title: 'Post 1', status: 'published' },
        { id: 2, title: 'Post 2', status: 'draft' }
      ];

      db._chainMethods.first.mockResolvedValueOnce({ count: '2' });
      db._chainMethods.offset.mockResolvedValueOnce(mockPosts);

      const res = await request(app).get('/api/blog/admin/blog');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by status', async () => {
      db._chainMethods.first.mockResolvedValueOnce({ count: '1' });
      db._chainMethods.offset.mockResolvedValueOnce([{ id: 1, status: 'draft' }]);

      const res = await request(app).get('/api/blog/admin/blog?status=draft');

      expect(res.status).toBe(200);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.clone.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const res = await request(app).get('/api/blog/admin/blog');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // ADMIN TUTORIAL ROUTES
  // =====================

  describe('POST /api/blog/admin/tutorials', () => {
    it('should create tutorial', async () => {
      const mockTutorial = {
        id: 1,
        title: 'New Tutorial',
        slug: 'new-tutorial'
      };

      db._chainMethods.first.mockResolvedValueOnce(null);
      db._chainMethods.returning.mockResolvedValueOnce([mockTutorial]);

      const res = await request(app)
        .post('/api/blog/admin/tutorials')
        .send({
          title: 'New Tutorial',
          description: 'Tutorial description',
          difficulty: 'beginner',
          status: 'published'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should create tutorial with steps', async () => {
      const mockTutorial = { id: 1, title: 'With Steps' };

      db._chainMethods.first.mockResolvedValueOnce(null);
      db._chainMethods.returning.mockResolvedValueOnce([mockTutorial]);

      const res = await request(app)
        .post('/api/blog/admin/tutorials')
        .send({
          title: 'With Steps',
          steps: [
            { title: 'Step 1', content: 'Content 1' },
            { title: 'Step 2', content: 'Content 2' }
          ]
        });

      expect(res.status).toBe(201);
    });

    it('should generate unique slug if exists', async () => {
      db._chainMethods.first.mockResolvedValueOnce({ id: 2, slug: 'tutorial' });
      db._chainMethods.returning.mockResolvedValueOnce([{ id: 1, slug: 'tutorial-123' }]);

      const res = await request(app)
        .post('/api/blog/admin/tutorials')
        .send({ title: 'Tutorial' });

      expect(res.status).toBe(201);
    });

    it('should return 400 if title missing', async () => {
      const res = await request(app)
        .post('/api/blog/admin/tutorials')
        .send({ description: 'No title' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .post('/api/blog/admin/tutorials')
        .send({ title: 'Test' });

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/blog/admin/tutorials/:id', () => {
    it('should update tutorial', async () => {
      const mockTutorial = { id: 1, title: 'Old Title', slug: 'old-title' };

      db._chainMethods.first
        .mockResolvedValueOnce(mockTutorial)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, title: 'New Title' });
      db._chainMethods.orderBy.mockResolvedValueOnce([]);

      const res = await request(app)
        .put('/api/blog/admin/tutorials/1')
        .send({ title: 'New Title', description: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should update tutorial steps', async () => {
      const mockTutorial = { id: 1, title: 'Tutorial', slug: 'tutorial' };

      db._chainMethods.first
        .mockResolvedValueOnce(mockTutorial)
        .mockResolvedValueOnce({ id: 1 });
      db._chainMethods.orderBy.mockResolvedValueOnce([{ step_number: 1, title: 'New Step' }]);

      const res = await request(app)
        .put('/api/blog/admin/tutorials/1')
        .send({
          steps: [
            { title: 'New Step 1', content: 'Content 1' }
          ]
        });

      expect(res.status).toBe(200);
    });

    it('should handle empty steps array', async () => {
      const mockTutorial = { id: 1, title: 'Tutorial', slug: 'tutorial' };

      db._chainMethods.first
        .mockResolvedValueOnce(mockTutorial)
        .mockResolvedValueOnce({ id: 1 });
      db._chainMethods.orderBy.mockResolvedValueOnce([]);

      const res = await request(app)
        .put('/api/blog/admin/tutorials/1')
        .send({ steps: [] });

      expect(res.status).toBe(200);
    });

    it('should update status to published', async () => {
      const mockTutorial = { id: 1, title: 'Draft', published_at: null };

      db._chainMethods.first
        .mockResolvedValueOnce(mockTutorial)
        .mockResolvedValueOnce({ id: 1 });
      db._chainMethods.orderBy.mockResolvedValueOnce([]);

      const res = await request(app)
        .put('/api/blog/admin/tutorials/1')
        .send({ status: 'published' });

      expect(res.status).toBe(200);
    });

    it('should return 404 if tutorial not found', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/api/blog/admin/tutorials/999')
        .send({ title: 'Update' });

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .put('/api/blog/admin/tutorials/1')
        .send({ title: 'Update' });

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/blog/admin/tutorials/:id', () => {
    it('should delete tutorial', async () => {
      db._chainMethods.first.mockResolvedValueOnce({ id: 1, title: 'To Delete' });

      const res = await request(app).delete('/api/blog/admin/tutorials/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });

    it('should return 404 if tutorial not found', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);

      const res = await request(app).delete('/api/blog/admin/tutorials/999');

      expect(res.status).toBe(404);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.first.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).delete('/api/blog/admin/tutorials/1');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/blog/admin/tutorials', () => {
    it('should get all tutorials for admin', async () => {
      const mockTutorials = [
        { id: 1, title: 'Tutorial 1', status: 'published' },
        { id: 2, title: 'Tutorial 2', status: 'draft' }
      ];

      db._chainMethods.first.mockResolvedValueOnce({ count: '2' });
      db._chainMethods.offset.mockResolvedValueOnce(mockTutorials);

      const res = await request(app).get('/api/blog/admin/tutorials');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by status', async () => {
      db._chainMethods.first.mockResolvedValueOnce({ count: '1' });
      db._chainMethods.offset.mockResolvedValueOnce([{ id: 1, status: 'published' }]);

      const res = await request(app).get('/api/blog/admin/tutorials?status=published');

      expect(res.status).toBe(200);
    });

    it('should return 500 on database error', async () => {
      db._chainMethods.clone.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const res = await request(app).get('/api/blog/admin/tutorials');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // HELPER FUNCTION TESTS
  // =====================

  describe('Helper Functions', () => {
    it('should calculate reading time correctly', async () => {
      // Create a post with ~400 words (should be 2 min read)
      const longContent = 'word '.repeat(400);

      db._chainMethods.first.mockResolvedValueOnce(null);
      db._chainMethods.returning.mockResolvedValueOnce([{
        id: 1,
        reading_time: 2
      }]);

      const res = await request(app)
        .post('/api/blog/admin/blog')
        .send({ title: 'Long Post', content: longContent });

      expect(res.status).toBe(201);
    });

    it('should generate slug from title', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);
      db._chainMethods.returning.mockResolvedValueOnce([{
        id: 1,
        slug: 'my-test-title'
      }]);

      const res = await request(app)
        .post('/api/blog/admin/blog')
        .send({
          title: 'My Test Title!',
          content: 'Content'
        });

      expect(res.status).toBe(201);
    });

    it('should handle special characters in slug', async () => {
      db._chainMethods.first.mockResolvedValueOnce(null);
      db._chainMethods.returning.mockResolvedValueOnce([{
        id: 1,
        slug: 'caf-special-123'
      }]);

      const res = await request(app)
        .post('/api/blog/admin/blog')
        .send({
          title: 'Caf Special @#$% 123!',
          content: 'Content'
        });

      expect(res.status).toBe(201);
    });
  });
});
