/**
 * Integrations API Routes
 * Handles OAuth flows and integration management
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const log = require('../utils/logger');
const {
  SlackIntegration,
  GoogleCalendarIntegration,
  GmailIntegration,
  CRMIntegration,
  createIntegration,
  getAvailableIntegrations
} = require('../services/autonomous/integrations');

// All routes require authentication
router.use(authMiddleware);

// ==========================================
// INTEGRATION CRUD
// ==========================================

/**
 * GET /api/integrations/available
 * Get all available integration types
 */
router.get('/available', (req, res) => {
  try {
    const integrations = getAvailableIntegrations();
    res.json({ success: true, integrations });
  } catch (error) {
    log.error('Error getting available integrations', { error: error.message });
    res.status(500).json({ error: 'Failed to get integrations' });
  }
});

/**
 * GET /api/integrations
 * Get user's connected integrations
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, type, name, status, config, metadata, last_sync_at, created_at
       FROM integrations WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      integrations: result.rows.map(row => ({
        ...row,
        config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
      }))
    });
  } catch (error) {
    log.error('Error fetching integrations', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

/**
 * GET /api/integrations/:id
 * Get single integration
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, type, name, status, config, metadata, last_sync_at, created_at, error_message
       FROM integrations WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({
      success: true,
      integration: {
        ...result.rows[0],
        config: typeof result.rows[0].config === 'string' ? JSON.parse(result.rows[0].config) : result.rows[0].config,
        metadata: typeof result.rows[0].metadata === 'string' ? JSON.parse(result.rows[0].metadata) : result.rows[0].metadata
      }
    });
  } catch (error) {
    log.error('Error fetching integration', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch integration' });
  }
});

/**
 * DELETE /api/integrations/:id
 * Disconnect and remove integration
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `DELETE FROM integrations WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    log.info('Integration deleted', { integrationId: id, userId });

    res.json({ success: true, message: 'Integration disconnected' });
  } catch (error) {
    log.error('Error deleting integration', { error: error.message });
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

// ==========================================
// OAUTH FLOWS
// ==========================================

/**
 * GET /api/integrations/:type/auth
 * Get OAuth authorization URL
 */
router.get('/:type/auth', (req, res) => {
  try {
    const { type } = req.params;
    const { provider } = req.query;

    let config;

    switch (type) {
      case 'slack':
        config = SlackIntegration.getOAuthConfig();
        break;
      case 'google_calendar':
      case 'google-calendar':
        config = GoogleCalendarIntegration.getOAuthConfig();
        break;
      case 'gmail':
        config = GmailIntegration.getOAuthConfig();
        break;
      case 'crm':
        config = CRMIntegration.getOAuthConfig(provider || 'hubspot');
        break;
      default:
        return res.status(400).json({ error: 'Unknown integration type' });
    }

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      response_type: 'code',
      state: JSON.stringify({ userId: req.user.id, type, provider })
    });

    if (config.accessType) {
      params.append('access_type', config.accessType);
    }
    if (config.prompt) {
      params.append('prompt', config.prompt);
    }

    const authUrl = `${config.authorizationUrl}?${params}`;

    res.json({ success: true, authUrl });
  } catch (error) {
    log.error('Error generating auth URL', { error: error.message });
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * GET /api/integrations/:type/callback
 * OAuth callback handler
 */
router.get('/:type/callback', async (req, res) => {
  try {
    const { type } = req.params;
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`/integrations?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return res.redirect('/integrations?error=missing_params');
    }

    let stateData;
    try {
      stateData = JSON.parse(state);
    } catch {
      return res.redirect('/integrations?error=invalid_state');
    }

    const { userId, provider } = stateData;

    // Exchange code for tokens
    let tokens;

    switch (type) {
      case 'slack':
        tokens = await SlackIntegration.exchangeCode(code);
        break;
      case 'google_calendar':
      case 'google-calendar':
        tokens = await GoogleCalendarIntegration.exchangeCode(code);
        break;
      case 'gmail':
        tokens = await GmailIntegration.exchangeCode(code);
        break;
      case 'crm':
        tokens = await CRMIntegration.exchangeCode(code, provider);
        break;
      default:
        return res.redirect('/integrations?error=unknown_type');
    }

    // Save integration to database
    const name = tokens.team_name || tokens.email || `${type} Integration`;

    await db.query(
      `INSERT INTO integrations (user_id, type, name, credentials, access_token, refresh_token, token_expires_at, scopes, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'connected', $9)
       ON CONFLICT (user_id, type, name)
       DO UPDATE SET credentials = $4, access_token = $5, refresh_token = $6, token_expires_at = $7, status = 'connected', updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        type,
        name,
        JSON.stringify(tokens),
        tokens.access_token,
        tokens.refresh_token,
        tokens.token_expires_at,
        tokens.scope ? tokens.scope.split(' ') : [],
        JSON.stringify({ provider, team_id: tokens.team_id, email: tokens.email })
      ]
    );

    log.info('Integration connected', { type, userId, name });

    res.redirect(`/integrations?success=${encodeURIComponent(type)}`);
  } catch (error) {
    log.error('OAuth callback error', { error: error.message });
    res.redirect(`/integrations?error=${encodeURIComponent(error.message)}`);
  }
});

// ==========================================
// INTEGRATION ACTIONS
// ==========================================

/**
 * POST /api/integrations/:id/test
 * Test integration connection
 */
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get integration
    const result = await db.query(
      `SELECT * FROM integrations WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const integration = result.rows[0];
    const credentials = typeof integration.credentials === 'string'
      ? JSON.parse(integration.credentials)
      : integration.credentials;

    // Create integration instance and test
    const instance = createIntegration(integration.type, credentials);
    const testResult = await instance.testConnection();

    // Update status
    await db.query(
      `UPDATE integrations SET status = $1, error_message = $2, last_sync_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [testResult.success ? 'connected' : 'error', testResult.error || null, id]
    );

    // Log test
    await logIntegrationAction(id, 'test_connection', null, testResult, testResult.success ? 'success' : 'failure');

    res.json({
      success: testResult.success,
      result: testResult
    });
  } catch (error) {
    log.error('Error testing integration', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/integrations/:id/execute
 * Execute an action on the integration
 */
router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, params } = req.body;
    const userId = req.user.id;

    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    // Get integration
    const result = await db.query(
      `SELECT * FROM integrations WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const integration = result.rows[0];

    if (integration.status !== 'connected') {
      return res.status(400).json({ error: 'Integration is not connected' });
    }

    const credentials = typeof integration.credentials === 'string'
      ? JSON.parse(integration.credentials)
      : integration.credentials;

    // Create integration instance
    const instance = createIntegration(integration.type, credentials);

    // Execute action
    const startTime = Date.now();
    let actionResult;

    // Map action names to methods
    switch (action) {
      // Slack
      case 'send_message':
        actionResult = await instance.sendMessage(params.channel, params.text, params);
        break;
      case 'list_channels':
        actionResult = await instance.listChannels(params);
        break;
      case 'get_history':
        actionResult = await instance.getChannelHistory(params.channel, params);
        break;
      case 'list_users':
        actionResult = await instance.listUsers(params);
        break;

      // Google Calendar
      case 'list_events':
        actionResult = await instance.listEvents(params.calendarId, params);
        break;
      case 'create_event':
        actionResult = await instance.createEvent(params.calendarId, params);
        break;
      case 'delete_event':
        actionResult = await instance.deleteEvent(params.calendarId, params.eventId);
        break;
      case 'list_calendars':
        actionResult = await instance.listCalendars();
        break;

      // Gmail
      case 'list_emails':
        actionResult = await instance.listEmails(params);
        break;
      case 'get_email':
        actionResult = await instance.getEmail(params.messageId);
        break;
      case 'send_email':
        actionResult = await instance.sendEmail(params.to, params.subject, params.body, params);
        break;
      case 'reply_to_email':
        actionResult = await instance.replyToEmail(params.messageId, params.body, params);
        break;
      case 'search_emails':
        actionResult = await instance.searchEmails(params.query, params);
        break;

      // CRM
      case 'create_contact':
        actionResult = await instance.createContact(params);
        break;
      case 'update_contact':
        actionResult = await instance.updateContact(params.contactId, params);
        break;
      case 'list_contacts':
        actionResult = await instance.listContacts(params);
        break;
      case 'create_deal':
        actionResult = await instance.createDeal(params);
        break;
      case 'update_deal':
        actionResult = await instance.updateDeal(params.dealId, params);
        break;
      case 'list_deals':
        actionResult = await instance.listDeals(params);
        break;

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    const duration = Date.now() - startTime;

    // Log action
    await logIntegrationAction(id, action, params, actionResult, actionResult.success ? 'success' : 'failure', duration);

    res.json({
      success: true,
      action,
      result: actionResult,
      duration
    });
  } catch (error) {
    log.error('Error executing integration action', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/integrations/:id/logs
 * Get integration action logs
 */
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    // Verify ownership
    const integration = await db.query(
      `SELECT id FROM integrations WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (integration.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const result = await db.query(
      `SELECT * FROM integration_logs WHERE integration_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json({
      success: true,
      logs: result.rows.map(row => ({
        ...row,
        request_data: typeof row.request_data === 'string' ? JSON.parse(row.request_data) : row.request_data,
        response_data: typeof row.response_data === 'string' ? JSON.parse(row.response_data) : row.response_data
      })),
      count: result.rows.length
    });
  } catch (error) {
    log.error('Error fetching integration logs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Log integration action
 */
async function logIntegrationAction(integrationId, action, requestData, responseData, result, durationMs = null) {
  try {
    await db.query(
      `INSERT INTO integration_logs (integration_id, action, request_data, response_data, result, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        integrationId,
        action,
        requestData ? JSON.stringify(requestData) : null,
        responseData ? JSON.stringify(responseData) : null,
        result,
        durationMs
      ]
    );
  } catch (error) {
    log.error('Error logging integration action', { error: error.message });
  }
}

module.exports = router;
