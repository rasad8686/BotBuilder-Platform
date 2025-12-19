/**
 * SCIM Service
 * Handles SCIM 2.0 User Provisioning (RFC 7643, RFC 7644)
 */

const crypto = require('crypto');
const db = require('../db');
const log = require('../utils/logger');

class SCIMService {
  /**
   * Generate SCIM token for IdP provisioning
   */
  static async generateToken(configId, name, expiresInDays = null) {
    try {
      const token = `scim_${crypto.randomBytes(32).toString('hex')}`;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const tokenPrefix = token.substring(0, 8); // Match DB column size (8 chars)

      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const result = await db.query(
        `INSERT INTO scim_tokens (sso_configuration_id, name, token_hash, token_prefix, expires_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [configId, name, tokenHash, tokenPrefix, expiresAt]
      );

      const tokenInfo = result.rows[0];

      log.info('SCIM token generated', { configId, tokenId: tokenInfo.id });

      return {
        token,
        tokenInfo: {
          id: tokenInfo.id,
          name: tokenInfo.name,
          token_prefix: tokenInfo.token_prefix,
          created_at: tokenInfo.created_at,
          expires_at: tokenInfo.expires_at
        }
      };
    } catch (error) {
      log.error('Error generating SCIM token:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Validate SCIM token
   */
  static async validateToken(token) {
    try {
      if (!token || !token.startsWith('scim_')) {
        return null;
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const tokenResult = await db.query(
        'SELECT * FROM scim_tokens WHERE token_hash = $1 AND is_active = true',
        [tokenHash]
      );

      const tokenRecord = tokenResult.rows[0];

      if (!tokenRecord) {
        return null;
      }

      if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
        return null;
      }

      await db.query(
        'UPDATE scim_tokens SET last_used_at = NOW() WHERE id = $1',
        [tokenRecord.id]
      );

      const configResult = await db.query(
        'SELECT * FROM sso_configurations WHERE id = $1',
        [tokenRecord.sso_configuration_id]
      );

      return configResult.rows[0] || null;
    } catch (error) {
      log.error('Error validating SCIM token:', { error: error.message });
      return null;
    }
  }

  /**
   * Revoke SCIM token
   */
  static async revokeToken(configId, tokenId) {
    try {
      await db.query(
        'UPDATE scim_tokens SET is_active = false WHERE id = $1 AND sso_configuration_id = $2',
        [tokenId, configId]
      );

      log.info('SCIM token revoked', { configId, tokenId });

      return { success: true };
    } catch (error) {
      log.error('Error revoking SCIM token:', { error: error.message });
      throw error;
    }
  }

  /**
   * List SCIM tokens for configuration
   */
  static async listTokens(configId) {
    try {
      const result = await db.query(
        'SELECT id, name, token_prefix, is_active, last_used_at, expires_at, created_at FROM scim_tokens WHERE sso_configuration_id = $1 ORDER BY created_at DESC',
        [configId]
      );
      return result.rows;
    } catch (error) {
      log.error('Error listing SCIM tokens:', { error: error.message });
      throw error;
    }
  }

  /**
   * Create user via SCIM
   */
  static async createUser(configId, scimUser) {
    try {
      const configResult = await db.query(
        'SELECT * FROM sso_configurations WHERE id = $1',
        [configId]
      );
      const config = configResult.rows[0];

      if (!config) {
        throw new Error('SSO configuration not found');
      }

      const email = this.extractEmail(scimUser);
      const name = this.extractName(scimUser);
      const externalId = scimUser.externalId || scimUser.id || email;

      if (!email) {
        throw new Error('Email is required');
      }

      const existingResult = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      let user = existingResult.rows[0];

      if (user) {
        await this.updateUserMapping(configId, user.id, externalId, scimUser);
        await this.logSync(configId, 'CREATE', 'User', externalId, user.id, 'skipped', 'User already exists');
        return this.toSCIMUser(user, externalId);
      }

      const userResult = await db.query(
        `INSERT INTO users (email, name, password_hash, email_verified, organization_id, created_at, updated_at)
         VALUES ($1, $2, null, true, $3, NOW(), NOW()) RETURNING *`,
        [email.toLowerCase(), name, config.organization_id]
      );
      user = userResult.rows[0];

      const defaultRoleId = config.default_role_id || 2;
      await db.query(
        `INSERT INTO team_members (tenant_id, user_id, role_id, status, joined_at)
         VALUES ($1, $2, $3, 'active', NOW())
         ON CONFLICT (tenant_id, user_id) DO NOTHING`,
        [config.organization_id, user.id, defaultRoleId]
      );

      await this.updateUserMapping(configId, user.id, externalId, scimUser);
      await this.logSync(configId, 'CREATE', 'User', externalId, user.id, 'success');

      log.info('SCIM user created', { configId, userId: user.id, email });

      return this.toSCIMUser(user, externalId);
    } catch (error) {
      log.error('Error creating SCIM user:', { error: error.message, configId });
      await this.logSync(configId, 'CREATE', 'User', scimUser.externalId, null, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Get user via SCIM
   */
  static async getUser(configId, id) {
    try {
      const mappingResult = await db.query(
        'SELECT * FROM sso_user_mappings WHERE sso_configuration_id = $1 AND (external_id = $2 OR user_id::text = $2)',
        [configId, id]
      );

      const mapping = mappingResult.rows[0];
      if (!mapping) {
        return null;
      }

      const userResult = await db.query('SELECT * FROM users WHERE id = $1', [mapping.user_id]);
      const user = userResult.rows[0];

      if (!user) {
        return null;
      }

      return this.toSCIMUser(user, mapping.external_id);
    } catch (error) {
      log.error('Error getting SCIM user:', { error: error.message, configId, id });
      throw error;
    }
  }

  /**
   * Update user via SCIM
   */
  static async updateUser(configId, id, scimUser) {
    try {
      const mappingResult = await db.query(
        'SELECT * FROM sso_user_mappings WHERE sso_configuration_id = $1 AND external_id = $2',
        [configId, id]
      );

      const mapping = mappingResult.rows[0];
      if (!mapping) {
        throw new Error('User not found');
      }

      const name = this.extractName(scimUser);
      if (name) {
        await db.query('UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2', [name, mapping.user_id]);
      }

      if (scimUser.active === false) {
        await db.query("UPDATE team_members SET status = 'inactive' WHERE user_id = $1", [mapping.user_id]);
      } else if (scimUser.active === true) {
        await db.query("UPDATE team_members SET status = 'active' WHERE user_id = $1", [mapping.user_id]);
      }

      await this.updateUserMapping(configId, mapping.user_id, id, scimUser);
      await this.logSync(configId, 'UPDATE', 'User', id, mapping.user_id, 'success');

      const userResult = await db.query('SELECT * FROM users WHERE id = $1', [mapping.user_id]);
      return this.toSCIMUser(userResult.rows[0], id);
    } catch (error) {
      log.error('Error updating SCIM user:', { error: error.message, configId, id });
      await this.logSync(configId, 'UPDATE', 'User', id, null, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Delete/Deprovision user via SCIM
   */
  static async deleteUser(configId, id) {
    try {
      const configResult = await db.query('SELECT * FROM sso_configurations WHERE id = $1', [configId]);
      const config = configResult.rows[0];

      const mappingResult = await db.query(
        'SELECT * FROM sso_user_mappings WHERE sso_configuration_id = $1 AND external_id = $2',
        [configId, id]
      );

      const mapping = mappingResult.rows[0];
      if (!mapping) {
        throw new Error('User not found');
      }

      if (config.auto_deprovision_users) {
        await db.query(
          'DELETE FROM team_members WHERE user_id = $1 AND tenant_id = $2',
          [mapping.user_id, config.organization_id]
        );
        await db.query('DELETE FROM sso_user_mappings WHERE id = $1', [mapping.id]);
      } else {
        await db.query(
          "UPDATE team_members SET status = 'inactive' WHERE user_id = $1 AND tenant_id = $2",
          [mapping.user_id, config.organization_id]
        );
      }

      await this.logSync(configId, 'DELETE', 'User', id, mapping.user_id, 'success');

      log.info('SCIM user deleted/deprovisioned', { configId, userId: mapping.user_id });

      return { success: true };
    } catch (error) {
      log.error('Error deleting SCIM user:', { error: error.message, configId, id });
      await this.logSync(configId, 'DELETE', 'User', id, null, 'failed', error.message);
      throw error;
    }
  }

  /**
   * List users via SCIM
   */
  static async listUsers(configId, options = {}) {
    try {
      const { filter, startIndex = 1, count = 100 } = options;

      let queryBase = `
        FROM users u
        JOIN sso_user_mappings m ON u.id = m.user_id
        WHERE m.sso_configuration_id = $1
      `;
      const params = [configId];
      let paramIndex = 2;

      if (filter) {
        const emailMatch = filter.match(/userName eq "([^"]+)"/i);
        if (emailMatch) {
          queryBase += ` AND u.email = $${paramIndex}`;
          params.push(emailMatch[1].toLowerCase());
          paramIndex++;
        }

        const externalIdMatch = filter.match(/externalId eq "([^"]+)"/i);
        if (externalIdMatch) {
          queryBase += ` AND m.external_id = $${paramIndex}`;
          params.push(externalIdMatch[1]);
          paramIndex++;
        }
      }

      const countResult = await db.query(`SELECT COUNT(*) as count ${queryBase}`, params);
      const totalResults = parseInt(countResult.rows[0].count);

      const usersResult = await db.query(
        `SELECT u.*, m.external_id ${queryBase} ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, count, startIndex - 1]
      );

      return {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults,
        startIndex,
        itemsPerPage: usersResult.rows.length,
        Resources: usersResult.rows.map(u => this.toSCIMUser(u, u.external_id))
      };
    } catch (error) {
      log.error('Error listing SCIM users:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Update user mapping
   */
  static async updateUserMapping(configId, userId, externalId, scimUser) {
    const existingResult = await db.query(
      'SELECT * FROM sso_user_mappings WHERE sso_configuration_id = $1 AND user_id = $2',
      [configId, userId]
    );

    const attributes = JSON.stringify({
      emails: scimUser.emails,
      name: scimUser.name,
      groups: scimUser.groups,
      roles: scimUser.roles,
      ...scimUser
    });

    if (existingResult.rows.length > 0) {
      await db.query(
        'UPDATE sso_user_mappings SET external_id = $1, attributes = $2, updated_at = NOW() WHERE id = $3',
        [externalId, attributes, existingResult.rows[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO sso_user_mappings (sso_configuration_id, user_id, external_id, email, attributes)
         VALUES ($1, $2, $3, $4, $5)`,
        [configId, userId, externalId, this.extractEmail(scimUser), attributes]
      );
    }
  }

  /**
   * Log SCIM sync operation
   */
  static async logSync(configId, operation, resourceType, externalId, userId, status, errorMessage = null) {
    try {
      await db.query(
        `INSERT INTO scim_sync_logs (sso_configuration_id, operation, resource_type, external_id, user_id, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [configId, operation, resourceType, externalId, userId, status, errorMessage]
      );
    } catch (error) {
      log.error('Error logging SCIM sync:', { error: error.message });
    }
  }

  /**
   * Get SCIM sync logs
   */
  static async getSyncLogs(configId, options = {}) {
    try {
      const { page = 1, limit = 50, operation, status } = options;
      const offset = (page - 1) * limit;

      let queryBase = 'FROM scim_sync_logs WHERE sso_configuration_id = $1';
      const params = [configId];
      let paramIndex = 2;

      if (operation) {
        queryBase += ` AND operation = $${paramIndex}`;
        params.push(operation);
        paramIndex++;
      }
      if (status) {
        queryBase += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      const countResult = await db.query(`SELECT COUNT(*) as count ${queryBase}`, params);
      const logsResult = await db.query(
        `SELECT * ${queryBase} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      return {
        logs: logsResult.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        limit
      };
    } catch (error) {
      log.error('Error getting SCIM sync logs:', { error: error.message });
      throw error;
    }
  }

  /**
   * Extract email from SCIM user
   */
  static extractEmail(scimUser) {
    if (scimUser.userName) {
      return scimUser.userName;
    }
    if (scimUser.emails && scimUser.emails.length > 0) {
      const primary = scimUser.emails.find(e => e.primary) || scimUser.emails[0];
      return primary.value || primary;
    }
    return null;
  }

  /**
   * Extract name from SCIM user
   */
  static extractName(scimUser) {
    if (scimUser.displayName) {
      return scimUser.displayName;
    }
    if (scimUser.name) {
      const parts = [];
      if (scimUser.name.givenName) parts.push(scimUser.name.givenName);
      if (scimUser.name.familyName) parts.push(scimUser.name.familyName);
      if (parts.length > 0) return parts.join(' ');
      if (scimUser.name.formatted) return scimUser.name.formatted;
    }
    return this.extractEmail(scimUser)?.split('@')[0] || 'Unknown';
  }

  /**
   * Convert user to SCIM format
   */
  static toSCIMUser(user, externalId) {
    const nameParts = (user.name || '').split(' ');

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: externalId || user.id.toString(),
      externalId: externalId,
      userName: user.email,
      name: {
        formatted: user.name,
        givenName: nameParts[0] || '',
        familyName: nameParts.slice(1).join(' ') || ''
      },
      displayName: user.name,
      emails: [{ value: user.email, primary: true, type: 'work' }],
      active: true,
      meta: {
        resourceType: 'User',
        created: user.created_at,
        lastModified: user.updated_at,
        location: `/scim/v2/Users/${externalId || user.id}`
      }
    };
  }

  // ==================== GROUPS ====================

  /**
   * List groups via SCIM
   */
  static async listGroups(configId, options = {}) {
    try {
      const { filter, startIndex = 1, count = 100 } = options;

      let queryBase = 'FROM sso_group_mappings WHERE sso_configuration_id = $1';
      const params = [configId];
      let paramIndex = 2;

      if (filter) {
        const parsedFilter = this.parseScimFilter(filter);
        if (parsedFilter.displayName) {
          queryBase += ` AND external_group_name ILIKE $${paramIndex}`;
          params.push(`%${parsedFilter.displayName}%`);
          paramIndex++;
        }
        if (parsedFilter.id) {
          queryBase += ` AND external_group_id = $${paramIndex}`;
          params.push(parsedFilter.id);
          paramIndex++;
        }
      }

      const countResult = await db.query(`SELECT COUNT(*) as count ${queryBase}`, params);
      const groupsResult = await db.query(
        `SELECT * ${queryBase} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, count, startIndex - 1]
      );

      const groupsWithMembers = await Promise.all(
        groupsResult.rows.map(async (g) => this.toSCIMGroup(g, configId))
      );

      return {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: parseInt(countResult.rows[0].count),
        startIndex,
        itemsPerPage: groupsResult.rows.length,
        Resources: groupsWithMembers
      };
    } catch (error) {
      log.error('Error listing SCIM groups:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Get group via SCIM
   */
  static async getGroup(configId, id) {
    try {
      const result = await db.query(
        'SELECT * FROM sso_group_mappings WHERE sso_configuration_id = $1 AND external_group_id = $2',
        [configId, id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.toSCIMGroup(result.rows[0], configId);
    } catch (error) {
      log.error('Error getting SCIM group:', { error: error.message, configId, id });
      throw error;
    }
  }

  /**
   * Create group via SCIM
   */
  static async createGroup(configId, scimGroup) {
    try {
      const configResult = await db.query('SELECT * FROM sso_configurations WHERE id = $1', [configId]);
      const config = configResult.rows[0];

      if (!config) {
        throw new Error('SSO configuration not found');
      }

      const displayName = scimGroup.displayName;
      const externalId = scimGroup.externalId || scimGroup.id || displayName;

      if (!displayName) {
        throw new Error('displayName is required');
      }

      const existingResult = await db.query(
        'SELECT * FROM sso_group_mappings WHERE sso_configuration_id = $1 AND external_group_id = $2',
        [configId, externalId]
      );

      if (existingResult.rows.length > 0) {
        throw new Error('Group already exists');
      }

      const defaultRoleId = config.default_role_id || 2;

      const groupResult = await db.query(
        `INSERT INTO sso_group_mappings (sso_configuration_id, external_group_id, external_group_name, role_id, is_default, priority)
         VALUES ($1, $2, $3, $4, false, 0) RETURNING *`,
        [configId, externalId, displayName, defaultRoleId]
      );

      if (scimGroup.members && scimGroup.members.length > 0) {
        await this.syncGroupMembers(configId, externalId, scimGroup.members);
      }

      await this.logSync(configId, 'CREATE', 'Group', externalId, null, 'success');

      log.info('SCIM group created', { configId, groupId: externalId });

      return this.toSCIMGroup(groupResult.rows[0], configId);
    } catch (error) {
      log.error('Error creating SCIM group:', { error: error.message, configId });
      await this.logSync(configId, 'CREATE', 'Group', scimGroup.externalId, null, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Update group via SCIM
   */
  static async updateGroup(configId, id, scimGroup) {
    try {
      const groupResult = await db.query(
        'SELECT * FROM sso_group_mappings WHERE sso_configuration_id = $1 AND external_group_id = $2',
        [configId, id]
      );

      if (groupResult.rows.length === 0) {
        throw new Error('Group not found');
      }

      const group = groupResult.rows[0];

      if (scimGroup.displayName) {
        await db.query(
          'UPDATE sso_group_mappings SET external_group_name = $1, updated_at = NOW() WHERE id = $2',
          [scimGroup.displayName, group.id]
        );
      }

      if (scimGroup.members !== undefined) {
        await this.syncGroupMembers(configId, id, scimGroup.members || []);
      }

      await this.logSync(configId, 'UPDATE', 'Group', id, null, 'success');

      const updatedResult = await db.query('SELECT * FROM sso_group_mappings WHERE id = $1', [group.id]);
      return this.toSCIMGroup(updatedResult.rows[0], configId);
    } catch (error) {
      log.error('Error updating SCIM group:', { error: error.message, configId, id });
      await this.logSync(configId, 'UPDATE', 'Group', id, null, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Delete group via SCIM
   */
  static async deleteGroup(configId, id) {
    try {
      const groupResult = await db.query(
        'SELECT * FROM sso_group_mappings WHERE sso_configuration_id = $1 AND external_group_id = $2',
        [configId, id]
      );

      if (groupResult.rows.length === 0) {
        throw new Error('Group not found');
      }

      await db.query('DELETE FROM sso_group_mappings WHERE id = $1', [groupResult.rows[0].id]);

      await this.logSync(configId, 'DELETE', 'Group', id, null, 'success');

      log.info('SCIM group deleted', { configId, groupId: id });

      return { success: true };
    } catch (error) {
      log.error('Error deleting SCIM group:', { error: error.message, configId, id });
      await this.logSync(configId, 'DELETE', 'Group', id, null, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Sync group members
   */
  static async syncGroupMembers(configId, groupId, members) {
    try {
      const groupResult = await db.query(
        'SELECT * FROM sso_group_mappings WHERE sso_configuration_id = $1 AND external_group_id = $2',
        [configId, groupId]
      );

      const group = groupResult.rows[0];
      if (!group) return;

      for (const member of members) {
        const mappingResult = await db.query(
          'SELECT * FROM sso_user_mappings WHERE sso_configuration_id = $1 AND external_id = $2',
          [configId, member.value]
        );

        if (mappingResult.rows.length > 0) {
          await db.query(
            'UPDATE team_members SET role_id = $1 WHERE user_id = $2',
            [group.role_id, mappingResult.rows[0].user_id]
          );
        }
      }
    } catch (error) {
      log.error('Error syncing group members:', { error: error.message });
    }
  }

  /**
   * Convert group to SCIM format
   */
  static async toSCIMGroup(group, configId) {
    const membersResult = await db.query(
      `SELECT m.external_id, u.name, u.email
       FROM sso_user_mappings m
       JOIN users u ON u.id = m.user_id
       JOIN team_members tm ON tm.user_id = u.id
       WHERE m.sso_configuration_id = $1 AND tm.role_id = $2`,
      [configId, group.role_id]
    );

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: group.external_group_id,
      externalId: group.external_group_id,
      displayName: group.external_group_name,
      members: membersResult.rows.map(m => ({
        value: m.external_id,
        display: m.name,
        $ref: `/scim/v2/Users/${m.external_id}`
      })),
      meta: {
        resourceType: 'Group',
        created: group.created_at,
        lastModified: group.updated_at || group.created_at,
        location: `/scim/v2/Groups/${group.external_group_id}`
      }
    };
  }

  // ==================== FILTER PARSING ====================

  static parseScimFilter(filter) {
    const result = {};
    if (!filter) return result;

    const eqMatches = filter.matchAll(/(\w+)\s+eq\s+"([^"]+)"/gi);
    for (const match of eqMatches) {
      result[match[1]] = match[2];
    }

    const coMatches = filter.matchAll(/(\w+)\s+co\s+"([^"]+)"/gi);
    for (const match of coMatches) {
      result[`${match[1]}_contains`] = match[2];
    }

    const swMatches = filter.matchAll(/(\w+)\s+sw\s+"([^"]+)"/gi);
    for (const match of swMatches) {
      result[`${match[1]}_startsWith`] = match[2];
    }

    const nestedMatches = filter.matchAll(/(\w+)\.(\w+)\s+eq\s+"([^"]+)"/gi);
    for (const match of nestedMatches) {
      result[`${match[1]}_${match[2]}`] = match[3];
    }

    return result;
  }

  static validateScimRequest(data, resourceType) {
    const errors = [];

    if (resourceType === 'User') {
      if (!data.userName && (!data.emails || data.emails.length === 0)) {
        errors.push('userName or emails is required');
      }
    } else if (resourceType === 'Group') {
      if (!data.displayName) {
        errors.push('displayName is required');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  static generateScimError(status, detail, scimType = null) {
    const error = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: status.toString(),
      detail
    };

    if (scimType) {
      error.scimType = scimType;
    }

    return error;
  }

  static getServiceProviderConfig() {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      documentationUri: 'https://docs.botbuilder.com/scim',
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Authentication using bearer token',
          specUri: 'https://tools.ietf.org/html/rfc6750',
          primary: true
        }
      ]
    };
  }

  static getResourceTypes() {
    return [
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        description: 'User Account',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
        schemaExtensions: []
      }
    ];
  }

  static getSchemas() {
    return [
      {
        id: 'urn:ietf:params:scim:schemas:core:2.0:User',
        name: 'User',
        description: 'User Account',
        attributes: [
          { name: 'userName', type: 'string', required: true, uniqueness: 'server' },
          { name: 'name', type: 'complex', required: false },
          { name: 'displayName', type: 'string', required: false },
          { name: 'emails', type: 'complex', multiValued: true, required: false },
          { name: 'active', type: 'boolean', required: false }
        ]
      }
    ];
  }
}

module.exports = SCIMService;
