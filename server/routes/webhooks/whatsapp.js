/**
 * WhatsApp Webhook Routes
 * Handles incoming webhooks from Meta WhatsApp Cloud API
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../../db');
const log = require('../../utils/logger');
const WhatsAppProvider = require('../../channels/providers/WhatsAppProvider');

const whatsappProvider = new WhatsAppProvider();

// Rate limiting for webhook
const webhookRateLimit = new Map();
const RATE_LIMIT_WINDOW = 1000; // 1 second
const RATE_LIMIT_MAX = 100; // max 100 requests per second

/**
 * Rate limit check
 */
function checkRateLimit(phoneNumberId) {
  const now = Date.now();
  const key = phoneNumberId || 'global';
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
 * GET /api/webhooks/whatsapp
 * Webhook verification challenge from Meta
 */
router.get('/', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    log.info('[WhatsApp Webhook] Verification request', { mode, hasToken: !!token });

    // Get verify token from settings or env
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'botbuilder_whatsapp_webhook';

    if (mode === 'subscribe' && token === verifyToken) {
      log.info('[WhatsApp Webhook] Verification successful');
      return res.status(200).send(challenge);
    }

    log.warn('[WhatsApp Webhook] Verification failed', { mode, tokenMatch: token === verifyToken });
    return res.status(403).json({ error: 'Verification failed' });
  } catch (error) {
    log.error('[WhatsApp Webhook] Verification error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/webhooks/whatsapp
 * Receive incoming messages and status updates
 */
router.post('/', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-hub-signature-256'];
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (appSecret && signature) {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(body)
        .digest('hex');

      if (!crypto.timingSafeEquals(Buffer.from(signature), Buffer.from(expectedSignature))) {
        log.warn('[WhatsApp Webhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const payload = req.body;

    // Always respond quickly to Meta
    res.status(200).json({ status: 'received' });

    // Process webhook asynchronously
    processWebhook(payload).catch(error => {
      log.error('[WhatsApp Webhook] Processing error', { error: error.message });
    });

  } catch (error) {
    log.error('[WhatsApp Webhook] Error', { error: error.message });
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
    const businessAccountId = entry.id;

    if (!entry.changes) continue;

    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id;
      const displayPhoneNumber = value.metadata?.display_phone_number;

      // Rate limit check
      if (!checkRateLimit(phoneNumberId)) {
        log.warn('[WhatsApp Webhook] Rate limit exceeded', { phoneNumberId });
        continue;
      }

      // Find channel by phone number ID
      const channel = await db('channels')
        .where({
          provider: 'whatsapp',
          business_account_id: phoneNumberId
        })
        .whereRaw("credentials->>'phone_number_id' = ?", [phoneNumberId])
        .orWhere({ business_account_id: phoneNumberId })
        .first();

      if (!channel) {
        log.warn('[WhatsApp Webhook] Channel not found', { phoneNumberId });
        continue;
      }

      // Process messages
      if (value.messages) {
        for (const message of value.messages) {
          await processIncomingMessage(channel, message, value.contacts?.[0], phoneNumberId);
        }
      }

      // Process status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          await processStatusUpdate(channel, status);
        }
      }
    }
  }
}

/**
 * Process incoming message
 */
async function processIncomingMessage(channel, message, contact, phoneNumberId) {
  try {
    const messageData = {
      channel_id: channel.id,
      external_id: message.id,
      direction: 'inbound',
      sender_id: message.from,
      sender_name: contact?.profile?.name || null,
      message_type: message.type,
      timestamp: message.timestamp ? new Date(parseInt(message.timestamp) * 1000) : new Date(),
      reply_to_id: message.context?.id || null,
      metadata: JSON.stringify({
        phoneNumberId,
        contactProfile: contact?.profile
      })
    };

    // Extract content based on message type
    switch (message.type) {
      case 'text':
        messageData.content = message.text?.body;
        break;

      case 'image':
        messageData.media_id = message.image?.id;
        messageData.media_type = message.image?.mime_type;
        messageData.content = message.image?.caption;
        break;

      case 'video':
        messageData.media_id = message.video?.id;
        messageData.media_type = message.video?.mime_type;
        messageData.content = message.video?.caption;
        break;

      case 'audio':
        messageData.media_id = message.audio?.id;
        messageData.media_type = message.audio?.mime_type;
        break;

      case 'document':
        messageData.media_id = message.document?.id;
        messageData.media_type = message.document?.mime_type;
        messageData.content = message.document?.caption;
        messageData.metadata = JSON.stringify({
          ...JSON.parse(messageData.metadata),
          filename: message.document?.filename
        });
        break;

      case 'location':
        messageData.content = JSON.stringify({
          latitude: message.location?.latitude,
          longitude: message.location?.longitude,
          name: message.location?.name,
          address: message.location?.address
        });
        break;

      case 'contacts':
        messageData.content = JSON.stringify(message.contacts);
        break;

      case 'interactive':
        messageData.content = message.interactive?.button_reply?.id ||
                              message.interactive?.list_reply?.id;
        messageData.metadata = JSON.stringify({
          ...JSON.parse(messageData.metadata),
          interactive: message.interactive
        });
        break;

      case 'button':
        messageData.content = message.button?.text;
        messageData.metadata = JSON.stringify({
          ...JSON.parse(messageData.metadata),
          payload: message.button?.payload
        });
        break;

      case 'sticker':
        messageData.media_id = message.sticker?.id;
        messageData.media_type = message.sticker?.mime_type;
        break;

      case 'reaction':
        messageData.content = message.reaction?.emoji;
        messageData.reply_to_id = message.reaction?.message_id;
        break;

      default:
        messageData.content = JSON.stringify(message);
    }

    // Store message in database
    await db('channel_messages').insert({
      ...messageData,
      created_at: new Date()
    });

    log.info('[WhatsApp Webhook] Message stored', {
      channelId: channel.id,
      messageId: message.id,
      type: message.type
    });

    // Route to bot engine for AI processing
    await routeMessageToBotEngine(channel, messageData, message);

  } catch (error) {
    log.error('[WhatsApp Webhook] Error processing message', { error: error.message });
  }
}

/**
 * Process status update (sent, delivered, read, failed)
 */
async function processStatusUpdate(channel, status) {
  try {
    const statusMap = {
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'read',
      'failed': 'failed'
    };

    const mappedStatus = statusMap[status.status];
    if (!mappedStatus) return;

    const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();

    // Update message status in database
    await db('channel_messages')
      .where({ external_id: status.id })
      .update({
        status: mappedStatus,
        [`${mappedStatus}_at`]: timestamp,
        updated_at: new Date()
      });

    // Log errors if present
    if (status.errors) {
      log.warn('[WhatsApp Webhook] Message delivery error', {
        messageId: status.id,
        errors: status.errors
      });

      // Store error details
      await db('channel_messages')
        .where({ external_id: status.id })
        .update({
          error_code: status.errors[0]?.code,
          error_message: status.errors[0]?.title,
          metadata: db.raw(`metadata || ?::jsonb`, [JSON.stringify({ errors: status.errors })])
        });
    }

    log.debug('[WhatsApp Webhook] Status updated', {
      messageId: status.id,
      status: mappedStatus
    });

  } catch (error) {
    log.error('[WhatsApp Webhook] Error processing status', { error: error.message });
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
    if (!messageData.content || ['reaction', 'sticker'].includes(messageData.message_type)) {
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
      log.error('[WhatsApp] RAG error', { error: ragError.message });
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

    // Send response via WhatsApp
    const credentials = JSON.parse(channel.credentials || '{}');

    await whatsappProvider.sendTextMessage(
      { credentials },
      messageData.sender_id,
      response.content,
      { replyToId: rawMessage.id }
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

    log.info('[WhatsApp] Bot response sent', {
      channelId: channel.id,
      to: messageData.sender_id
    });

  } catch (error) {
    log.error('[WhatsApp] Error routing to bot engine', { error: error.message });
  }
}

module.exports = router;
