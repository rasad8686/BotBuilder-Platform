/**
 * AIMessageHandler Tests
 * Tests for server/services/ai/aiMessageHandler.js
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../../db');
const AIMessageHandler = require('../../../services/ai/aiMessageHandler');

describe('AIMessageHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildMessagesWithContext', () => {
    it('should build messages with system prompt and user message', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const messages = await AIMessageHandler.buildMessagesWithContext({
        botId: 1,
        sessionId: 'session-123',
        userMessage: 'Hello',
        systemPrompt: 'You are helpful'
      });

      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toBe('You are helpful');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('Hello');
    });

    it('should include conversation history', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { role: 'assistant', content: 'Hi!', created_at: new Date() },
          { role: 'user', content: 'Previous message', created_at: new Date() }
        ]
      });

      const messages = await AIMessageHandler.buildMessagesWithContext({
        botId: 1,
        sessionId: 'session-123',
        userMessage: 'Hello again',
        contextWindow: 5
      });

      expect(messages.length).toBe(4); // system + 2 history + current
    });

    it('should use default system prompt', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const messages = await AIMessageHandler.buildMessagesWithContext({
        botId: 1,
        sessionId: 'session-123',
        userMessage: 'Hello'
      });

      expect(messages[0].content).toBe('You are a helpful assistant.');
    });

    it('should skip history if contextWindow is 0', async () => {
      const messages = await AIMessageHandler.buildMessagesWithContext({
        botId: 1,
        sessionId: 'session-123',
        userMessage: 'Hello',
        contextWindow: 0
      });

      expect(db.query).not.toHaveBeenCalled();
      expect(messages.length).toBe(2);
    });

    it('should skip history if no sessionId', async () => {
      const messages = await AIMessageHandler.buildMessagesWithContext({
        botId: 1,
        userMessage: 'Hello',
        contextWindow: 5
      });

      expect(db.query).not.toHaveBeenCalled();
    });

    it('should handle history fetch error gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const messages = await AIMessageHandler.buildMessagesWithContext({
        botId: 1,
        sessionId: 'session-123',
        userMessage: 'Hello',
        contextWindow: 5
      });

      // Should still return system + user message despite error
      expect(messages.length).toBe(2);
    });
  });

  describe('saveMessage', () => {
    it('should save message to database', async () => {
      const savedMsg = {
        id: 1,
        bot_id: 1,
        session_id: 'session-123',
        role: 'user',
        content: 'Hello'
      };
      db.query.mockResolvedValueOnce({ rows: [savedMsg] });

      const result = await AIMessageHandler.saveMessage({
        botId: 1,
        sessionId: 'session-123',
        role: 'user',
        content: 'Hello'
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ai_conversations'),
        [1, 'session-123', 'user', 'Hello']
      );
    });

    it('should throw error if missing required params', async () => {
      await expect(AIMessageHandler.saveMessage({
        botId: 1,
        sessionId: 'session-123',
        role: 'user'
        // missing content
      })).rejects.toThrow('botId, sessionId, role, and content are required');
    });

    it('should throw error if botId missing', async () => {
      await expect(AIMessageHandler.saveMessage({
        sessionId: 'session-123',
        role: 'user',
        content: 'Hello'
      })).rejects.toThrow('botId, sessionId, role, and content are required');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(AIMessageHandler.saveMessage({
        botId: 1,
        sessionId: 'session-123',
        role: 'user',
        content: 'Hello'
      })).rejects.toThrow('DB error');
    });
  });

  describe('clearConversation', () => {
    it('should clear conversation history', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 5 });

      const count = await AIMessageHandler.clearConversation(1, 'session-123');

      expect(count).toBe(5);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM ai_conversations'),
        [1, 'session-123']
      );
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        AIMessageHandler.clearConversation(1, 'session-123')
      ).rejects.toThrow('DB error');
    });
  });

  describe('getConversationHistory', () => {
    it('should get conversation history', async () => {
      const history = [
        { id: 1, role: 'user', content: 'Hi', created_at: new Date() },
        { id: 2, role: 'assistant', content: 'Hello!', created_at: new Date() }
      ];
      db.query.mockResolvedValueOnce({ rows: history });

      const result = await AIMessageHandler.getConversationHistory(1, 'session-123');

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1, 'session-123', 50]
      );
    });

    it('should use custom limit', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await AIMessageHandler.getConversationHistory(1, 'session-123', 100);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 'session-123', 100]
      );
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        AIMessageHandler.getConversationHistory(1, 'session-123')
      ).rejects.toThrow('DB error');
    });
  });

  describe('cleanupOldConversations', () => {
    it('should cleanup old conversations', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 100 });

      const count = await AIMessageHandler.cleanupOldConversations(30);

      expect(count).toBe(100);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('30 days')
      );
    });

    it('should use default days', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 50 });

      await AIMessageHandler.cleanupOldConversations();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('30 days')
      );
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        AIMessageHandler.cleanupOldConversations(30)
      ).rejects.toThrow('DB error');
    });
  });

  describe('getConversationStats', () => {
    it('should get stats for specific session', async () => {
      const stats = {
        total_messages: 10,
        user_messages: 5,
        assistant_messages: 5,
        first_message: new Date(),
        last_message: new Date()
      };
      db.query.mockResolvedValueOnce({ rows: [stats] });

      const result = await AIMessageHandler.getConversationStats(1, 'session-123');

      expect(result.total_messages).toBe(10);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('bot_id = $1 AND session_id = $2'),
        [1, 'session-123']
      );
    });

    it('should get stats for entire bot', async () => {
      const stats = {
        total_messages: 1000,
        user_messages: 500,
        assistant_messages: 500,
        unique_sessions: 50
      };
      db.query.mockResolvedValueOnce({ rows: [stats] });

      const result = await AIMessageHandler.getConversationStats(1);

      expect(result.unique_sessions).toBe(50);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DISTINCT session_id'),
        [1]
      );
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        AIMessageHandler.getConversationStats(1, 'session-123')
      ).rejects.toThrow('DB error');
    });
  });

  describe('formatMessage', () => {
    it('should return empty string for empty content', () => {
      expect(AIMessageHandler.formatMessage('')).toBe('');
      expect(AIMessageHandler.formatMessage(null)).toBe('');
      expect(AIMessageHandler.formatMessage(undefined)).toBe('');
    });

    it('should trim whitespace', () => {
      expect(AIMessageHandler.formatMessage('  Hello  ')).toBe('Hello');
    });

    it('should truncate long messages', () => {
      const longMessage = 'a'.repeat(100);
      const formatted = AIMessageHandler.formatMessage(longMessage, 50);

      expect(formatted).toBe('a'.repeat(50) + '...');
    });

    it('should not truncate if within limit', () => {
      const message = 'Short message';
      const formatted = AIMessageHandler.formatMessage(message, 100);

      expect(formatted).toBe(message);
    });
  });

  describe('validateMessage', () => {
    it('should pass valid message', () => {
      const result = AIMessageHandler.validateMessage('Hello');
      expect(result.valid).toBe(true);
    });

    it('should fail empty message', () => {
      const result = AIMessageHandler.validateMessage('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should allow empty if configured', () => {
      const result = AIMessageHandler.validateMessage('', { allowEmpty: true });
      expect(result.valid).toBe(true);
    });

    it('should fail message below minLength', () => {
      const result = AIMessageHandler.validateMessage('Hi', { minLength: 5 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 5 characters');
    });

    it('should fail message above maxLength', () => {
      const result = AIMessageHandler.validateMessage('Hello', { maxLength: 3 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot exceed 3 characters');
    });

    it('should use default options', () => {
      const result = AIMessageHandler.validateMessage('Valid message');
      expect(result.valid).toBe(true);
    });
  });
});
