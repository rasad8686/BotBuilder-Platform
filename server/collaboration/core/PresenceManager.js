/**
 * PresenceManager - Real-time user presence tracking
 * Tracks which users are online and what entities they're editing
 */

class PresenceManager {
  constructor(io) {
    this.io = io;
    // Map of tenantId -> Map of oderId -> { user, socket, entities, lastSeen }
    this.presenceByTenant = new Map();
    // Map of socketId -> { oderId, tenantId }
    this.socketToUser = new Map();
    // Cleanup interval (remove stale users after 30 seconds of inactivity)
    this.cleanupInterval = setInterval(() => this.cleanupStaleUsers(), 30000);
  }

  /**
   * Track a user's presence
   */
  trackUser(tenantId, userId, userData, socketId) {
    if (!this.presenceByTenant.has(tenantId)) {
      this.presenceByTenant.set(tenantId, new Map());
    }

    const tenantPresence = this.presenceByTenant.get(tenantId);

    tenantPresence.set(userId, {
      user: {
        id: userId,
        username: userData.username,
        email: userData.email,
        avatar: userData.avatar
      },
      socketId,
      entities: new Map(), // entityKey -> { entityType, entityId, startedAt }
      lastSeen: Date.now(),
      connectedAt: tenantPresence.has(userId)
        ? tenantPresence.get(userId).connectedAt
        : Date.now()
    });

    this.socketToUser.set(socketId, { userId, tenantId });

    // Broadcast presence update to tenant
    this.broadcastPresence(tenantId);

    return true;
  }

  /**
   * Remove a user's presence
   */
  removeUser(socketId) {
    const userInfo = this.socketToUser.get(socketId);
    if (!userInfo) return false;

    const { userId, tenantId } = userInfo;
    const tenantPresence = this.presenceByTenant.get(tenantId);

    if (tenantPresence) {
      tenantPresence.delete(userId);

      // Clean up empty tenant
      if (tenantPresence.size === 0) {
        this.presenceByTenant.delete(tenantId);
      }
    }

    this.socketToUser.delete(socketId);

    // Broadcast presence update to tenant
    this.broadcastPresence(tenantId);

    return true;
  }

  /**
   * Update user's last seen timestamp
   */
  heartbeat(socketId) {
    const userInfo = this.socketToUser.get(socketId);
    if (!userInfo) return false;

    const { userId, tenantId } = userInfo;
    const tenantPresence = this.presenceByTenant.get(tenantId);

    if (tenantPresence && tenantPresence.has(userId)) {
      tenantPresence.get(userId).lastSeen = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Track user editing an entity
   */
  startEditingEntity(socketId, entityType, entityId) {
    const userInfo = this.socketToUser.get(socketId);
    if (!userInfo) return false;

    const { userId, tenantId } = userInfo;
    const tenantPresence = this.presenceByTenant.get(tenantId);

    if (tenantPresence && tenantPresence.has(userId)) {
      const userPresence = tenantPresence.get(userId);
      const entityKey = `${entityType}:${entityId}`;

      userPresence.entities.set(entityKey, {
        entityType,
        entityId,
        startedAt: Date.now()
      });

      // Broadcast entity editing update
      this.broadcastEntityPresence(tenantId, entityType, entityId);
      return true;
    }

    return false;
  }

  /**
   * Stop tracking user editing an entity
   */
  stopEditingEntity(socketId, entityType, entityId) {
    const userInfo = this.socketToUser.get(socketId);
    if (!userInfo) return false;

    const { userId, tenantId } = userInfo;
    const tenantPresence = this.presenceByTenant.get(tenantId);

    if (tenantPresence && tenantPresence.has(userId)) {
      const userPresence = tenantPresence.get(userId);
      const entityKey = `${entityType}:${entityId}`;

      userPresence.entities.delete(entityKey);

      // Broadcast entity editing update
      this.broadcastEntityPresence(tenantId, entityType, entityId);
      return true;
    }

    return false;
  }

  /**
   * Get all active users in a tenant
   */
  getActiveUsers(tenantId) {
    const tenantPresence = this.presenceByTenant.get(tenantId);
    if (!tenantPresence) return [];

    const users = [];
    for (const [userId, presence] of tenantPresence) {
      users.push({
        ...presence.user,
        lastSeen: presence.lastSeen,
        connectedAt: presence.connectedAt,
        editingEntities: Array.from(presence.entities.values())
      });
    }

    return users;
  }

  /**
   * Get users editing a specific entity
   */
  getUsersEditingEntity(tenantId, entityType, entityId) {
    const tenantPresence = this.presenceByTenant.get(tenantId);
    if (!tenantPresence) return [];

    const entityKey = `${entityType}:${entityId}`;
    const users = [];

    for (const [userId, presence] of tenantPresence) {
      if (presence.entities.has(entityKey)) {
        users.push({
          ...presence.user,
          startedEditingAt: presence.entities.get(entityKey).startedAt
        });
      }
    }

    return users;
  }

  /**
   * Broadcast presence update to all users in a tenant
   */
  broadcastPresence(tenantId) {
    if (!this.io) return;

    const activeUsers = this.getActiveUsers(tenantId);

    this.io.to(`tenant:${tenantId}`).emit('presence:update', {
      tenantId,
      users: activeUsers,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast entity presence update
   */
  broadcastEntityPresence(tenantId, entityType, entityId) {
    if (!this.io) return;

    const editingUsers = this.getUsersEditingEntity(tenantId, entityType, entityId);

    this.io.to(`tenant:${tenantId}`).emit('presence:entity', {
      tenantId,
      entityType,
      entityId,
      users: editingUsers,
      timestamp: Date.now()
    });
  }

  /**
   * Clean up stale users (no heartbeat for 30+ seconds)
   */
  cleanupStaleUsers() {
    const staleThreshold = Date.now() - 30000;

    for (const [tenantId, tenantPresence] of this.presenceByTenant) {
      const staleUsers = [];

      for (const [userId, presence] of tenantPresence) {
        if (presence.lastSeen < staleThreshold) {
          staleUsers.push(presence.socketId);
        }
      }

      // Remove stale users
      for (const socketId of staleUsers) {
        this.removeUser(socketId);
      }
    }
  }

  /**
   * Get presence stats
   */
  getStats() {
    let totalUsers = 0;
    let totalTenants = this.presenceByTenant.size;

    for (const tenantPresence of this.presenceByTenant.values()) {
      totalUsers += tenantPresence.size;
    }

    return {
      totalUsers,
      totalTenants,
      timestamp: Date.now()
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.presenceByTenant.clear();
    this.socketToUser.clear();
  }
}

// Singleton instance
let presenceManagerInstance = null;

function getPresenceManager(io) {
  if (!presenceManagerInstance && io) {
    presenceManagerInstance = new PresenceManager(io);
  }
  return presenceManagerInstance;
}

module.exports = {
  PresenceManager,
  getPresenceManager
};
