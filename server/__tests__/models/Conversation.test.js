/**
 * Conversation Model Tests
 * Tests for server/models/Conversation.js
 */

// Mock the database BEFORE importing the model
jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const Conversation = require('../../models/Conversation');

describe('Conversation Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // create()
  // ========================================
  describe('create()', () => {
    it('should create a new conversation message with all required fields', async () => {
      const mockConvRow = {
        id: 1,
        bot_id: 5,
        session_id: 'session-123',
        role: 'user',
        content: 'Hello, bot!'
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
        .mockResolvedValueOnce({ rows: [mockConvRow] }); // SELECT for findById

      const result = await Conversation.create({
        bot_id: 5,
        session_id: 'session-123',
        role: 'user',
        content: 'Hello, bot!'
      });

      expect(result.id).toBe(1);
      expect(result.bot_id).toBe(5);
      expect(result.session_id).toBe('session-123');
      expect(result.role).toBe('user');
      expect(result.content).toBe('Hello, bot!');
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should create assistant message', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, role: 'assistant', content: 'Hi there!' }] });

      const result = await Conversation.create({
        bot_id: 5,
        session_id: 'session-123',
        role: 'assistant',
        content: 'Hi there!'
      });

      expect(result.role).toBe('assistant');
      expect(result.content).toBe('Hi there!');
    });

    it('should create system message', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, role: 'system', content: 'System prompt' }] });

      const result = await Conversation.create({
        bot_id: 5,
        session_id: 'session-123',
        role: 'system',
        content: 'System prompt'
      });

      expect(result.role).toBe('system');
    });
  });

  // ========================================
  // findById()
  // ========================================
  describe('findById()', () => {
    it('should return conversation message if found', async () => {
      const mockConv = {
        id: 1,
        bot_id: 5,
        session_id: 'session-123',
        role: 'user',
        content: 'Test message'
      };
      db.query.mockResolvedValueOnce({ rows: [mockConv] });

      const result = await Conversation.findById(1);

      expect(result.id).toBe(1);
      expect(result.content).toBe('Test message');
      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM ai_conversations WHERE id = $1',
        [1]
      );
    });

    it('should return null if conversation message not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Conversation.findById(999);

      expect(result).toBeNull();
    });
  });

  // ========================================
  // findAll()
  // ========================================
  describe('findAll()', () => {
    it('should return all conversation messages with default pagination', async () => {
      const mockConvs = [
        { id: 1, bot_id: 5, session_id: 'session-1', role: 'user', content: 'Message 1' },
        { id: 2, bot_id: 5, session_id: 'session-1', role: 'assistant', content: 'Message 2' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockConvs });

      const result = await Conversation.findAll();

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [10, 0] // default limit and offset
      );
    });

    it('should support custom pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Conversation.findAll({ limit: 20, offset: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [20, 10]
      );
    });

    it('should return empty array if no conversation messages', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Conversation.findAll();

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // findByBot()
  // ========================================
  describe('findByBot()', () => {
    it('should return conversation messages for a specific bot', async () => {
      const mockConvs = [
        { id: 1, bot_id: 5, role: 'user', content: 'Message 1' },
        { id: 2, bot_id: 5, role: 'assistant', content: 'Message 2' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockConvs });

      const result = await Conversation.findByBot(5);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('bot_id = $1'),
        [5, 10, 0]
      );
    });

    it('should support pagination for bot conversations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Conversation.findByBot(5, { limit: 15, offset: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [5, 15, 5]
      );
    });

    it('should return empty array if bot has no conversations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Conversation.findByBot(999);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // findBySession()
  // ========================================
  describe('findBySession()', () => {
    it('should return conversation messages for a specific session', async () => {
      const mockConvs = [
        { id: 1, bot_id: 5, session_id: 'session-123', role: 'user', content: 'Hello' },
        { id: 2, bot_id: 5, session_id: 'session-123', role: 'assistant', content: 'Hi' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockConvs });

      const result = await Conversation.findBySession(5, 'session-123');

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('bot_id = $1 AND session_id = $2'),
        [5, 'session-123', 50, 0]
      );
    });

    it('should order by created_at ASC for session messages', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Conversation.findBySession(5, 'session-123');

      expect(db.query.mock.calls[0][0]).toContain('ORDER BY created_at ASC');
    });

    it('should support custom pagination for session', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Conversation.findBySession(5, 'session-123', { limit: 100, offset: 20 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [5, 'session-123', 100, 20]
      );
    });

    it('should use default limit of 50 for session', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Conversation.findBySession(5, 'session-123');

      expect(db.query.mock.calls[0][1][2]).toBe(50);
    });

    it('should return empty array if session has no messages', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Conversation.findBySession(5, 'nonexistent-session');

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // findByOrganization()
  // ========================================
  describe('findByOrganization()', () => {
    it('should return conversations for an organization via bots', async () => {
      const mockConvs = [
        { id: 1, bot_id: 5, role: 'user', content: 'Message 1' },
        { id: 2, bot_id: 6, role: 'user', content: 'Message 2' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockConvs });

      const result = await Conversation.findByOrganization(10);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('b.organization_id = $1'),
        [10, 10, 0]
      );
    });

    it('should join with bots table', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Conversation.findByOrganization(10);

      expect(db.query.mock.calls[0][0]).toContain('JOIN bots b');
    });

    it('should support pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Conversation.findByOrganization(10, { limit: 25, offset: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [10, 25, 10]
      );
    });

    it('should return empty array if organization has no conversations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Conversation.findByOrganization(999);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // search()
  // ========================================
  describe('search()', () => {
    it('should search conversations by content', async () => {
      const mockConvs = [
        { id: 1, content: 'How to reset password?' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockConvs });

      const result = await Conversation.search('password');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('content ILIKE $1'),
        ['%password%', 10, 0]
      );
    });

    it('should be case-insensitive', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Conversation.search('PASSWORD');

      expect(db.query.mock.calls[0][1][0]).toBe('%PASSWORD%');
    });

    it('should support pagination for search results', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Conversation.search('test', { limit: 5, offset: 2 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['%test%', 5, 2]
      );
    });

    it('should return empty array if no matches', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Conversation.search('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // update()
  // ========================================
  describe('update()', () => {
    it('should update conversation content', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, content: 'Updated content' }] }); // SELECT

      const result = await Conversation.update(1, { content: 'Updated content' });

      expect(result.content).toBe('Updated content');
      expect(db.query.mock.calls[0][0]).toContain('content = $1');
    });

    it('should update conversation role', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, role: 'system' }] });

      await Conversation.update(1, { role: 'system' });

      expect(db.query.mock.calls[0][0]).toContain('role = $1');
    });

    it('should update both content and role', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, role: 'assistant', content: 'New message' }] });

      await Conversation.update(1, {
        content: 'New message',
        role: 'assistant'
      });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('content = $1');
      expect(updateQuery).toContain('role = $2');
    });

    it('should not update if no fields provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Conversation.update(1, {});

      expect(db.query).toHaveBeenCalledTimes(1); // Only SELECT, no UPDATE
    });
  });

  // ========================================
  // delete()
  // ========================================
  describe('delete()', () => {
    it('should delete conversation message by id', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      await Conversation.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM ai_conversations WHERE id = $1',
        [1]
      );
    });

    it('should handle deletion of non-existent message', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 0 });

      await Conversation.delete(999);

      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // deleteSession()
  // ========================================
  describe('deleteSession()', () => {
    it('should delete all messages in a session', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 5 });

      await Conversation.deleteSession(5, 'session-123');

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM ai_conversations WHERE bot_id = $1 AND session_id = $2',
        [5, 'session-123']
      );
    });

    it('should handle deletion of non-existent session', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 0 });

      await Conversation.deleteSession(5, 'nonexistent-session');

      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // countByBot()
  // ========================================
  describe('countByBot()', () => {
    it('should return count of conversation messages for bot', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '100' }] });

      const result = await Conversation.countByBot(5);

      expect(result).toBe(100);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [5]
      );
    });

    it('should return 0 if bot has no conversation messages', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await Conversation.countByBot(999);

      expect(result).toBe(0);
    });
  });

  // ========================================
  // Error Handling
  // ========================================
  describe('Error Handling', () => {
    it('should propagate database errors on create', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(Conversation.create({
        bot_id: 5,
        session_id: 'session-123',
        role: 'user',
        content: 'Test'
      })).rejects.toThrow('Database error');
    });

    it('should propagate database errors on findById', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection error'));

      await expect(Conversation.findById(1)).rejects.toThrow('Connection error');
    });

    it('should propagate database errors on update', async () => {
      db.query.mockRejectedValueOnce(new Error('Update failed'));

      await expect(Conversation.update(1, { content: 'Test' })).rejects.toThrow('Update failed');
    });

    it('should propagate database errors on delete', async () => {
      db.query.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(Conversation.delete(1)).rejects.toThrow('Delete failed');
    });

    it('should propagate database errors on deleteSession', async () => {
      db.query.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(Conversation.deleteSession(5, 'session-123')).rejects.toThrow('Delete failed');
    });
  });

  // ========================================
  // Validation Tests
  // ========================================
  describe('Validation', () => {
    it('should handle empty content', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: '' }] });

      const result = await Conversation.create({
        bot_id: 5,
        session_id: 'session-123',
        role: 'user',
        content: ''
      });

      expect(result.content).toBe('');
    });

    it('should handle long content', async () => {
      const longContent = 'A'.repeat(10000);
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: longContent }] });

      const result = await Conversation.create({
        bot_id: 5,
        session_id: 'session-123',
        role: 'user',
        content: longContent
      });

      expect(result.content).toBe(longContent);
    });

    it('should handle special characters in content', async () => {
      const content = 'Special chars: <>&"\' 测试 🚀';
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: content }] });

      const result = await Conversation.create({
        bot_id: 5,
        session_id: 'session-123',
        role: 'user',
        content: content
      });

      expect(result.content).toBe(content);
    });

    it('should handle special characters in session_id', async () => {
      const sessionId = 'session-123-abc_def';
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, session_id: sessionId }] });

      const result = await Conversation.create({
        bot_id: 5,
        session_id: sessionId,
        role: 'user',
        content: 'Test'
      });

      expect(result.session_id).toBe(sessionId);
    });

    it('should handle different role types', async () => {
      const roles = ['user', 'assistant', 'system'];

      for (const role of roles) {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, role: role }] });

        const result = await Conversation.create({
          bot_id: 5,
          session_id: 'session-123',
          role: role,
          content: 'Test'
        });

        expect(result.role).toBe(role);
      }
    });
  });
});
