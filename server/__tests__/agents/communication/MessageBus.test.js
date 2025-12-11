/**
 * MessageBus Tests
 * Tests for server/agents/communication/MessageBus.js
 */

// Mock AgentMessage model
jest.mock('../../../models/AgentMessage', () => ({
  create: jest.fn(),
  findByToAgentId: jest.fn(),
  findByExecutionId: jest.fn(),
  countByExecutionId: jest.fn()
}));

const MessageBus = require('../../../agents/communication/MessageBus');
const AgentMessage = require('../../../models/AgentMessage');

describe('MessageBus', () => {
  let messageBus;

  beforeEach(() => {
    jest.clearAllMocks();
    messageBus = new MessageBus('exec_123');
  });

  describe('constructor', () => {
    it('should initialize with execution ID', () => {
      expect(messageBus.executionId).toBe('exec_123');
    });

    it('should initialize empty collections', () => {
      expect(messageBus.subscribers.size).toBe(0);
      expect(messageBus.messageQueue).toEqual([]);
    });
  });

  describe('send', () => {
    it('should create message via AgentMessage model', async () => {
      const mockMessage = {
        id: 1,
        from_agent_id: 1,
        to_agent_id: 2,
        message_type: 'data',
        content: 'Hello'
      };
      AgentMessage.create.mockResolvedValue(mockMessage);

      const result = await messageBus.send(1, 2, 'data', 'Hello', { priority: 'high' });

      expect(AgentMessage.create).toHaveBeenCalledWith({
        execution_id: 'exec_123',
        from_agent_id: 1,
        to_agent_id: 2,
        message_type: 'data',
        content: 'Hello',
        metadata: { priority: 'high' }
      });
      expect(result).toEqual(mockMessage);
    });

    it('should add message to local queue', async () => {
      AgentMessage.create.mockResolvedValue({ id: 1 });

      await messageBus.send(1, 2, 'data', 'Test');

      expect(messageBus.messageQueue).toHaveLength(1);
    });

    it('should notify subscribers', async () => {
      const callback = jest.fn();
      messageBus.subscribe(2, callback);
      AgentMessage.create.mockResolvedValue({ id: 1, to_agent_id: 2 });

      await messageBus.send(1, 2, 'data', 'Test');

      expect(callback).toHaveBeenCalledWith({ id: 1, to_agent_id: 2 });
    });
  });

  describe('receive', () => {
    it('should fetch messages for agent', async () => {
      const messages = [
        { id: 1, message_type: 'data', from_agent_id: 1 },
        { id: 2, message_type: 'request', from_agent_id: 2 }
      ];
      AgentMessage.findByToAgentId.mockResolvedValue(messages);

      const result = await messageBus.receive(3);

      expect(AgentMessage.findByToAgentId).toHaveBeenCalledWith('exec_123', 3);
      expect(result).toHaveLength(2);
    });

    it('should filter by message type', async () => {
      const messages = [
        { id: 1, message_type: 'data' },
        { id: 2, message_type: 'request' }
      ];
      AgentMessage.findByToAgentId.mockResolvedValue(messages);

      const result = await messageBus.receive(3, { messageType: 'request' });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it('should filter by sender', async () => {
      const messages = [
        { id: 1, from_agent_id: 1 },
        { id: 2, from_agent_id: 2 }
      ];
      AgentMessage.findByToAgentId.mockResolvedValue(messages);

      const result = await messageBus.receive(3, { fromAgentId: 2 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it('should filter by timestamp', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 60000);
      const messages = [
        { id: 1, timestamp: earlier.toISOString() },
        { id: 2, timestamp: now.toISOString() }
      ];
      AgentMessage.findByToAgentId.mockResolvedValue(messages);

      const result = await messageBus.receive(3, {
        since: new Date(now.getTime() - 30000).toISOString()
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it('should limit results', async () => {
      const messages = [{ id: 1 }, { id: 2 }, { id: 3 }];
      AgentMessage.findByToAgentId.mockResolvedValue(messages);

      const result = await messageBus.receive(3, { limit: 2 });

      expect(result).toHaveLength(2);
    });
  });

  describe('getHistory', () => {
    it('should fetch all messages for execution', async () => {
      const messages = [{ id: 1 }, { id: 2 }];
      AgentMessage.findByExecutionId.mockResolvedValue(messages);

      const result = await messageBus.getHistory();

      expect(AgentMessage.findByExecutionId).toHaveBeenCalledWith('exec_123');
      expect(result).toHaveLength(2);
    });

    it('should filter by message type', async () => {
      const messages = [
        { id: 1, message_type: 'data' },
        { id: 2, message_type: 'error' }
      ];
      AgentMessage.findByExecutionId.mockResolvedValue(messages);

      const result = await messageBus.getHistory({ messageType: 'error' });

      expect(result).toHaveLength(1);
    });

    it('should filter by sender and recipient', async () => {
      const messages = [
        { id: 1, from_agent_id: 1, to_agent_id: 2 },
        { id: 2, from_agent_id: 2, to_agent_id: 3 }
      ];
      AgentMessage.findByExecutionId.mockResolvedValue(messages);

      const result = await messageBus.getHistory({ fromAgentId: 1, toAgentId: 2 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe('broadcast', () => {
    it('should send to all agents', async () => {
      AgentMessage.create.mockResolvedValue({ id: 1 });

      await messageBus.broadcast(1, 'announcement', 'Hello everyone');

      expect(AgentMessage.create).toHaveBeenCalledWith(expect.objectContaining({
        to_agent_id: '*',
        metadata: expect.objectContaining({ broadcast: true })
      }));
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('should subscribe callback for agent', () => {
      const callback = jest.fn();

      messageBus.subscribe(1, callback);

      expect(messageBus.subscribers.get(1)).toContain(callback);
    });

    it('should allow multiple subscriptions per agent', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      messageBus.subscribe(1, cb1);
      messageBus.subscribe(1, cb2);

      expect(messageBus.subscribers.get(1)).toHaveLength(2);
    });

    it('should unsubscribe callback', () => {
      const callback = jest.fn();
      messageBus.subscribe(1, callback);

      messageBus.unsubscribe(1, callback);

      expect(messageBus.subscribers.get(1)).toHaveLength(0);
    });

    it('should handle unsubscribe for non-existent agent', () => {
      expect(() => {
        messageBus.unsubscribe(999, jest.fn());
      }).not.toThrow();
    });
  });

  describe('notifySubscribers', () => {
    it('should notify specific agent subscriber', async () => {
      const callback = jest.fn();
      messageBus.subscribe(2, callback);

      await messageBus.notifySubscribers({ to_agent_id: 2, content: 'test' });

      expect(callback).toHaveBeenCalledWith({ to_agent_id: 2, content: 'test' });
    });

    it('should notify all on broadcast except sender', async () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      const cb3 = jest.fn();
      messageBus.subscribe(1, cb1); // Sender
      messageBus.subscribe(2, cb2);
      messageBus.subscribe(3, cb3);

      await messageBus.notifySubscribers({
        from_agent_id: 1,
        to_agent_id: '*',
        content: 'broadcast'
      });

      expect(cb1).not.toHaveBeenCalled(); // Sender not notified
      expect(cb2).toHaveBeenCalled();
      expect(cb3).toHaveBeenCalled();
    });
  });

  describe('waitForResponse', () => {
    it('should resolve when response received', async () => {
      const responsePromise = messageBus.waitForResponse(2, 1, 5000);

      // Simulate response
      setTimeout(async () => {
        await messageBus.notifySubscribers({
          from_agent_id: 2,
          to_agent_id: 1,
          message_type: 'response',
          content: 'Done'
        });
      }, 50);

      const result = await responsePromise;

      expect(result.message_type).toBe('response');
    });

    it('should timeout if no response', async () => {
      await expect(
        messageBus.waitForResponse(2, 1, 100)
      ).rejects.toThrow('Response timeout');
    });
  });

  describe('request', () => {
    it('should send request and wait for response', async () => {
      AgentMessage.create.mockResolvedValue({ id: 1 });

      const requestPromise = messageBus.request(1, 2, { query: 'test' }, 5000);

      // Simulate response - from original recipient (2) back to sender (1)
      setTimeout(async () => {
        await messageBus.notifySubscribers({
          from_agent_id: 2, // Response from original recipient
          to_agent_id: 1,   // Back to sender
          message_type: 'response',
          content: 'Answer'
        });
      }, 50);

      const result = await requestPromise;

      expect(AgentMessage.create).toHaveBeenCalled();
      expect(result.message_type).toBe('response');
    });
  });

  describe('getMessageCount', () => {
    it('should return message count', async () => {
      AgentMessage.countByExecutionId.mockResolvedValue(42);

      const count = await messageBus.getMessageCount();

      expect(count).toBe(42);
    });
  });

  describe('clearQueue/clearSubscribers', () => {
    it('should clear message queue', () => {
      messageBus.messageQueue = [{ id: 1 }, { id: 2 }];

      messageBus.clearQueue();

      expect(messageBus.messageQueue).toEqual([]);
    });

    it('should clear all subscribers', () => {
      messageBus.subscribe(1, jest.fn());
      messageBus.subscribe(2, jest.fn());

      messageBus.clearSubscribers();

      expect(messageBus.subscribers.size).toBe(0);
    });
  });
});
