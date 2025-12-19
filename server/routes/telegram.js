/**
 * Telegram Channel API Routes
 * Endpoints for managing Telegram bot integrations
 */

const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegramController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/channels/telegram
 * @desc    Get all Telegram channels for organization
 * @access  Private
 */
router.get('/', telegramController.getChannels);

/**
 * @route   GET /api/channels/telegram/stats
 * @desc    Get channel statistics
 * @access  Private
 * @query   channelId - Optional specific channel
 * @query   startDate - Start date for stats
 * @query   endDate - End date for stats
 */
router.get('/stats', telegramController.getChannelStats);

/**
 * @route   POST /api/channels/telegram/connect
 * @desc    Connect a new Telegram bot
 * @access  Private
 * @body    botToken - Telegram bot token (required)
 * @body    botId - BotBuilder bot ID to connect (optional)
 */
router.post('/connect', telegramController.connectTelegram);

/**
 * @route   POST /api/channels/telegram/test
 * @desc    Test Telegram bot connection
 * @access  Private
 * @body    botToken - Bot token to test (or channelId)
 * @body    channelId - Existing channel ID to test
 */
router.post('/test', telegramController.testConnection);

/**
 * @route   GET /api/channels/telegram/:id
 * @desc    Get single Telegram channel
 * @access  Private
 */
router.get('/:id', telegramController.getChannel);

/**
 * @route   PUT /api/channels/telegram/:id
 * @desc    Update Telegram channel
 * @access  Private
 * @body    isActive - Enable/disable channel
 * @body    settings - Channel settings
 * @body    botId - Associated bot ID
 */
router.put('/:id', telegramController.updateChannel);

/**
 * @route   DELETE /api/channels/telegram/:id
 * @desc    Disconnect Telegram bot
 * @access  Private
 */
router.delete('/:id', telegramController.disconnectTelegram);

/**
 * @route   POST /api/channels/telegram/:id/send-test
 * @desc    Send a test message
 * @access  Private
 * @body    chatId - Chat ID to send to
 * @body    message - Message text
 */
router.post('/:id/send-test', telegramController.sendTestMessage);

/**
 * @route   POST /api/channels/telegram/:id/refresh-webhook
 * @desc    Refresh webhook URL and secret
 * @access  Private
 */
router.post('/:id/refresh-webhook', telegramController.refreshWebhook);

module.exports = router;
