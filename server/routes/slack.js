/**
 * Slack Channel API Routes
 * Endpoints for managing Slack workspace integrations
 */

const express = require('express');
const router = express.Router();
const slackController = require('../controllers/slackController');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   GET /api/channels/slack/oauth
 * @desc    Start OAuth flow - get authorization URL
 * @access  Private
 * @query   botId - Optional bot ID to associate with workspace
 */
router.get('/oauth', authenticateToken, slackController.startOAuth);

/**
 * @route   GET /api/channels/slack/callback
 * @desc    OAuth callback - handle Slack redirect
 * @access  Public (Slack redirects here)
 * @query   code - Authorization code
 * @query   state - State token for verification
 */
router.get('/callback', slackController.oauthCallback);

// All routes below require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/channels/slack
 * @desc    Get all Slack workspaces for organization
 * @access  Private
 */
router.get('/', slackController.getChannels);

/**
 * @route   GET /api/channels/slack/stats
 * @desc    Get workspace statistics
 * @access  Private
 * @query   channelId - Optional specific workspace
 * @query   startDate - Start date for stats
 * @query   endDate - End date for stats
 */
router.get('/stats', slackController.getChannelStats);

/**
 * @route   POST /api/channels/slack/test
 * @desc    Test Slack connection
 * @access  Private
 * @body    channelId - Workspace channel ID to test
 */
router.post('/test', slackController.testConnection);

/**
 * @route   GET /api/channels/slack/:id
 * @desc    Get single Slack workspace
 * @access  Private
 */
router.get('/:id', slackController.getChannel);

/**
 * @route   PUT /api/channels/slack/:id
 * @desc    Update Slack workspace settings
 * @access  Private
 * @body    isActive - Enable/disable workspace
 * @body    settings - Workspace settings
 * @body    botId - Associated bot ID
 */
router.put('/:id', slackController.updateChannel);

/**
 * @route   DELETE /api/channels/slack/:id
 * @desc    Disconnect Slack workspace
 * @access  Private
 */
router.delete('/:id', slackController.disconnectSlack);

/**
 * @route   GET /api/channels/slack/:id/info
 * @desc    Get detailed workspace info from Slack
 * @access  Private
 */
router.get('/:id/info', slackController.getWorkspaceInfo);

/**
 * @route   GET /api/channels/slack/:id/channels
 * @desc    List Slack channels in workspace
 * @access  Private
 */
router.get('/:id/channels', slackController.listSlackChannels);

/**
 * @route   POST /api/channels/slack/:id/send-test
 * @desc    Send a test message to a Slack channel
 * @access  Private
 * @body    slackChannelId - Slack channel ID to send to
 * @body    message - Message text
 */
router.post('/:id/send-test', slackController.sendTestMessage);

module.exports = router;
