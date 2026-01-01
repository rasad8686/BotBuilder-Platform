/**
 * Message Model Tests
 * Tests for server/models/Message.js
 */

// Mock the database BEFORE importing the model
jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const Message = require('../../models/Message');

describe('Message Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // create()
  // ========================================
  describe('create()', () => {
    it('should create a new message with all required fields', async () => {
      const mockMessageRow = {
        id: 1,
        bot_id: 5,
        organization_id: 10,
        sender: 'user',
        content: 'Hello, bot!',
        metadata: '{}'
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
        .mockResolvedValueOnce({ rows: [mockMessageRow] }); // SELECT for findById

      const result = await Message.create({
        bot_id: 5,
        organization_id: 10,
        sender: 'user',
        content: 'Hello, bot!'
      });

      expect(result.id).toBe(1);
      expect(result.bot_id).toBe(5);
      expect(result.organization_id).toBe(10);
      expect(result.sender).toBe('user');
      expect(result.content).toBe('Hello, bot!');
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should set sender to user by default', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, sender: 'user', metadata: '{}' }] });

      await Message.create({
        bot_id: 5,
        organization_id: 10,
        content: 'Test message'
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][2]).toBe('user'); // sender should be 'user'
    });

    it('should allow custom sender', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, sender: 'bot', metadata: '{}' }] });

      await Message.create({
        bot_id: 5,
        organization_id: 10,
        sender: 'bot',
        content: 'Bot response'
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][2]).toBe('bot');
    });

    it('should stringify metadata object', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, metadata: '{"platform":"slack"}' }] });

      await Message.create({
        bot_id: 5,
        organization_id: 10,
        content: 'Test',
        metadata: { platform: 'slack' }
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][4]).toBe('{"platform":"slack"}');
    });

    it('should use empty object for metadata if not provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, metadata: '{}' }] });

      await Message.create({
        bot_id: 5,
        organization_id: 10,
        content: 'Test'
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][4]).toBe('{}');
    });
  });

  // ========================================
  // findById()
  // ========================================
  describe('findById()', () => {
    it('should return message if found', async () => {
      const mockMessage = {
        id: 1,
        bot_id: 5,
        content: 'Test message',
        metadata: '{"key":"value"}'
      };
      db.query.mockResolvedValueOnce({ rows: [mockMessage] });

      const result = await Message.findById(1);

      expect(result.id).toBe(1);
      expect(result.content).toBe('Test message');
      expect(result.metadata).toEqual({ key: 'value' });
      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM bot_messages WHERE id = $1',
        [1]
      );
    });

    it('should return null if message not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Message.findById(999);

      expect(result).toBeNull();
    });

    it('should parse JSON metadata', async () => {
      const mockMessage = {
        id: 1,
        content: 'Test',
        metadata: '{"platform":"telegram","user_id":123}'
      };
      db.query.mockResolvedValueOnce({ rows: [mockMessage] });

      const result = await Message.findById(1);

      expect(result.metadata).toEqual({ platform: 'telegram', user_id: 123 });
      expect(typeof result.metadata).toBe('object');
    });
  });

  // ========================================
  // findAll()
  // ========================================
  describe('findAll()', () => {
    it('should return all messages with default pagination', async () => {
      const mockMessages = [
        { id: 1, content: 'Message 1', metadata: '{}' },
        { id: 2, content: 'Message 2', metadata: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockMessages });

      const result = await Message.findAll();

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [10, 0] // default limit and offset
      );
    });

    it('should support custom pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Message.findAll({ limit: 20, offset: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [20, 10]
      );
    });

    it('should return empty array if no messages', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Message.findAll();

      expect(result).toEqual([]);
    });

    it('should parse metadata for all messages', async () => {
      const mockMessages = [
        { id: 1, metadata: '{"a":1}' },
        { id: 2, metadata: '{"b":2}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockMessages });

      const result = await Message.findAll();

      expect(result[0].metadata).toEqual({ a: 1 });
      expect(result[1].metadata).toEqual({ b: 2 });
    });
  });

  // ========================================
  // findByBot()
  // ========================================
  describe('findByBot()', () => {
    it('should return messages for a specific bot', async () => {
      const mockMessages = [
        { id: 1, bot_id: 5, content: 'Message 1', metadata: '{}' },
        { id: 2, bot_id: 5, content: 'Message 2', metadata: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockMessages });

      const result = await Message.findByBot(5);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('bot_id = $1'),
        [5, 10, 0]
      );
    });

    it('should support pagination for bot messages', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Message.findByBot(5, { limit: 15, offset: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [5, 15, 5]
      );
    });

    it('should return empty array if bot has no messages', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Message.findByBot(999);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // findByOrganization()
  // ========================================
  describe('findByOrganization()', () => {
    it('should return messages for a specific organization', async () => {
      const mockMessages = [
        { id: 1, organization_id: 10, content: 'Message 1', metadata: '{}' },
        { id: 2, organization_id: 10, content: 'Message 2', metadata: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockMessages });

      const result = await Message.findByOrganization(10);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $1'),
        [10, 10, 0]
      );
    });

    it('should support pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Message.findByOrganization(10, { limit: 25, offset: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [10, 25, 10]
      );
    });

    it('should return empty array if organization has no messages', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Message.findByOrganization(999);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // findBySender()
  // ========================================
  describe('findBySender()', () => {
    it('should return messages from a specific sender', async () => {
      const mockMessages = [
        { id: 1, sender: 'user', content: 'User message', metadata: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockMessages });

      const result = await Message.findBySender('user');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('sender = $1'),
        ['user', 10, 0]
      );
    });

    it('should support pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Message.findBySender('bot', { limit: 15, offset: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['bot', 15, 5]
      );
    });

    it('should return empty array if no messages from sender', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Message.findBySender('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // search()
  // ========================================
  describe('search()', () => {
    it('should search messages by content', async () => {
      const mockMessages = [
        { id: 1, content: 'How to reset password?', metadata: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockMessages });

      const result = await Message.search('password');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('content ILIKE $1'),
        ['%password%', 10, 0]
      );
    });

    it('should be case-insensitive', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Message.search('PASSWORD');

      expect(db.query.mock.calls[0][1][0]).toBe('%PASSWORD%');
    });

    it('should support pagination for search results', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Message.search('test', { limit: 5, offset: 2 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['%test%', 5, 2]
      );
    });

    it('should return empty array if no matches', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Message.search('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // update()
  // ========================================
  describe('update()', () => {
    it('should update message content', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, content: 'Updated content', metadata: '{}' }] }); // SELECT

      const result = await Message.update(1, { content: 'Updated content' });

      expect(result.content).toBe('Updated content');
      expect(db.query.mock.calls[0][0]).toContain('content = $1');
    });

    it('should update message metadata', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, metadata: '{"new":"metadata"}' }] });

      await Message.update(1, { metadata: { new: 'metadata' } });

      expect(db.query.mock.calls[0][1]).toContain('{"new":"metadata"}');
    });

    it('should update message sender', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, sender: 'bot', metadata: '{}' }] });

      await Message.update(1, { sender: 'bot' });

      expect(db.query.mock.calls[0][0]).toContain('sender = $1');
    });

    it('should update multiple fields', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, metadata: '{}' }] });

      await Message.update(1, {
        content: 'Updated',
        sender: 'bot',
        metadata: { updated: true }
      });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('content = $1');
      expect(updateQuery).toContain('metadata = $2');
      expect(updateQuery).toContain('sender = $3');
    });

    it('should not update if no fields provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, metadata: '{}' }] });

      await Message.update(1, {});

      expect(db.query).toHaveBeenCalledTimes(1); // Only SELECT, no UPDATE
    });
  });

  // ========================================
  // delete()
  // ========================================
  describe('delete()', () => {
    it('should delete message by id', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      await Message.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM bot_messages WHERE id = $1',
        [1]
      );
    });

    it('should handle deletion of non-existent message', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 0 });

      await Message.delete(999);

      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // countByBot()
  // ========================================
  describe('countByBot()', () => {
    it('should return count of messages for bot', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '50' }] });

      const result = await Message.countByBot(5);

      expect(result).toBe(50);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [5]
      );
    });

    it('should return 0 if bot has no messages', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await Message.countByBot(999);

      expect(result).toBe(0);
    });
  });

  // ========================================
  // countByOrganization()
  // ========================================
  describe('countByOrganization()', () => {
    it('should return count of messages for organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '250' }] });

      const result = await Message.countByOrganization(10);

      expect(result).toBe(250);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [10]
      );
    });

    it('should return 0 if organization has no messages', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await Message.countByOrganization(999);

      expect(result).toBe(0);
    });
  });

  // ========================================
  // parseMessage()
  // ========================================
  describe('parseMessage()', () => {
    it('should parse JSON string metadata', () => {
      const raw = {
        id: 1,
        content: 'Test message',
        metadata: '{"platform":"slack","user_id":123}'
      };

      const result = Message.parseMessage(raw);

      expect(result.metadata).toEqual({ platform: 'slack', user_id: 123 });
      expect(typeof result.metadata).toBe('object');
    });

    it('should handle already parsed metadata', () => {
      const raw = {
        id: 1,
        content: 'Test message',
        metadata: { platform: 'telegram' }
      };

      const result = Message.parseMessage(raw);

      expect(result.metadata).toEqual({ platform: 'telegram' });
    });

    it('should default to empty object for null/undefined metadata', () => {
      const raw = {
        id: 1,
        content: 'Test message',
        metadata: null
      };

      const result = Message.parseMessage(raw);

      expect(result.metadata).toEqual({});
    });

    it('should preserve all other fields', () => {
      const raw = {
        id: 1,
        bot_id: 5,
        organization_id: 10,
        sender: 'user',
        content: 'Test message',
        metadata: '{}'
      };

      const result = Message.parseMessage(raw);

      expect(result.id).toBe(1);
      expect(result.bot_id).toBe(5);
      expect(result.organization_id).toBe(10);
      expect(result.sender).toBe('user');
      expect(result.content).toBe('Test message');
    });
  });

  // ========================================
  // Error Handling
  // ========================================
  describe('Error Handling', () => {
    it('should propagate database errors on create', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(Message.create({
        bot_id: 5,
        organization_id: 10,
        content: 'Test'
      })).rejects.toThrow('Database error');
    });

    it('should propagate database errors on findById', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection error'));

      await expect(Message.findById(1)).rejects.toThrow('Connection error');
    });

    it('should propagate database errors on update', async () => {
      db.query.mockRejectedValueOnce(new Error('Update failed'));

      await expect(Message.update(1, { content: 'Test' })).rejects.toThrow('Update failed');
    });

    it('should propagate database errors on delete', async () => {
      db.query.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(Message.delete(1)).rejects.toThrow('Delete failed');
    });
  });

  // ========================================
  // Validation Tests
  // ========================================
  describe('Validation', () => {
    it('should handle empty content', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: '', metadata: '{}' }] });

      const result = await Message.create({
        bot_id: 5,
        organization_id: 10,
        content: ''
      });

      expect(result.content).toBe('');
    });

    it('should handle long content', async () => {
      const longContent = 'A'.repeat(50000);
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: longContent, metadata: '{}' }] });

      const result = await Message.create({
        bot_id: 5,
        organization_id: 10,
        content: longContent
      });

      expect(result.content).toBe(longContent);
    });

    it('should handle special characters in content', async () => {
      const content = 'Special chars: <>&"\' 测试 🚀 \n\t';
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: content, metadata: '{}' }] });

      const result = await Message.create({
        bot_id: 5,
        organization_id: 10,
        content: content
      });

      expect(result.content).toBe(content);
    });

    it('should handle complex metadata object', async () => {
      const complexMetadata = {
        platform: 'slack',
        user: {
          id: 123,
          name: 'John Doe',
          avatar: 'url'
        },
        channel: {
          id: 'C123',
          name: 'general'
        },
        attachments: [
          { type: 'image', url: 'img1.jpg' },
          { type: 'file', url: 'doc.pdf' }
        ]
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, metadata: JSON.stringify(complexMetadata) }] });

      const result = await Message.create({
        bot_id: 5,
        organization_id: 10,
        content: 'Test',
        metadata: complexMetadata
      });

      expect(result.metadata).toEqual(complexMetadata);
    });

    it('should handle different sender types', async () => {
      const senders = ['user', 'bot', 'system', 'admin'];

      for (const sender of senders) {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, sender: sender, metadata: '{}' }] });

        const result = await Message.create({
          bot_id: 5,
          organization_id: 10,
          sender: sender,
          content: 'Test'
        });

        expect(result.sender).toBe(sender);
      }
    });
  });
});
