/**
 * Telegram Webhook Routes
 * Handles incoming updates from Telegram Bot API
 * Full-featured with AI/RAG support, analytics, and rate limiting
 */

const express = require('express');
const router = express.Router();
const telegramService = require('../../services/channels/telegramService');
const db = require('../../db');

// Rate limiting tracker
const rateLimitTracker = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

/**
 * POST /api/webhooks/telegram/:botId
 * Telegram webhook endpoint - receives updates from Telegram
 */
router.post('/:botId', async (req, res) => {
  const { botId } = req.params;
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];

  try {
    // Find telegram channel by botId
    const channel = await db('telegram_channels')
      .where({ bot_id: botId, is_active: true })
      .first();

    if (!channel) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Verify webhook signature
    if (channel.webhook_secret && channel.webhook_secret !== secretToken) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse the incoming update
    const update = req.body;
    const messageData = telegramService.handleIncomingMessage(update);

    // Store update for processing
    await db('telegram_messages').insert({
      channel_id: channel.id,
      update_id: messageData.updateId,
      message_type: messageData.type,
      chat_id: messageData.chatId?.toString(),
      user_id: messageData.userId?.toString(),
      username: messageData.username,
      message_text: messageData.text,
      message_id: messageData.messageId?.toString(),
      raw_data: JSON.stringify(update),
      created_at: new Date()
    });

    // Route message to bot engine for processing
    await routeMessageToBotEngine(channel, messageData);

    // Answer callback queries immediately
    if (messageData.type === 'callback_query' && messageData.callbackQueryId) {
      await telegramService.answerCallbackQuery(
        channel.bot_token,
        messageData.callbackQueryId,
        { text: '' }
      );
    }

    // Telegram expects 200 OK
    res.status(200).json({ ok: true });

  } catch (error) {
    // Telegram Webhook Error - silent fail
    // Still return 200 to prevent Telegram from retrying
    res.status(200).json({ ok: true, error: 'Processing error' });
  }
});

/**
 * Check rate limit for a chat
 * @param {string} chatId - Chat ID
 * @returns {boolean} - True if rate limited
 */
function isRateLimited(chatId) {
  const now = Date.now();
  const key = chatId.toString();

  if (!rateLimitTracker.has(key)) {
    rateLimitTracker.set(key, { count: 1, windowStart: now });
    return false;
  }

  const tracker = rateLimitTracker.get(key);

  // Reset window if expired
  if (now - tracker.windowStart > RATE_LIMIT_WINDOW) {
    tracker.count = 1;
    tracker.windowStart = now;
    return false;
  }

  // Check if over limit
  if (tracker.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  tracker.count++;
  return false;
}

/**
 * Route message to bot engine for AI processing
 * @param {Object} channel - Telegram channel record
 * @param {Object} messageData - Parsed message data
 */
async function routeMessageToBotEngine(channel, messageData) {
  try {
    // Check rate limit
    if (isRateLimited(messageData.chatId)) {
      await telegramService.sendMessage(
        channel.bot_token,
        messageData.chatId,
        'You are sending messages too quickly. Please wait a moment.',
        { parseMode: 'HTML' }
      );
      return;
    }

    // Get associated bot
    const bot = await db('bots')
      .where({ id: channel.bot_id })
      .first();

    if (!bot || bot.status !== 'active') {
      return;
    }

    // Handle callback queries
    if (messageData.type === 'callback_query') {
      await handleCallbackQuery(channel, messageData, bot);
      return;
    }

    // Handle media messages
    if (['photo', 'video', 'audio', 'document', 'voice', 'sticker'].includes(messageData.type)) {
      await handleMediaMessage(channel, messageData, bot);
      return;
    }

    // Handle location messages
    if (messageData.type === 'location') {
      await handleLocationMessage(channel, messageData, bot);
      return;
    }

    // Skip if no text
    if (!messageData.text) {
      return;
    }

    // Check if this is a command
    if (messageData.text.startsWith('/')) {
      await handleCommand(channel, messageData, bot);
      return;
    }

    // Send typing indicator
    await telegramService.sendChatAction(
      channel.bot_token,
      messageData.chatId,
      'typing'
    );

    // Process message through bot engine
    const response = await processBotMessage(bot, messageData, channel);

    // Send response
    if (response) {
      await telegramService.sendMessage(
        channel.bot_token,
        messageData.chatId,
        response.text,
        {
          parseMode: 'HTML',
          keyboard: response.keyboard,
          replyToMessageId: messageData.messageId
        }
      );
    }

  } catch (error) {
    // Send error message to user
    try {
      await telegramService.sendMessage(
        channel.bot_token,
        messageData.chatId,
        'Sorry, I encountered an error processing your message. Please try again.',
        { parseMode: 'HTML' }
      );
    } catch (sendError) {
      // Silent fail
    }
  }
}

/**
 * Handle callback query (inline button press)
 * @param {Object} channel - Channel record
 * @param {Object} messageData - Message data
 * @param {Object} bot - Bot record
 */
async function handleCallbackQuery(channel, messageData, bot) {
  const callbackData = messageData.text;
  const botSettings = bot.settings ? JSON.parse(bot.settings) : {};

  // Check for predefined actions
  if (callbackData.startsWith('action:')) {
    const action = callbackData.replace('action:', '');
    const actions = botSettings.callbackActions || {};

    if (actions[action]) {
      await telegramService.sendMessage(
        channel.bot_token,
        messageData.chatId,
        actions[action].response,
        {
          parseMode: 'HTML',
          keyboard: actions[action].keyboard
        }
      );
      return;
    }
  }

  // Process as regular message for AI
  const response = await processBotMessage(bot, {
    ...messageData,
    text: `Button pressed: ${callbackData}`
  }, channel);

  if (response) {
    // Edit original message or send new one
    try {
      await telegramService.editMessageText(
        channel.bot_token,
        messageData.chatId,
        messageData.messageId,
        response.text,
        { parseMode: 'HTML', keyboard: response.keyboard }
      );
    } catch (editError) {
      // If edit fails, send new message
      await telegramService.sendMessage(
        channel.bot_token,
        messageData.chatId,
        response.text,
        { parseMode: 'HTML', keyboard: response.keyboard }
      );
    }
  }
}

/**
 * Handle media messages
 * @param {Object} channel - Channel record
 * @param {Object} messageData - Message data
 * @param {Object} bot - Bot record
 */
async function handleMediaMessage(channel, messageData, bot) {
  const botSettings = bot.settings ? JSON.parse(bot.settings) : {};

  // Check if media handling is enabled
  if (botSettings.handleMedia === false) {
    await telegramService.sendMessage(
      channel.bot_token,
      messageData.chatId,
      'I can only process text messages at the moment.',
      { parseMode: 'HTML' }
    );
    return;
  }

  // Send appropriate chat action
  const actions = {
    photo: 'upload_photo',
    video: 'upload_video',
    audio: 'upload_audio',
    document: 'upload_document',
    voice: 'record_voice',
    sticker: 'typing'
  };

  await telegramService.sendChatAction(
    channel.bot_token,
    messageData.chatId,
    actions[messageData.type] || 'typing'
  );

  // Create description for AI
  let mediaDescription = `[${messageData.type.toUpperCase()}]`;
  if (messageData.text) {
    mediaDescription += ` Caption: ${messageData.text}`;
  }

  // Process through AI
  const response = await processBotMessage(bot, {
    ...messageData,
    text: mediaDescription
  }, channel);

  if (response) {
    await telegramService.sendMessage(
      channel.bot_token,
      messageData.chatId,
      response.text,
      {
        parseMode: 'HTML',
        keyboard: response.keyboard,
        replyToMessageId: messageData.messageId
      }
    );
  }
}

/**
 * Handle location messages
 * @param {Object} channel - Channel record
 * @param {Object} messageData - Message data
 * @param {Object} bot - Bot record
 */
async function handleLocationMessage(channel, messageData, bot) {
  const location = messageData.location;

  if (!location) return;

  const response = await processBotMessage(bot, {
    ...messageData,
    text: `[LOCATION] Latitude: ${location.latitude}, Longitude: ${location.longitude}`
  }, channel);

  if (response) {
    await telegramService.sendMessage(
      channel.bot_token,
      messageData.chatId,
      response.text,
      {
        parseMode: 'HTML',
        keyboard: response.keyboard,
        replyToMessageId: messageData.messageId
      }
    );
  }
}

/**
 * Handle Telegram commands (/start, /help, etc.)
 * @param {Object} channel - Telegram channel
 * @param {Object} messageData - Message data
 * @param {Object} bot - Bot record
 */
async function handleCommand(channel, messageData, bot) {
  const command = messageData.text.split(' ')[0].toLowerCase();
  const args = messageData.text.split(' ').slice(1).join(' ');

  let response;

  switch (command) {
    case '/start':
      response = {
        text: `👋 <b>Welcome to ${bot.name}!</b>\n\n${bot.description || 'How can I help you today?'}\n\nJust send me a message to get started.`,
        keyboard: channel.settings?.startKeyboard ? {
          inline: true,
          buttons: JSON.parse(channel.settings.startKeyboard)
        } : null
      };
      break;

    case '/help':
      response = {
        text: `ℹ️ <b>Help</b>\n\nI'm ${bot.name}, your AI assistant.\n\n<b>Commands:</b>\n/start - Start the bot\n/help - Show this help message\n/info - Bot information\n\nJust type your question or message and I'll do my best to help!`
      };
      break;

    case '/info':
      response = {
        text: `🤖 <b>Bot Information</b>\n\n<b>Name:</b> ${bot.name}\n<b>Description:</b> ${bot.description || 'No description'}\n<b>Powered by:</b> BotBuilder Platform`
      };
      break;

    default:
      // Unknown command - treat as regular message
      return;
  }

  if (response) {
    await telegramService.sendMessage(
      channel.bot_token,
      messageData.chatId,
      response.text,
      {
        parseMode: 'HTML',
        keyboard: response.keyboard
      }
    );
  }
}

/**
 * Process message through bot AI engine with RAG support
 * @param {Object} bot - Bot record
 * @param {Object} messageData - Message data
 * @param {Object} channel - Channel record
 * @returns {Object} Response object
 */
async function processBotMessage(bot, messageData, channel) {
  try {
    // Get bot's AI configuration
    const aiConfig = bot.ai_config ? JSON.parse(bot.ai_config) : {};
    const botSettings = bot.settings ? JSON.parse(bot.settings) : {};

    // Get or create conversation session
    let session = await db('telegram_sessions')
      .where({
        channel_id: channel.id,
        chat_id: messageData.chatId?.toString()
      })
      .first();

    if (!session) {
      const [newSession] = await db('telegram_sessions').insert({
        channel_id: channel.id,
        chat_id: messageData.chatId?.toString(),
        user_id: messageData.userId?.toString(),
        username: messageData.username,
        context: JSON.stringify([]),
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');
      session = newSession;
    }

    // Get conversation context
    let context = [];
    try {
      context = JSON.parse(session.context || '[]');
    } catch (e) {
      context = [];
    }

    // Add user message to context
    context.push({
      role: 'user',
      content: messageData.text,
      timestamp: new Date().toISOString()
    });

    // Keep only last 10 messages for context
    if (context.length > 10) {
      context = context.slice(-10);
    }

    // Try to get AI response from bot engine
    let aiResponse = null;

    try {
      // Check if RAG is enabled for this bot
      const knowledgeBase = await db('knowledge_bases')
        .where({ bot_id: bot.id, is_active: true })
        .first();

      if (knowledgeBase) {
        // Search knowledge base for relevant context
        const relevantDocs = await searchKnowledgeBase(bot.id, messageData.text);

        if (relevantDocs && relevantDocs.length > 0) {
          const ragContext = relevantDocs.map(doc => doc.content).join('\n\n');

          // Generate AI response with RAG context
          aiResponse = await generateAIResponse(bot, messageData.text, context, ragContext);
        }
      }

      // If no RAG or no relevant docs, use regular AI
      if (!aiResponse) {
        aiResponse = await generateAIResponse(bot, messageData.text, context, null);
      }
    } catch (aiError) {
      // AI error - use fallback
      aiResponse = {
        text: botSettings.fallbackMessage || 'I apologize, but I\'m having trouble processing your request. Please try again.',
        keyboard: null
      };
    }

    // Add assistant response to context
    context.push({
      role: 'assistant',
      content: aiResponse.text,
      timestamp: new Date().toISOString()
    });

    // Update session context
    await db('telegram_sessions')
      .where({ id: session.id })
      .update({
        context: JSON.stringify(context),
        updated_at: new Date()
      });

    // Log analytics
    await logMessageAnalytics(channel.id, messageData, aiResponse);

    return aiResponse;

  } catch (error) {
    return {
      text: 'An error occurred processing your message. Please try again.',
      keyboard: null
    };
  }
}

/**
 * Search knowledge base for relevant documents
 * @param {number} botId - Bot ID
 * @param {string} query - Search query
 * @returns {Array} Relevant documents
 */
async function searchKnowledgeBase(botId, query) {
  try {
    // Get knowledge base documents
    const documents = await db('knowledge_documents')
      .where({ bot_id: botId, is_active: true })
      .select('id', 'title', 'content', 'metadata');

    if (!documents || documents.length === 0) {
      return [];
    }

    // Simple keyword-based search (can be replaced with vector search)
    const queryWords = query.toLowerCase().split(/\s+/);
    const scoredDocs = documents.map(doc => {
      const content = (doc.content || '').toLowerCase();
      const title = (doc.title || '').toLowerCase();

      let score = 0;
      queryWords.forEach(word => {
        if (content.includes(word)) score += 1;
        if (title.includes(word)) score += 2;
      });

      return { ...doc, score };
    });

    // Return top 3 relevant documents
    return scoredDocs
      .filter(doc => doc.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

  } catch (error) {
    return [];
  }
}

/**
 * Generate AI response using bot's AI configuration
 * @param {Object} bot - Bot record
 * @param {string} userMessage - User's message
 * @param {Array} context - Conversation context
 * @param {string} ragContext - RAG context from knowledge base
 * @returns {Object} AI response
 */
async function generateAIResponse(bot, userMessage, context, ragContext) {
  const aiConfig = bot.ai_config ? JSON.parse(bot.ai_config) : {};
  const botSettings = bot.settings ? JSON.parse(bot.settings) : {};

  // Build system prompt
  let systemPrompt = aiConfig.systemPrompt || botSettings.systemPrompt ||
    `You are ${bot.name}, a helpful AI assistant. ${bot.description || ''}`;

  // Add RAG context if available
  if (ragContext) {
    systemPrompt += `\n\nUse the following information to help answer the user's question:\n${ragContext}`;
  }

  // Try to use configured AI provider
  const aiProvider = aiConfig.provider || 'openai';
  const aiModel = aiConfig.model || 'gpt-3.5-turbo';

  try {
    // Check for API key in bot config or environment
    const apiKey = aiConfig.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // No API key - return a helpful message
      return {
        text: `Thank you for your message! I'm ${bot.name}. I received: "${userMessage}"\n\nTo enable AI responses, please configure an API key in your bot settings.`,
        keyboard: null
      };
    }

    // Make AI API call based on provider
    if (aiProvider === 'openai' || aiProvider === 'azure') {
      const response = await callOpenAI(apiKey, aiModel, systemPrompt, context, userMessage, aiConfig);
      return {
        text: response,
        keyboard: null
      };
    } else if (aiProvider === 'anthropic') {
      const response = await callAnthropic(apiKey, aiModel, systemPrompt, context, userMessage, aiConfig);
      return {
        text: response,
        keyboard: null
      };
    } else {
      // Fallback for unknown provider
      return {
        text: `Thank you for your message! I received: "${userMessage}"`,
        keyboard: null
      };
    }
  } catch (error) {
    // Return fallback response on error
    return {
      text: botSettings.fallbackMessage || 'I apologize, but I\'m having trouble processing your request right now. Please try again later.',
      keyboard: null
    };
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(apiKey, model, systemPrompt, context, userMessage, config) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...context.slice(-8).map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];

  const response = await fetch(config.baseUrl || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call Anthropic API
 */
async function callAnthropic(apiKey, model, systemPrompt, context, userMessage, config) {
  const messages = context.slice(-8).map(msg => ({
    role: msg.role,
    content: msg.content
  }));
  messages.push({ role: 'user', content: userMessage });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-3-haiku-20240307',
      max_tokens: config.maxTokens || 1000,
      system: systemPrompt,
      messages: messages
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Log message analytics
 */
async function logMessageAnalytics(channelId, messageData, response) {
  try {
    await db('telegram_analytics').insert({
      channel_id: channelId,
      chat_id: messageData.chatId?.toString(),
      user_id: messageData.userId?.toString(),
      message_type: messageData.type,
      message_length: (messageData.text || '').length,
      response_length: (response.text || '').length,
      has_keyboard: !!response.keyboard,
      created_at: new Date()
    });
  } catch (error) {
    // Analytics logging error - silent fail
  }
}

module.exports = router;
