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
 * Send a streaming chat message to AI
 * Permission: member or higher
 * TODO: Implement streaming endpoint
 */
// router.post('/:botId/ai/chat/stream', checkPermission('member'), sendChatStream);

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

/**
 * GET /api/bots/:botId/ai/conversations/:sessionId
 * Get conversation history for a session
 * TODO: Implement if needed
 */

/**
 * DELETE /api/bots/:botId/ai/conversations/:sessionId
 * Clear conversation history for a session
 * TODO: Implement if needed
 */

module.exports = router;
