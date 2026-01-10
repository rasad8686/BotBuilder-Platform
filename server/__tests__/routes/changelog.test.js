/**
 * Changelog Routes Tests
 * Tests for server/routes/changelog.js
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

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user']) : null;
    next();
  }
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const changelogRoutes = require('../../routes/changelog');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/changelog', changelogRoutes);

describe('Changelog Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // PUBLIC ENDPOINTS
  // =============================================================================

  describe('GET /api/changelog', () => {
    it('should return paginated changelog entries', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] }) // Count
        .mockResolvedValueOnce({ // Entries
          rows: [
            { id: 1, version: '2.1.0', title: 'New Feature', type: 'feature', is_breaking: false, published_at: new Date() },
            { id: 2, version: '2.0.0', title: 'Major Update', type: 'breaking', is_breaking: true, published_at: new Date() }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: 'Added API endpoint' }] }) // Items for entry 1
        .mockResolvedValueOnce({ rows: [{ id: 2, content: 'Changed auth flow' }] }); // Items for entry 2

      const response = await request(app)
        .get('/api/changelog')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entries).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should filter by type', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, version: '2.1.0', title: 'Bug Fix', type: 'bugfix' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/changelog?type=bugfix')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('type = $1'),
        expect.arrayContaining(['bugfix'])
      );
    });

    it('should filter by search query', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, version: '2.1.0', title: 'API Changes' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/changelog?search=API')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/changelog/latest', () => {
    it('should return the latest published entry', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            version: '2.1.0',
            title: 'Latest Release',
            type: 'feature',
            published_at: new Date()
          }]
        })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: 'New feature added' }] });

      const response = await request(app)
        .get('/api/changelog/latest')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.version).toBe('2.1.0');
      expect(response.body.data.items).toHaveLength(1);
    });

    it('should return null if no entries', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/changelog/latest')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });
  });

  describe('GET /api/changelog/rss', () => {
    it('should return RSS feed', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          version: '2.1.0',
          title: 'New Feature',
          description: 'A new feature',
          type: 'feature',
          published_at: new Date()
        }]
      });

      const response = await request(app)
        .get('/api/changelog/rss')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/rss+xml');
      expect(response.text).toContain('<?xml version="1.0"');
      expect(response.text).toContain('<title>BotBuilder Changelog</title>');
      expect(response.text).toContain('New Feature');
    });
  });

  describe('GET /api/changelog/:version', () => {
    it('should return specific version', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            version: '2.0.0',
            title: 'Version 2',
            type: 'breaking',
            is_breaking: true
          }]
        })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: 'Breaking change' }] });

      const response = await request(app)
        .get('/api/changelog/2.0.0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.version).toBe('2.0.0');
    });

    it('should return 404 for unknown version', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/changelog/99.99.99')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  // =============================================================================
  // ADMIN ENDPOINTS
  // =============================================================================

  describe('GET /api/changelog/admin/list', () => {
    it('should require admin role', async () => {
      const response = await request(app)
        .get('/api/changelog/admin/list')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'user' }))
        .expect(403);

      expect(response.body.message).toContain('Admin access required');
    });

    it('should return all entries for admin', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, version: '2.1.0', title: 'Published', is_published: true },
            { id: 2, version: '2.2.0', title: 'Draft', is_published: false }
          ]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/changelog/admin/list')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entries).toHaveLength(2);
    });
  });

  describe('POST /api/changelog/admin', () => {
    it('should require admin role', async () => {
      const response = await request(app)
        .post('/api/changelog/admin')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'user' }))
        .send({ version: '2.1.0', title: 'Test' })
        .expect(403);

      expect(response.body.message).toContain('Admin access required');
    });

    it('should create new changelog entry', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check duplicate
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            version: '2.1.0',
            title: 'New Release',
            description: 'Description',
            type: 'feature',
            is_published: false
          }]
        });

      const response = await request(app)
        .post('/api/changelog/admin')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .send({
          version: '2.1.0',
          title: 'New Release',
          description: 'Description',
          type: 'feature'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.version).toBe('2.1.0');
    });

    it('should reject duplicate version', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Existing entry

      const response = await request(app)
        .post('/api/changelog/admin')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .send({ version: '2.0.0', title: 'Duplicate' })
        .expect(400);

      expect(response.body.message).toContain('already exists');
    });

    it('should require version and title', async () => {
      const response = await request(app)
        .post('/api/changelog/admin')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .send({ version: '2.0.0' })
        .expect(400);

      expect(response.body.message).toContain('required');
    });

    it('should create entry with items', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, version: '2.1.0', title: 'With Items' }]
        })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: 'Item 1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, content: 'Item 2' }] });

      const response = await request(app)
        .post('/api/changelog/admin')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .send({
          version: '2.1.0',
          title: 'With Items',
          items: [
            { content: 'Item 1' },
            { content: 'Item 2', apiEndpoint: '/api/test' }
          ]
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/changelog/admin/:id', () => {
    it('should update changelog entry', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, is_published: false }] }) // Existing check
        .mockResolvedValueOnce({ rows: [] }) // Duplicate check
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            version: '2.1.1',
            title: 'Updated Title',
            is_published: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Get items

      const response = await request(app)
        .put('/api/changelog/admin/1')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .send({
          version: '2.1.1',
          title: 'Updated Title'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
    });

    it('should return 404 for non-existent entry', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/changelog/admin/999')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .send({ title: 'Updated' })
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('DELETE /api/changelog/admin/:id', () => {
    it('should delete changelog entry', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, version: '2.0.0' }]
      });

      const response = await request(app)
        .delete('/api/changelog/admin/1')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 for non-existent entry', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .delete('/api/changelog/admin/999')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/changelog/admin/:id/publish', () => {
    it('should publish entry', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            version: '2.1.0',
            title: 'Published',
            is_published: true,
            published_at: new Date()
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Get items

      const response = await request(app)
        .post('/api/changelog/admin/1/publish')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.is_published).toBe(true);
    });

    it('should return 404 for non-existent entry', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/changelog/admin/999/publish')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/changelog/admin/:id/unpublish', () => {
    it('should unpublish entry', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          version: '2.1.0',
          is_published: false
        }]
      });

      const response = await request(app)
        .post('/api/changelog/admin/1/unpublish')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.is_published).toBe(false);
    });
  });

  // =============================================================================
  // ERROR HANDLING
  // =============================================================================

  describe('Error Handling', () => {
    it('should handle database errors in GET /api/changelog', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .get('/api/changelog')
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should handle database errors in admin endpoints', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .get('/api/changelog/admin/list')
        .set('x-test-user', JSON.stringify({ id: 1, role: 'admin' }))
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});
