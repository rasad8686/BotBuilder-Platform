/**
 * AgentMessage Model Tests
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const AgentMessage = require('../../models/AgentMessage');

describe('AgentMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a message', async () => {
      const messageData = {
        execution_id: 1,
        from_agent_id: 2,
        to_agent_id: 3,
        message_type: 'data',
        content: { message: 'test' },
        metadata: { priority: 'high' }
      };

      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          ...messageData,
          content: JSON.stringify(messageData.content),
          metadata: JSON.stringify(messageData.metadata)
        }]
      });

      const result = await AgentMessage.create(messageData);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_messages'),
        expect.any(Array)
      );
      expect(result.content).toEqual({ message: 'test' });
      expect(result.metadata).toEqual({ priority: 'high' });
    });

    it('should use default values', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          execution_id: 1,
          from_agent_id: 2,
          to_agent_id: 3,
          message_type: 'data',
          content: '{}',
          metadata: '{}'
        }]
      });

      await AgentMessage.create({
        execution_id: 1,
        from_agent_id: 2,
        to_agent_id: 3
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 2, 3, 'data', '{}', '{}'])
      );
    });
  });

  describe('findById', () => {
    it('should return message by id', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          execution_id: 1,
          content: '{"message":"test"}',
          metadata: '{}'
        }]
      });

      const result = await AgentMessage.findById(1);

      expect(result.id).toBe(1);
      expect(result.content).toEqual({ message: 'test' });
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await AgentMessage.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByExecutionId', () => {
    it('should return messages ordered by timestamp', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, execution_id: 1, content: '{}', metadata: '{}' },
          { id: 2, execution_id: 1, content: '{}', metadata: '{}' }
        ]
      });

      const results = await AgentMessage.findByExecutionId(1);

      expect(results).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY timestamp ASC'),
        [1]
      );
    });
  });

  describe('findByFromAgentId', () => {
    it('should return messages from specific agent', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, from_agent_id: 2, content: '{}', metadata: '{}' }]
      });

      const results = await AgentMessage.findByFromAgentId(1, 2);

      expect(results).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('from_agent_id = $2'),
        [1, 2]
      );
    });
  });

  describe('findByToAgentId', () => {
    it('should return messages to specific agent', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, to_agent_id: 3, content: '{}', metadata: '{}' }]
      });

      const results = await AgentMessage.findByToAgentId(1, 3);

      expect(results).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('to_agent_id = $2'),
        [1, 3]
      );
    });
  });

  describe('findByType', () => {
    it('should return messages by type', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, message_type: 'error', content: '{}', metadata: '{}' }]
      });

      const results = await AgentMessage.findByType(1, 'error');

      expect(results).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('message_type = $2'),
        [1, 'error']
      );
    });
  });

  describe('delete', () => {
    it('should delete message and return true', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const result = await AgentMessage.delete(1);

      expect(result).toBe(true);
    });

    it('should return false if not found', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      const result = await AgentMessage.delete(999);

      expect(result).toBe(false);
    });
  });

  describe('deleteByExecutionId', () => {
    it('should delete all messages for execution', async () => {
      db.query.mockResolvedValue({ rowCount: 5 });

      const result = await AgentMessage.deleteByExecutionId(1);

      expect(result).toBe(5);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE execution_id = $1'),
        [1]
      );
    });
  });

  describe('countByExecutionId', () => {
    it('should return message count', async () => {
      db.query.mockResolvedValue({
        rows: [{ count: '10' }]
      });

      const result = await AgentMessage.countByExecutionId(1);

      expect(result).toBe(10);
    });

    it('should return 0 for empty result', async () => {
      db.query.mockResolvedValue({
        rows: [{}]
      });

      const result = await AgentMessage.countByExecutionId(1);

      expect(result).toBe(0);
    });
  });

  describe('parseMessage', () => {
    it('should parse JSON string fields', () => {
      const message = {
        id: 1,
        content: '{"message":"test"}',
        metadata: '{"key":"value"}'
      };

      const result = AgentMessage.parseMessage(message);

      expect(result.content).toEqual({ message: 'test' });
      expect(result.metadata).toEqual({ key: 'value' });
    });

    it('should handle already parsed fields', () => {
      const message = {
        id: 1,
        content: { message: 'test' },
        metadata: { key: 'value' }
      };

      const result = AgentMessage.parseMessage(message);

      expect(result.content).toEqual({ message: 'test' });
      expect(result.metadata).toEqual({ key: 'value' });
    });

    it('should handle null/undefined fields', () => {
      const message = {
        id: 1,
        content: null,
        metadata: undefined
      };

      const result = AgentMessage.parseMessage(message);

      expect(result.content).toEqual({});
      expect(result.metadata).toEqual({});
    });
  });
});
