/**
 * Facebook Messenger Webhook Routes
 * Handles incoming messages and webhook verification
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const log = require('../../utils/logger');
const FacebookProvider = require('../../channels/providers/FacebookProvider');
const facebookService = require('../../services/channels/facebookService');

// Rate limiting storage
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // Max requests per window

/**
 * Rate limiter middleware
 */
const rateLimiter = (req, res, next) => {
  const pageId = req.body?.entry?.[0]?.id || 'unknown';
  const now = Date.now();

  if (!rateLimitMap.has(pageId)) {
    rateLimitMap.set(pageId, { count: 1, startTime: now });
    return next();
  }

  const rateData = rateLimitMap.get(pageId);

  if (now - rateData.startTime > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(pageId, { count: 1, startTime: now });
    return next();
  }

  if (rateData.count >= RATE_LIMIT_MAX) {
    log.warn('Facebook webhook rate limit exceeded', { pageId });
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  rateData.count++;
  next();
};

/**
 * GET /webhooks/facebook
 * Webhook verification endpoint
 */
router.get('/', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    log.info('Facebook webhook verification request', { mode, hasToken: !!token });

    // Get verify token from environment or database
    const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      log.info('Facebook webhook verified successfully');
      return res.status(200).send(challenge);
    }

    log.warn('Facebook webhook verification failed', { mode, tokenMatch: token === verifyToken });
    return res.status(403).json({ error: 'Verification failed' });
  } catch (error) {
    log.error('Facebook webhook verification error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /webhooks/facebook
 * Incoming messages endpoint
 */
router.post('/', rateLimiter, async (req, res) => {
  try {
    // Immediately respond to Facebook (required within 20 seconds)
    res.status(200).send('EVENT_RECEIVED');

    const body = req.body;

    // Validate request signature
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = JSON.stringify(body);
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (appSecret && signature) {
      const provider = new FacebookProvider({ appSecret });
      if (!provider.validateSignature(rawBody, signature)) {
        log.warn('Facebook webhook invalid signature');
        return;
      }
    }

    // Process only page events
    if (body.object !== 'page') {
      log.debug('Facebook webhook non-page event', { object: body.object });
      return;
    }

    // Process each entry
    for (const entry of body.entry || []) {
      const pageId = entry.id;

      // Get page configuration from database
      const pageConfig = await getPageConfig(pageId);
      if (!pageConfig) {
        log.warn('Facebook page not configured', { pageId });
        continue;
      }

      const provider = new FacebookProvider({
        pageAccessToken: pageConfig.access_token,
        appSecret: process.env.FACEBOOK_APP_SECRET
      });

      // Parse events
      const events = provider.parseWebhookEvent({ object: 'page', entry: [entry] });

      // Process each event
      for (const event of events) {
        await processEvent(event, provider, pageConfig);
      }
    }
  } catch (error) {
    log.error('Facebook webhook processing error', { error: error.message, stack: error.stack });
  }
});

/**
 * Get page configuration from database
 */
async function getPageConfig(pageId) {
  try {
    const result = await db.query(
      `SELECT fp.*, b.id as bot_id, b.name as bot_name, b.ai_enabled, b.ai_model,
              b.system_prompt, b.knowledge_base_enabled
       FROM facebook_pages fp
       LEFT JOIN bots b ON b.id = fp.bot_id
       WHERE fp.page_id = $1 AND fp.is_active = true`,
      [pageId]
    );

    return result.rows[0] || null;
  } catch (error) {
    log.error('Error getting Facebook page config', { error: error.message, pageId });
    return null;
  }
}

/**
 * Process webhook event
 */
async function processEvent(event, provider, pageConfig) {
  const { senderId, type } = event;

  if (!senderId) return;

  try {
    // Skip echo events (messages sent by the page)
    if (type === 'echo') {
      log.debug('Facebook echo event skipped', { senderId });
      return;
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(senderId, pageConfig);

    // Mark message as seen
    await provider.markSeen(senderId);

    // Handle different event types
    switch (type) {
      case 'text':
        await handleTextMessage(event, provider, pageConfig, conversation);
        break;

      case 'attachments':
        await handleAttachments(event, provider, pageConfig, conversation);
        break;

      case 'postback':
        await handlePostback(event, provider, pageConfig, conversation);
        break;

      case 'referral':
        await handleReferral(event, provider, pageConfig, conversation);
        break;

      case 'delivery':
        await handleDelivery(event, pageConfig, conversation);
        break;

      case 'read':
        await handleRead(event, pageConfig, conversation);
        break;

      case 'reaction':
        await handleReaction(event, pageConfig, conversation);
        break;

      default:
        log.debug('Facebook unhandled event type', { type, senderId });
    }
  } catch (error) {
    log.error('Facebook event processing error', { error: error.message, type, senderId });
  }
}

/**
 * Get or create conversation
 */
async function getOrCreateConversation(senderId, pageConfig) {
  try {
    // Check for existing conversation
    let result = await db.query(
      `SELECT * FROM facebook_conversations
       WHERE sender_id = $1 AND page_id = $2`,
      [senderId, pageConfig.page_id]
    );

    if (result.rows.length > 0) {
      // Update last activity
      await db.query(
        `UPDATE facebook_conversations SET last_activity_at = NOW() WHERE id = $1`,
        [result.rows[0].id]
      );
      return result.rows[0];
    }

    // Get user profile
    let userProfile = { firstName: 'User', lastName: '' };
    try {
      const provider = new FacebookProvider({ pageAccessToken: pageConfig.access_token });
      const profileResult = await provider.getUserProfile(senderId);
      if (profileResult.success) {
        userProfile = profileResult.profile;
      }
    } catch (e) {
      log.debug('Could not get user profile', { senderId });
    }

    // Create new conversation
    result = await db.query(
      `INSERT INTO facebook_conversations (
        facebook_page_id, page_id, sender_id, user_first_name, user_last_name,
        user_profile_pic, status, created_at, last_activity_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
      RETURNING *`,
      [
        pageConfig.id,
        pageConfig.page_id,
        senderId,
        userProfile.firstName || 'User',
        userProfile.lastName || '',
        userProfile.profilePic || null
      ]
    );

    return result.rows[0];
  } catch (error) {
    log.error('Error getting/creating conversation', { error: error.message, senderId });
    return null;
  }
}

/**
 * Handle text message
 */
async function handleTextMessage(event, provider, pageConfig, conversation) {
  const { senderId, text, quickReply, messageId } = event;

  // Save incoming message
  await saveMessage({
    conversationId: conversation.id,
    messageId,
    direction: 'incoming',
    type: 'text',
    content: text,
    payload: quickReply ? { quickReply } : null
  });

  // Show typing indicator
  await provider.showTypingOn(senderId);

  let responseText = '';

  // Check for quick reply payload
  if (quickReply) {
    responseText = await handleQuickReplyPayload(quickReply, pageConfig);
  }
  // AI/RAG response
  else if (pageConfig.ai_enabled && pageConfig.bot_id) {
    responseText = await generateAIResponse(text, pageConfig, conversation);
  }
  // Default response
  else {
    responseText = pageConfig.default_response || 'Thank you for your message. We will get back to you soon.';
  }

  // Hide typing indicator
  await provider.showTypingOff(senderId);

  // Send response
  if (responseText) {
    const result = await provider.sendText(senderId, responseText);

    if (result.success) {
      await saveMessage({
        conversationId: conversation.id,
        messageId: result.messageId,
        direction: 'outgoing',
        type: 'text',
        content: responseText
      });
    }
  }

  // Update conversation statistics
  await updateConversationStats(conversation.id);
}

/**
 * Handle attachments
 */
async function handleAttachments(event, provider, pageConfig, conversation) {
  const { senderId, attachments, messageId } = event;

  for (const attachment of attachments) {
    // Save incoming attachment
    await saveMessage({
      conversationId: conversation.id,
      messageId,
      direction: 'incoming',
      type: attachment.type,
      content: attachment.url || '',
      payload: attachment
    });

    // Handle location attachment specially
    if (attachment.type === 'location' && attachment.coordinates) {
      const { lat, long } = attachment.coordinates;
      await provider.sendText(
        senderId,
        `Thank you for sharing your location (${lat}, ${long}). How can we help you in this area?`
      );
    }
    // Default attachment response
    else {
      const responses = {
        image: 'Thank you for sharing the image.',
        video: 'Thank you for sharing the video.',
        audio: 'Thank you for the audio message.',
        file: 'Thank you for sharing the file.'
      };

      const response = responses[attachment.type] || 'Thank you for your message.';
      await provider.sendText(senderId, response);
    }
  }

  await updateConversationStats(conversation.id);
}

/**
 * Handle postback
 */
async function handlePostback(event, provider, pageConfig, conversation) {
  const { senderId, payload, title } = event;

  log.info('Facebook postback received', { senderId, payload, title });

  // Save postback as message
  await saveMessage({
    conversationId: conversation.id,
    direction: 'incoming',
    type: 'postback',
    content: title || payload,
    payload: { payload, title }
  });

  // Handle specific payloads
  let responseText = '';

  if (payload === 'GET_STARTED') {
    responseText = pageConfig.welcome_message ||
      `Welcome! I'm here to help. How can I assist you today?`;
  } else {
    // Custom payload handling
    responseText = await handlePostbackPayload(payload, pageConfig, conversation);
  }

  if (responseText) {
    await provider.sendText(senderId, responseText);
  }
}

/**
 * Handle referral
 */
async function handleReferral(event, provider, pageConfig, conversation) {
  const { senderId, ref, source, adId } = event;

  log.info('Facebook referral received', { senderId, ref, source, adId });

  // Save referral info
  await db.query(
    `UPDATE facebook_conversations SET
      referral_ref = $1, referral_source = $2, referral_ad_id = $3
     WHERE id = $4`,
    [ref, source, adId, conversation.id]
  );

  // Send welcome message with referral context
  let welcomeMessage = pageConfig.welcome_message || 'Welcome! How can I help you today?';

  if (ref) {
    // Custom handling based on ref parameter
    welcomeMessage = `Welcome! ${ref ? `(Ref: ${ref})` : ''} How can I help you today?`;
  }

  await provider.sendText(senderId, welcomeMessage);
}

/**
 * Handle delivery receipt
 */
async function handleDelivery(event, pageConfig, conversation) {
  const { mids, watermark } = event;

  if (mids && mids.length > 0) {
    for (const mid of mids) {
      await db.query(
        `UPDATE facebook_messages SET delivered_at = NOW() WHERE message_id = $1`,
        [mid]
      );
    }
  }
}

/**
 * Handle read receipt
 */
async function handleRead(event, pageConfig, conversation) {
  const { watermark } = event;

  if (watermark) {
    await db.query(
      `UPDATE facebook_messages SET read_at = NOW()
       WHERE conversation_id = $1 AND direction = 'outgoing'
       AND created_at <= to_timestamp($2 / 1000)`,
      [conversation.id, watermark]
    );
  }
}

/**
 * Handle reaction
 */
async function handleReaction(event, pageConfig, conversation) {
  const { mid, reaction, emoji, action } = event;

  log.info('Facebook reaction received', { mid, reaction, emoji, action });

  if (mid) {
    await db.query(
      `UPDATE facebook_messages SET reaction = $1, reaction_emoji = $2 WHERE message_id = $3`,
      [action === 'react' ? reaction : null, action === 'react' ? emoji : null, mid]
    );
  }
}

/**
 * Handle quick reply payload
 */
async function handleQuickReplyPayload(payload, pageConfig) {
  // Custom quick reply handling
  const quickReplyResponses = {
    'YES': 'Great! Let me help you further.',
    'NO': 'No problem. Is there anything else I can help with?',
    'HELP': 'Here are some things I can help you with...',
    'CONTACT': 'You can reach us at support@example.com or call us at +1-234-567-890.'
  };

  return quickReplyResponses[payload] || null;
}

/**
 * Handle postback payload
 */
async function handlePostbackPayload(payload, pageConfig, conversation) {
  // Custom postback handling based on payload
  const postbackResponses = {
    'MENU_HELP': 'How can I help you today? You can ask me about our products, services, or support.',
    'MENU_PRODUCTS': 'We offer a variety of products. What category are you interested in?',
    'MENU_SUPPORT': 'For support, please describe your issue and we\'ll help you resolve it.',
    'MENU_CONTACT': 'You can reach us at support@example.com or through this chat.'
  };

  return postbackResponses[payload] || 'Thank you for your selection. How can I help you?';
}

/**
 * Generate AI response using bot configuration
 */
async function generateAIResponse(userMessage, pageConfig, conversation) {
  try {
    // Get AI service
    const AIService = require('../../services/ai/aiService');
    const aiService = new AIService();

    // Get conversation history
    const historyResult = await db.query(
      `SELECT direction, content FROM facebook_messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [conversation.id]
    );

    const conversationHistory = historyResult.rows.reverse().map(msg => ({
      role: msg.direction === 'incoming' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Generate response
    const response = await aiService.generateResponse({
      botId: pageConfig.bot_id,
      message: userMessage,
      conversationHistory,
      systemPrompt: pageConfig.system_prompt,
      model: pageConfig.ai_model || 'gpt-4',
      useKnowledgeBase: pageConfig.knowledge_base_enabled
    });

    return response.text || response.content || 'I apologize, but I couldn\'t generate a response. Please try again.';
  } catch (error) {
    log.error('Facebook AI response error', { error: error.message });
    return 'I apologize, but I\'m having trouble processing your request. Please try again later.';
  }
}

/**
 * Save message to database
 */
async function saveMessage(params) {
  const { conversationId, messageId, direction, type, content, payload } = params;

  try {
    await db.query(
      `INSERT INTO facebook_messages (
        conversation_id, message_id, direction, type, content, payload, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (message_id) DO NOTHING`,
      [conversationId, messageId || `msg_${Date.now()}`, direction, type, content, JSON.stringify(payload || {})]
    );
  } catch (error) {
    log.error('Error saving Facebook message', { error: error.message });
  }
}

/**
 * Update conversation statistics
 */
async function updateConversationStats(conversationId) {
  try {
    await db.query(
      `UPDATE facebook_conversations SET
        message_count = (SELECT COUNT(*) FROM facebook_messages WHERE conversation_id = $1),
        last_activity_at = NOW()
       WHERE id = $1`,
      [conversationId]
    );
  } catch (error) {
    log.error('Error updating conversation stats', { error: error.message });
  }
}

module.exports = router;
