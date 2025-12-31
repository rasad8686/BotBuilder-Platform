/**
 * Facebook Messenger Service
 * Channel CRUD and messaging operations
 */

const db = require('../../db');
const log = require('../../utils/logger');
const FacebookProvider = require('../../channels/providers/FacebookProvider');

class FacebookService {
  constructor() {
    this.appId = process.env.FACEBOOK_APP_ID;
    this.appSecret = process.env.FACEBOOK_APP_SECRET;
  }

  // ==========================================
  // CHANNEL/PAGE MANAGEMENT
  // ==========================================

  /**
   * Connect Facebook page
   */
  async connectPage(params) {
    const {
      userId,
      organizationId,
      pageId,
      pageName,
      accessToken,
      botId,
      settings = {}
    } = params;

    try {
      // Verify page access token
      const provider = new FacebookProvider({ pageAccessToken: accessToken });
      const pageInfo = await provider.getPageInfo();

      if (!pageInfo.success) {
        return { success: false, error: 'Invalid page access token' };
      }

      // Check if page already connected
      const existing = await db.query(
        'SELECT id FROM facebook_pages WHERE page_id = $1',
        [pageId]
      );

      if (existing.rows.length > 0) {
        // Update existing connection
        const result = await db.query(
          `UPDATE facebook_pages SET
            user_id = $1, organization_id = $2, page_name = $3,
            access_token = $4, bot_id = $5, settings = $6,
            is_active = true, updated_at = NOW()
           WHERE page_id = $7
           RETURNING *`,
          [userId, organizationId, pageName || pageInfo.page.name, accessToken, botId, JSON.stringify(settings), pageId]
        );

        return { success: true, page: result.rows[0], updated: true };
      }

      // Create new connection
      const result = await db.query(
        `INSERT INTO facebook_pages (
          user_id, organization_id, page_id, page_name, access_token,
          bot_id, settings, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
        RETURNING *`,
        [userId, organizationId, pageId, pageName || pageInfo.page.name, accessToken, botId, JSON.stringify(settings)]
      );

      // Set up webhook subscriptions
      await this.setupWebhookSubscription(pageId, accessToken);

      log.info('Facebook page connected', { pageId, pageName });
      return { success: true, page: result.rows[0] };
    } catch (error) {
      log.error('Error connecting Facebook page', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect Facebook page
   */
  async disconnectPage(pageId, userId) {
    try {
      const result = await db.query(
        `UPDATE facebook_pages SET is_active = false, updated_at = NOW()
         WHERE page_id = $1 AND user_id = $2
         RETURNING *`,
        [pageId, userId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Page not found' };
      }

      log.info('Facebook page disconnected', { pageId });
      return { success: true };
    } catch (error) {
      log.error('Error disconnecting Facebook page', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get connected pages for user
   */
  async getConnectedPages(userId, organizationId = null) {
    try {
      let query = `
        SELECT fp.*, b.name as bot_name
        FROM facebook_pages fp
        LEFT JOIN bots b ON b.id = fp.bot_id
        WHERE fp.user_id = $1 AND fp.is_active = true
      `;
      const params = [userId];

      if (organizationId) {
        query += ' AND fp.organization_id = $2';
        params.push(organizationId);
      }

      query += ' ORDER BY fp.created_at DESC';

      const result = await db.query(query, params);

      return { success: true, pages: result.rows };
    } catch (error) {
      log.error('Error getting connected pages', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get page by ID
   */
  async getPage(pageId) {
    try {
      const result = await db.query(
        `SELECT fp.*, b.name as bot_name, b.ai_enabled
         FROM facebook_pages fp
         LEFT JOIN bots b ON b.id = fp.bot_id
         WHERE fp.page_id = $1`,
        [pageId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Page not found' };
      }

      return { success: true, page: result.rows[0] };
    } catch (error) {
      log.error('Error getting page', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update page settings
   */
  async updatePageSettings(pageId, userId, settings) {
    try {
      const result = await db.query(
        `UPDATE facebook_pages SET
          settings = settings || $1::jsonb,
          updated_at = NOW()
         WHERE page_id = $2 AND user_id = $3
         RETURNING *`,
        [JSON.stringify(settings), pageId, userId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Page not found' };
      }

      return { success: true, page: result.rows[0] };
    } catch (error) {
      log.error('Error updating page settings', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Setup webhook subscription for page
   */
  async setupWebhookSubscription(pageId, accessToken) {
    try {
      const provider = new FacebookProvider({ pageAccessToken: accessToken });

      // Subscribe to webhook fields
      const fields = ['messages', 'messaging_postbacks', 'messaging_optins', 'message_deliveries', 'message_reads', 'messaging_referrals'];

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscribed_fields: fields })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        log.error('Error subscribing to webhook', { error: data.error });
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      log.error('Error setting up webhook subscription', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // MESSAGING
  // ==========================================

  /**
   * Send text message
   */
  async sendText(pageId, recipientId, text, options = {}) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      const result = await provider.sendText(recipientId, text, options);

      if (result.success) {
        await this.logMessage(pageId, recipientId, 'text', text, 'outgoing', result.messageId);
      }

      return result;
    } catch (error) {
      log.error('Error sending text', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send image
   */
  async sendImage(pageId, recipientId, imageUrl, options = {}) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      const result = await provider.sendImage(recipientId, imageUrl, options);

      if (result.success) {
        await this.logMessage(pageId, recipientId, 'image', imageUrl, 'outgoing', result.messageId);
      }

      return result;
    } catch (error) {
      log.error('Error sending image', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send video
   */
  async sendVideo(pageId, recipientId, videoUrl, options = {}) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      const result = await provider.sendVideo(recipientId, videoUrl, options);

      if (result.success) {
        await this.logMessage(pageId, recipientId, 'video', videoUrl, 'outgoing', result.messageId);
      }

      return result;
    } catch (error) {
      log.error('Error sending video', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send audio
   */
  async sendAudio(pageId, recipientId, audioUrl, options = {}) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      const result = await provider.sendAudio(recipientId, audioUrl, options);

      if (result.success) {
        await this.logMessage(pageId, recipientId, 'audio', audioUrl, 'outgoing', result.messageId);
      }

      return result;
    } catch (error) {
      log.error('Error sending audio', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send file
   */
  async sendFile(pageId, recipientId, fileUrl, options = {}) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      const result = await provider.sendFile(recipientId, fileUrl, options);

      if (result.success) {
        await this.logMessage(pageId, recipientId, 'file', fileUrl, 'outgoing', result.messageId);
      }

      return result;
    } catch (error) {
      log.error('Error sending file', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send generic template
   */
  async sendGenericTemplate(pageId, recipientId, elements, options = {}) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      const result = await provider.sendGenericTemplate(recipientId, elements, options);

      if (result.success) {
        await this.logMessage(pageId, recipientId, 'template', JSON.stringify(elements), 'outgoing', result.messageId);
      }

      return result;
    } catch (error) {
      log.error('Error sending generic template', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send button template
   */
  async sendButtonTemplate(pageId, recipientId, text, buttons, options = {}) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      const result = await provider.sendButtonTemplate(recipientId, text, buttons, options);

      if (result.success) {
        await this.logMessage(pageId, recipientId, 'template', text, 'outgoing', result.messageId);
      }

      return result;
    } catch (error) {
      log.error('Error sending button template', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send quick replies
   */
  async sendQuickReplies(pageId, recipientId, text, quickReplies, options = {}) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      const result = await provider.sendQuickReplies(recipientId, text, quickReplies, options);

      if (result.success) {
        await this.logMessage(pageId, recipientId, 'quick_reply', text, 'outgoing', result.messageId);
      }

      return result;
    } catch (error) {
      log.error('Error sending quick replies', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send template (generic method)
   */
  async sendTemplate(pageId, recipientId, templateType, templateData, options = {}) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });

      let result;
      switch (templateType) {
        case 'generic':
          result = await provider.sendGenericTemplate(recipientId, templateData.elements, options);
          break;
        case 'button':
          result = await provider.sendButtonTemplate(recipientId, templateData.text, templateData.buttons, options);
          break;
        case 'receipt':
          result = await provider.sendReceiptTemplate(recipientId, templateData, options);
          break;
        case 'media':
          result = await provider.sendMediaTemplate(recipientId, templateData.mediaType, templateData.attachmentId, templateData.buttons, options);
          break;
        default:
          return { success: false, error: 'Unknown template type' };
      }

      if (result.success) {
        await this.logMessage(pageId, recipientId, 'template', JSON.stringify(templateData), 'outgoing', result.messageId);
      }

      return result;
    } catch (error) {
      log.error('Error sending template', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // PAGE SETTINGS
  // ==========================================

  /**
   * Get page info from Facebook
   */
  async getPageInfo(pageId) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      return await provider.getPageInfo();
    } catch (error) {
      log.error('Error getting page info', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(pageId, userId) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      return await provider.getUserProfile(userId);
    } catch (error) {
      log.error('Error getting user profile', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Set persistent menu
   */
  async setPersistentMenu(pageId, menuItems, options = {}) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      const result = await provider.setPersistentMenu(menuItems, options);

      if (result.success) {
        // Save menu to settings
        await this.updatePageSettings(pageId, pageResult.page.user_id, { persistentMenu: menuItems });
      }

      return result;
    } catch (error) {
      log.error('Error setting persistent menu', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete persistent menu
   */
  async deletePersistentMenu(pageId) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      return await provider.deletePersistentMenu();
    } catch (error) {
      log.error('Error deleting persistent menu', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Set get started button
   */
  async setGetStartedButton(pageId, payload = 'GET_STARTED') {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      return await provider.setGetStartedButton(payload);
    } catch (error) {
      log.error('Error setting get started button', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Set greeting text
   */
  async setGreetingText(pageId, greetings) {
    try {
      const pageResult = await this.getPage(pageId);
      if (!pageResult.success) return pageResult;

      const provider = new FacebookProvider({ pageAccessToken: pageResult.page.access_token });
      const result = await provider.setGreetingText(greetings);

      if (result.success) {
        await this.updatePageSettings(pageId, pageResult.page.user_id, { greeting: greetings });
      }

      return result;
    } catch (error) {
      log.error('Error setting greeting text', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Set welcome message
   */
  async setWelcomeMessage(pageId, userId, message) {
    try {
      await db.query(
        `UPDATE facebook_pages SET welcome_message = $1, updated_at = NOW()
         WHERE page_id = $2 AND user_id = $3`,
        [message, pageId, userId]
      );

      return { success: true };
    } catch (error) {
      log.error('Error setting welcome message', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // CONVERSATIONS
  // ==========================================

  /**
   * Get conversations for page
   */
  async getConversations(pageId, options = {}) {
    const { limit = 50, offset = 0, status } = options;

    try {
      let query = `
        SELECT fc.*,
          (SELECT COUNT(*) FROM facebook_messages WHERE conversation_id = fc.id) as message_count,
          (SELECT content FROM facebook_messages WHERE conversation_id = fc.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM facebook_conversations fc
        WHERE fc.page_id = $1
      `;
      const params = [pageId];
      let paramIndex = 2;

      if (status) {
        query += ` AND fc.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      query += ` ORDER BY fc.last_activity_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      // Get total count
      const countResult = await db.query(
        'SELECT COUNT(*) FROM facebook_conversations WHERE page_id = $1',
        [pageId]
      );

      return {
        success: true,
        conversations: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
      };
    } catch (error) {
      log.error('Error getting conversations', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(conversationId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    try {
      const result = await db.query(
        `SELECT * FROM facebook_messages
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [conversationId, limit, offset]
      );

      return { success: true, messages: result.rows.reverse() };
    } catch (error) {
      log.error('Error getting conversation messages', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // ANALYTICS
  // ==========================================

  /**
   * Get page statistics
   */
  async getPageStats(pageId, options = {}) {
    const { startDate, endDate } = options;

    try {
      // Base stats
      const statsResult = await db.query(
        `SELECT
          (SELECT COUNT(*) FROM facebook_conversations WHERE page_id = $1) as total_conversations,
          (SELECT COUNT(*) FROM facebook_conversations WHERE page_id = $1 AND status = 'active') as active_conversations,
          (SELECT COUNT(*) FROM facebook_messages fm
           JOIN facebook_conversations fc ON fc.id = fm.conversation_id
           WHERE fc.page_id = $1) as total_messages,
          (SELECT COUNT(*) FROM facebook_messages fm
           JOIN facebook_conversations fc ON fc.id = fm.conversation_id
           WHERE fc.page_id = $1 AND fm.direction = 'incoming') as incoming_messages,
          (SELECT COUNT(*) FROM facebook_messages fm
           JOIN facebook_conversations fc ON fc.id = fm.conversation_id
           WHERE fc.page_id = $1 AND fm.direction = 'outgoing') as outgoing_messages`,
        [pageId]
      );

      // Daily stats for the last 30 days
      const dailyResult = await db.query(
        `SELECT
          DATE(fc.created_at) as date,
          COUNT(DISTINCT fc.id) as new_conversations,
          COUNT(fm.id) as messages
         FROM facebook_conversations fc
         LEFT JOIN facebook_messages fm ON fm.conversation_id = fc.id
         WHERE fc.page_id = $1 AND fc.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(fc.created_at)
         ORDER BY date`,
        [pageId]
      );

      return {
        success: true,
        stats: statsResult.rows[0],
        daily: dailyResult.rows
      };
    } catch (error) {
      log.error('Error getting page stats', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get message type distribution
   */
  async getMessageTypeStats(pageId) {
    try {
      const result = await db.query(
        `SELECT fm.type, COUNT(*) as count
         FROM facebook_messages fm
         JOIN facebook_conversations fc ON fc.id = fm.conversation_id
         WHERE fc.page_id = $1
         GROUP BY fm.type`,
        [pageId]
      );

      return { success: true, stats: result.rows };
    } catch (error) {
      log.error('Error getting message type stats', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  /**
   * Log message to database
   */
  async logMessage(pageId, recipientId, type, content, direction, messageId) {
    try {
      // Get conversation
      const convResult = await db.query(
        `SELECT id FROM facebook_conversations WHERE page_id = $1 AND sender_id = $2`,
        [pageId, recipientId]
      );

      if (convResult.rows.length === 0) return;

      await db.query(
        `INSERT INTO facebook_messages (
          conversation_id, message_id, direction, type, content, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [convResult.rows[0].id, messageId, direction, type, content]
      );
    } catch (error) {
      log.error('Error logging message', { error: error.message });
    }
  }

  /**
   * Test page credentials
   */
  async testCredentials(accessToken) {
    try {
      const provider = new FacebookProvider({ pageAccessToken: accessToken });
      const result = await provider.getPageInfo();

      if (result.success) {
        return {
          success: true,
          page: result.page
        };
      }

      return { success: false, error: result.error };
    } catch (error) {
      log.error('Error testing credentials', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Exchange short-lived token for long-lived token
   */
  async exchangeToken(shortLivedToken) {
    try {
      const url = `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${this.appId}&` +
        `client_secret=${this.appSecret}&` +
        `fb_exchange_token=${shortLivedToken}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error };
      }

      return {
        success: true,
        accessToken: data.access_token,
        expiresIn: data.expires_in
      };
    } catch (error) {
      log.error('Error exchanging token', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's pages from Facebook
   */
  async getUserPages(userAccessToken) {
    try {
      const url = `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error };
      }

      const pages = data.data.map(page => ({
        id: page.id,
        name: page.name,
        accessToken: page.access_token,
        category: page.category,
        tasks: page.tasks
      }));

      return { success: true, pages };
    } catch (error) {
      log.error('Error getting user pages', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new FacebookService();
