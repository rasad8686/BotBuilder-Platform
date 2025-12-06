/**
 * InstagramProvider - Meta Instagram Messaging API Integration
 * Handles Instagram Direct Messages, Story Replies, and Icebreakers
 */

const BaseProvider = require('./BaseProvider');
const crypto = require('crypto');

class InstagramProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'instagram';
    this.version = '1.0.0';
    this.apiVersion = config.apiVersion || 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  /**
   * Initialize Instagram channel
   */
  async initialize(channel) {
    try {
      const isValid = await this.validateCredentials(channel.credentials);
      if (!isValid) {
        throw new Error('Invalid Instagram credentials');
      }

      this.log('info', `Instagram channel initialized: ${channel.id}`);
      return true;
    } catch (error) {
      this.log('error', 'Failed to initialize Instagram channel', { error: error.message });
      throw error;
    }
  }

  /**
   * Send a message (generic method)
   */
  async send(channel, message) {
    const { to, type = 'text', content, mediaUrl, mediaType } = message;

    switch (type) {
      case 'text':
        return this.sendTextMessage(channel, to, content, message);
      case 'image':
      case 'video':
      case 'audio':
        return this.sendMediaMessage(channel, to, type, mediaUrl, message);
      case 'story_reply':
        return this.sendStoryReply(channel, to, content, message);
      case 'reaction':
        return this.sendReaction(channel, to, message.messageId, message.reaction);
      case 'icebreaker':
        return this.sendIcebreaker(channel, to, message);
      default:
        throw new Error(`Unsupported message type: ${type}`);
    }
  }

  /**
   * Send a text message
   */
  async sendTextMessage(channel, to, text, options = {}) {
    const { pageId, accessToken } = this.getCredentials(channel);

    const payload = {
      recipient: {
        id: to
      },
      message: {
        text
      }
    };

    // Add quick replies if provided
    if (options.quickReplies && options.quickReplies.length > 0) {
      payload.message.quick_replies = options.quickReplies.map(qr => ({
        content_type: 'text',
        title: qr.title,
        payload: qr.payload || qr.title
      }));
    }

    return this.makeRequest(pageId, accessToken, payload);
  }

  /**
   * Send a media message (image, video, audio)
   */
  async sendMediaMessage(channel, to, mediaType, mediaUrl, options = {}) {
    const { pageId, accessToken } = this.getCredentials(channel);

    const attachmentType = mediaType === 'audio' ? 'audio' :
                           mediaType === 'video' ? 'video' : 'image';

    const payload = {
      recipient: {
        id: to
      },
      message: {
        attachment: {
          type: attachmentType,
          payload: {
            url: mediaUrl,
            is_reusable: options.isReusable || false
          }
        }
      }
    };

    // Use attachment_id if provided instead of URL
    if (options.attachmentId) {
      payload.message.attachment.payload = {
        attachment_id: options.attachmentId
      };
    }

    return this.makeRequest(pageId, accessToken, payload);
  }

  /**
   * Send a story reply
   */
  async sendStoryReply(channel, to, text, options = {}) {
    const { pageId, accessToken } = this.getCredentials(channel);

    const payload = {
      recipient: {
        id: to
      },
      message: {
        text
      }
    };

    // Story reply requires the story_id in metadata
    if (options.storyId) {
      payload.message.metadata = JSON.stringify({
        story_id: options.storyId
      });
    }

    return this.makeRequest(pageId, accessToken, payload);
  }

  /**
   * Send icebreaker suggestions
   */
  async sendIcebreaker(channel, to, options = {}) {
    const { pageId, accessToken } = this.getCredentials(channel);

    const payload = {
      recipient: {
        id: to
      },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: options.elements || [{
              title: options.title || 'Welcome!',
              subtitle: options.subtitle,
              buttons: options.buttons || []
            }]
          }
        }
      }
    };

    return this.makeRequest(pageId, accessToken, payload);
  }

  /**
   * Send generic template (cards/carousel)
   */
  async sendGenericTemplate(channel, to, elements) {
    const { pageId, accessToken } = this.getCredentials(channel);

    const payload = {
      recipient: {
        id: to
      },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: elements.map(el => ({
              title: el.title,
              subtitle: el.subtitle,
              image_url: el.imageUrl,
              default_action: el.defaultAction,
              buttons: el.buttons
            }))
          }
        }
      }
    };

    return this.makeRequest(pageId, accessToken, payload);
  }

  /**
   * Send button template
   */
  async sendButtonTemplate(channel, to, text, buttons) {
    const { pageId, accessToken } = this.getCredentials(channel);

    const payload = {
      recipient: {
        id: to
      },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text,
            buttons: buttons.map(btn => {
              if (btn.type === 'web_url') {
                return {
                  type: 'web_url',
                  url: btn.url,
                  title: btn.title
                };
              }
              return {
                type: 'postback',
                title: btn.title,
                payload: btn.payload
              };
            })
          }
        }
      }
    };

    return this.makeRequest(pageId, accessToken, payload);
  }

  /**
   * Send reaction to a message
   */
  async sendReaction(channel, to, messageId, reaction) {
    const { pageId, accessToken } = this.getCredentials(channel);

    const payload = {
      recipient: {
        id: to
      },
      sender_action: 'react',
      payload: {
        message_id: messageId,
        reaction: reaction // 'love', 'haha', 'wow', 'sad', 'angry', 'like'
      }
    };

    return this.makeRequest(pageId, accessToken, payload);
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(channel, to, typing = true) {
    const { pageId, accessToken } = this.getCredentials(channel);

    const payload = {
      recipient: {
        id: to
      },
      sender_action: typing ? 'typing_on' : 'typing_off'
    };

    try {
      await this.makeRequest(pageId, accessToken, payload);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Mark message as seen
   */
  async markAsRead(channel, messageId) {
    const { pageId, accessToken } = this.getCredentials(channel);

    // Instagram uses sender_action for read receipts
    // Note: This requires knowing the sender ID
    // In practice, read receipts are often handled automatically

    this.log('info', 'Mark as read requested', { messageId });
    return true;
  }

  /**
   * Verify webhook signature
   */
  verify(request, secret) {
    const signature = request.headers['x-hub-signature-256'];
    if (!signature) {
      return false;
    }

    const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    try {
      return crypto.timingSafeEquals(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Handle webhook verification challenge
   */
  handleChallenge(query, verifyToken) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }

    return null;
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(manager, payload, headers) {
    const results = [];

    if (!payload.entry) {
      return results;
    }

    for (const entry of payload.entry) {
      const pageId = entry.id;
      const time = entry.time;

      // Process messaging events
      if (entry.messaging) {
        for (const event of entry.messaging) {
          const result = await this.processMessagingEvent(manager, event, pageId);
          if (result) results.push(result);
        }
      }

      // Process standby events (for handover protocol)
      if (entry.standby) {
        for (const event of entry.standby) {
          this.log('info', 'Standby event received', { event });
        }
      }
    }

    return results;
  }

  /**
   * Process individual messaging event
   */
  async processMessagingEvent(manager, event, pageId) {
    const Channel = require('../../models/Channel');

    // Find channel by page ID
    const channel = await Channel.findByBusinessAccountId(pageId);
    if (!channel) {
      this.log('warn', 'Channel not found for page ID', { pageId });
      return null;
    }

    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    const timestamp = event.timestamp;

    // Handle different event types
    if (event.message) {
      return this.processIncomingMessage(manager, channel, event, senderId, timestamp);
    }

    if (event.postback) {
      return this.processPostback(manager, channel, event, senderId, timestamp);
    }

    if (event.reaction) {
      return this.processReaction(manager, channel, event, senderId, timestamp);
    }

    if (event.read) {
      await this.processReadReceipt(manager, event);
      return null;
    }

    if (event.delivery) {
      await this.processDeliveryReceipt(manager, event);
      return null;
    }

    // Story mention
    if (event.message?.attachments?.[0]?.type === 'story_mention') {
      return this.processStoryMention(manager, channel, event, senderId, timestamp);
    }

    return null;
  }

  /**
   * Process incoming message
   */
  async processIncomingMessage(manager, channel, event, senderId, timestamp) {
    const message = event.message;

    const messageData = {
      from: senderId,
      fromName: null, // Instagram doesn't provide name in webhook
      messageType: 'text',
      externalId: message.mid,
      timestamp,
      replyToId: message.reply_to?.mid || null,
      metadata: {
        isEcho: message.is_echo || false,
        appId: message.app_id
      }
    };

    // Check if it's an echo (message sent by us)
    if (message.is_echo) {
      this.log('debug', 'Echo message received, skipping', { mid: message.mid });
      return null;
    }

    // Text message
    if (message.text) {
      messageData.content = message.text;
      messageData.messageType = 'text';
    }

    // Attachments
    if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];

      switch (attachment.type) {
        case 'image':
          messageData.messageType = 'image';
          messageData.mediaUrl = attachment.payload?.url;
          break;

        case 'video':
          messageData.messageType = 'video';
          messageData.mediaUrl = attachment.payload?.url;
          break;

        case 'audio':
          messageData.messageType = 'audio';
          messageData.mediaUrl = attachment.payload?.url;
          break;

        case 'file':
          messageData.messageType = 'document';
          messageData.mediaUrl = attachment.payload?.url;
          break;

        case 'share':
          messageData.messageType = 'text';
          messageData.content = attachment.payload?.url || '[Shared content]';
          messageData.metadata.share = attachment.payload;
          break;

        case 'story_mention':
          messageData.messageType = 'text';
          messageData.content = '[Story mention]';
          messageData.mediaUrl = attachment.payload?.url;
          messageData.metadata.storyMention = true;
          break;

        case 'reel':
          messageData.messageType = 'video';
          messageData.content = '[Reel share]';
          messageData.mediaUrl = attachment.payload?.url;
          messageData.metadata.reel = true;
          break;

        default:
          messageData.content = `[${attachment.type}]`;
          messageData.metadata.attachment = attachment;
      }
    }

    // Quick reply
    if (message.quick_reply) {
      messageData.metadata.quickReply = message.quick_reply.payload;
    }

    // Story reply
    if (message.reply_to?.story) {
      messageData.metadata.storyReply = {
        storyId: message.reply_to.story.id,
        storyUrl: message.reply_to.story.url
      };
    }

    return manager.receiveMessage(channel.id, messageData);
  }

  /**
   * Process postback (button click)
   */
  async processPostback(manager, channel, event, senderId, timestamp) {
    const postback = event.postback;

    const messageData = {
      from: senderId,
      messageType: 'text',
      content: postback.title || postback.payload,
      externalId: `postback_${timestamp}`,
      timestamp,
      metadata: {
        postback: true,
        payload: postback.payload,
        title: postback.title,
        referral: postback.referral
      }
    };

    return manager.receiveMessage(channel.id, messageData);
  }

  /**
   * Process reaction
   */
  async processReaction(manager, channel, event, senderId, timestamp) {
    const reaction = event.reaction;

    const messageData = {
      from: senderId,
      messageType: 'reaction',
      content: reaction.emoji || reaction.reaction,
      externalId: `reaction_${timestamp}`,
      timestamp,
      replyToId: reaction.mid,
      metadata: {
        reaction: true,
        action: reaction.action, // 'react' or 'unreact'
        emoji: reaction.emoji
      }
    };

    return manager.receiveMessage(channel.id, messageData);
  }

  /**
   * Process story mention
   */
  async processStoryMention(manager, channel, event, senderId, timestamp) {
    const attachment = event.message.attachments[0];

    const messageData = {
      from: senderId,
      messageType: 'text',
      content: '[Mentioned you in their story]',
      externalId: event.message.mid,
      timestamp,
      mediaUrl: attachment.payload?.url,
      metadata: {
        storyMention: true,
        storyUrl: attachment.payload?.url
      }
    };

    return manager.receiveMessage(channel.id, messageData);
  }

  /**
   * Process read receipt
   */
  async processReadReceipt(manager, event) {
    const watermark = event.read?.watermark;
    // All messages sent before watermark timestamp have been read
    this.log('debug', 'Read receipt received', { watermark });
  }

  /**
   * Process delivery receipt
   */
  async processDeliveryReceipt(manager, event) {
    const mids = event.delivery?.mids || [];
    for (const mid of mids) {
      await manager.updateMessageStatus(mid, 'delivered', event.delivery?.watermark);
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(channel, messageId) {
    return {
      messageId,
      status: 'unknown',
      note: 'Status updates are received via webhooks'
    };
  }

  /**
   * Get user profile
   */
  async getUserProfile(channel, userId) {
    const { accessToken } = this.getCredentials(channel);

    try {
      const response = await fetch(
        `${this.baseUrl}/${userId}?fields=name,profile_pic&access_token=${accessToken}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        id: userId,
        name: data.name,
        profilePic: data.profile_pic
      };
    } catch (error) {
      this.log('error', 'Failed to get user profile', { error: error.message });
      return null;
    }
  }

  /**
   * Validate credentials
   */
  async validateCredentials(credentials) {
    const { pageId, accessToken } = credentials;

    if (!pageId || !accessToken) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/${pageId}?access_token=${accessToken}`
      );
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Set up persistent menu
   */
  async setPersistentMenu(channel, menuItems) {
    const { pageId, accessToken } = this.getCredentials(channel);

    const payload = {
      persistent_menu: [{
        locale: 'default',
        composer_input_disabled: false,
        call_to_actions: menuItems.map(item => ({
          type: item.type || 'postback',
          title: item.title,
          payload: item.payload,
          url: item.url
        }))
      }]
    };

    const response = await fetch(
      `${this.baseUrl}/${pageId}/messenger_profile?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    return response.ok;
  }

  /**
   * Set up ice breakers
   */
  async setIceBreakers(channel, iceBreakers) {
    const { pageId, accessToken } = this.getCredentials(channel);

    const payload = {
      ice_breakers: iceBreakers.map(ib => ({
        question: ib.question,
        payload: ib.payload
      }))
    };

    const response = await fetch(
      `${this.baseUrl}/${pageId}/messenger_profile?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    return response.ok;
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      textMessages: true,
      mediaMessages: true,
      templates: true,
      reactions: true,
      replies: true,
      typing: true,
      readReceipts: true,
      locationMessages: false,
      contactMessages: false,
      interactiveMessages: true,
      stickers: false,
      stories: true,
      iceBreakers: true
    };
  }

  /**
   * Get credentials from channel
   */
  getCredentials(channel) {
    const credentials = channel.credentials || {};

    return {
      pageId: credentials.page_id || channel.business_account_id,
      accessToken: credentials.access_token || channel.access_token,
      appSecret: credentials.app_secret,
      instagramAccountId: credentials.instagram_account_id
    };
  }

  /**
   * Make API request
   */
  async makeRequest(pageId, accessToken, payload) {
    const response = await fetch(
      `${this.baseUrl}/${pageId}/messages?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error?.message || 'Instagram API request failed';
      this.log('error', 'Instagram API error', { error: data.error, payload });
      throw new Error(errorMessage);
    }

    return {
      success: true,
      messageId: data.message_id,
      recipientId: data.recipient_id
    };
  }
}

module.exports = InstagramProvider;
