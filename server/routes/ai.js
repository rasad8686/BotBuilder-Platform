const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const { checkPermission } = require('../middleware/checkPermission');
const {
  getAIConfig,
  configureAI,
  deleteAIConfig,
  sendChat,
  sendChatStream,
  testAIConnection,
  getAIUsage,
  getOrganizationAIBilling,
  getProviders,
  getModels
} = require('../controllers/aiController');

/**
 * AI Routes
 * All routes for AI configuration, chat, and usage tracking
 */

// ═══════════════════════════════════════════════════════════
// PUBLIC ROUTES (No authentication needed)
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/ai/providers
 * Get list of available AI providers
 * Public - no auth required
 */
router.get('/providers', getProviders);

/**
 * GET /api/ai/models/:provider
 * Get available models for a specific provider
 * Public - no auth required
 */
router.get('/models/:provider', getModels);

// ═══════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES
// Apply authentication and organization middleware
// ═══════════════════════════════════════════════════════════

router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

// ═══════════════════════════════════════════════════════════
// BOT AI CONFIGURATION ROUTES
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/bots/:botId/ai/configure
 * Get AI configuration for a bot
 * Permission: viewer or higher
 */
router.get('/:botId/ai/configure', checkPermission('viewer'), getAIConfig);

/**
 * POST /api/bots/:botId/ai/configure
 * Create or update AI configuration for a bot
 * Permission: member or higher
 * Body: {
 *   provider: 'openai' | 'claude',
 *   model: 'gpt-4o-mini' | 'claude-3-5-sonnet-20241022',
 *   api_key: 'sk-...' (optional),
 *   temperature: 0.7 (optional),
 *   max_tokens: 1000 (optional),
 *   system_prompt: 'You are...' (optional),
 *   context_window: 10 (optional),
 *   enable_streaming: true (optional),
 *   is_enabled: true (optional)
 * }
 */
router.post('/:botId/ai/configure', checkPermission('member'), configureAI);

/**
 * DELETE /api/bots/:botId/ai/configure
 * Delete AI configuration for a bot
 * Permission: admin only
 */
router.delete('/:botId/ai/configure', checkPermission('admin'), deleteAIConfig);

/**
 * POST /api/bots/:botId/ai/test
 * Test AI connection for a bot
 * Permission: viewer or higher
 */
router.post('/:botId/ai/test', checkPermission('viewer'), testAIConnection);

// ═══════════════════════════════════════════════════════════
// AI CHAT ROUTES
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/bots/:botId/ai/chat
 * Send a chat message to AI
 * Permission: member or higher
 * Body: {
 *   message: 'User message',
 *   sessionId: 'unique_session_id'
 * }
 */
router.post('/:botId/ai/chat', checkPermission('member'), sendChat);

/**
 * POST /api/bots/:botId/ai/chat/stream
 * Send a streaming chat message to AI (Server-Sent Events)
 * Permission: member or higher
 * Body: {
 *   message: 'User message',
 *   sessionId: 'unique_session_id'
 * }
 * Response: SSE stream with events:
 *   - { type: 'chunk', content: '...', fullContent: '...' }
 *   - { type: 'done', content: '...', usage: {...}, cost: 0.001, responseTime: 1234 }
 *   - { type: 'error', message: '...' }
 */
router.post('/:botId/ai/chat/stream', checkPermission('member'), sendChatStream);

// ═══════════════════════════════════════════════════════════
// AI USAGE & BILLING ROUTES
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/bots/:botId/ai/usage
 * Get AI usage statistics for a bot
 * Permission: viewer or higher
 * Query params: startDate, endDate, limit
 */
router.get('/:botId/ai/usage', checkPermission('viewer'), getAIUsage);

/**
 * GET /api/organizations/:orgId/ai/billing
 * Get AI billing information for organization
 * Permission: viewer or higher
 */
router.get('/organizations/:orgId/ai/billing', checkPermission('viewer'), getOrganizationAIBilling);

// ═══════════════════════════════════════════════════════════
// CONVERSATION MANAGEMENT (Future)
// ═══════════════════════════════════════════════════════════
// CONVERSATION HISTORY ROUTES
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/bots/:botId/ai/conversations/:sessionId
 * Get conversation history for a session
 */
router.get('/bots/:botId/ai/conversations/:sessionId', checkPermission('bots', 'read'), async (req, res) => {
  try {
    const { botId, sessionId } = req.params;
    const db = require('../db');

    // Verify bot ownership
    const botCheck = await db.query(
      'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
      [botId, req.organization.id]
    );

    if (botCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Get conversation history from widget_messages
    const result = await db.query(
      `SELECT id, role, content, created_at
       FROM widget_messages
       WHERE bot_id = $1 AND session_id = $2
       ORDER BY created_at ASC`,
      [botId, sessionId]
    );

    res.json({
      success: true,
      sessionId,
      messages: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

/**
 * DELETE /api/bots/:botId/ai/conversations/:sessionId
 * Clear conversation history for a session
 */
router.delete('/bots/:botId/ai/conversations/:sessionId', checkPermission('bots', 'delete'), async (req, res) => {
  try {
    const { botId, sessionId } = req.params;
    const db = require('../db');

    // Verify bot ownership
    const botCheck = await db.query(
      'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
      [botId, req.organization.id]
    );

    if (botCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Delete conversation history
    const result = await db.query(
      'DELETE FROM widget_messages WHERE bot_id = $1 AND session_id = $2 RETURNING id',
      [botId, sessionId]
    );

    res.json({
      success: true,
      message: 'Conversation history cleared',
      deletedCount: result.rows.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear conversation history' });
  }
});

module.exports = router;
