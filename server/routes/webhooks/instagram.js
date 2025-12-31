/**
 * Instagram Webhook Routes
 * Handles incoming webhooks from Meta Instagram Messaging API
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../../db');
const log = require('../../utils/logger');
const InstagramProvider = require('../../channels/providers/InstagramProvider');

const instagramProvider = new InstagramProvider();

// Rate limiting for webhook
const webhookRateLimit = new Map();
const RATE_LIMIT_WINDOW = 1000; // 1 second
const RATE_LIMIT_MAX = 100; // max 100 requests per second

/**
 * Rate limit check
 */
function checkRateLimit(pageId) {
  const now = Date.now();
  const key = pageId || 'global';
  const record = webhookRateLimit.get(key);

  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    webhookRateLimit.set(key, { timestamp: now, count: 1 });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * GET /api/webhooks/instagram
 * Webhook verification challenge from Meta
 */
router.get('/', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    log.info('[Instagram Webhook] Verification request', { mode, hasToken: !!token });

    // Get verify token from settings or env
    const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || 'botbuilder_instagram_webhook';

    if (mode === 'subscribe' && token === verifyToken) {
      log.info('[Instagram Webhook] Verification successful');
      return res.status(200).send(challenge);
    }

    log.warn('[Instagram Webhook] Verification failed', { mode, tokenMatch: token === verifyToken });
    return res.status(403).json({ error: 'Verification failed' });
  } catch (error) {
    log.error('[Instagram Webhook] Verification error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/webhooks/instagram
 * Receive incoming messages and events
 */
router.post('/', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-hub-signature-256'];
    const appSecret = process.env.INSTAGRAM_APP_SECRET;

    if (appSecret && signature) {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(body)
        .digest('hex');

      if (!crypto.timingSafeEquals(Buffer.from(signature), Buffer.from(expectedSignature))) {
        log.warn('[Instagram Webhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const payload = req.body;

    // Always respond quickly to Meta
    res.status(200).json({ status: 'received' });

    // Process webhook asynchronously
    processWebhook(payload).catch(error => {
      log.error('[Instagram Webhook] Processing error', { error: error.message });
    });

  } catch (error) {
    log.error('[Instagram Webhook] Error', { error: error.message });
    // Still return 200 to prevent Meta from retrying
    res.status(200).json({ status: 'error' });
  }
});

/**
 * Process webhook payload asynchronously
 */
async function processWebhook(payload) {
  if (!payload.entry) {
    return;
  }

  for (const entry of payload.entry) {
    const pageId = entry.id;

    // Rate limit check
    if (!checkRateLimit(pageId)) {
      log.warn('[Instagram Webhook] Rate limit exceeded', { pageId });
      continue;
    }

    // Process messaging events
    if (entry.messaging) {
      for (const event of entry.messaging) {
        await processMessagingEvent(event, pageId);
      }
    }

    // Process standby events (for handover protocol)
    if (entry.standby) {
      for (const event of entry.standby) {
        log.debug('[Instagram Webhook] Standby event', { pageId });
      }
    }
  }
}

/**
 * Process messaging event
 */
async function processMessagingEvent(event, pageId) {
  try {
    // Find channel by page ID
    const channel = await db('channels')
      .where({ provider: 'instagram' })
      .where(function() {
        this.where({ business_account_id: pageId })
          .orWhereRaw("credentials->>'page_id' = ?", [pageId])
          .orWhereRaw("credentials->>'instagram_account_id' = ?", [pageId]);
      })
      .first();

    if (!channel) {
      log.warn('[Instagram Webhook] Channel not found', { pageId });
      return;
    }

    const senderId = event.sender?.id;
    const timestamp = event.timestamp;

    // Handle different event types
    if (event.message) {
      // Skip echo messages (messages sent by us)
      if (event.message.is_echo) {
        log.debug('[Instagram Webhook] Echo message, skipping', { mid: event.message.mid });
        return;
      }
      await processIncomingMessage(channel, event, senderId, timestamp);
    } else if (event.postback) {
      await processPostback(channel, event, senderId, timestamp);
    } else if (event.reaction) {
      await processReaction(channel, event, senderId, timestamp);
    } else if (event.read) {
      await processReadReceipt(channel, event);
    } else if (event.delivery) {
      await processDeliveryReceipt(channel, event);
    }

  } catch (error) {
    log.error('[Instagram Webhook] Error processing event', { error: error.message });
  }
}

/**
 * Process incoming message
 */
async function processIncomingMessage(channel, event, senderId, timestamp) {
  try {
    const message = event.message;

    const messageData = {
      channel_id: channel.id,
      external_id: message.mid,
      direction: 'inbound',
      sender_id: senderId,
      sender_name: null,
      message_type: 'text',
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      reply_to_id: message.reply_to?.mid || null,
      metadata: JSON.stringify({
        pageId: event.recipient?.id,
        isEcho: false
      })
    };

    // Text message
    if (message.text) {
      messageData.content = message.text;
      messageData.message_type = 'text';
    }

    // Attachments
    if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];

      switch (attachment.type) {
        case 'image':
          messageData.message_type = 'image';
          messageData.media_url = attachment.payload?.url;
          break;
        case 'video':
          messageData.message_type = 'video';
          messageData.media_url = attachment.payload?.url;
          break;
        case 'audio':
          messageData.message_type = 'audio';
          messageData.media_url = attachment.payload?.url;
          break;
        case 'file':
          messageData.message_type = 'document';
          messageData.media_url = attachment.payload?.url;
          break;
        case 'share':
          messageData.message_type = 'text';
          messageData.content = attachment.payload?.url || '[Shared content]';
          break;
        case 'story_mention':
          messageData.message_type = 'story_mention';
          messageData.content = '[Mentioned you in their story]';
          messageData.media_url = attachment.payload?.url;
          break;
        case 'reel':
          messageData.message_type = 'reel';
          messageData.content = '[Reel share]';
          messageData.media_url = attachment.payload?.url;
          break;
        default:
          messageData.content = `[${attachment.type}]`;
      }
    }

    // Quick reply
    if (message.quick_reply) {
      messageData.metadata = JSON.stringify({
        ...JSON.parse(messageData.metadata),
        quickReply: message.quick_reply.payload
      });
    }

    // Story reply
    if (message.reply_to?.story) {
      messageData.metadata = JSON.stringify({
        ...JSON.parse(messageData.metadata),
        storyReply: {
          storyId: message.reply_to.story.id,
          storyUrl: message.reply_to.story.url
        }
      });
    }

    // Store message in database
    await db('channel_messages').insert({
      ...messageData,
      created_at: new Date()
    });

    log.info('[Instagram Webhook] Message stored', {
      channelId: channel.id,
      messageId: message.mid,
      type: messageData.message_type
    });

    // Route to bot engine for AI processing
    await routeMessageToBotEngine(channel, messageData, message);

  } catch (error) {
    log.error('[Instagram Webhook] Error processing message', { error: error.message });
  }
}

/**
 * Process postback (button click)
 */
async function processPostback(channel, event, senderId, timestamp) {
  try {
    const postback = event.postback;

    const messageData = {
      channel_id: channel.id,
      external_id: `postback_${timestamp}`,
      direction: 'inbound',
      sender_id: senderId,
      message_type: 'postback',
      content: postback.title || postback.payload,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      metadata: JSON.stringify({
        postback: true,
        payload: postback.payload,
        title: postback.title,
        referral: postback.referral
      }),
      created_at: new Date()
    };

    await db('channel_messages').insert(messageData);

    log.info('[Instagram Webhook] Postback stored', {
      channelId: channel.id,
      payload: postback.payload
    });

    // Route to bot engine
    await routeMessageToBotEngine(channel, messageData, event);

  } catch (error) {
    log.error('[Instagram Webhook] Error processing postback', { error: error.message });
  }
}

/**
 * Process reaction
 */
async function processReaction(channel, event, senderId, timestamp) {
  try {
    const reaction = event.reaction;

    const messageData = {
      channel_id: channel.id,
      external_id: `reaction_${timestamp}`,
      direction: 'inbound',
      sender_id: senderId,
      message_type: 'reaction',
      content: reaction.emoji || reaction.reaction,
      reply_to_id: reaction.mid,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      metadata: JSON.stringify({
        reaction: true,
        action: reaction.action,
        emoji: reaction.emoji
      }),
      created_at: new Date()
    };

    await db('channel_messages').insert(messageData);

    log.debug('[Instagram Webhook] Reaction stored', {
      channelId: channel.id,
      emoji: reaction.emoji
    });

  } catch (error) {
    log.error('[Instagram Webhook] Error processing reaction', { error: error.message });
  }
}

/**
 * Process read receipt
 */
async function processReadReceipt(channel, event) {
  try {
    const watermark = event.read?.watermark;

    // Update all messages before watermark as read
    if (watermark) {
      await db('channel_messages')
        .where({ channel_id: channel.id, direction: 'outbound' })
        .where('timestamp', '<=', new Date(watermark))
        .whereNull('read_at')
        .update({
          status: 'read',
          read_at: new Date(),
          updated_at: new Date()
        });

      log.debug('[Instagram Webhook] Read receipt processed', { watermark });
    }
  } catch (error) {
    log.error('[Instagram Webhook] Error processing read receipt', { error: error.message });
  }
}

/**
 * Process delivery receipt
 */
async function processDeliveryReceipt(channel, event) {
  try {
    const mids = event.delivery?.mids || [];
    const watermark = event.delivery?.watermark;

    for (const mid of mids) {
      await db('channel_messages')
        .where({ external_id: mid })
        .update({
          status: 'delivered',
          delivered_at: watermark ? new Date(watermark) : new Date(),
          updated_at: new Date()
        });
    }

    log.debug('[Instagram Webhook] Delivery receipt processed', { count: mids.length });
  } catch (error) {
    log.error('[Instagram Webhook] Error processing delivery receipt', { error: error.message });
  }
}

/**
 * Route message to bot engine for AI processing
 */
async function routeMessageToBotEngine(channel, messageData, rawMessage) {
  try {
    // Get associated bot
    const bot = await db('bots')
      .where({ id: channel.bot_id })
      .first();

    if (!bot || bot.status !== 'active') {
      return;
    }

    // Skip non-processable message types
    if (!messageData.content || ['reaction', 'story_mention'].includes(messageData.message_type)) {
      return;
    }

    // Get AI configuration
    const aiConfig = await db('ai_configurations')
      .where({ bot_id: bot.id, is_enabled: true })
      .first();

    if (!aiConfig) {
      return;
    }

    // Import AI services
    const { AIProviderFactory, EncryptionHelper } = require('../../services/ai');
    const ragService = require('../../services/ragService');

    // Get API key
    let apiKey;
    if (aiConfig.api_key_encrypted) {
      apiKey = EncryptionHelper.decrypt(aiConfig.api_key_encrypted);
    } else {
      apiKey = aiConfig.provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY;
    }

    if (!apiKey) {
      return;
    }

    // Get AI service
    const aiService = AIProviderFactory.getProvider({
      provider: aiConfig.provider,
      apiKey: apiKey.trim(),
      model: aiConfig.model
    });

    // Build system prompt with RAG
    let systemPrompt = aiConfig.system_prompt || 'You are a helpful assistant.';

    try {
      const ragResult = await ragService.getContextForQuery(bot.id, messageData.content, {
        maxChunks: 20,
        threshold: 0.15
      });

      if (ragResult.hasContext && ragResult.context) {
        systemPrompt = ragService.buildRAGPrompt(aiConfig.system_prompt, ragResult.context);
      }
    } catch (ragError) {
      log.error('[Instagram] RAG error', { error: ragError.message });
    }

    // Get conversation history
    const history = await db('channel_messages')
      .where({ channel_id: channel.id, sender_id: messageData.sender_id })
      .orderBy('created_at', 'desc')
      .limit(aiConfig.context_window || 10);

    // Build messages array
    const messages = [{ role: 'system', content: systemPrompt }];

    for (const msg of history.reverse()) {
      const role = msg.direction === 'inbound' ? 'user' : 'assistant';
      if (msg.content && msg.content !== messageData.content) {
        messages.push({ role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: messageData.content });

    // Send to AI
    const response = await aiService.chat({
      messages,
      temperature: parseFloat(aiConfig.temperature) || 0.7,
      maxTokens: parseInt(aiConfig.max_tokens) || 1024,
      stream: false
    });

    // Send response via Instagram
    const credentials = JSON.parse(channel.credentials || '{}');

    await instagramProvider.sendTextMessage(
      { credentials },
      messageData.sender_id,
      response.content
    );

    // Store bot response
    await db('channel_messages').insert({
      channel_id: channel.id,
      direction: 'outbound',
      sender_id: 'bot',
      recipient_id: messageData.sender_id,
      content: response.content,
      message_type: 'text',
      status: 'sent',
      created_at: new Date()
    });

    log.info('[Instagram] Bot response sent', {
      channelId: channel.id,
      to: messageData.sender_id
    });

  } catch (error) {
    log.error('[Instagram] Error routing to bot engine', { error: error.message });
  }
}

module.exports = router;
