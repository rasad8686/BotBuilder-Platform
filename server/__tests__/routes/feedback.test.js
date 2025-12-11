/**
 * Feedback Routes Tests
 * Tests for server/routes/feedback.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  })
}));

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'email_123' } })
    }
  }))
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const feedbackRouter = require('../../routes/feedback');

const app = express();
app.use(express.json());
app.use('/api/feedback', feedbackRouter);

describe('Feedback Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/feedback', () => {
    it('should submit feedback successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ name: 'Test User', email: 'test@example.com' }] }) // Get user
        .mockResolvedValueOnce({ rows: [{ id: 1, category: 'bug', created_at: new Date() }] }); // Insert feedback

      const response = await request(app)
        .post('/api/feedback')
        .send({
          category: 'bug',
          message: 'This is a bug report with at least 10 characters'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Thank you');
    });

    it('should reject missing category', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({ message: 'This is a message' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });

    it('should reject missing message', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({ category: 'bug' });

      expect(response.status).toBe(400);
    });

    it('should reject invalid category', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          category: 'invalid',
          message: 'This is a message with enough characters'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid category');
    });

    it('should reject short message', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          category: 'bug',
          message: 'short'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('10 characters');
    });

    it('should reject long message', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          category: 'bug',
          message: 'a'.repeat(5001)
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('5000 characters');
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/feedback')
        .send({
          category: 'bug',
          message: 'This is a valid message with enough characters'
        });

      expect(response.status).toBe(404);
    });

    it('should accept all valid categories', async () => {
      const categories = ['bug', 'feature', 'question', 'suggestion', 'other'];

      for (const category of categories) {
        db.query
          .mockResolvedValueOnce({ rows: [{ name: 'Test', email: 'test@example.com' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, category, created_at: new Date() }] });

        const response = await request(app)
          .post('/api/feedback')
          .send({
            category,
            message: 'This is a valid message with enough characters'
          });

        expect(response.status).toBe(201);
      }
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/api/feedback')
        .send({
          category: 'bug',
          message: 'This is a valid message with enough characters'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/feedback', () => {
    it('should return feedback for admin', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] }) // Check admin
        .mockResolvedValueOnce({ rows: [{ id: 1, category: 'bug', message: 'Test' }] }) // Get feedback
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Count

      const response = await request(app).get('/api/feedback');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter by own feedback for non-admin', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'member' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const response = await request(app).get('/api/feedback');

      expect(response.status).toBe(200);
    });

    it('should filter by status', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const response = await request(app).get('/api/feedback?status=new');

      expect(response.status).toBe(200);
    });

    it('should filter by category', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const response = await request(app).get('/api/feedback?category=bug');

      expect(response.status).toBe(200);
    });

    it('should handle pagination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '100' }] });

      const response = await request(app).get('/api/feedback?page=2&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/feedback');

      expect(response.status).toBe(500);
    });
  });
});
