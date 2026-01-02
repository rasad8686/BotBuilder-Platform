/**
 * @fileoverview GraphQL Query Resolvers
 * @description Resolvers for all GraphQL queries
 * @module graphql/resolvers/query
 */

const db = require('../../db');
const log = require('../../utils/logger');

const Query = {
  // ==========================================
  // USER QUERIES
  // ==========================================
  me: async (_, __, { user }) => {
    if (!user) return null;

    try {
      const result = await db.query(
        `SELECT id, name, email, email_verified, created_at, updated_at
         FROM users WHERE id = $1`,
        [user.id]
      );

      if (result.rows.length === 0) return null;

      const userData = result.rows[0];
      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: userData.email_verified,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in me query:', { error: error.message });
      throw error;
    }
  },

  user: async (_, { id }, { user }) => {
    if (!user) throw new Error('Authentication required');

    try {
      const result = await db.query(
        `SELECT id, name, email, email_verified, created_at, updated_at
         FROM users WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) return null;

      const userData = result.rows[0];
      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: userData.email_verified,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in user query:', { error: error.message });
      throw error;
    }
  },

  // ==========================================
  // BOT QUERIES
  // ==========================================
  bot: async (_, { id }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      const result = await db.query(
        `SELECT b.*, u.name as owner_name, u.email as owner_email
         FROM bots b
         LEFT JOIN users u ON b.user_id = u.id
         WHERE b.id = $1 AND b.organization_id = $2`,
        [id, organizationId]
      );

      if (result.rows.length === 0) return null;

      const bot = result.rows[0];
      return {
        id: bot.id,
        name: bot.name,
        description: bot.description,
        status: bot.status || 'active',
        type: bot.type,
        aiProvider: bot.ai_provider,
        aiModel: bot.ai_model,
        systemPrompt: bot.system_prompt,
        welcomeMessage: bot.welcome_message,
        isActive: bot.is_active !== false,
        createdAt: bot.created_at,
        updatedAt: bot.updated_at,
        owner: bot.owner_name ? {
          id: bot.user_id,
          name: bot.owner_name,
          email: bot.owner_email
        } : null
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in bot query:', { error: error.message });
      throw error;
    }
  },

  bots: async (_, { limit = 20, offset = 0, status }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      let whereClause = 'WHERE b.organization_id = $1';
      const params = [organizationId];

      if (status) {
        whereClause += ' AND b.status = $2';
        params.push(status);
      }

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) FROM bots b ${whereClause}`,
        params
      );
      const totalCount = parseInt(countResult.rows[0].count);

      // Get bots
      const result = await db.query(
        `SELECT b.*, u.name as owner_name, u.email as owner_email
         FROM bots b
         LEFT JOIN users u ON b.user_id = u.id
         ${whereClause}
         ORDER BY b.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      const nodes = result.rows.map(bot => ({
        id: bot.id,
        name: bot.name,
        description: bot.description,
        status: bot.status || 'active',
        type: bot.type,
        aiProvider: bot.ai_provider,
        aiModel: bot.ai_model,
        systemPrompt: bot.system_prompt,
        welcomeMessage: bot.welcome_message,
        isActive: bot.is_active !== false,
        createdAt: bot.created_at,
        updatedAt: bot.updated_at,
        owner: bot.owner_name ? {
          id: bot.user_id,
          name: bot.owner_name,
          email: bot.owner_email
        } : null
      }));

      return {
        nodes,
        totalCount,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: nodes.length > 0 ? String(nodes[0].id) : null,
          endCursor: nodes.length > 0 ? String(nodes[nodes.length - 1].id) : null
        }
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in bots query:', { error: error.message });
      throw error;
    }
  },

  // ==========================================
  // ANALYTICS QUERIES
  // ==========================================
  analytics: async (_, { botId, period }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      // Verify bot ownership
      const botCheck = await db.query(
        'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
        [botId, organizationId]
      );

      if (botCheck.rows.length === 0) {
        throw new Error('Bot not found');
      }

      // Calculate date range
      let intervalSql;
      switch (period) {
        case '24h':
          intervalSql = "NOW() - INTERVAL '24 hours'";
          break;
        case '7d':
          intervalSql = "NOW() - INTERVAL '7 days'";
          break;
        case '90d':
          intervalSql = "NOW() - INTERVAL '90 days'";
          break;
        case '30d':
        default:
          intervalSql = "NOW() - INTERVAL '30 days'";
          break;
      }

      // Get summary stats
      const summaryResult = await db.query(
        `SELECT
           COUNT(*) as total_messages,
           COUNT(DISTINCT conversation_id) as total_conversations,
           COUNT(DISTINCT session_id) as unique_users,
           AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as avg_response_time
         FROM messages
         WHERE bot_id = $1 AND created_at >= ${intervalSql}`,
        [botId]
      );

      const summary = summaryResult.rows[0] || {};

      // Get daily stats
      const dailyResult = await db.query(
        `SELECT
           DATE_TRUNC('day', created_at) as date,
           COUNT(*) as messages,
           COUNT(DISTINCT conversation_id) as conversations,
           COUNT(DISTINCT session_id) as unique_users
         FROM messages
         WHERE bot_id = $1 AND created_at >= ${intervalSql}
         GROUP BY DATE_TRUNC('day', created_at)
         ORDER BY date`,
        [botId]
      );

      return {
        botId,
        period,
        summary: {
          totalMessages: parseInt(summary.total_messages) || 0,
          totalConversations: parseInt(summary.total_conversations) || 0,
          uniqueUsers: parseInt(summary.unique_users) || 0,
          averageResponseTime: parseFloat(summary.avg_response_time) || 0,
          satisfactionScore: null,
          resolutionRate: null
        },
        dailyStats: dailyResult.rows.map(row => ({
          date: row.date.toISOString().split('T')[0],
          messages: parseInt(row.messages),
          conversations: parseInt(row.conversations),
          uniqueUsers: parseInt(row.unique_users)
        })),
        topIntents: [],
        responseTimeDistribution: []
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in analytics query:', { error: error.message });
      throw error;
    }
  },

  // ==========================================
  // MESSAGE QUERIES
  // ==========================================
  messages: async (_, { botId, limit = 50, offset = 0 }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      // Verify bot ownership
      const botCheck = await db.query(
        'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
        [botId, organizationId]
      );

      if (botCheck.rows.length === 0) {
        throw new Error('Bot not found');
      }

      const result = await db.query(
        `SELECT id, bot_id, conversation_id, role, content, metadata, created_at
         FROM messages
         WHERE bot_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [botId, limit, offset]
      );

      return result.rows.map(msg => ({
        id: msg.id,
        botId: msg.bot_id,
        conversationId: msg.conversation_id,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata,
        createdAt: msg.created_at
      }));
    } catch (error) {
      log.error('[GRAPHQL] Error in messages query:', { error: error.message });
      throw error;
    }
  },

  conversation: async (_, { id }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      const result = await db.query(
        `SELECT DISTINCT ON (m.conversation_id)
           m.conversation_id as id,
           m.bot_id,
           m.session_id,
           MIN(m.created_at) as created_at,
           MAX(m.created_at) as updated_at,
           COUNT(*) as message_count
         FROM messages m
         JOIN bots b ON m.bot_id = b.id
         WHERE m.conversation_id = $1 AND b.organization_id = $2
         GROUP BY m.conversation_id, m.bot_id, m.session_id`,
        [id, organizationId]
      );

      if (result.rows.length === 0) return null;

      const conv = result.rows[0];
      return {
        id: conv.id,
        botId: conv.bot_id,
        sessionId: conv.session_id,
        status: 'active',
        messageCount: parseInt(conv.message_count),
        createdAt: conv.created_at,
        updatedAt: conv.updated_at
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in conversation query:', { error: error.message });
      throw error;
    }
  },

  conversations: async (_, { botId, limit = 20, offset = 0 }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      // Verify bot ownership
      const botCheck = await db.query(
        'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
        [botId, organizationId]
      );

      if (botCheck.rows.length === 0) {
        throw new Error('Bot not found');
      }

      const result = await db.query(
        `SELECT
           conversation_id as id,
           bot_id,
           session_id,
           MIN(created_at) as created_at,
           MAX(created_at) as updated_at,
           COUNT(*) as message_count
         FROM messages
         WHERE bot_id = $1 AND conversation_id IS NOT NULL
         GROUP BY conversation_id, bot_id, session_id
         ORDER BY MAX(created_at) DESC
         LIMIT $2 OFFSET $3`,
        [botId, limit, offset]
      );

      return result.rows.map(conv => ({
        id: conv.id,
        botId: conv.bot_id,
        sessionId: conv.session_id,
        status: 'active',
        messageCount: parseInt(conv.message_count),
        createdAt: conv.created_at,
        updatedAt: conv.updated_at
      }));
    } catch (error) {
      log.error('[GRAPHQL] Error in conversations query:', { error: error.message });
      throw error;
    }
  },

  // ==========================================
  // API TOKEN QUERIES
  // ==========================================
  apiTokens: async (_, __, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      const result = await db.query(
        `SELECT id, token_name, token_preview, is_active, expires_at, last_used_at, created_at
         FROM api_tokens
         WHERE organization_id = $1
         ORDER BY created_at DESC`,
        [organizationId]
      );

      return result.rows.map(token => ({
        id: token.id,
        name: token.token_name,
        preview: token.token_preview,
        isActive: token.is_active,
        expiresAt: token.expires_at,
        lastUsedAt: token.last_used_at,
        createdAt: token.created_at,
        usage: {
          totalRequests: 0,
          totalTokens: 0,
          totalCost: 0
        }
      }));
    } catch (error) {
      log.error('[GRAPHQL] Error in apiTokens query:', { error: error.message });
      throw error;
    }
  },

  apiToken: async (_, { id }, { user, organizationId }) => {
    if (!user) throw new Error('Authentication required');

    try {
      const result = await db.query(
        `SELECT id, token_name, token_preview, is_active, expires_at, last_used_at, created_at
         FROM api_tokens
         WHERE id = $1 AND organization_id = $2`,
        [id, organizationId]
      );

      if (result.rows.length === 0) return null;

      const token = result.rows[0];
      return {
        id: token.id,
        name: token.token_name,
        preview: token.token_preview,
        isActive: token.is_active,
        expiresAt: token.expires_at,
        lastUsedAt: token.last_used_at,
        createdAt: token.created_at,
        usage: {
          totalRequests: 0,
          totalTokens: 0,
          totalCost: 0
        }
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in apiToken query:', { error: error.message });
      throw error;
    }
  },

  // ==========================================
  // ORGANIZATION QUERIES
  // ==========================================
  organization: async (_, { id }, { user }) => {
    if (!user) throw new Error('Authentication required');

    try {
      const result = await db.query(
        `SELECT o.*, u.name as owner_name, u.email as owner_email
         FROM organizations o
         LEFT JOIN users u ON o.owner_id = u.id
         WHERE o.id = $1`,
        [id]
      );

      if (result.rows.length === 0) return null;

      const org = result.rows[0];
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        planTier: org.plan_tier,
        owner: org.owner_name ? {
          id: org.owner_id,
          name: org.owner_name,
          email: org.owner_email
        } : null,
        createdAt: org.created_at
      };
    } catch (error) {
      log.error('[GRAPHQL] Error in organization query:', { error: error.message });
      throw error;
    }
  },

  organizations: async (_, __, { user }) => {
    if (!user) throw new Error('Authentication required');

    try {
      const result = await db.query(
        `SELECT o.*, u.name as owner_name, u.email as owner_email
         FROM organizations o
         LEFT JOIN users u ON o.owner_id = u.id
         JOIN organization_members om ON om.org_id = o.id
         WHERE om.user_id = $1 AND om.status = 'active'
         ORDER BY o.name`,
        [user.id]
      );

      return result.rows.map(org => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        planTier: org.plan_tier,
        owner: org.owner_name ? {
          id: org.owner_id,
          name: org.owner_name,
          email: org.owner_email
        } : null,
        createdAt: org.created_at
      }));
    } catch (error) {
      log.error('[GRAPHQL] Error in organizations query:', { error: error.message });
      throw error;
    }
  }
};

module.exports = Query;
