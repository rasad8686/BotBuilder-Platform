/**
 * PresenceManager Tests
 * Tests for server/collaboration/core/PresenceManager.js
 */

// Use fake timers to prevent setInterval from running
jest.useFakeTimers();

const { PresenceManager, getPresenceManager } = require('../../collaboration/core/PresenceManager');

describe('PresenceManager', () => {
  let presenceManager;
  let mockIo;

  beforeEach(() => {
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };
    presenceManager = new PresenceManager(mockIo);
  });

  afterEach(() => {
    presenceManager.destroy();
  });

  describe('constructor', () => {
    it('should initialize with io and maps', () => {
      expect(presenceManager.io).toBe(mockIo);
      expect(presenceManager.presenceByTenant).toBeInstanceOf(Map);
      expect(presenceManager.socketToUser).toBeInstanceOf(Map);
    });

    it('should set cleanup interval', () => {
      expect(presenceManager.cleanupInterval).toBeDefined();
    });
  });

  describe('trackUser', () => {
    it('should track user presence', () => {
      const result = presenceManager.trackUser(
        1, // tenantId
        100, // userId
        { username: 'test', email: 'test@test.com', avatar: null },
        'socket123'
      );

      expect(result).toBe(true);
      expect(presenceManager.presenceByTenant.has(1)).toBe(true);
      expect(presenceManager.socketToUser.has('socket123')).toBe(true);
    });

    it('should create tenant map if not exists', () => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');

      expect(presenceManager.presenceByTenant.get(1)).toBeInstanceOf(Map);
    });

    it('should broadcast presence update', () => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');

      expect(mockIo.to).toHaveBeenCalledWith('tenant:1');
      expect(mockIo.emit).toHaveBeenCalledWith('presence:update', expect.any(Object));
    });

    it('should preserve connectedAt for existing user', () => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');
      const firstConnectedAt = presenceManager.presenceByTenant.get(1).get(100).connectedAt;

      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket456');
      const secondConnectedAt = presenceManager.presenceByTenant.get(1).get(100).connectedAt;

      expect(secondConnectedAt).toBe(firstConnectedAt);
    });
  });

  describe('removeUser', () => {
    beforeEach(() => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');
    });

    it('should remove user presence', () => {
      const result = presenceManager.removeUser('socket123');

      expect(result).toBe(true);
      expect(presenceManager.socketToUser.has('socket123')).toBe(false);
    });

    it('should return false for unknown socket', () => {
      const result = presenceManager.removeUser('unknown');

      expect(result).toBe(false);
    });

    it('should clean up empty tenant map', () => {
      presenceManager.removeUser('socket123');

      expect(presenceManager.presenceByTenant.has(1)).toBe(false);
    });

    it('should broadcast presence update', () => {
      mockIo.to.mockClear();
      mockIo.emit.mockClear();

      presenceManager.removeUser('socket123');

      expect(mockIo.to).toHaveBeenCalledWith('tenant:1');
      expect(mockIo.emit).toHaveBeenCalledWith('presence:update', expect.any(Object));
    });
  });

  describe('heartbeat', () => {
    it('should update lastSeen timestamp', () => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');
      const initialLastSeen = presenceManager.presenceByTenant.get(1).get(100).lastSeen;

      // Small delay to ensure different timestamp
      const result = presenceManager.heartbeat('socket123');
      const newLastSeen = presenceManager.presenceByTenant.get(1).get(100).lastSeen;

      expect(result).toBe(true);
      expect(newLastSeen).toBeGreaterThanOrEqual(initialLastSeen);
    });

    it('should return false for unknown socket', () => {
      const result = presenceManager.heartbeat('unknown');

      expect(result).toBe(false);
    });
  });

  describe('startEditingEntity', () => {
    beforeEach(() => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');
    });

    it('should track entity editing', () => {
      const result = presenceManager.startEditingEntity('socket123', 'flow', 'flow_1');

      expect(result).toBe(true);
      const userPresence = presenceManager.presenceByTenant.get(1).get(100);
      expect(userPresence.entities.has('flow:flow_1')).toBe(true);
    });

    it('should broadcast entity presence', () => {
      mockIo.to.mockClear();
      mockIo.emit.mockClear();

      presenceManager.startEditingEntity('socket123', 'flow', 'flow_1');

      expect(mockIo.emit).toHaveBeenCalledWith('presence:entity', expect.objectContaining({
        entityType: 'flow',
        entityId: 'flow_1'
      }));
    });

    it('should return false for unknown socket', () => {
      const result = presenceManager.startEditingEntity('unknown', 'flow', 'flow_1');

      expect(result).toBe(false);
    });
  });

  describe('stopEditingEntity', () => {
    beforeEach(() => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');
      presenceManager.startEditingEntity('socket123', 'flow', 'flow_1');
    });

    it('should stop tracking entity editing', () => {
      const result = presenceManager.stopEditingEntity('socket123', 'flow', 'flow_1');

      expect(result).toBe(true);
      const userPresence = presenceManager.presenceByTenant.get(1).get(100);
      expect(userPresence.entities.has('flow:flow_1')).toBe(false);
    });

    it('should broadcast entity presence update', () => {
      mockIo.to.mockClear();
      mockIo.emit.mockClear();

      presenceManager.stopEditingEntity('socket123', 'flow', 'flow_1');

      expect(mockIo.emit).toHaveBeenCalledWith('presence:entity', expect.any(Object));
    });

    it('should return false for unknown socket', () => {
      const result = presenceManager.stopEditingEntity('unknown', 'flow', 'flow_1');

      expect(result).toBe(false);
    });
  });

  describe('getActiveUsers', () => {
    it('should return all active users in tenant', () => {
      presenceManager.trackUser(1, 100, { username: 'user1' }, 'socket1');
      presenceManager.trackUser(1, 101, { username: 'user2' }, 'socket2');

      const users = presenceManager.getActiveUsers(1);

      expect(users).toHaveLength(2);
      expect(users[0]).toHaveProperty('username');
      expect(users[0]).toHaveProperty('lastSeen');
      expect(users[0]).toHaveProperty('connectedAt');
    });

    it('should return empty array for unknown tenant', () => {
      const users = presenceManager.getActiveUsers(999);

      expect(users).toEqual([]);
    });

    it('should include editing entities', () => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');
      presenceManager.startEditingEntity('socket123', 'flow', 'flow_1');

      const users = presenceManager.getActiveUsers(1);

      expect(users[0].editingEntities).toHaveLength(1);
      expect(users[0].editingEntities[0].entityType).toBe('flow');
    });
  });

  describe('getUsersEditingEntity', () => {
    it('should return users editing specific entity', () => {
      presenceManager.trackUser(1, 100, { username: 'user1' }, 'socket1');
      presenceManager.trackUser(1, 101, { username: 'user2' }, 'socket2');
      presenceManager.startEditingEntity('socket1', 'flow', 'flow_1');

      const users = presenceManager.getUsersEditingEntity(1, 'flow', 'flow_1');

      expect(users).toHaveLength(1);
      expect(users[0].username).toBe('user1');
      expect(users[0]).toHaveProperty('startedEditingAt');
    });

    it('should return empty array if no users editing', () => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');

      const users = presenceManager.getUsersEditingEntity(1, 'flow', 'flow_1');

      expect(users).toEqual([]);
    });

    it('should return empty array for unknown tenant', () => {
      const users = presenceManager.getUsersEditingEntity(999, 'flow', 'flow_1');

      expect(users).toEqual([]);
    });
  });

  describe('broadcastPresence', () => {
    it('should emit to tenant room', () => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');
      mockIo.to.mockClear();
      mockIo.emit.mockClear();

      presenceManager.broadcastPresence(1);

      expect(mockIo.to).toHaveBeenCalledWith('tenant:1');
      expect(mockIo.emit).toHaveBeenCalledWith('presence:update', expect.objectContaining({
        tenantId: 1,
        users: expect.any(Array),
        timestamp: expect.any(Number)
      }));
    });

    it('should not emit if no io', () => {
      const pmNoIo = new PresenceManager(null);

      // Should not throw
      pmNoIo.broadcastPresence(1);

      pmNoIo.destroy();
    });
  });

  describe('broadcastEntityPresence', () => {
    it('should emit entity presence to tenant room', () => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');
      mockIo.to.mockClear();
      mockIo.emit.mockClear();

      presenceManager.broadcastEntityPresence(1, 'flow', 'flow_1');

      expect(mockIo.emit).toHaveBeenCalledWith('presence:entity', expect.objectContaining({
        tenantId: 1,
        entityType: 'flow',
        entityId: 'flow_1',
        users: expect.any(Array)
      }));
    });
  });

  describe('cleanupStaleUsers', () => {
    it('should remove users with old lastSeen', () => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');

      // Manually set lastSeen to old value
      presenceManager.presenceByTenant.get(1).get(100).lastSeen = Date.now() - 60000;

      presenceManager.cleanupStaleUsers();

      expect(presenceManager.presenceByTenant.has(1)).toBe(false);
    });

    it('should keep users with recent lastSeen', () => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');

      presenceManager.cleanupStaleUsers();

      expect(presenceManager.presenceByTenant.has(1)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return presence statistics', () => {
      presenceManager.trackUser(1, 100, { username: 'test1' }, 'socket1');
      presenceManager.trackUser(1, 101, { username: 'test2' }, 'socket2');
      presenceManager.trackUser(2, 200, { username: 'test3' }, 'socket3');

      const stats = presenceManager.getStats();

      expect(stats.totalUsers).toBe(3);
      expect(stats.totalTenants).toBe(2);
      expect(stats.timestamp).toBeDefined();
    });

    it('should return zero stats when empty', () => {
      const stats = presenceManager.getStats();

      expect(stats.totalUsers).toBe(0);
      expect(stats.totalTenants).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clear all data', () => {
      presenceManager.trackUser(1, 100, { username: 'test' }, 'socket123');

      presenceManager.destroy();

      expect(presenceManager.presenceByTenant.size).toBe(0);
      expect(presenceManager.socketToUser.size).toBe(0);
    });
  });

  describe('getPresenceManager', () => {
    it('should return singleton instance', () => {
      const pm1 = getPresenceManager(mockIo);
      const pm2 = getPresenceManager();

      expect(pm2).toBe(pm1);
    });
  });
});
