/**
 * Channel API Routes
 * Handles WhatsApp, Instagram, Telegram channel management
 */

const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');
const ChannelMessage = require('../models/ChannelMessage');
const channelManager = require('../channels/core/ChannelManager');
const authMiddleware = require('../middleware/auth');
const pool = require('../db');
const log = require('../utils/logger');

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/channels
 * Get all channels for current tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const { type } = req.query;

    // Optimized: Single query with JOIN instead of N+1 queries
    let query = `
      SELECT c.*,
        COUNT(cm.id) as "messageCount",
        COUNT(cm.id) FILTER (WHERE cm.direction = 'inbound') as "inboundCount",
        COUNT(cm.id) FILTER (WHERE cm.direction = 'outbound') as "outboundCount"
      FROM channels c
      LEFT JOIN channel_messages cm ON c.id = cm.channel_id
      WHERE c.tenant_id = $1
    `;
    const params = [tenantId];

    if (type) {
      query += ` AND c.type = $2`;
      params.push(type);
    }

    query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

    const result = await pool.query(query, params);
    const channelsWithStats = result.rows.map(row => ({
      ...row,
      messageCount: parseInt(row.messageCount) || 0,
      inboundCount: parseInt(row.inboundCount) || 0,
      outboundCount: parseInt(row.outboundCount) || 0
    }));

    res.json(channelsWithStats);
  } catch (error) {
    log.error('Error fetching channels', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

/**
 * POST /api/channels
 * Create a new channel
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const {
      type,
      name,
      credentials,
      phone_number,
      username,
      settings
    } = req.body;

    if (!type || !name) {
      return res.status(400).json({ error: 'Type and name are required' });
    }

    const validTypes = ['whatsapp', 'instagram', 'telegram', 'messenger', 'sms'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid channel type. Must be one of: ${validTypes.join(', ')}` });
    }

    const channel = await channelManager.registerChannel(tenantId, {
      type,
      name,
      credentials,
      phone_number,
      username,
      settings
    });

    res.status(201).json(channel);
  } catch (error) {
    log.error('Error creating channel', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to create channel' });
  }
});

/**
 * GET /api/channels/:id
 * Get channel details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const channel = await Channel.findById(parseInt(id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get statistics
    const stats = await channelManager.getChannelStats(channel.id);

    res.json({
      ...channel,
      stats
    });
  } catch (error) {
    log.error('Error fetching channel', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch channel' });
  }
});

/**
 * PUT /api/channels/:id
 * Update a channel
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const channel = await Channel.findById(parseInt(id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await Channel.update(parseInt(id), req.body);
    res.json(updated);
  } catch (error) {
    log.error('Error updating channel', { error: error.message });
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

/**
 * DELETE /api/channels/:id
 * Delete a channel
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const channel = await Channel.findById(parseInt(id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Channel.delete(parseInt(id));
    res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    log.error('Error deleting channel', { error: error.message });
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

/**
 * POST /api/channels/:id/send
 * Send a message through channel
 */
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const channel = await Channel.findById(parseInt(id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      to,
      type = 'text',
      content,
      mediaUrl,
      caption,
      templateName,
      templateLanguage,
      templateVariables,
      replyToId
    } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient (to) is required' });
    }

    const result = await channelManager.sendMessage(parseInt(id), {
      to,
      type,
      content,
      mediaUrl,
      caption,
      templateName,
      templateLanguage,
      components: templateVariables,
      replyToId
    });

    res.json(result);
  } catch (error) {
    log.error('Error sending message', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

/**
 * GET /api/channels/:id/messages
 * Get message history for a channel
 */
router.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const channel = await Channel.findById(parseInt(id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      conversation_id,
      direction,
      limit = 50,
      offset = 0,
      start_date,
      end_date
    } = req.query;

    const messages = await channelManager.getMessageHistory(parseInt(id), {
      conversationId: conversation_id,
      direction,
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate: start_date,
      endDate: end_date
    });

    res.json(messages);
  } catch (error) {
    log.error('Error fetching messages', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * GET /api/channels/:id/conversations
 * Get conversation list for a channel
 */
router.get('/:id/conversations', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const channel = await Channel.findById(parseInt(id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { limit = 50, offset = 0 } = req.query;

    const conversations = await ChannelMessage.getConversations(
      parseInt(id),
      parseInt(limit),
      parseInt(offset)
    );

    res.json(conversations);
  } catch (error) {
    log.error('Error fetching conversations', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/channels/:id/conversation/:contact
 * Get conversation with specific contact
 */
router.get('/:id/conversation/:contact', async (req, res) => {
  try {
    const { id, contact } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const channel = await Channel.findById(parseInt(id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { limit = 50 } = req.query;

    const messages = await channelManager.getConversation(
      parseInt(id),
      contact,
      parseInt(limit)
    );

    res.json(messages);
  } catch (error) {
    log.error('Error fetching conversation', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * POST /api/channels/:id/templates
 * Create a message template
 */
router.post('/:id/templates', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const channel = await Channel.findById(parseInt(id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      name,
      language = 'en',
      category,
      content,
      header_type,
      header_content,
      footer,
      buttons,
      variables
    } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }

    const result = await pool.query(
      `INSERT INTO channel_templates
       (channel_id, name, language, category, content, header_type, header_content, footer, buttons, variables, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       RETURNING *`,
      [parseInt(id), name, language, category, content, header_type, header_content, footer, buttons || [], variables || []]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    log.error('Error creating template', { error: error.message });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * GET /api/channels/:id/templates
 * Get templates for a channel
 */
router.get('/:id/templates', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const channel = await Channel.findById(parseInt(id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT * FROM channel_templates WHERE channel_id = $1 ORDER BY created_at DESC`,
      [parseInt(id)]
    );

    res.json(result.rows);
  } catch (error) {
    log.error('Error fetching templates', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/channels/:id/contacts
 * Get contacts for a channel
 */
router.get('/:id/contacts', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const channel = await Channel.findById(parseInt(id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { limit = 50, offset = 0, search } = req.query;

    const contacts = await channelManager.getContacts(parseInt(id), {
      limit: parseInt(limit),
      offset: parseInt(offset),
      search
    });

    res.json(contacts);
  } catch (error) {
    log.error('Error fetching contacts', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

/**
 * GET /api/channels/:id/stats
 * Get channel statistics
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const channel = await Channel.findById(parseInt(id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { period = '30d' } = req.query;

    const stats = await channelManager.getChannelStats(parseInt(id), period);
    const dailyStats = await ChannelMessage.getStats(parseInt(id), period);

    res.json({
      summary: stats,
      daily: dailyStats
    });
  } catch (error) {
    log.error('Error fetching stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * POST /api/channels/test
 * Test channel credentials before saving
 */
router.post('/test', async (req, res) => {
  try {
    const { type, credentials } = req.body;

    if (!type || !credentials) {
      return res.status(400).json({ error: 'Type and credentials are required' });
    }

    let isValid = false;
    let message = 'Connection test failed';
    let details = {};

    switch (type) {
      case 'instagram': {
        // Test Instagram credentials by calling Graph API
        const { page_id, access_token, instagram_account_id } = credentials;

        if (!page_id || !access_token) {
          return res.status(400).json({
            success: false,
            error: 'Page ID and Access Token are required'
          });
        }

        try {
          // Verify page access token
          const pageResponse = await fetch(
            `https://graph.facebook.com/v18.0/${page_id}?fields=id,name,instagram_business_account&access_token=${access_token}`
          );
          const pageData = await pageResponse.json();

          if (pageData.error) {
            return res.json({
              success: false,
              error: pageData.error.message || 'Invalid Page Access Token',
              code: pageData.error.code
            });
          }

          // Verify Instagram account if provided
          if (instagram_account_id) {
            const igResponse = await fetch(
              `https://graph.facebook.com/v18.0/${instagram_account_id}?fields=id,username&access_token=${access_token}`
            );
            const igData = await igResponse.json();

            if (igData.error) {
              return res.json({
                success: false,
                error: igData.error.message || 'Invalid Instagram Account ID',
                code: igData.error.code
              });
            }

            details.instagramUsername = igData.username;
          }

          isValid = true;
          message = 'Instagram connection successful';
          details.pageName = pageData.name;
          details.pageId = pageData.id;
          if (pageData.instagram_business_account) {
            details.linkedInstagramId = pageData.instagram_business_account.id;
          }
        } catch (fetchError) {
          return res.json({
            success: false,
            error: 'Failed to connect to Instagram API: ' + fetchError.message
          });
        }
        break;
      }

      case 'whatsapp': {
        // Test WhatsApp credentials
        const { phone_number_id, access_token: waToken } = credentials;

        if (!phone_number_id || !waToken) {
          return res.status(400).json({
            success: false,
            error: 'Phone Number ID and Access Token are required'
          });
        }

        try {
          const response = await fetch(
            `https://graph.facebook.com/v18.0/${phone_number_id}?access_token=${waToken}`
          );
          const data = await response.json();

          if (data.error) {
            return res.json({
              success: false,
              error: data.error.message || 'Invalid credentials',
              code: data.error.code
            });
          }

          isValid = true;
          message = 'WhatsApp connection successful';
          details.phoneNumber = data.display_phone_number;
          details.verifiedName = data.verified_name;
        } catch (fetchError) {
          return res.json({
            success: false,
            error: 'Failed to connect to WhatsApp API: ' + fetchError.message
          });
        }
        break;
      }

      case 'telegram': {
        // Test Telegram bot token
        const { bot_token } = credentials;

        if (!bot_token) {
          return res.status(400).json({
            success: false,
            error: 'Bot Token is required'
          });
        }

        try {
          const response = await fetch(
            `https://api.telegram.org/bot${bot_token}/getMe`
          );
          const data = await response.json();

          if (!data.ok) {
            return res.json({
              success: false,
              error: data.description || 'Invalid bot token'
            });
          }

          isValid = true;
          message = 'Telegram connection successful';
          details.botUsername = data.result.username;
          details.botName = data.result.first_name;
        } catch (fetchError) {
          return res.json({
            success: false,
            error: 'Failed to connect to Telegram API: ' + fetchError.message
          });
        }
        break;
      }

      case 'messenger': {
        // Test Messenger (Facebook Page) credentials
        const { page_id: msgPageId, access_token: msgToken } = credentials;

        if (!msgPageId || !msgToken) {
          return res.status(400).json({
            success: false,
            error: 'Page ID and Access Token are required'
          });
        }

        try {
          const response = await fetch(
            `https://graph.facebook.com/v18.0/${msgPageId}?fields=id,name&access_token=${msgToken}`
          );
          const data = await response.json();

          if (data.error) {
            return res.json({
              success: false,
              error: data.error.message || 'Invalid credentials',
              code: data.error.code
            });
          }

          isValid = true;
          message = 'Messenger connection successful';
          details.pageName = data.name;
        } catch (fetchError) {
          return res.json({
            success: false,
            error: 'Failed to connect to Facebook API: ' + fetchError.message
          });
        }
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported channel type: ${type}`
        });
    }

    res.json({
      success: isValid,
      message,
      details
    });
  } catch (error) {
    log.error('Error testing channel credentials', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to test credentials: ' + error.message
    });
  }
});

/**
 * PUT /api/channels/:id/credentials
 * Update channel credentials
 */
router.put('/:id/credentials', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.current_organization_id || req.user.id;

    const channel = await Channel.findById(parseInt(id));

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await Channel.updateCredentials(parseInt(id), req.body);
    res.json({ message: 'Credentials updated successfully' });
  } catch (error) {
    log.error('Error updating credentials', { error: error.message });
    res.status(500).json({ error: 'Failed to update credentials' });
  }
});

module.exports = router;
