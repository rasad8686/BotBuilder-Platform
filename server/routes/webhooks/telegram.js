/**
 * Telegram Webhook Routes
 * Handles incoming updates from Telegram Bot API
 */

const express = require('express');
const router = express.Router();
const telegramService = require('../../services/channels/telegramService');
const db = require('../../db');

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
      console.warn(`[Telegram Webhook] Unknown bot ID: ${botId}`);
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Verify webhook signature
    if (channel.webhook_secret && channel.webhook_secret !== secretToken) {
      console.warn(`[Telegram Webhook] Invalid secret token for bot: ${botId}`);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse the incoming update
    const update = req.body;
    const messageData = telegramService.handleIncomingMessage(update);

    console.log(`[Telegram Webhook] Received ${messageData.type} from ${messageData.username || messageData.userId}`);

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
    console.error('[Telegram Webhook] Error processing update:', error);
    // Still return 200 to prevent Telegram from retrying
    res.status(200).json({ ok: true, error: 'Processing error' });
  }
});

/**
 * Route message to bot engine for AI processing
 * @param {Object} channel - Telegram channel record
 * @param {Object} messageData - Parsed message data
 */
async function routeMessageToBotEngine(channel, messageData) {
  try {
    // Get associated bot
    const bot = await db('bots')
      .where({ id: channel.bot_id })
      .first();

    if (!bot || bot.status !== 'active') {
      console.log(`[Telegram] Bot ${channel.bot_id} is not active`);
      return;
    }

    // Skip non-text messages for now (can be extended)
    if (!messageData.text || messageData.type === 'callback_query') {
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
    const response = await processBotMessage(bot, messageData);

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
    console.error('[Telegram] Error routing message:', error);

    // Send error message to user
    try {
      await telegramService.sendMessage(
        channel.bot_token,
        messageData.chatId,
        '❌ Sorry, I encountered an error processing your message. Please try again.',
        { parseMode: 'HTML' }
      );
    } catch (sendError) {
      console.error('[Telegram] Error sending error message:', sendError);
    }
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
 * Process message through bot AI engine
 * @param {Object} bot - Bot record
 * @param {Object} messageData - Message data
 * @returns {Object} Response object
 */
async function processBotMessage(bot, messageData) {
  // This integrates with the existing bot engine
  // For now, return a placeholder - will be connected to actual AI service

  try {
    // Get bot's AI configuration
    const aiConfig = bot.ai_config ? JSON.parse(bot.ai_config) : {};

    // Get or create conversation session
    let session = await db('telegram_sessions')
      .where({
        channel_id: messageData.channelId,
        chat_id: messageData.chatId?.toString()
      })
      .first();

    if (!session) {
      session = await db('telegram_sessions').insert({
        channel_id: messageData.channelId,
        chat_id: messageData.chatId?.toString(),
        user_id: messageData.userId?.toString(),
        username: messageData.username,
        context: JSON.stringify([]),
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');
      session = session[0];
    }

    // Here you would integrate with your AI service
    // For now, echo back the message as acknowledgment
    return {
      text: `📝 Message received: "${messageData.text}"\n\n<i>AI processing will be connected to the main bot engine.</i>`,
      keyboard: null
    };

  } catch (error) {
    console.error('[Telegram] Error processing bot message:', error);
    throw error;
  }
}

module.exports = router;
