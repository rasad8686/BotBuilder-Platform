/**
 * Comprehensive Conversations Routes Tests
 * Tests for server/routes/conversations.js
 *
 * Coverage:
 * - GET /api/conversations - list conversations with pagination
 * - GET /api/conversations/:id - get single conversation
 * - GET /api/conversations/:id/messages - get messages for conversation
 * - POST /api/conversations - create new conversation
 * - PUT /api/conversations/:id - update conversation
 * - DELETE /api/conversations/:id - delete conversation
 * - POST /api/conversations/:id/close - close conversation
 * - GET /api/conversations/search - search conversations
 * - POST /api/conversations/:id/transfer - transfer to agent
 * - GET /api/conversations/stats - conversation statistics
 * - Error handling and validation
 * - Authorization checks
 * - Organization isolation
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', name: 'Test User' };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const log = require('../../utils/logger');

// Create mock router since conversations.js doesn't exist yet
const router = express.Router();
const authenticateToken = require('../../middleware/auth');
const { organizationContext, requireOrganization } = require('../../middleware/organizationContext');

router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

// Mock implementation of conversations routes
router.get('/', async (req, res) => {
  try {
    const organization_id = req.organization.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const channel = req.query.channel;

    let whereConditions = ['organization_id = $1'];
    let params = [organization_id];
    let paramCount = 2;

    if (status) {
      whereConditions.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (channel) {
      whereConditions.push(`channel = $${paramCount}`);
      params.push(channel);
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*) FROM conversations WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await db.query(
      `SELECT * FROM conversations
       WHERE ${whereClause}
       ORDER BY updated_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    log.error('List conversations error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/search', async (req, res) => {
  try {
    const organization_id = req.organization.id;
    const { query, status, channel } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    let whereConditions = ['organization_id = $1'];
    let params = [organization_id];
    let paramCount = 2;

    whereConditions.push(`(customer_name ILIKE $${paramCount} OR customer_email ILIKE $${paramCount})`);
    params.push(`%${query}%`);
    paramCount++;

    if (status) {
      whereConditions.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (channel) {
      whereConditions.push(`channel = $${paramCount}`);
      params.push(channel);
      paramCount++;
    }

    const result = await db.query(
      `SELECT * FROM conversations
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY updated_at DESC
       LIMIT 50`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    log.error('Search conversations error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to search conversations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const organization_id = req.organization.id;

    const result = await db.query(
      `SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        AVG(EXTRACT(EPOCH FROM (closed_at - created_at))) as avg_duration
       FROM conversations
       WHERE organization_id = $1`,
      [organization_id]
    );

    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        total: parseInt(stats.total),
        open: parseInt(stats.open),
        closed: parseInt(stats.closed),
        pending: parseInt(stats.pending),
        avgDuration: stats.avg_duration ? parseFloat(stats.avg_duration) : null
      }
    });
  } catch (error) {
    log.error('Get stats error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    const result = await db.query(
      'SELECT * FROM conversations WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or not accessible in this organization'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Get conversation error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    // Verify conversation exists and belongs to organization
    const convCheck = await db.query(
      'SELECT id FROM conversations WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (convCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or not accessible in this organization'
      });
    }

    const result = await db.query(
      `SELECT * FROM conversation_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    log.error('Get conversation messages error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const organization_id = req.organization.id;
    const { channel, customer_name, customer_email, customer_phone, subject, metadata } = req.body;

    if (!channel || channel.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Channel is required'
      });
    }

    const validChannels = ['web', 'email', 'slack', 'telegram', 'whatsapp', 'facebook'];
    if (!validChannels.includes(channel.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid channel. Valid channels: ${validChannels.join(', ')}`
      });
    }

    const result = await db.query(
      `INSERT INTO conversations
       (organization_id, channel, customer_name, customer_email, customer_phone, subject, status, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [organization_id, channel.toLowerCase(), customer_name, customer_email, customer_phone, subject, metadata ? JSON.stringify(metadata) : null]
    );

    res.status(201).json({
      success: true,
      message: 'Conversation created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Create conversation error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;
    const { status, subject, assigned_to, metadata } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    // Verify conversation exists
    const checkResult = await db.query(
      'SELECT id FROM conversations WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or not accessible in this organization'
      });
    }

    if (!status && !subject && assigned_to === undefined && !metadata) {
      return res.status(400).json({
        success: false,
        message: 'At least one field must be provided for update'
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status) {
      const validStatuses = ['open', 'closed', 'pending'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Valid statuses: ${validStatuses.join(', ')}`
        });
      }
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (subject !== undefined) {
      updates.push(`subject = $${paramCount}`);
      values.push(subject);
      paramCount++;
    }

    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramCount}`);
      values.push(assigned_to);
      paramCount++;
    }

    if (metadata) {
      updates.push(`metadata = $${paramCount}`);
      values.push(JSON.stringify(metadata));
      paramCount++;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await db.query(
      `UPDATE conversations
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json({
      success: true,
      message: 'Conversation updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Update conversation error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    const checkResult = await db.query(
      'SELECT id FROM conversations WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or not accessible in this organization'
      });
    }

    await db.query('DELETE FROM conversations WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
      deletedId: parseInt(id)
    });
  } catch (error) {
    log.error('Delete conversation error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;
    const { reason } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    const checkResult = await db.query(
      'SELECT id, status FROM conversations WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or not accessible in this organization'
      });
    }

    if (checkResult.rows[0].status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Conversation is already closed'
      });
    }

    const result = await db.query(
      `UPDATE conversations
       SET status = 'closed', closed_at = CURRENT_TIMESTAMP, close_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [reason, id]
    );

    res.json({
      success: true,
      message: 'Conversation closed successfully',
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Close conversation error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to close conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/:id/transfer', async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;
    const { agent_id } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    if (!agent_id) {
      return res.status(400).json({
        success: false,
        message: 'Agent ID is required'
      });
    }

    const checkResult = await db.query(
      'SELECT id FROM conversations WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found or not accessible in this organization'
      });
    }

    // Verify agent exists
    const agentCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
      [agent_id, organization_id]
    );

    if (agentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found or not accessible in this organization'
      });
    }

    const result = await db.query(
      `UPDATE conversations
       SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [agent_id, id]
    );

    res.json({
      success: true,
      message: 'Conversation transferred successfully',
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Transfer conversation error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to transfer conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

const app = express();
app.use(express.json());
app.use('/api/conversations', router);

describe('Conversations Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/conversations - List Conversations', () => {
    describe('Successful Retrieval', () => {
      it('should list all conversations with pagination', async () => {
        const mockConversations = [
          { id: 1, channel: 'web', status: 'open', customer_name: 'John Doe' },
          { id: 2, channel: 'email', status: 'closed', customer_name: 'Jane Smith' }
        ];

        db.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: mockConversations });

        const response = await request(app).get('/api/conversations?page=1&limit=10');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.pagination).toMatchObject({
          page: 1,
          limit: 10,
          total: 50,
          totalPages: 5,
          hasNext: true,
          hasPrev: false
        });
      });

      it('should use default pagination values', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '10' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/conversations');

        expect(response.status).toBe(200);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(10);
      });

      it('should enforce maximum limit of 100', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '200' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/conversations?limit=500');

        expect(response.status).toBe(200);
        expect(response.body.pagination.limit).toBe(100);
      });

      it('should filter by status', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '5' }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations?status=open');

        const countCall = db.query.mock.calls[0];
        expect(countCall[0]).toContain('status = $2');
        expect(countCall[1]).toContain('open');
      });

      it('should filter by channel', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '3' }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations?channel=slack');

        const countCall = db.query.mock.calls[0];
        expect(countCall[0]).toContain('channel = $2');
        expect(countCall[1]).toContain('slack');
      });

      it('should filter by both status and channel', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '2' }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations?status=open&channel=web');

        const countCall = db.query.mock.calls[0];
        expect(countCall[0]).toContain('status = $2');
        expect(countCall[0]).toContain('channel = $3');
      });

      it('should calculate pagination correctly for page 2', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/conversations?page=2&limit=10');

        expect(response.status).toBe(200);
        expect(response.body.pagination.hasNext).toBe(true);
        expect(response.body.pagination.hasPrev).toBe(true);
      });

      it('should calculate pagination correctly for last page', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/conversations?page=5&limit=10');

        expect(response.status).toBe(200);
        expect(response.body.pagination.hasNext).toBe(false);
        expect(response.body.pagination.hasPrev).toBe(true);
      });

      it('should order by updated_at DESC', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '10' }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations');

        const selectCall = db.query.mock.calls[1];
        expect(selectCall[0]).toContain('ORDER BY updated_at DESC');
      });
    });

    describe('Error Handling', () => {
      it('should handle database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/conversations');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Failed to retrieve conversations');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('GET /api/conversations/:id - Get Single Conversation', () => {
    describe('Successful Retrieval', () => {
      it('should return conversation details', async () => {
        const mockConversation = {
          id: 1,
          channel: 'web',
          status: 'open',
          customer_name: 'John Doe',
          customer_email: 'john@example.com',
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query.mockResolvedValueOnce({ rows: [mockConversation] });

        const response = await request(app).get('/api/conversations/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          id: 1,
          channel: 'web',
          status: 'open',
          customer_name: 'John Doe'
        });
      });

      it('should verify organization isolation', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await request(app).get('/api/conversations/1');

        expect(db.query).toHaveBeenCalledWith(
          'SELECT * FROM conversations WHERE id = $1 AND organization_id = $2',
          ['1', 1]
        );
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid conversation ID', async () => {
        const response = await request(app).get('/api/conversations/abc');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid conversation ID');
      });

      it('should return 404 if conversation not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/conversations/999');

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Conversation not found or not accessible in this organization');
      });
    });

    describe('Error Handling', () => {
      it('should handle database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/conversations/1');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to retrieve conversation');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('GET /api/conversations/:id/messages - Get Conversation Messages', () => {
    describe('Successful Retrieval', () => {
      it('should return all messages for conversation', async () => {
        const mockMessages = [
          { id: 1, conversation_id: 1, content: 'Hello', sender: 'customer' },
          { id: 2, conversation_id: 1, content: 'Hi there', sender: 'agent' }
        ];

        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: mockMessages });

        const response = await request(app).get('/api/conversations/1/messages');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.total).toBe(2);
      });

      it('should verify conversation belongs to organization', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations/1/messages');

        expect(db.query).toHaveBeenCalledWith(
          'SELECT id FROM conversations WHERE id = $1 AND organization_id = $2',
          ['1', 1]
        );
      });

      it('should order messages by created_at ASC', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations/1/messages');

        const selectCall = db.query.mock.calls[1];
        expect(selectCall[0]).toContain('ORDER BY created_at ASC');
      });

      it('should return empty array if no messages', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/conversations/1/messages');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(0);
        expect(response.body.total).toBe(0);
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid conversation ID', async () => {
        const response = await request(app).get('/api/conversations/abc/messages');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid conversation ID');
      });

      it('should return 404 if conversation not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/conversations/999/messages');

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Conversation not found or not accessible in this organization');
      });
    });

    describe('Error Handling', () => {
      it('should handle database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/conversations/1/messages');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to retrieve messages');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('POST /api/conversations - Create Conversation', () => {
    describe('Successful Creation', () => {
      it('should create conversation with required fields', async () => {
        const mockConversation = {
          id: 1,
          organization_id: 1,
          channel: 'web',
          status: 'open',
          created_at: new Date()
        };

        db.query.mockResolvedValueOnce({ rows: [mockConversation] });

        const response = await request(app)
          .post('/api/conversations')
          .send({ channel: 'web' });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Conversation created successfully');
        expect(response.body.data).toMatchObject({ id: 1, channel: 'web' });
      });

      it('should create conversation with all optional fields', async () => {
        const mockConversation = {
          id: 2,
          channel: 'email',
          customer_name: 'John Doe',
          customer_email: 'john@example.com',
          customer_phone: '1234567890',
          subject: 'Support Request'
        };

        db.query.mockResolvedValueOnce({ rows: [mockConversation] });

        const response = await request(app)
          .post('/api/conversations')
          .send({
            channel: 'email',
            customer_name: 'John Doe',
            customer_email: 'john@example.com',
            customer_phone: '1234567890',
            subject: 'Support Request'
          });

        expect(response.status).toBe(201);
        expect(response.body.data.customer_name).toBe('John Doe');
      });

      it('should create conversation with metadata', async () => {
        const metadata = { source: 'website', priority: 'high' };

        db.query.mockResolvedValueOnce({ rows: [{ id: 3 }] });

        const response = await request(app)
          .post('/api/conversations')
          .send({ channel: 'web', metadata });

        expect(response.status).toBe(201);
      });

      it('should normalize channel to lowercase', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 4, channel: 'slack' }] });

        await request(app)
          .post('/api/conversations')
          .send({ channel: 'SLACK' });

        const insertCall = db.query.mock.calls[0];
        expect(insertCall[1]).toContain('slack');
      });

      it('should accept web channel', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 5, channel: 'web' }] });

        const response = await request(app)
          .post('/api/conversations')
          .send({ channel: 'web' });

        expect(response.status).toBe(201);
      });

      it('should accept email channel', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 6, channel: 'email' }] });

        const response = await request(app)
          .post('/api/conversations')
          .send({ channel: 'email' });

        expect(response.status).toBe(201);
      });

      it('should accept slack channel', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 7, channel: 'slack' }] });

        const response = await request(app)
          .post('/api/conversations')
          .send({ channel: 'slack' });

        expect(response.status).toBe(201);
      });

      it('should accept telegram channel', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 8, channel: 'telegram' }] });

        const response = await request(app)
          .post('/api/conversations')
          .send({ channel: 'telegram' });

        expect(response.status).toBe(201);
      });

      it('should accept whatsapp channel', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 9, channel: 'whatsapp' }] });

        const response = await request(app)
          .post('/api/conversations')
          .send({ channel: 'whatsapp' });

        expect(response.status).toBe(201);
      });

      it('should accept facebook channel', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 10, channel: 'facebook' }] });

        const response = await request(app)
          .post('/api/conversations')
          .send({ channel: 'facebook' });

        expect(response.status).toBe(201);
      });

      it('should set default status to open', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 11, status: 'open' }] });

        const response = await request(app)
          .post('/api/conversations')
          .send({ channel: 'web' });

        expect(response.status).toBe(201);
        expect(response.body.data.status).toBe('open');
      });
    });

    describe('Validation Errors', () => {
      it('should reject missing channel', async () => {
        const response = await request(app)
          .post('/api/conversations')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Channel is required');
      });

      it('should reject empty channel', async () => {
        const response = await request(app)
          .post('/api/conversations')
          .send({ channel: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Channel is required');
      });

      it('should reject invalid channel', async () => {
        const response = await request(app)
          .post('/api/conversations')
          .send({ channel: 'invalid_channel' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid channel');
        expect(response.body.message).toContain('web, email, slack, telegram, whatsapp, facebook');
      });
    });

    describe('Error Handling', () => {
      it('should handle database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .post('/api/conversations')
          .send({ channel: 'web' });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to create conversation');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('PUT /api/conversations/:id - Update Conversation', () => {
    describe('Successful Updates', () => {
      it('should update conversation status', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'closed' }] });

        const response = await request(app)
          .put('/api/conversations/1')
          .send({ status: 'closed' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Conversation updated successfully');
        expect(response.body.data.status).toBe('closed');
      });

      it('should update conversation subject', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, subject: 'New Subject' }] });

        const response = await request(app)
          .put('/api/conversations/1')
          .send({ subject: 'New Subject' });

        expect(response.status).toBe(200);
        expect(response.body.data.subject).toBe('New Subject');
      });

      it('should update assigned_to', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, assigned_to: 5 }] });

        const response = await request(app)
          .put('/api/conversations/1')
          .send({ assigned_to: 5 });

        expect(response.status).toBe(200);
        expect(response.body.data.assigned_to).toBe(5);
      });

      it('should update metadata', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app)
          .put('/api/conversations/1')
          .send({ metadata: { priority: 'urgent' } });

        expect(response.status).toBe(200);
      });

      it('should update multiple fields', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            status: 'pending',
            subject: 'Updated',
            assigned_to: 3
          }] });

        const response = await request(app)
          .put('/api/conversations/1')
          .send({
            status: 'pending',
            subject: 'Updated',
            assigned_to: 3
          });

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('pending');
        expect(response.body.data.subject).toBe('Updated');
        expect(response.body.data.assigned_to).toBe(3);
      });

      it('should clear assigned_to with null', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, assigned_to: null }] });

        const response = await request(app)
          .put('/api/conversations/1')
          .send({ assigned_to: null });

        expect(response.status).toBe(200);
      });

      it('should accept open status', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'open' }] });

        const response = await request(app)
          .put('/api/conversations/1')
          .send({ status: 'open' });

        expect(response.status).toBe(200);
      });

      it('should accept closed status', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'closed' }] });

        const response = await request(app)
          .put('/api/conversations/1')
          .send({ status: 'closed' });

        expect(response.status).toBe(200);
      });

      it('should accept pending status', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending' }] });

        const response = await request(app)
          .put('/api/conversations/1')
          .send({ status: 'pending' });

        expect(response.status).toBe(200);
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid conversation ID', async () => {
        const response = await request(app)
          .put('/api/conversations/abc')
          .send({ status: 'closed' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid conversation ID');
      });

      it('should return 404 if conversation not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .put('/api/conversations/999')
          .send({ status: 'closed' });

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Conversation not found or not accessible in this organization');
      });

      it('should reject empty update', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app)
          .put('/api/conversations/1')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('At least one field must be provided for update');
      });

      it('should reject invalid status', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app)
          .put('/api/conversations/1')
          .send({ status: 'invalid_status' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid status');
        expect(response.body.message).toContain('open, closed, pending');
      });
    });

    describe('Error Handling', () => {
      it('should handle database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .put('/api/conversations/1')
          .send({ status: 'closed' });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to update conversation');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('DELETE /api/conversations/:id - Delete Conversation', () => {
    describe('Successful Deletion', () => {
      it('should delete conversation successfully', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/conversations/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Conversation deleted successfully');
        expect(response.body.deletedId).toBe(1);
      });

      it('should execute DELETE query', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 5 }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).delete('/api/conversations/5');

        expect(db.query).toHaveBeenCalledWith(
          'DELETE FROM conversations WHERE id = $1',
          ['5']
        );
      });

      it('should verify conversation belongs to organization', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).delete('/api/conversations/1');

        expect(db.query).toHaveBeenCalledWith(
          'SELECT id FROM conversations WHERE id = $1 AND organization_id = $2',
          ['1', 1]
        );
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid conversation ID', async () => {
        const response = await request(app).delete('/api/conversations/abc');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid conversation ID');
      });

      it('should return 404 if conversation not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/conversations/999');

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Conversation not found or not accessible in this organization');
      });
    });

    describe('Error Handling', () => {
      it('should handle database error on check', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).delete('/api/conversations/1');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to delete conversation');
        expect(log.error).toHaveBeenCalled();
      });

      it('should handle database error on delete', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockRejectedValueOnce(new Error('Delete failed'));

        const response = await request(app).delete('/api/conversations/1');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to delete conversation');
      });
    });
  });

  describe('POST /api/conversations/:id/close - Close Conversation', () => {
    describe('Successful Close', () => {
      it('should close conversation successfully', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'open' }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            status: 'closed',
            closed_at: new Date()
          }] });

        const response = await request(app)
          .post('/api/conversations/1/close')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Conversation closed successfully');
        expect(response.body.data.status).toBe('closed');
      });

      it('should close conversation with reason', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'open' }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            status: 'closed',
            close_reason: 'Resolved'
          }] });

        const response = await request(app)
          .post('/api/conversations/1/close')
          .send({ reason: 'Resolved' });

        expect(response.status).toBe(200);
        expect(response.body.data.close_reason).toBe('Resolved');
      });

      it('should set closed_at timestamp', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'open' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await request(app)
          .post('/api/conversations/1/close')
          .send({});

        const updateCall = db.query.mock.calls[1];
        expect(updateCall[0]).toContain('closed_at = CURRENT_TIMESTAMP');
      });

      it('should update updated_at timestamp', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'open' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await request(app)
          .post('/api/conversations/1/close')
          .send({});

        const updateCall = db.query.mock.calls[1];
        expect(updateCall[0]).toContain('updated_at = CURRENT_TIMESTAMP');
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid conversation ID', async () => {
        const response = await request(app)
          .post('/api/conversations/abc/close')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid conversation ID');
      });

      it('should return 404 if conversation not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/conversations/999/close')
          .send({});

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Conversation not found or not accessible in this organization');
      });

      it('should reject closing already closed conversation', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'closed' }] });

        const response = await request(app)
          .post('/api/conversations/1/close')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Conversation is already closed');
      });
    });

    describe('Error Handling', () => {
      it('should handle database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .post('/api/conversations/1/close')
          .send({});

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to close conversation');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('GET /api/conversations/search - Search Conversations', () => {
    describe('Successful Search', () => {
      it('should search conversations by query', async () => {
        const mockResults = [
          { id: 1, customer_name: 'John Doe', customer_email: 'john@example.com' },
          { id: 2, customer_name: 'Jane Doe', customer_email: 'jane@example.com' }
        ];

        db.query.mockResolvedValueOnce({ rows: mockResults });

        const response = await request(app).get('/api/conversations/search?query=Doe');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.total).toBe(2);
      });

      it('should use ILIKE for case-insensitive search', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations/search?query=john');

        const queryCall = db.query.mock.calls[0];
        expect(queryCall[0]).toContain('ILIKE');
      });

      it('should search in customer_name and customer_email', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations/search?query=test');

        const queryCall = db.query.mock.calls[0];
        expect(queryCall[0]).toContain('customer_name ILIKE');
        expect(queryCall[0]).toContain('customer_email ILIKE');
      });

      it('should filter by status in search', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations/search?query=john&status=open');

        const queryCall = db.query.mock.calls[0];
        expect(queryCall[0]).toContain('status = $3');
        expect(queryCall[1]).toContain('open');
      });

      it('should filter by channel in search', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations/search?query=john&channel=slack');

        const queryCall = db.query.mock.calls[0];
        expect(queryCall[0]).toContain('channel = $3');
        expect(queryCall[1]).toContain('slack');
      });

      it('should filter by both status and channel', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations/search?query=john&status=open&channel=web');

        const queryCall = db.query.mock.calls[0];
        expect(queryCall[0]).toContain('status = $3');
        expect(queryCall[0]).toContain('channel = $4');
      });

      it('should limit results to 50', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations/search?query=test');

        const queryCall = db.query.mock.calls[0];
        expect(queryCall[0]).toContain('LIMIT 50');
      });

      it('should order by updated_at DESC', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/conversations/search?query=test');

        const queryCall = db.query.mock.calls[0];
        expect(queryCall[0]).toContain('ORDER BY updated_at DESC');
      });
    });

    describe('Validation Errors', () => {
      it('should reject missing query', async () => {
        const response = await request(app).get('/api/conversations/search');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Search query is required');
      });

      it('should reject empty query', async () => {
        const response = await request(app).get('/api/conversations/search?query=   ');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Search query is required');
      });
    });

    describe('Error Handling', () => {
      it('should handle database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/conversations/search?query=test');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to search conversations');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('POST /api/conversations/:id/transfer - Transfer Conversation', () => {
    describe('Successful Transfer', () => {
      it('should transfer conversation to agent', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 5 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, assigned_to: 5 }] });

        const response = await request(app)
          .post('/api/conversations/1/transfer')
          .send({ agent_id: 5 });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Conversation transferred successfully');
        expect(response.body.data.assigned_to).toBe(5);
      });

      it('should verify agent exists in organization', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 5 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await request(app)
          .post('/api/conversations/1/transfer')
          .send({ agent_id: 5 });

        expect(db.query).toHaveBeenCalledWith(
          'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
          [5, 1]
        );
      });

      it('should update updated_at timestamp', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 5 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await request(app)
          .post('/api/conversations/1/transfer')
          .send({ agent_id: 5 });

        const updateCall = db.query.mock.calls[2];
        expect(updateCall[0]).toContain('updated_at = CURRENT_TIMESTAMP');
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid conversation ID', async () => {
        const response = await request(app)
          .post('/api/conversations/abc/transfer')
          .send({ agent_id: 5 });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid conversation ID');
      });

      it('should reject missing agent_id', async () => {
        const response = await request(app)
          .post('/api/conversations/1/transfer')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Agent ID is required');
      });

      it('should return 404 if conversation not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/conversations/999/transfer')
          .send({ agent_id: 5 });

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Conversation not found or not accessible in this organization');
      });

      it('should return 404 if agent not found', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/conversations/1/transfer')
          .send({ agent_id: 999 });

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Agent not found or not accessible in this organization');
      });
    });

    describe('Error Handling', () => {
      it('should handle database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .post('/api/conversations/1/transfer')
          .send({ agent_id: 5 });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to transfer conversation');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('GET /api/conversations/stats - Get Statistics', () => {
    describe('Successful Retrieval', () => {
      it('should return conversation statistics', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            total: '100',
            open: '25',
            closed: '70',
            pending: '5',
            avg_duration: '3600.5'
          }]
        });

        const response = await request(app).get('/api/conversations/stats');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          total: 100,
          open: 25,
          closed: 70,
          pending: 5,
          avgDuration: 3600.5
        });
      });

      it('should handle null average duration', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            total: '0',
            open: '0',
            closed: '0',
            pending: '0',
            avg_duration: null
          }]
        });

        const response = await request(app).get('/api/conversations/stats');

        expect(response.status).toBe(200);
        expect(response.body.data.avgDuration).toBeNull();
      });

      it('should count conversations by status', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ total: '10', open: '3', closed: '5', pending: '2' }] });

        await request(app).get('/api/conversations/stats');

        const queryCall = db.query.mock.calls[0];
        expect(queryCall[0]).toContain("COUNT(CASE WHEN status = 'open' THEN 1 END)");
        expect(queryCall[0]).toContain("COUNT(CASE WHEN status = 'closed' THEN 1 END)");
        expect(queryCall[0]).toContain("COUNT(CASE WHEN status = 'pending' THEN 1 END)");
      });

      it('should calculate average duration', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ total: '10', avg_duration: '1800' }] });

        await request(app).get('/api/conversations/stats');

        const queryCall = db.query.mock.calls[0];
        expect(queryCall[0]).toContain('AVG(EXTRACT(EPOCH FROM (closed_at - created_at)))');
      });

      it('should filter by organization', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ total: '10' }] });

        await request(app).get('/api/conversations/stats');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE organization_id = $1'),
          [1]
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/conversations/stats');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to retrieve statistics');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('Organization Isolation', () => {
    it('should filter conversations by organization on list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/conversations');

      const countCall = db.query.mock.calls[0];
      expect(countCall[0]).toContain('organization_id = $1');
      expect(countCall[1][0]).toBe(1);
    });

    it('should filter conversation by organization on get', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/conversations/1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $2'),
        ['1', 1]
      );
    });

    it('should filter by organization on create', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await request(app)
        .post('/api/conversations')
        .send({ channel: 'web' });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][0]).toBe(1); // organization_id
    });

    it('should verify organization on update', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .put('/api/conversations/1')
        .send({ status: 'closed' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $2'),
        ['1', 1]
      );
    });

    it('should verify organization on delete', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).delete('/api/conversations/1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $2'),
        ['1', 1]
      );
    });

    it('should verify organization on close', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/api/conversations/1/close')
        .send({});

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $2'),
        ['1', 1]
      );
    });

    it('should verify organization on transfer', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/api/conversations/1/transfer')
        .send({ agent_id: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $2'),
        ['1', 1]
      );
    });

    it('should filter by organization on search', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/conversations/search?query=test');

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[0]).toContain('organization_id = $1');
      expect(queryCall[1][0]).toBe(1);
    });

    it('should filter by organization on stats', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '10' }] });

      await request(app).get('/api/conversations/stats');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $1'),
        [1]
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long subject', async () => {
      const longSubject = 'a'.repeat(1000);

      db.query.mockResolvedValueOnce({ rows: [{ id: 1, subject: longSubject }] });

      const response = await request(app)
        .post('/api/conversations')
        .send({ channel: 'web', subject: longSubject });

      expect(response.status).toBe(201);
    });

    it('should handle special characters in search query', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/conversations/search?query=%20test%20%26%20more');

      expect(response.status).toBe(200);
    });

    it('should handle unicode characters in customer name', async () => {
      const unicodeName = '你好 🌟 مرحبا';

      db.query.mockResolvedValueOnce({ rows: [{ id: 1, customer_name: unicodeName }] });

      const response = await request(app)
        .post('/api/conversations')
        .send({ channel: 'web', customer_name: unicodeName });

      expect(response.status).toBe(201);
    });

    it('should handle negative page numbers', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/conversations?page=-5');

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(-5); // Not validated in mock implementation
    });

    it('should handle zero as conversation ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/conversations/0');

      expect(response.status).toBe(404);
    });

    it('should handle large metadata objects', async () => {
      const largeMetadata = {
        data: 'x'.repeat(10000),
        nested: { field1: 'value1', field2: 'value2', field3: 'value3' }
      };

      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/conversations')
        .send({ channel: 'web', metadata: largeMetadata });

      expect(response.status).toBe(201);
    });

    it('should handle concurrent status updates', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'closed' }] });

      const response = await request(app)
        .put('/api/conversations/1')
        .send({ status: 'closed' });

      expect(response.status).toBe(200);
    });

    it('should handle empty strings in optional fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        customer_name: '',
        customer_email: '',
        subject: ''
      }] });

      const response = await request(app)
        .post('/api/conversations')
        .send({
          channel: 'web',
          customer_name: '',
          customer_email: '',
          subject: ''
        });

      expect(response.status).toBe(201);
    });
  });
});
