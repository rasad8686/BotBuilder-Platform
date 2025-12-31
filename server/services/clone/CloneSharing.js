/**
 * Clone Sharing Service
 * Handles sharing clones between users and organizations
 */

const db = require('../../db');
const log = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class CloneSharing {
  constructor() {
    this.shareTypes = ['view', 'use', 'edit', 'admin'];
    this.linkExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days default
  }

  /**
   * Share clone with specific user
   * @param {string} cloneId - Clone ID
   * @param {string} ownerId - Owner user ID
   * @param {string} targetUserId - User to share with
   * @param {Object} options - Share options
   * @returns {Promise<Object>} Share result
   */
  async shareWithUser(cloneId, ownerId, targetUserId, options = {}) {
    try {
      // Verify ownership
      const cloneResult = await db.query(
        `SELECT id, name, user_id FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, ownerId]
      );

      if (cloneResult.rows.length === 0) {
        return { success: false, error: 'Clone not found or not owned by you' };
      }

      // Check if already shared
      const existingShare = await db.query(
        `SELECT id FROM clone_shares WHERE clone_id = $1 AND shared_with_user_id = $2`,
        [cloneId, targetUserId]
      );

      if (existingShare.rows.length > 0) {
        // Update existing share
        await db.query(
          `UPDATE clone_shares SET
            permission_level = $1,
            can_train = $2,
            can_export = $3,
            expires_at = $4,
            updated_at = NOW()
          WHERE id = $5`,
          [
            options.permissionLevel || 'use',
            options.canTrain || false,
            options.canExport || false,
            options.expiresAt || null,
            existingShare.rows[0].id
          ]
        );

        return { success: true, shareId: existingShare.rows[0].id, updated: true };
      }

      // Create new share
      const result = await db.query(
        `INSERT INTO clone_shares (
          clone_id, shared_by_user_id, shared_with_user_id,
          permission_level, can_train, can_export, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          cloneId,
          ownerId,
          targetUserId,
          options.permissionLevel || 'use',
          options.canTrain || false,
          options.canExport || false,
          options.expiresAt || null
        ]
      );

      // Send notification (if notification service available)
      try {
        await this._notifyUser(targetUserId, {
          type: 'clone_shared',
          cloneName: cloneResult.rows[0].name,
          sharedBy: ownerId
        });
      } catch {
        // Notification is optional
      }

      return { success: true, share: result.rows[0] };
    } catch (error) {
      log.error('Error sharing clone with user', { error: error.message, cloneId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Share clone with organization
   * @param {string} cloneId - Clone ID
   * @param {string} ownerId - Owner user ID
   * @param {string} targetOrgId - Organization to share with
   * @param {Object} options - Share options
   * @returns {Promise<Object>} Share result
   */
  async shareWithOrganization(cloneId, ownerId, targetOrgId, options = {}) {
    try {
      // Verify ownership
      const cloneResult = await db.query(
        `SELECT id, name FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, ownerId]
      );

      if (cloneResult.rows.length === 0) {
        return { success: false, error: 'Clone not found or not owned by you' };
      }

      // Create organization share
      const result = await db.query(
        `INSERT INTO clone_shares (
          clone_id, shared_by_user_id, shared_with_org_id,
          permission_level, can_train, can_export, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (clone_id, shared_with_org_id)
        DO UPDATE SET
          permission_level = EXCLUDED.permission_level,
          can_train = EXCLUDED.can_train,
          can_export = EXCLUDED.can_export,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
        RETURNING *`,
        [
          cloneId,
          ownerId,
          targetOrgId,
          options.permissionLevel || 'use',
          options.canTrain || false,
          options.canExport || false,
          options.expiresAt || null
        ]
      );

      return { success: true, share: result.rows[0] };
    } catch (error) {
      log.error('Error sharing clone with organization', { error: error.message, cloneId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate shareable link
   * @param {string} cloneId - Clone ID
   * @param {string} ownerId - Owner user ID
   * @param {Object} options - Link options
   * @returns {Promise<Object>} Share link result
   */
  async generateShareLink(cloneId, ownerId, options = {}) {
    try {
      // Verify ownership
      const cloneResult = await db.query(
        `SELECT id, name FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, ownerId]
      );

      if (cloneResult.rows.length === 0) {
        return { success: false, error: 'Clone not found or not owned by you' };
      }

      // Generate unique token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = options.expiresAt || new Date(Date.now() + this.linkExpiry);

      // Store share link
      const result = await db.query(
        `INSERT INTO clone_share_links (
          clone_id, created_by_user_id, token,
          permission_level, max_uses, expires_at,
          password_hash, require_email
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          cloneId,
          ownerId,
          token,
          options.permissionLevel || 'view',
          options.maxUses || null,
          expiresAt,
          options.password ? this._hashPassword(options.password) : null,
          options.requireEmail || false
        ]
      );

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const shareUrl = `${baseUrl}/clones/shared/${token}`;

      return {
        success: true,
        shareLink: result.rows[0],
        url: shareUrl,
        token,
        expiresAt
      };
    } catch (error) {
      log.error('Error generating share link', { error: error.message, cloneId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Access clone via share link
   * @param {string} token - Share link token
   * @param {Object} accessInfo - Access information
   * @returns {Promise<Object>} Access result
   */
  async accessViaLink(token, accessInfo = {}) {
    try {
      // Find share link
      const linkResult = await db.query(
        `SELECT sl.*, wc.name as clone_name, wc.user_id as owner_id
         FROM clone_share_links sl
         JOIN work_clones wc ON wc.id = sl.clone_id
         WHERE sl.token = $1 AND sl.is_active = true`,
        [token]
      );

      if (linkResult.rows.length === 0) {
        return { success: false, error: 'Invalid or expired share link' };
      }

      const link = linkResult.rows[0];

      // Check expiration
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return { success: false, error: 'Share link has expired' };
      }

      // Check max uses
      if (link.max_uses && link.use_count >= link.max_uses) {
        return { success: false, error: 'Share link has reached maximum uses' };
      }

      // Check password
      if (link.password_hash && !this._verifyPassword(accessInfo.password, link.password_hash)) {
        return { success: false, error: 'Invalid password' };
      }

      // Check email requirement
      if (link.require_email && !accessInfo.email) {
        return { success: false, error: 'Email is required', requireEmail: true };
      }

      // Record access
      await db.query(
        `INSERT INTO clone_share_access_log (
          share_link_id, accessed_by_user_id, accessed_by_email, ip_address
        ) VALUES ($1, $2, $3, $4)`,
        [link.id, accessInfo.userId || null, accessInfo.email || null, accessInfo.ipAddress || null]
      );

      // Increment use count
      await db.query(
        `UPDATE clone_share_links SET use_count = use_count + 1 WHERE id = $1`,
        [link.id]
      );

      // Get clone data based on permission
      const clone = await this._getCloneForPermission(link.clone_id, link.permission_level);

      return {
        success: true,
        clone,
        permissionLevel: link.permission_level,
        cloneName: link.clone_name
      };
    } catch (error) {
      log.error('Error accessing via share link', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get clones shared with user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Shared clones
   */
  async getSharedWithMe(userId) {
    try {
      const result = await db.query(
        `SELECT wc.*, cs.permission_level, cs.can_train, cs.can_export,
                cs.shared_by_user_id, u.name as shared_by_name,
                cs.created_at as shared_at
         FROM clone_shares cs
         JOIN work_clones wc ON wc.id = cs.clone_id
         LEFT JOIN users u ON u.id = cs.shared_by_user_id
         WHERE cs.shared_with_user_id = $1
           AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
           AND cs.is_active = true
         ORDER BY cs.created_at DESC`,
        [userId]
      );

      return { success: true, clones: result.rows };
    } catch (error) {
      log.error('Error getting shared clones', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get shares for a clone
   * @param {string} cloneId - Clone ID
   * @param {string} ownerId - Owner user ID
   * @returns {Promise<Object>} Clone shares
   */
  async getCloneShares(cloneId, ownerId) {
    try {
      // Verify ownership
      const cloneCheck = await db.query(
        `SELECT id FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, ownerId]
      );

      if (cloneCheck.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      // Get user shares
      const userShares = await db.query(
        `SELECT cs.*, u.name as shared_with_name, u.email as shared_with_email
         FROM clone_shares cs
         LEFT JOIN users u ON u.id = cs.shared_with_user_id
         WHERE cs.clone_id = $1 AND cs.shared_with_user_id IS NOT NULL
         ORDER BY cs.created_at DESC`,
        [cloneId]
      );

      // Get organization shares
      const orgShares = await db.query(
        `SELECT cs.*, o.name as shared_with_org_name
         FROM clone_shares cs
         LEFT JOIN organizations o ON o.id = cs.shared_with_org_id
         WHERE cs.clone_id = $1 AND cs.shared_with_org_id IS NOT NULL
         ORDER BY cs.created_at DESC`,
        [cloneId]
      );

      // Get share links
      const shareLinks = await db.query(
        `SELECT * FROM clone_share_links
         WHERE clone_id = $1 AND is_active = true
         ORDER BY created_at DESC`,
        [cloneId]
      );

      return {
        success: true,
        userShares: userShares.rows,
        orgShares: orgShares.rows,
        shareLinks: shareLinks.rows.map(l => ({
          ...l,
          url: `${process.env.APP_URL || 'http://localhost:3000'}/clones/shared/${l.token}`
        }))
      };
    } catch (error) {
      log.error('Error getting clone shares', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Revoke share
   * @param {string} shareId - Share ID
   * @param {string} ownerId - Owner user ID
   * @returns {Promise<Object>} Revoke result
   */
  async revokeShare(shareId, ownerId) {
    try {
      const result = await db.query(
        `UPDATE clone_shares SET is_active = false, updated_at = NOW()
         WHERE id = $1 AND clone_id IN (
           SELECT id FROM work_clones WHERE user_id = $2
         )
         RETURNING *`,
        [shareId, ownerId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Share not found or not authorized' };
      }

      return { success: true, message: 'Share revoked successfully' };
    } catch (error) {
      log.error('Error revoking share', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Revoke share link
   * @param {string} linkId - Share link ID
   * @param {string} ownerId - Owner user ID
   * @returns {Promise<Object>} Revoke result
   */
  async revokeShareLink(linkId, ownerId) {
    try {
      const result = await db.query(
        `UPDATE clone_share_links SET is_active = false
         WHERE id = $1 AND clone_id IN (
           SELECT id FROM work_clones WHERE user_id = $2
         )
         RETURNING *`,
        [linkId, ownerId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Share link not found or not authorized' };
      }

      return { success: true, message: 'Share link revoked successfully' };
    } catch (error) {
      log.error('Error revoking share link', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Check user permission for clone
   * @param {string} cloneId - Clone ID
   * @param {string} userId - User ID
   * @param {string} requiredPermission - Required permission level
   * @returns {Promise<Object>} Permission check result
   */
  async checkPermission(cloneId, userId, requiredPermission = 'view') {
    try {
      // Check if owner
      const ownerCheck = await db.query(
        `SELECT id FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (ownerCheck.rows.length > 0) {
        return { success: true, hasPermission: true, level: 'owner' };
      }

      // Check direct share
      const shareCheck = await db.query(
        `SELECT permission_level FROM clone_shares
         WHERE clone_id = $1 AND shared_with_user_id = $2
           AND is_active = true
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [cloneId, userId]
      );

      if (shareCheck.rows.length > 0) {
        const level = shareCheck.rows[0].permission_level;
        const hasPermission = this._checkPermissionLevel(level, requiredPermission);
        return { success: true, hasPermission, level };
      }

      return { success: true, hasPermission: false };
    } catch (error) {
      log.error('Error checking permission', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Hash password for share link
   * @private
   */
  _hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Verify password for share link
   * @private
   */
  _verifyPassword(password, hash) {
    if (!password) return false;
    return this._hashPassword(password) === hash;
  }

  /**
   * Check if permission level satisfies requirement
   * @private
   */
  _checkPermissionLevel(actual, required) {
    const levels = { 'view': 1, 'use': 2, 'edit': 3, 'admin': 4 };
    return levels[actual] >= levels[required];
  }

  /**
   * Get clone data based on permission level
   * @private
   */
  async _getCloneForPermission(cloneId, permissionLevel) {
    const fields = permissionLevel === 'view'
      ? 'id, name, description, status, avatar_url'
      : '*';

    const result = await db.query(
      `SELECT ${fields} FROM work_clones WHERE id = $1`,
      [cloneId]
    );

    return result.rows[0];
  }

  /**
   * Send notification to user
   * @private
   */
  async _notifyUser(userId, notification) {
    // This would integrate with notification service
    log.info('Clone share notification', { userId, notification });
  }
}

module.exports = CloneSharing;
