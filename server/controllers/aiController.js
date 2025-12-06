const log = require('../utils/logger');
const db = require('../db');
const {
  AIProviderFactory,
  AIMessageHandler,
  AICostCalculator,
  EncryptionHelper
} = require('../services/ai');
const webhookService = require('../services/webhookService');
const ragService = require('../services/ragService');

/**
 * AI Controller
 * Handles all AI-related operations
 */

/**
 * Get AI configuration for a bot
 * GET /api/bots/:botId/ai/configure
 */
async function getAIConfig(req, res) {
  try {
    const { botId } = req.params;
    const organizationId = req.organization.id;

    // Verify bot belongs to organization
    const botCheck = await db.query(
      'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
      [botId, organizationId]
    );

    if (botCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bot not found or not accessible'
      });
    }

    // Get AI configuration
    const query = `
      SELECT
        id, bot_id, provider, model, temperature, max_tokens,
        system_prompt, context_window, enable_streaming, is_enabled,
        knowledge_base_id, created_at, updated_at,
        CASE WHEN api_key_encrypted IS NOT NULL THEN true ELSE false END as has_custom_key
      FROM ai_configurations
      WHERE bot_id = $1
    `;

    const result = await db.query(query, [botId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'AI configuration not found for this bot'
      });
    }

    const config = result.rows[0];

    // Get available models for the provider
    const availableModels = AIProviderFactory.getModelsForProvider(config.provider);

    return res.status(200).json({
      success: true,
      config: config,
      availableModels: availableModels
    });

  } catch (error) {
    log.error('Get AI config error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to get AI configuration'
    });
  }
}

/**
 * Create or update AI configuration for a bot
 * POST /api/bots/:botId/ai/configure
 */
async function configureAI(req, res) {
  try {
    const { botId } = req.params;
    const organizationId = req.organization.id;
    const {
      provider,
      model,
      api_key,
      temperature,
      max_tokens,
      system_prompt,
      context_window,
      enable_streaming,
      is_enabled
    } = req.body;

    // Verify bot belongs to organization
    const botCheck = await db.query(
      'SELECT id, name FROM bots WHERE id = $1 AND organization_id = $2',
      [botId, organizationId]
    );

    if (botCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bot not found or not accessible'
      });
    }

    // Validate required fields
    if (!provider || !model) {
      return res.status(400).json({
        success: false,
        message: 'Provider and model are required'
      });
    }

    // Validate configuration
    const validation = AIProviderFactory.validateConfig({
      provider,
      model,
      temperature,
      max_tokens,
      context_window
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration',
        errors: validation.errors
      });
    }

    // Encrypt API key if provided
    let apiKeyEncrypted = null;
    if (api_key) {
      // Validate API key format
      const keyValidation = EncryptionHelper.validateApiKeyFormat(api_key, provider);
      if (!keyValidation.valid) {
        return res.status(400).json({
          success: false,
          message: keyValidation.error
        });
      }

      apiKeyEncrypted = EncryptionHelper.encrypt(api_key);
    }

    // Check if config already exists
    const existingConfig = await db.query(
      'SELECT id FROM ai_configurations WHERE bot_id = $1',
      [botId]
    );

    let result;

    // Get knowledge_base_id from request
    const { knowledge_base_id } = req.body;

    if (existingConfig.rows.length > 0) {
      // Update existing configuration
      const updateQuery = `
        UPDATE ai_configurations
        SET
          provider = $1,
          model = $2,
          api_key_encrypted = COALESCE($3, api_key_encrypted),
          temperature = $4,
          max_tokens = $5,
          system_prompt = $6,
          context_window = $7,
          enable_streaming = $8,
          is_enabled = $9,
          knowledge_base_id = $10,
          updated_at = NOW()
        WHERE bot_id = $11
        RETURNING id, bot_id, provider, model, temperature, max_tokens,
                  system_prompt, context_window, enable_streaming, is_enabled,
                  knowledge_base_id, created_at, updated_at
      `;

      result = await db.query(updateQuery, [
        provider,
        model,
        apiKeyEncrypted,
        temperature || 0.7,
        max_tokens || 1000,
        system_prompt || 'You are a helpful assistant.',
        context_window !== undefined ? context_window : 10,
        enable_streaming !== undefined ? enable_streaming : true,
        is_enabled !== undefined ? is_enabled : true,
        knowledge_base_id || null,
        botId
      ]);

      return res.status(200).json({
        success: true,
        message: 'AI configuration updated successfully',
        config: result.rows[0]
      });

    } else {
      // Create new configuration
      const insertQuery = `
        INSERT INTO ai_configurations (
          bot_id, provider, model, api_key_encrypted, temperature, max_tokens,
          system_prompt, context_window, enable_streaming, is_enabled, knowledge_base_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, bot_id, provider, model, temperature, max_tokens,
                  system_prompt, context_window, enable_streaming, is_enabled,
                  knowledge_base_id, created_at, updated_at
      `;

      result = await db.query(insertQuery, [
        botId,
        provider,
        model,
        apiKeyEncrypted,
        temperature || 0.7,
        max_tokens || 1000,
        system_prompt || 'You are a helpful assistant.',
        context_window !== undefined ? context_window : 10,
        enable_streaming !== undefined ? enable_streaming : true,
        is_enabled !== undefined ? is_enabled : true,
        knowledge_base_id || null
      ]);

      return res.status(201).json({
        success: true,
        message: 'AI configuration created successfully',
        config: result.rows[0]
      });
    }

  } catch (error) {
    log.error('Configure AI error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to configure AI'
    });
  }
}

/**
 * Delete AI configuration
 * DELETE /api/bots/:botId/ai/configure
 */
async function deleteAIConfig(req, res) {
  try {
    const { botId } = req.params;
    const organizationId = req.organization.id;

    // Verify bot belongs to organization
    const botCheck = await db.query(
      'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
      [botId, organizationId]
    );

    if (botCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bot not found or not accessible'
      });
    }

    // Delete AI configuration
    const result = await db.query(
      'DELETE FROM ai_configurations WHERE bot_id = $1 RETURNING id',
      [botId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'AI configuration not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'AI configuration deleted successfully'
    });

  } catch (error) {
    log.error('Delete AI config error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to delete AI configuration'
    });
  }
}

/**
 * Send chat message to AI
 * POST /api/bots/:botId/ai/chat
 */
async function sendChat(req, res) {
  try {
    const { botId } = req.params;
    const organizationId = req.organization.id;
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Message and sessionId are required'
      });
    }

    // Verify bot belongs to organization
    const botCheck = await db.query(
      'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
      [botId, organizationId]
    );

    if (botCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bot not found or not accessible'
      });
    }

    // Get AI configuration
    const configResult = await db.query(
      `SELECT * FROM ai_configurations WHERE bot_id = $1 AND is_enabled = true`,
      [botId]
    );

    if (configResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'AI is not configured or enabled for this bot'
      });
    }

    const config = configResult.rows[0];

    // Get API key (custom or platform)
    let apiKey;
    if (config.api_key_encrypted) {
      apiKey = EncryptionHelper.decrypt(config.api_key_encrypted);
      log.debug('Using custom encrypted API key', { provider: config.provider });
    } else {
      // Use platform API key
      apiKey = config.provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY;

      // Trim whitespace
      if (apiKey) {
        apiKey = apiKey.trim();
      }

      // Debug logging (show first 15 chars only for security)
      log.debug('Platform API key status', {
        provider: config.provider,
        keyLoaded: apiKey ? apiKey.substring(0, 15) + '...' : 'NOT FOUND',
        keyLength: apiKey ? apiKey.length : 0
      });

      if (!apiKey) {
        log.error('Platform API key not configured', { provider: config.provider });
        return res.status(400).json({
          success: false,
          message: `Platform API key not configured for ${config.provider}. Please provide your own API key.`
        });
      }
    }

    // Get AI service
    const aiService = AIProviderFactory.getProvider({
      provider: config.provider,
      apiKey: apiKey,
      model: config.model
    });

    // RAG: Get relevant context from Knowledge Base
    let systemPrompt = config.system_prompt;
    let ragSources = [];
    try {
      log.debug('Starting RAG search', { botId });
      const ragResult = await ragService.getContextForQuery(botId, message, {
        maxChunks: 20,
        threshold: 0.15  // Very low threshold for cross-language queries
      });
      log.debug('RAG result received', {
        hasContext: ragResult.hasContext,
        error: ragResult.error || 'none'
      });

      if (ragResult.hasContext && ragResult.context) {
        systemPrompt = ragService.buildRAGPrompt(config.system_prompt, ragResult.context);
        ragSources = ragResult.sources || [];
        log.info('RAG context added', {
          sourcesCount: ragSources.length,
          promptLength: systemPrompt.length,
          promptPreview: systemPrompt.substring(0, 500)
        });
      }
    } catch (ragError) {
      log.error('RAG error (continuing without context)', { error: ragError.message });
    }

    // Build messages with context
    const messages = await AIMessageHandler.buildMessagesWithContext({
      botId: botId,
      sessionId: sessionId,
      userMessage: message,
      systemPrompt: systemPrompt,
      contextWindow: config.context_window
    });

    // Send to AI
    const startTime = Date.now();
    const response = await aiService.chat({
      messages: messages,
      temperature: parseFloat(config.temperature),
      maxTokens: parseInt(config.max_tokens),
      stream: false
    });

    // Calculate cost
    const cost = AICostCalculator.calculateCost({
      provider: config.provider,
      model: config.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens
    });

    // Save user message to history
    await AIMessageHandler.saveMessage({
      botId: botId,
      sessionId: sessionId,
      role: 'user',
      content: message
    });

    // Trigger message.sent webhook for user message
    await webhookService.trigger(organizationId, 'message.sent', {
      bot_id: botId,
      session_id: sessionId,
      message: {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      }
    });

    // Save AI response to history
    await AIMessageHandler.saveMessage({
      botId: botId,
      sessionId: sessionId,
      role: 'assistant',
      content: response.content
    });

    // Trigger message.received webhook for bot response
    await webhookService.trigger(organizationId, 'message.received', {
      bot_id: botId,
      session_id: sessionId,
      message: {
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString()
      },
      usage: response.usage,
      cost_usd: cost
    });

    // Log usage for billing
    await db.query(
      `INSERT INTO ai_usage_logs (
        organization_id, bot_id, provider, model,
        prompt_tokens, completion_tokens, total_tokens,
        cost_usd, response_time_ms, user_message, ai_response, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        organizationId,
        botId,
        config.provider,
        config.model,
        response.usage.promptTokens,
        response.usage.completionTokens,
        response.usage.totalTokens,
        cost,
        response.responseTime,
        message,
        response.content,
        'success'
      ]
    );

    return res.status(200).json({
      success: true,
      response: response.content,
      usage: response.usage,
      cost: cost,
      responseTime: response.responseTime,
      sources: ragSources.length > 0 ? ragSources : undefined
    });

  } catch (error) {
    log.error('Send chat error', { error: error.message, stack: error.stack });

    // Log error to usage logs
    try {
      await db.query(
        `INSERT INTO ai_usage_logs (
          organization_id, bot_id, provider, model,
          error_message, status
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.organization.id,
          req.params.botId,
          error.provider || 'unknown',
          error.model || 'unknown',
          error.message,
          'error'
        ]
      );
    } catch (logError) {
      log.error('Failed to log error to database', { error: logError.message });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to send chat message'
    });
  }
}

/**
 * Test AI connection
 * POST /api/bots/:botId/ai/test
 */
async function testAIConnection(req, res) {
  try {
    const { botId } = req.params;
    const organizationId = req.organization.id;

    // Verify bot belongs to organization
    const botCheck = await db.query(
      'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
      [botId, organizationId]
    );

    if (botCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bot not found or not accessible'
      });
    }

    // Get AI configuration
    const configResult = await db.query(
      'SELECT * FROM ai_configurations WHERE bot_id = $1',
      [botId]
    );

    if (configResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'AI is not configured for this bot'
      });
    }

    const config = configResult.rows[0];

    // Get API key
    let apiKey;
    if (config.api_key_encrypted) {
      apiKey = EncryptionHelper.decrypt(config.api_key_encrypted);
      log.debug('Using custom encrypted API key', { provider: config.provider });
    } else {
      apiKey = config.provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY;

      // Trim whitespace
      if (apiKey) {
        apiKey = apiKey.trim();
      }

      // Debug logging (show first 15 chars only for security)
      log.debug('Platform API key status for test', {
        provider: config.provider,
        keyLoaded: apiKey ? apiKey.substring(0, 15) + '...' : 'NOT FOUND',
        keyLength: apiKey ? apiKey.length : 0
      });
    }

    if (!apiKey) {
      log.error('No API key configured for test', { provider: config.provider });
      return res.status(400).json({
        success: false,
        message: 'No API key configured'
      });
    }

    // Get AI service and test connection
    const aiService = AIProviderFactory.getProvider({
      provider: config.provider,
      apiKey: apiKey,
      model: config.model
    });

    const testResult = await aiService.testConnection();

    return res.status(200).json({
      success: true,
      test: testResult
    });

  } catch (error) {
    log.error('Test AI connection error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to test AI connection'
    });
  }
}

/**
 * Get AI usage statistics for a bot
 * GET /api/bots/:botId/ai/usage
 */
async function getAIUsage(req, res) {
  try {
    const { botId } = req.params;
    const organizationId = req.organization.id;
    const { startDate, endDate, limit = 50 } = req.query;

    // Verify bot belongs to organization
    const botCheck = await db.query(
      'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
      [botId, organizationId]
    );

    if (botCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bot not found or not accessible'
      });
    }

    // Build query with optional date filters
    let query = `
      SELECT
        id, provider, model, prompt_tokens, completion_tokens, total_tokens,
        cost_usd, response_time_ms, status, created_at
      FROM ai_usage_logs
      WHERE bot_id = $1
    `;

    const params = [botId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      params.push(endDate);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1}`;
    params.push(limit);

    const usageResult = await db.query(query, params);

    // Get summary statistics
    const summaryQuery = `
      SELECT
        COUNT(*) as total_requests,
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_requests
      FROM ai_usage_logs
      WHERE bot_id = $1
      ${startDate ? 'AND created_at >= $2' : ''}
      ${endDate ? `AND created_at <= $${startDate ? 3 : 2}` : ''}
    `;

    const summaryParams = [botId];
    if (startDate) summaryParams.push(startDate);
    if (endDate) summaryParams.push(endDate);

    const summaryResult = await db.query(summaryQuery, summaryParams);
    const summary = summaryResult.rows[0];

    return res.status(200).json({
      success: true,
      usage: usageResult.rows,
      summary: {
        totalRequests: parseInt(summary.total_requests),
        totalPromptTokens: parseInt(summary.total_prompt_tokens) || 0,
        totalCompletionTokens: parseInt(summary.total_completion_tokens) || 0,
        totalTokens: parseInt(summary.total_tokens) || 0,
        totalCost: parseFloat(summary.total_cost) || 0,
        avgResponseTime: parseFloat(summary.avg_response_time) || 0,
        successfulRequests: parseInt(summary.successful_requests),
        failedRequests: parseInt(summary.failed_requests)
      }
    });

  } catch (error) {
    log.error('Get AI usage error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to get AI usage statistics'
    });
  }
}

/**
 * Get AI usage billing for organization
 * GET /api/organizations/:orgId/ai/billing
 */
async function getOrganizationAIBilling(req, res) {
  try {
    const { orgId } = req.params;
    const organizationId = req.organization.id;

    // Verify user has access to this organization
    if (parseInt(orgId) !== organizationId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this organization'
      });
    }

    // Get current month usage
    const currentMonthQuery = `
      SELECT
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        provider,
        COUNT(*) as requests_per_provider
      FROM ai_usage_logs
      WHERE organization_id = $1
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY provider
    `;

    const currentMonthResult = await db.query(currentMonthQuery, [organizationId]);

    // Get all-time usage
    const allTimeQuery = `
      SELECT
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as total_cost
      FROM ai_usage_logs
      WHERE organization_id = $1
    `;

    const allTimeResult = await db.query(allTimeQuery, [organizationId]);

    // Get daily usage for last 30 days
    const dailyQuery = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as requests,
        SUM(total_tokens) as tokens,
        SUM(cost_usd) as cost
      FROM ai_usage_logs
      WHERE organization_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const dailyResult = await db.query(dailyQuery, [organizationId]);

    return res.status(200).json({
      success: true,
      currentMonth: {
        totalRequests: currentMonthResult.rows.reduce((sum, row) => sum + parseInt(row.total_requests), 0),
        totalTokens: currentMonthResult.rows.reduce((sum, row) => sum + parseInt(row.total_tokens || 0), 0),
        totalCost: currentMonthResult.rows.reduce((sum, row) => sum + parseFloat(row.total_cost || 0), 0),
        byProvider: currentMonthResult.rows
      },
      allTime: {
        totalRequests: parseInt(allTimeResult.rows[0].total_requests),
        totalTokens: parseInt(allTimeResult.rows[0].total_tokens) || 0,
        totalCost: parseFloat(allTimeResult.rows[0].total_cost) || 0
      },
      daily: dailyResult.rows
    });

  } catch (error) {
    log.error('Get organization AI billing error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to get AI billing information'
    });
  }
}

/**
 * Get available AI providers
 * GET /api/ai/providers
 */
function getProviders(req, res) {
  try {
    const providers = AIProviderFactory.getSupportedProviders();

    const providerDetails = providers.map(provider => ({
      id: provider,
      name: provider.charAt(0).toUpperCase() + provider.slice(1),
      models: AIProviderFactory.getModelsForProvider(provider)
    }));

    return res.status(200).json({
      success: true,
      providers: providerDetails
    });

  } catch (error) {
    log.error('Get providers error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to get providers'
    });
  }
}

/**
 * Get models for a specific provider
 * GET /api/ai/models/:provider
 */
function getModels(req, res) {
  try {
    const { provider } = req.params;

    const models = AIProviderFactory.getModelsForProvider(provider);

    if (models.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Provider '${provider}' not found or has no models`
      });
    }

    return res.status(200).json({
      success: true,
      provider: provider,
      models: models
    });

  } catch (error) {
    log.error('Get models error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to get models'
    });
  }
}

/**
 * Send streaming chat message to AI
 * POST /api/bots/:botId/ai/chat/stream
 * Uses Server-Sent Events (SSE) for real-time streaming
 */
async function sendChatStream(req, res) {
  try {
    const { botId } = req.params;
    const organizationId = req.organization.id;
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Message and sessionId are required'
      });
    }

    // Verify bot belongs to organization
    const botCheck = await db.query(
      'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
      [botId, organizationId]
    );

    if (botCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bot not found or not accessible'
      });
    }

    // Get AI configuration
    const configResult = await db.query(
      `SELECT * FROM ai_configurations WHERE bot_id = $1 AND is_enabled = true`,
      [botId]
    );

    if (configResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'AI is not configured or enabled for this bot'
      });
    }

    const config = configResult.rows[0];

    // Get API key (custom or platform)
    let apiKey;
    if (config.api_key_encrypted) {
      apiKey = EncryptionHelper.decrypt(config.api_key_encrypted);
    } else {
      apiKey = config.provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY;

      if (apiKey) {
        apiKey = apiKey.trim();
      }

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: `Platform API key not configured for ${config.provider}. Please provide your own API key.`
        });
      }
    }

    // Get AI service
    const aiService = AIProviderFactory.getProvider({
      provider: config.provider,
      apiKey: apiKey,
      model: config.model
    });

    // RAG: Get relevant context from Knowledge Base
    let systemPrompt = config.system_prompt;
    let ragSources = [];
    try {
      log.debug('Starting RAG search for streaming', { botId });
      const ragResult = await ragService.getContextForQuery(botId, message, {
        maxChunks: 20,
        threshold: 0.15  // Very low threshold for cross-language queries
      });
      log.debug('RAG result for streaming', {
        hasContext: ragResult.hasContext,
        error: ragResult.error || 'none'
      });

      if (ragResult.hasContext && ragResult.context) {
        systemPrompt = ragService.buildRAGPrompt(config.system_prompt, ragResult.context);
        ragSources = ragResult.sources || [];
        log.info('RAG context added for streaming', { sourcesCount: ragSources.length });
      }
    } catch (ragError) {
      log.error('RAG error for streaming (continuing without context)', { error: ragError.message });
    }

    // Build messages with context
    const messages = await AIMessageHandler.buildMessagesWithContext({
      botId: botId,
      sessionId: sessionId,
      userMessage: message,
      systemPrompt: systemPrompt,
      contextWindow: config.context_window
    });

    // Save user message to history
    await AIMessageHandler.saveMessage({
      botId: botId,
      sessionId: sessionId,
      role: 'user',
      content: message
    });

    // Trigger webhook for user message
    await webhookService.trigger(organizationId, 'message.sent', {
      bot_id: botId,
      session_id: sessionId,
      message: {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      }
    });

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    const startTime = Date.now();

    // Handle streaming with callbacks
    await aiService.chatStream(
      {
        messages: messages,
        temperature: parseFloat(config.temperature),
        maxTokens: parseInt(config.max_tokens)
      },
      // onChunk callback - send each piece of text
      (chunk) => {
        const data = JSON.stringify({
          type: 'chunk',
          content: chunk.content,
          fullContent: chunk.fullContent
        });
        res.write(`data: ${data}\n\n`);
      },
      // onComplete callback - finalize stream
      async (result) => {
        const responseTime = Date.now() - startTime;

        // Calculate cost
        const cost = AICostCalculator.calculateCost({
          provider: config.provider,
          model: config.model,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens
        });

        // Save AI response to history
        await AIMessageHandler.saveMessage({
          botId: botId,
          sessionId: sessionId,
          role: 'assistant',
          content: result.content
        });

        // Trigger webhook for AI response
        await webhookService.trigger(organizationId, 'message.received', {
          bot_id: botId,
          session_id: sessionId,
          message: {
            role: 'assistant',
            content: result.content,
            timestamp: new Date().toISOString()
          },
          usage: result.usage,
          cost_usd: cost
        });

        // Log usage for billing
        await db.query(
          `INSERT INTO ai_usage_logs (
            organization_id, bot_id, provider, model,
            prompt_tokens, completion_tokens, total_tokens,
            cost_usd, response_time_ms, user_message, ai_response, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            organizationId,
            botId,
            config.provider,
            config.model,
            result.usage.promptTokens,
            result.usage.completionTokens,
            result.usage.totalTokens,
            cost,
            responseTime,
            message,
            result.content,
            'success'
          ]
        );

        // Send completion event
        const doneData = JSON.stringify({
          type: 'done',
          content: result.content,
          usage: result.usage,
          cost: cost,
          responseTime: responseTime,
          sources: ragSources.length > 0 ? ragSources : undefined
        });
        res.write(`data: ${doneData}\n\n`);
        res.end();
      },
      // onError callback
      async (error) => {
        log.error('Streaming error', { error: error.message, stack: error.stack });

        // Log error
        try {
          await db.query(
            `INSERT INTO ai_usage_logs (
              organization_id, bot_id, provider, model,
              error_message, status
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              organizationId,
              botId,
              config.provider,
              config.model,
              error.message,
              'error'
            ]
          );
        } catch (logError) {
          log.error('Failed to log streaming error to database', { error: logError.message });
        }

        // Send error event
        const errorData = JSON.stringify({
          type: 'error',
          message: error.message || 'Streaming failed'
        });
        res.write(`data: ${errorData}\n\n`);
        res.end();
      }
    );

  } catch (error) {
    log.error('Send chat stream error', { error: error.message, stack: error.stack });

    // If headers not sent yet, send JSON error
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to start streaming'
      });
    }

    // If streaming already started, send SSE error
    const errorData = JSON.stringify({
      type: 'error',
      message: error.message || 'Streaming failed'
    });
    res.write(`data: ${errorData}\n\n`);
    res.end();
  }
}

module.exports = {
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
};
