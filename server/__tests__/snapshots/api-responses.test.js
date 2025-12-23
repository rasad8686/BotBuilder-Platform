/**
 * API Response Snapshot Tests
 * Tests response structure consistency for Bot CRUD operations
 * Uses Jest snapshots to detect unintended API response changes
 */

const request = require('supertest');
const express = require('express');

// ========================================
// MOCKS - Must be defined BEFORE imports
// ========================================

// Mock the database
jest.mock('../../db', () => ({
  query: jest.fn(),
  pool: { query: jest.fn() }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  http: jest.fn()
}));

// Mock webhook service
jest.mock('../../services/webhookService', () => ({
  trigger: jest.fn().mockResolvedValue(true)
}));

// Mock audit middleware
jest.mock('../../middleware/audit', () => ({
  logBotCreated: jest.fn().mockResolvedValue(true),
  logBotUpdated: jest.fn().mockResolvedValue(true),
  logBotDeleted: jest.fn().mockResolvedValue(true)
}));

const db = require('../../db');

// ========================================
// TEST APP SETUP
// ========================================

function createTestApp() {
  const app = express();
  app.use(express.json());

  // Mock authentication middleware
  app.use((req, res, next) => {
    req.user = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      current_organization_id: 1,
      organization_id: 1
    };
    req.organization = {
      id: 1,
      org_id: 1,
      name: 'Test Organization',
      slug: 'test-org',
      role: 'admin',
      owner_id: 1,
      is_owner: true
    };
    next();
  });

  // Bot routes for snapshot testing
  app.get('/api/bots', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM bots WHERE organization_id = $1', [req.organization.id]);
      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total: result.rows.length,
          page: 1,
          limit: 10,
          totalPages: 1
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  app.get('/api/bots/:id', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Bot not found' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  app.post('/api/bots', async (req, res) => {
    try {
      const { name, description, welcome_message } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'Name is required' });
      }
      const result = await db.query(
        'INSERT INTO bots (name, description, welcome_message, organization_id, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, description, welcome_message, req.organization.id, req.user.id]
      );
      res.status(201).json({ success: true, data: result.rows[0], message: 'Bot created successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  app.put('/api/bots/:id', async (req, res) => {
    try {
      const { name, description, welcome_message, is_active } = req.body;
      const result = await db.query(
        'UPDATE bots SET name = COALESCE($1, name), description = COALESCE($2, description), welcome_message = COALESCE($3, welcome_message), is_active = COALESCE($4, is_active), updated_at = NOW() WHERE id = $5 AND organization_id = $6 RETURNING *',
        [name, description, welcome_message, is_active, req.params.id, req.organization.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Bot not found' });
      }
      res.json({ success: true, data: result.rows[0], message: 'Bot updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  app.delete('/api/bots/:id', async (req, res) => {
    try {
      const result = await db.query('DELETE FROM bots WHERE id = $1 AND organization_id = $2 RETURNING id', [req.params.id, req.organization.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Bot not found' });
      }
      res.json({ success: true, message: 'Bot deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  return app;
}

// ========================================
// SNAPSHOT TESTS
// ========================================

describe('API Response Snapshots - Bots', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------
  // Bot List Response
  // ----------------------------------------
  describe('GET /api/bots - List Bots', () => {
    it('should match snapshot for empty bot list', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/bots');

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for bot list with items', async () => {
      const mockBots = [
        {
          id: 1,
          name: 'Customer Support Bot',
          description: 'Handles customer inquiries',
          welcome_message: 'Hello! How can I help you today?',
          is_active: true,
          organization_id: 1,
          user_id: 1,
          created_at: '2024-01-15T10:00:00.000Z',
          updated_at: '2024-01-15T10:00:00.000Z'
        },
        {
          id: 2,
          name: 'Sales Bot',
          description: 'Assists with product information',
          welcome_message: 'Welcome! Looking for something specific?',
          is_active: false,
          organization_id: 1,
          user_id: 1,
          created_at: '2024-01-16T10:00:00.000Z',
          updated_at: '2024-01-16T10:00:00.000Z'
        }
      ];
      db.query.mockResolvedValueOnce({ rows: mockBots });

      const response = await request(app).get('/api/bots');

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // Bot Get Response
  // ----------------------------------------
  describe('GET /api/bots/:id - Get Single Bot', () => {
    it('should match snapshot for successful bot retrieval', async () => {
      const mockBot = {
        id: 1,
        name: 'Customer Support Bot',
        description: 'Handles customer inquiries',
        welcome_message: 'Hello! How can I help you today?',
        is_active: true,
        organization_id: 1,
        user_id: 1,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        settings: {
          language: 'en',
          tone: 'professional',
          max_response_length: 500
        }
      };
      db.query.mockResolvedValueOnce({ rows: [mockBot] });

      const response = await request(app).get('/api/bots/1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/bots/999');

      expect(response.status).toBe(404);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // Bot Create Response
  // ----------------------------------------
  describe('POST /api/bots - Create Bot', () => {
    it('should match snapshot for successful bot creation', async () => {
      const newBot = {
        id: 3,
        name: 'New Test Bot',
        description: 'A test bot for snapshot testing',
        welcome_message: 'Hello from the test bot!',
        is_active: true,
        organization_id: 1,
        user_id: 1,
        created_at: '2024-01-17T10:00:00.000Z',
        updated_at: '2024-01-17T10:00:00.000Z'
      };
      db.query.mockResolvedValueOnce({ rows: [newBot] });

      const response = await request(app)
        .post('/api/bots')
        .send({
          name: 'New Test Bot',
          description: 'A test bot for snapshot testing',
          welcome_message: 'Hello from the test bot!'
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for missing name validation error', async () => {
      const response = await request(app)
        .post('/api/bots')
        .send({
          description: 'A bot without a name'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // Bot Update Response
  // ----------------------------------------
  describe('PUT /api/bots/:id - Update Bot', () => {
    it('should match snapshot for successful bot update', async () => {
      const updatedBot = {
        id: 1,
        name: 'Updated Bot Name',
        description: 'Updated description',
        welcome_message: 'Updated welcome message!',
        is_active: false,
        organization_id: 1,
        user_id: 1,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-18T10:00:00.000Z'
      };
      db.query.mockResolvedValueOnce({ rows: [updatedBot] });

      const response = await request(app)
        .put('/api/bots/1')
        .send({
          name: 'Updated Bot Name',
          description: 'Updated description',
          welcome_message: 'Updated welcome message!',
          is_active: false
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for update on non-existent bot', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/bots/999')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(404);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // Bot Delete Response
  // ----------------------------------------
  describe('DELETE /api/bots/:id - Delete Bot', () => {
    it('should match snapshot for successful bot deletion', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app).delete('/api/bots/1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();
    });

    it('should match snapshot for delete on non-existent bot', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/bots/999');

      expect(response.status).toBe(404);
      expect(response.body).toMatchSnapshot();
    });
  });

  // ----------------------------------------
  // Server Error Response
  // ----------------------------------------
  describe('Server Error Responses', () => {
    it('should match snapshot for server error on list', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app).get('/api/bots');

      expect(response.status).toBe(500);
      expect(response.body).toMatchSnapshot();
    });
  });
});
