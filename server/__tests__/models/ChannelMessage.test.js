/**
 * ChannelMessage Model Tests
 * Tests for server/models/ChannelMessage.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const ChannelMessage = require('../../models/ChannelMessage');

describe('ChannelMessage Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create message with all fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await ChannelMessage.create({
        channel_id: 1,
        bot_id: 1,
        conversation_id: 'conv_123',
        direction: 'inbound',
        from_number: '+1234567890',
        to_number: '+0987654321',
        message_type: 'text',
        content: 'Hello'
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO channel_messages'),
        expect.any(Array)
      );
    });

    it('should generate conversation ID if not provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await ChannelMessage.create({
        channel_id: 1,
        from_number: '+1234567890',
        to_number: '+0987654321'
      });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues[2]).toContain('conv_');
    });

    it('should use default values for optional fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await ChannelMessage.create({
        channel_id: 1,
        from_number: '+1234567890',
        to_number: '+0987654321'
      });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues[7]).toBe('text'); // default message_type
      expect(insertValues[13]).toBe('pending'); // default status
    });
  });

  describe('findByChannel()', () => {
    it('should return messages for channel', async () => {
      const mockMessages = [{ id: 1 }, { id: 2 }];
      db.query.mockResolvedValueOnce({ rows: mockMessages });

      const result = await ChannelMessage.findByChannel(1);

      expect(result).toHaveLength(2);
    });

    it('should filter by conversationId', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ChannelMessage.findByChannel(1, { conversationId: 'conv_123' });

      expect(db.query.mock.calls[0][0]).toContain('conversation_id = $');
    });

    it('should filter by direction', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ChannelMessage.findByChannel(1, { direction: 'inbound' });

      expect(db.query.mock.calls[0][0]).toContain('direction = $');
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ChannelMessage.findByChannel(1, { status: 'delivered' });

      expect(db.query.mock.calls[0][0]).toContain('status = $');
    });

    it('should filter by messageType', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ChannelMessage.findByChannel(1, { messageType: 'image' });

      expect(db.query.mock.calls[0][0]).toContain('message_type = $');
    });

    it('should filter by date range', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ChannelMessage.findByChannel(1, {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      });

      expect(db.query.mock.calls[0][0]).toContain('created_at >= $');
      expect(db.query.mock.calls[0][0]).toContain('created_at <= $');
    });

    it('should use custom limit and offset', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ChannelMessage.findByChannel(1, { limit: 10, offset: 20 });

      expect(db.query.mock.calls[0][1]).toContain(10);
      expect(db.query.mock.calls[0][1]).toContain(20);
    });
  });

  describe('findById()', () => {
    it('should return message if found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await ChannelMessage.findById(1);

      expect(result.id).toBe(1);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ChannelMessage.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByExternalId()', () => {
    it('should return message by external ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, external_id: 'ext_123' }] });

      const result = await ChannelMessage.findByExternalId('ext_123');

      expect(result.external_id).toBe('ext_123');
    });

    it('should return null for null external ID', async () => {
      const result = await ChannelMessage.findByExternalId(null);

      expect(result).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ChannelMessage.findByExternalId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateStatus()', () => {
    it('should update status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'delivered' }] });

      const result = await ChannelMessage.updateStatus(1, 'delivered');

      expect(result.status).toBe('delivered');
    });

    it('should update status with error message', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'failed', error_message: 'Error' }] });

      const result = await ChannelMessage.updateStatus(1, 'failed', 'Error');

      expect(result.error_message).toBe('Error');
    });

    it('should apply additional updates', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await ChannelMessage.updateStatus(1, 'delivered', null, { external_id: 'ext_123' });

      expect(db.query.mock.calls[0][0]).toContain('external_id = $');
    });
  });

  describe('getConversation()', () => {
    it('should return conversation messages', async () => {
      const mockMessages = [{ id: 1 }, { id: 2 }];
      db.query.mockResolvedValueOnce({ rows: mockMessages });

      const result = await ChannelMessage.getConversation(1, '+1234567890');

      expect(result).toHaveLength(2);
    });

    it('should reverse messages to chronological order', async () => {
      const mockMessages = [{ id: 2 }, { id: 1 }];
      db.query.mockResolvedValueOnce({ rows: mockMessages });

      const result = await ChannelMessage.getConversation(1, '+1234567890');

      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });
  });

  describe('getConversations()', () => {
    it('should return grouped conversations', async () => {
      const mockConversations = [
        { conversation_id: 'conv_1', contact_number: '+123' },
        { conversation_id: 'conv_2', contact_number: '+456' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockConversations });

      const result = await ChannelMessage.getConversations(1);

      expect(result).toHaveLength(2);
    });
  });

  describe('markAsRead()', () => {
    it('should mark messages as read', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      const result = await ChannelMessage.markAsRead(1, 'conv_123');

      expect(result).toHaveLength(2);
      expect(db.query.mock.calls[0][0]).toContain("status = 'read'");
    });
  });

  describe('getUnreadCount()', () => {
    it('should return unread count for channel', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await ChannelMessage.getUnreadCount(1);

      expect(result).toBe(5);
    });

    it('should filter by conversation ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await ChannelMessage.getUnreadCount(1, 'conv_123');

      expect(result).toBe(2);
      expect(db.query.mock.calls[0][0]).toContain('conversation_id = $2');
    });
  });

  describe('delete()', () => {
    it('should delete message', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await ChannelMessage.delete(1);

      expect(result.id).toBe(1);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ChannelMessage.delete(999);

      expect(result).toBeNull();
    });
  });

  describe('deleteByChannel()', () => {
    it('should delete all messages for channel', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      const result = await ChannelMessage.deleteByChannel(1);

      expect(result).toBe(2);
    });
  });

  describe('getStats()', () => {
    it('should return message statistics', async () => {
      const mockStats = [
        { date: '2024-01-01', inbound: 10, outbound: 8 }
      ];
      db.query.mockResolvedValueOnce({ rows: mockStats });

      const result = await ChannelMessage.getStats(1, '30d');

      expect(result).toHaveLength(1);
    });

    it('should use 7 day period', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ChannelMessage.getStats(1, '7d');

      expect(db.query).toHaveBeenCalled();
    });

    it('should use 90 day period', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ChannelMessage.getStats(1, '90d');

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('search()', () => {
    it('should search messages by content', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, content: 'Hello world' }] });

      const result = await ChannelMessage.search(1, 'Hello');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        [1, '%Hello%', 50]
      );
    });
  });

  describe('getFailedMessages()', () => {
    it('should return failed outbound messages', async () => {
      const mockMessages = [{ id: 1, status: 'failed' }];
      db.query.mockResolvedValueOnce({ rows: mockMessages });

      const result = await ChannelMessage.getFailedMessages(1);

      expect(result).toHaveLength(1);
      expect(db.query.mock.calls[0][0]).toContain("status = 'failed'");
    });
  });

  describe('generateConversationId()', () => {
    it('should generate consistent conversation ID', () => {
      const id1 = ChannelMessage.generateConversationId('+123', '+456');
      const id2 = ChannelMessage.generateConversationId('+456', '+123');

      expect(id1).toBe(id2);
      expect(id1).toContain('conv_');
    });
  });

  describe('getByDateRange()', () => {
    it('should return messages in date range', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await ChannelMessage.getByDateRange(
        1,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('countByChannel()', () => {
    it('should return message counts', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: 100, inbound: 60, outbound: 40 }] });

      const result = await ChannelMessage.countByChannel(1);

      expect(result.total).toBe(100);
      expect(result.inbound).toBe(60);
      expect(result.outbound).toBe(40);
    });
  });
});
