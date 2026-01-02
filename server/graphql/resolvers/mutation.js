/**
 * @fileoverview GraphQL Mutation Resolvers
 * @description Resolvers for all GraphQL mutations
 * @module graphql/resolvers/mutation
 */

const db = require('../../db');
const crypto = require('crypto');
const log = require('../../utils/logger');

const Mutation = {
  // ==========================================
  // BOT MUTATIONS
  // ==========================================
  createBot: async (_, { input }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      const {
        name,
        description,
        type,
        aiProvider,
        aiModel,
        systemPrompt,
        welcomeMessage
      } = input;

      if (!name || name.trim() === '') {
        throw new Error('Bot name is required');
      }

      const result = await db.query(
        `INSERT INTO bots (
          name, description, type, ai_provider, ai_model,
          system_prompt, welcome_message, user_id, organization_id,
          status, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          name.trim(),
          description || null,
          type || 'chatbot',
          aiProvider || 'openai',
          aiModel || 'gpt-3.5-turbo',
          systemPrompt || null,
          welcomeMessage || null,
          user.id,
          organizationId
        ]
      );

      const bot = result.rows[0];

      log.info('[GRAPHQL] Bot created', { botId: bot.id, userId: user.id });

      return {
        id: bot.id,
        name: bot.name,
        description: bot.description,
        status: bot.status,
        type: bot.type,
        aiProvider: bot.ai_provider,
        aiModel: bot.ai_model,
        systemPrompt: bot.system_prompt,
        welcomeMessage: bot.welcome_message,
        isActive: bot.is_active,
        createdAt: bot.created_at,
        updatedAt: bot.updated_at
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in createBot:', { error: error.message });
      throw error;
    }
  },

  updateBot: async (_, { id, input }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      // Verify ownership
      const botCheck = await db.query(
        'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
        [id, organizationId]
      );

      if (botCheck.rows.length === 0) {
        throw new Error('Bot not found');
      }

      // Build update query
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (input.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(input.name);
      }
      if (input.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(input.description);
      }
      if (input.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(input.status);
      }
      if (input.aiProvider !== undefined) {
        updates.push(`ai_provider = $${paramCount++}`);
        values.push(input.aiProvider);
      }
      if (input.aiModel !== undefined) {
        updates.push(`ai_model = $${paramCount++}`);
        values.push(input.aiModel);
      }
      if (input.systemPrompt !== undefined) {
        updates.push(`system_prompt = $${paramCount++}`);
        values.push(input.systemPrompt);
      }
      if (input.welcomeMessage !== undefined) {
        updates.push(`welcome_message = $${paramCount++}`);
        values.push(input.welcomeMessage);
      }
      if (input.isActive !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(input.isActive);
      }

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await db.query(
        `UPDATE bots SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      const bot = result.rows[0];

      log.info('[GRAPHQL] Bot updated', { botId: id, userId: user.id });

      return {
        id: bot.id,
        name: bot.name,
        description: bot.description,
        status: bot.status,
        type: bot.type,
        aiProvider: bot.ai_provider,
        aiModel: bot.ai_model,
        systemPrompt: bot.system_prompt,
        welcomeMessage: bot.welcome_message,
        isActive: bot.is_active,
        createdAt: bot.created_at,
        updatedAt: bot.updated_at
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in updateBot:', { error: error.message });
      throw error;
    }
  },

  deleteBot: async (_, { id }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      // Verify ownership
      const botCheck = await db.query(
        'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
        [id, organizationId]
      );

      if (botCheck.rows.length === 0) {
        throw new Error('Bot not found');
      }

      await db.query('DELETE FROM bots WHERE id = $1', [id]);

      log.info('[GRAPHQL] Bot deleted', { botId: id, userId: user.id });

      return true;
    } catch (error) {
      log.error('[GRAPHQL] Error in deleteBot:', { error: error.message });
      throw error;
    }
  },

  // ==========================================
  // MESSAGE MUTATIONS
  // ==========================================
  sendMessage: async (_, { botId, message, conversationId }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      // Verify bot ownership
      const botCheck = await db.query(
        'SELECT id, name FROM bots WHERE id = $1 AND organization_id = $2',
        [botId, organizationId]
      );

      if (botCheck.rows.length === 0) {
        throw new Error('Bot not found');
      }

      // Generate conversation ID if not provided
      const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insert user message
      const result = await db.query(
        `INSERT INTO messages (bot_id, conversation_id, role, content, session_id, created_at)
         VALUES ($1, $2, 'user', $3, $4, CURRENT_TIMESTAMP)
         RETURNING id, bot_id, conversation_id, role, content, created_at`,
        [botId, convId, message, `session_${user.id}`]
      );

      const msg = result.rows[0];

      log.info('[GRAPHQL] Message sent', { botId, conversationId: convId, userId: user.id });

      return {
        id: msg.id,
        botId: msg.bot_id,
        conversationId: msg.conversation_id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.created_at
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in sendMessage:', { error: error.message });
      throw error;
    }
  },

  // ==========================================
  // API TOKEN MUTATIONS
  // ==========================================
  createAPIToken: async (_, { input }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      const { name, expiresInDays, botId } = input;

      if (!name || name.trim() === '') {
        throw new Error('Token name is required');
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const tokenPreview = token.substring(0, 8) + '...' + token.substring(token.length - 4);

      // Calculate expiration
      let expiresAt = null;
      if (expiresInDays && expiresInDays > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      }

      const result = await db.query(
        `INSERT INTO api_tokens (
          user_id, organization_id, bot_id, token_name, token_hash, token_preview,
          expires_at, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, token_name, token_preview, is_active, expires_at, created_at`,
        [user.id, organizationId, botId || null, name.trim(), tokenHash, tokenPreview, expiresAt]
      );

      const apiToken = result.rows[0];

      log.info('[GRAPHQL] API Token created', { tokenId: apiToken.id, userId: user.id });

      return {
        id: apiToken.id,
        name: apiToken.token_name,
        preview: apiToken.token_preview,
        token: token, // Only returned once!
        isActive: apiToken.is_active,
        expiresAt: apiToken.expires_at,
        createdAt: apiToken.created_at
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in createAPIToken:', { error: error.message });
      throw error;
    }
  },

  deleteAPIToken: async (_, { id }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      const result = await db.query(
        'DELETE FROM api_tokens WHERE id = $1 AND organization_id = $2 RETURNING id',
        [id, organizationId]
      );

      if (result.rows.length === 0) {
        throw new Error('API Token not found');
      }

      log.info('[GRAPHQL] API Token deleted', { tokenId: id, userId: user.id });

      return true;
    } catch (error) {
      log.error('[GRAPHQL] Error in deleteAPIToken:', { error: error.message });
      throw error;
    }
  },

  toggleAPIToken: async (_, { id }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      const tokenCheck = await db.query(
        'SELECT id, is_active FROM api_tokens WHERE id = $1 AND organization_id = $2',
        [id, organizationId]
      );

      if (tokenCheck.rows.length === 0) {
        throw new Error('API Token not found');
      }

      const newStatus = !tokenCheck.rows[0].is_active;

      const result = await db.query(
        `UPDATE api_tokens SET is_active = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, token_name, token_preview, is_active, expires_at, last_used_at, created_at`,
        [newStatus, id]
      );

      const token = result.rows[0];

      log.info('[GRAPHQL] API Token toggled', { tokenId: id, newStatus, userId: user.id });

      return {
        id: token.id,
        name: token.token_name,
        preview: token.token_preview,
        isActive: token.is_active,
        expiresAt: token.expires_at,
        lastUsedAt: token.last_used_at,
        createdAt: token.created_at
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in toggleAPIToken:', { error: error.message });
      throw error;
    }
  },

  // ==========================================
  // ORGANIZATION MUTATIONS
  // ==========================================
  switchOrganization: async (_, { organizationId }, { user }) => {
    if (!user) throw new Error('Authentication required');

    try {
      // Verify membership
      const memberCheck = await db.query(
        `SELECT om.org_id FROM organization_members om
         WHERE om.user_id = $1 AND om.org_id = $2 AND om.status = 'active'`,
        [user.id, organizationId]
      );

      if (memberCheck.rows.length === 0) {
        throw new Error('Not a member of this organization');
      }

      // Get user data with new organization
      const result = await db.query(
        `SELECT id, name, email, email_verified, created_at, updated_at
         FROM users WHERE id = $1`,
        [user.id]
      );

      const userData = result.rows[0];

      log.info('[GRAPHQL] Organization switched', { userId: user.id, newOrgId: organizationId });

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: userData.email_verified,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in switchOrganization:', { error: error.message });
      throw error;
    }
  }
};

module.exports = Mutation;
