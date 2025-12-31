/**
 * Channel Model Tests
 * Tests for server/models/Channel.js
 */

// Mock the database BEFORE importing the model
jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const Channel = require('../../models/Channel');

describe('Channel Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // findByTenant()
  // ========================================
  describe('findByTenant()', () => {
    it('should return all channels for a tenant', async () => {
      const mockChannels = [
        { id: 1, type: 'whatsapp', name: 'WhatsApp 1' },
        { id: 2, type: 'instagram', name: 'Instagram 1' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockChannels });

      const result = await Channel.findByTenant(1);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        [1]
      );
    });

    it('should filter by type when provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, type: 'whatsapp' }] });

      const result = await Channel.findByTenant(1, 'whatsapp');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('type = $2'),
        [1, 'whatsapp']
      );
    });

    it('should return empty array if no channels', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Channel.findByTenant(999);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // findById()
  // ========================================
  describe('findById()', () => {
    it('should return channel if found', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', name: 'WhatsApp' };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const result = await Channel.findById(1);

      expect(result.id).toBe(1);
      expect(result.type).toBe('whatsapp');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Channel.findById(999);

      expect(result).toBeNull();
    });
  });

  // ========================================
  // findByPhoneNumber()
  // ========================================
  describe('findByPhoneNumber()', () => {
    it('should find active channel by phone number', async () => {
      const mockChannel = { id: 1, phone_number: '+1234567890', status: 'active' };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const result = await Channel.findByPhoneNumber('+1234567890');

      expect(result.phone_number).toBe('+1234567890');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'active'"),
        ['+1234567890']
      );
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Channel.findByPhoneNumber('+9999999999');

      expect(result).toBeNull();
    });
  });

  // ========================================
  // findByUsername()
  // ========================================
  describe('findByUsername()', () => {
    it('should find active channel by username and type', async () => {
      const mockChannel = { id: 1, username: '@testbot', type: 'telegram', status: 'active' };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const result = await Channel.findByUsername('@testbot', 'telegram');

      expect(result.username).toBe('@testbot');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('username = $1'),
        ['@testbot', 'telegram']
      );
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Channel.findByUsername('@notexist', 'telegram');

      expect(result).toBeNull();
    });
  });

  // ========================================
  // findByBusinessAccountId()
  // ========================================
  describe('findByBusinessAccountId()', () => {
    it('should find active channel by business account ID', async () => {
      const mockChannel = { id: 1, business_account_id: 'ba123', status: 'active' };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const result = await Channel.findByBusinessAccountId('ba123');

      expect(result.business_account_id).toBe('ba123');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Channel.findByBusinessAccountId('notexist');

      expect(result).toBeNull();
    });
  });

  // ========================================
  // create()
  // ========================================
  describe('create()', () => {
    it('should create a new channel with all fields', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', name: 'New Channel' };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const result = await Channel.create({
        tenant_id: 1,
        type: 'whatsapp',
        name: 'New Channel',
        phone_number: '+1234567890',
        credentials: { token: 'abc' }
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO channels'),
        expect.any(Array)
      );
    });

    it('should use default values for optional fields', async () => {
      const mockChannel = { id: 1, status: 'pending' };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      await Channel.create({
        tenant_id: 1,
        type: 'whatsapp',
        name: 'Channel'
      });

      // Check defaults are applied
      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues).toContain('pending'); // default status
    });
  });

  // ========================================
  // update()
  // ========================================
  describe('update()', () => {
    it('should update allowed fields', async () => {
      const mockChannel = { id: 1, name: 'Updated' };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const result = await Channel.update(1, { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(db.query.mock.calls[0][0]).toContain('name = $1');
    });

    it('should update multiple fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Channel.update(1, {
        name: 'Updated',
        status: 'active',
        phone_number: '+0987654321'
      });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('name = $1');
      expect(updateQuery).toContain('status = $2');
      expect(updateQuery).toContain('phone_number = $3');
    });

    it('should ignore disallowed fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Channel.update(1, {
        name: 'Updated',
        id: 999, // disallowed
        tenant_id: 999 // disallowed
      });

      const updateValues = db.query.mock.calls[0][1];
      expect(updateValues).not.toContain(999);
    });

    it('should return current channel if no updates', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Channel.update(1, {});

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
    });
  });

  // ========================================
  // delete()
  // ========================================
  describe('delete()', () => {
    it('should delete channel and return it', async () => {
      const mockChannel = { id: 1, name: 'Deleted' };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const result = await Channel.delete(1);

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        [1]
      );
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Channel.delete(999);

      expect(result).toBeNull();
    });
  });

  // ========================================
  // updateCredentials()
  // ========================================
  describe('updateCredentials()', () => {
    it('should update channel credentials', async () => {
      const mockChannel = { id: 1, credentials: { token: 'new-token' } };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const result = await Channel.updateCredentials(1, { token: 'new-token' });

      expect(result.credentials.token).toBe('new-token');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('credentials = credentials || $1'),
        [{ token: 'new-token' }, 1]
      );
    });
  });

  // ========================================
  // updateTokens()
  // ========================================
  describe('updateTokens()', () => {
    it('should update access and refresh tokens', async () => {
      const mockChannel = { id: 1, access_token: 'new-access', refresh_token: 'new-refresh' };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const expiresAt = new Date();
      const result = await Channel.updateTokens(1, 'new-access', 'new-refresh', expiresAt);

      expect(result.access_token).toBe('new-access');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('access_token = $1'),
        ['new-access', 'new-refresh', expiresAt, 1]
      );
    });

    it('should update only access token if no refresh provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await Channel.updateTokens(1, 'new-access');

      expect(db.query.mock.calls[0][1][1]).toBeNull(); // refresh_token
      expect(db.query.mock.calls[0][1][2]).toBeNull(); // expires_at
    });
  });

  // ========================================
  // updateStatus()
  // ========================================
  describe('updateStatus()', () => {
    it('should update channel status', async () => {
      const mockChannel = { id: 1, status: 'active' };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const result = await Channel.updateStatus(1, 'active');

      expect(result.status).toBe('active');
    });

    it('should update status with error message', async () => {
      const mockChannel = { id: 1, status: 'error', error_message: 'Connection failed' };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const result = await Channel.updateStatus(1, 'error', 'Connection failed');

      expect(result.error_message).toBe('Connection failed');
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['error', 'Connection failed', 1]
      );
    });
  });

  // ========================================
  // getActiveByType()
  // ========================================
  describe('getActiveByType()', () => {
    it('should return active channels by type', async () => {
      const mockChannels = [
        { id: 1, type: 'whatsapp', status: 'active' },
        { id: 2, type: 'whatsapp', status: 'active' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockChannels });

      const result = await Channel.getActiveByType('whatsapp');

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'active'"),
        ['whatsapp']
      );
    });
  });

  // ========================================
  // getExpiringTokens()
  // ========================================
  describe('getExpiringTokens()', () => {
    it('should return channels with expiring tokens', async () => {
      const mockChannels = [{ id: 1, token_expires_at: new Date() }];
      db.query.mockResolvedValueOnce({ rows: mockChannels });

      const result = await Channel.getExpiringTokens(24);

      expect(result).toHaveLength(1);
    });

    it('should use default 24 hours', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Channel.getExpiringTokens();

      expect(db.query).toHaveBeenCalled();
    });
  });

  // ========================================
  // getCountByTenant()
  // ========================================
  describe('getCountByTenant()', () => {
    it('should return channel counts grouped by type', async () => {
      const mockCounts = [
        { type: 'whatsapp', count: 2 },
        { type: 'instagram', count: 1 }
      ];
      db.query.mockResolvedValueOnce({ rows: mockCounts });

      const result = await Channel.getCountByTenant(1);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('whatsapp');
    });
  });

  // ========================================
  // verifyWebhookSecret()
  // ========================================
  describe('verifyWebhookSecret()', () => {
    it('should return true if secret matches', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await Channel.verifyWebhookSecret(1, 'correct-secret');

      expect(result).toBe(true);
    });

    it('should return false if secret does not match', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Channel.verifyWebhookSecret(1, 'wrong-secret');

      expect(result).toBe(false);
    });
  });

  // ========================================
  // updateLastSync()
  // ========================================
  describe('updateLastSync()', () => {
    it('should update last sync timestamp', async () => {
      const mockChannel = { id: 1, last_sync_at: new Date() };
      db.query.mockResolvedValueOnce({ rows: [mockChannel] });

      const result = await Channel.updateLastSync(1);

      expect(result.last_sync_at).toBeDefined();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('last_sync_at = NOW()'),
        [1]
      );
    });
  });

  // ========================================
  // getSettings()
  // ========================================
  describe('getSettings()', () => {
    it('should return channel settings', async () => {
      const mockSettings = { autoReply: true, greeting: 'Hello' };
      db.query.mockResolvedValueOnce({ rows: [{ settings: mockSettings }] });

      const result = await Channel.getSettings(1);

      expect(result.autoReply).toBe(true);
    });

    it('should return empty object if no settings', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Channel.getSettings(999);

      expect(result).toEqual({});
    });
  });

  // ========================================
  // updateSettings()
  // ========================================
  describe('updateSettings()', () => {
    it('should update channel settings', async () => {
      const newSettings = { autoReply: false };
      db.query.mockResolvedValueOnce({ rows: [{ settings: newSettings }] });

      const result = await Channel.updateSettings(1, newSettings);

      expect(result.autoReply).toBe(false);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('settings = settings || $1'),
        [newSettings, 1]
      );
    });
  });
});
