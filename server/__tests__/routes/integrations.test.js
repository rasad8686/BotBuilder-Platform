/**
 * Comprehensive Integrations Routes Tests
 * Testing all endpoints with 70+ comprehensive test cases
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 'user-1', email: 'test@example.com' };
  next();
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../services/autonomous/integrations', () => ({
  SlackIntegration: {
    getOAuthConfig: jest.fn(() => ({
      clientId: 'slack-client-id',
      redirectUri: 'http://localhost/callback',
      scopes: ['chat:write', 'channels:read'],
      authorizationUrl: 'https://slack.com/oauth/v2/authorize'
    })),
    exchangeCode: jest.fn()
  },
  GoogleCalendarIntegration: {
    getOAuthConfig: jest.fn(() => ({
      clientId: 'google-client-id',
      redirectUri: 'http://localhost/callback',
      scopes: ['calendar.readonly'],
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      accessType: 'offline',
      prompt: 'consent'
    })),
    exchangeCode: jest.fn()
  },
  GmailIntegration: {
    getOAuthConfig: jest.fn(() => ({
      clientId: 'gmail-client-id',
      redirectUri: 'http://localhost/callback',
      scopes: ['gmail.readonly'],
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth'
    })),
    exchangeCode: jest.fn()
  },
  CRMIntegration: {
    getOAuthConfig: jest.fn(() => ({
      clientId: 'crm-client-id',
      redirectUri: 'http://localhost/callback',
      scopes: ['contacts'],
      authorizationUrl: 'https://app.hubspot.com/oauth/authorize'
    })),
    exchangeCode: jest.fn()
  },
  createIntegration: jest.fn(() => ({
    testConnection: jest.fn().mockResolvedValue({ success: true }),
    sendMessage: jest.fn().mockResolvedValue({ success: true }),
    listChannels: jest.fn().mockResolvedValue({ success: true, channels: [] }),
    getChannelHistory: jest.fn().mockResolvedValue({ success: true, messages: [] }),
    listUsers: jest.fn().mockResolvedValue({ success: true, users: [] }),
    listEvents: jest.fn().mockResolvedValue({ success: true, events: [] }),
    createEvent: jest.fn().mockResolvedValue({ success: true }),
    deleteEvent: jest.fn().mockResolvedValue({ success: true }),
    listCalendars: jest.fn().mockResolvedValue({ success: true, calendars: [] }),
    listEmails: jest.fn().mockResolvedValue({ success: true, emails: [] }),
    getEmail: jest.fn().mockResolvedValue({ success: true }),
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
    replyToEmail: jest.fn().mockResolvedValue({ success: true }),
    searchEmails: jest.fn().mockResolvedValue({ success: true, emails: [] }),
    createContact: jest.fn().mockResolvedValue({ success: true }),
    updateContact: jest.fn().mockResolvedValue({ success: true }),
    listContacts: jest.fn().mockResolvedValue({ success: true, contacts: [] }),
    createDeal: jest.fn().mockResolvedValue({ success: true }),
    updateDeal: jest.fn().mockResolvedValue({ success: true }),
    listDeals: jest.fn().mockResolvedValue({ success: true, deals: [] })
  })),
  getAvailableIntegrations: jest.fn(() => [
    { type: 'slack', name: 'Slack', category: 'messaging' },
    { type: 'discord', name: 'Discord', category: 'messaging' },
    { type: 'telegram', name: 'Telegram', category: 'messaging' },
    { type: 'whatsapp', name: 'WhatsApp', category: 'messaging' },
    { type: 'google_calendar', name: 'Google Calendar', category: 'productivity' },
    { type: 'gmail', name: 'Gmail', category: 'email' },
    { type: 'zapier', name: 'Zapier', category: 'automation' },
    { type: 'webhook', name: 'Webhook', category: 'custom' }
  ])
}));

const db = require('../../db');
const {
  SlackIntegration,
  GoogleCalendarIntegration,
  GmailIntegration,
  CRMIntegration,
  createIntegration,
  getAvailableIntegrations
} = require('../../services/autonomous/integrations');
const logger = require('../../utils/logger');
const integrationsRouter = require('../../routes/integrations');

describe('Integrations Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/integrations', integrationsRouter);
  });

  // ==========================================
  // GET /api/integrations/available
  // ==========================================
  describe('GET /api/integrations/available', () => {
    it('should return all available integrations', async () => {
      const res = await request(app).get('/api/integrations/available');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.integrations).toHaveLength(8);
      expect(getAvailableIntegrations).toHaveBeenCalled();
    });

    it('should include Slack integration', async () => {
      const res = await request(app).get('/api/integrations/available');

      const slack = res.body.integrations.find(i => i.type === 'slack');
      expect(slack).toBeDefined();
      expect(slack.name).toBe('Slack');
      expect(slack.category).toBe('messaging');
    });

    it('should include Discord integration', async () => {
      const res = await request(app).get('/api/integrations/available');

      const discord = res.body.integrations.find(i => i.type === 'discord');
      expect(discord).toBeDefined();
      expect(discord.name).toBe('Discord');
    });

    it('should include Telegram integration', async () => {
      const res = await request(app).get('/api/integrations/available');

      const telegram = res.body.integrations.find(i => i.type === 'telegram');
      expect(telegram).toBeDefined();
      expect(telegram.name).toBe('Telegram');
    });

    it('should include WhatsApp integration', async () => {
      const res = await request(app).get('/api/integrations/available');

      const whatsapp = res.body.integrations.find(i => i.type === 'whatsapp');
      expect(whatsapp).toBeDefined();
      expect(whatsapp.name).toBe('WhatsApp');
    });

    it('should include Gmail integration', async () => {
      const res = await request(app).get('/api/integrations/available');

      const gmail = res.body.integrations.find(i => i.type === 'gmail');
      expect(gmail).toBeDefined();
      expect(gmail.category).toBe('email');
    });

    it('should include Zapier integration', async () => {
      const res = await request(app).get('/api/integrations/available');

      const zapier = res.body.integrations.find(i => i.type === 'zapier');
      expect(zapier).toBeDefined();
      expect(zapier.category).toBe('automation');
    });

    it('should include Webhook integration', async () => {
      const res = await request(app).get('/api/integrations/available');

      const webhook = res.body.integrations.find(i => i.type === 'webhook');
      expect(webhook).toBeDefined();
      expect(webhook.category).toBe('custom');
    });

    it('should handle error when getting available integrations', async () => {
      getAvailableIntegrations.mockImplementationOnce(() => {
        throw new Error('Failed to get integrations');
      });

      const res = await request(app).get('/api/integrations/available');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to get integrations');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================
  // GET /api/integrations
  // ==========================================
  describe('GET /api/integrations', () => {
    it('should return user integrations', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: '1',
            type: 'slack',
            name: 'Slack Workspace',
            status: 'connected',
            config: '{"workspace":"test"}',
            metadata: '{"team_id":"T123"}',
            last_sync_at: '2024-01-01T00:00:00Z',
            created_at: '2024-01-01T00:00:00Z'
          }
        ]
      });

      const res = await request(app).get('/api/integrations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.integrations).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['user-1']
      );
    });

    it('should parse JSON config and metadata from strings', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: '1',
            type: 'slack',
            config: '{"key":"value"}',
            metadata: '{"team":"test"}'
          }
        ]
      });

      const res = await request(app).get('/api/integrations');

      expect(res.body.integrations[0].config).toEqual({ key: 'value' });
      expect(res.body.integrations[0].metadata).toEqual({ team: 'test' });
    });

    it('should handle already parsed JSON objects', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: '1',
            type: 'slack',
            config: { key: 'value' },
            metadata: { team: 'test' }
          }
        ]
      });

      const res = await request(app).get('/api/integrations');

      expect(res.body.integrations[0].config).toEqual({ key: 'value' });
      expect(res.body.integrations[0].metadata).toEqual({ team: 'test' });
    });

    it('should return empty array when no integrations', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/integrations');

      expect(res.status).toBe(200);
      expect(res.body.integrations).toEqual([]);
    });

    it('should return multiple integrations ordered by created_at DESC', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: '3', type: 'gmail', name: 'Gmail', config: '{}', metadata: '{}', created_at: '2024-01-03' },
          { id: '2', type: 'slack', name: 'Slack', config: '{}', metadata: '{}', created_at: '2024-01-02' },
          { id: '1', type: 'discord', name: 'Discord', config: '{}', metadata: '{}', created_at: '2024-01-01' }
        ]
      });

      const res = await request(app).get('/api/integrations');

      expect(res.body.integrations).toHaveLength(3);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        ['user-1']
      );
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('Database connection error'));

      const res = await request(app).get('/api/integrations');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch integrations');
      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching integrations',
        expect.any(Object)
      );
    });
  });

  // ==========================================
  // GET /api/integrations/:id
  // ==========================================
  describe('GET /api/integrations/:id', () => {
    it('should return single integration', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: '1',
          type: 'slack',
          name: 'Slack',
          status: 'connected',
          config: '{"workspace":"test"}',
          metadata: '{"team_id":"T123"}',
          last_sync_at: '2024-01-01',
          created_at: '2024-01-01',
          error_message: null
        }]
      });

      const res = await request(app).get('/api/integrations/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.integration.id).toBe('1');
      expect(res.body.integration.type).toBe('slack');
    });

    it('should parse config and metadata', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: '1',
          config: '{"api_key":"secret"}',
          metadata: '{"version":"1.0"}'
        }]
      });

      const res = await request(app).get('/api/integrations/1');

      expect(res.body.integration.config).toEqual({ api_key: 'secret' });
      expect(res.body.integration.metadata).toEqual({ version: '1.0' });
    });

    it('should include error_message field', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: '1',
          type: 'slack',
          config: '{}',
          metadata: '{}',
          error_message: 'Token expired'
        }]
      });

      const res = await request(app).get('/api/integrations/1');

      expect(res.body.integration.error_message).toBe('Token expired');
    });

    it('should verify user ownership', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await request(app).get('/api/integrations/123');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['123', 'user-1']
      );
    });

    it('should return 404 if integration not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/integrations/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Integration not found');
    });

    it('should return 404 if integration belongs to different user', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/integrations/999');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('Query failed'));

      const res = await request(app).get('/api/integrations/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch integration');
    });
  });

  // ==========================================
  // DELETE /api/integrations/:id
  // ==========================================
  describe('DELETE /api/integrations/:id', () => {
    it('should delete integration successfully', async () => {
      db.query.mockResolvedValue({ rows: [{ id: '1' }] });

      const res = await request(app).delete('/api/integrations/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Integration disconnected');
    });

    it('should verify user ownership before deleting', async () => {
      db.query.mockResolvedValue({ rows: [{ id: '1' }] });

      await request(app).delete('/api/integrations/1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM integrations WHERE id = $1 AND user_id = $2'),
        ['1', 'user-1']
      );
    });

    it('should log deletion', async () => {
      db.query.mockResolvedValue({ rows: [{ id: '1' }] });

      await request(app).delete('/api/integrations/1');

      expect(logger.info).toHaveBeenCalledWith(
        'Integration deleted',
        { integrationId: '1', userId: 'user-1' }
      );
    });

    it('should return 404 if integration not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).delete('/api/integrations/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Integration not found');
    });

    it('should return 404 if trying to delete another users integration', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).delete('/api/integrations/999');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('Delete failed'));

      const res = await request(app).delete('/api/integrations/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete integration');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================
  // GET /api/integrations/:type/auth
  // ==========================================
  describe('GET /api/integrations/:type/auth', () => {
    it('should return Slack auth URL', async () => {
      const res = await request(app).get('/api/integrations/slack/auth');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.authUrl).toContain('slack.com/oauth/v2/authorize');
      expect(res.body.authUrl).toContain('client_id=slack-client-id');
      expect(res.body.authUrl).toContain('scope=chat%3Awrite+channels%3Aread');
    });

    it('should include state in Slack auth URL', async () => {
      const res = await request(app).get('/api/integrations/slack/auth');

      expect(res.body.authUrl).toContain('state=');
      const url = new URL(res.body.authUrl);
      const state = JSON.parse(url.searchParams.get('state'));
      expect(state.userId).toBe('user-1');
      expect(state.type).toBe('slack');
    });

    it('should return Google Calendar auth URL', async () => {
      const res = await request(app).get('/api/integrations/google_calendar/auth');

      expect(res.status).toBe(200);
      expect(res.body.authUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(res.body.authUrl).toContain('access_type=offline');
      expect(res.body.authUrl).toContain('prompt=consent');
    });

    it('should support google-calendar with hyphen', async () => {
      const res = await request(app).get('/api/integrations/google-calendar/auth');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return Gmail auth URL', async () => {
      const res = await request(app).get('/api/integrations/gmail/auth');

      expect(res.status).toBe(200);
      expect(res.body.authUrl).toContain('accounts.google.com');
      expect(res.body.authUrl).toContain('gmail.readonly');
    });

    it('should return CRM auth URL with default provider', async () => {
      const res = await request(app).get('/api/integrations/crm/auth');

      expect(res.status).toBe(200);
      expect(CRMIntegration.getOAuthConfig).toHaveBeenCalledWith('hubspot');
    });

    it('should return CRM auth URL with specified provider', async () => {
      const res = await request(app).get('/api/integrations/crm/auth?provider=salesforce');

      expect(res.status).toBe(200);
      expect(CRMIntegration.getOAuthConfig).toHaveBeenCalledWith('salesforce');
    });

    it('should include state with provider for CRM', async () => {
      const res = await request(app).get('/api/integrations/crm/auth?provider=salesforce');

      const url = new URL(res.body.authUrl);
      const state = JSON.parse(url.searchParams.get('state'));
      expect(state.provider).toBe('salesforce');
    });

    it('should return 400 for unknown integration type', async () => {
      const res = await request(app).get('/api/integrations/unknown/auth');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Unknown integration type');
    });

    it('should handle error during auth URL generation', async () => {
      SlackIntegration.getOAuthConfig.mockImplementationOnce(() => {
        throw new Error('Config error');
      });

      const res = await request(app).get('/api/integrations/slack/auth');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to generate authorization URL');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================
  // GET /api/integrations/:type/callback
  // ==========================================
  describe('GET /api/integrations/:type/callback', () => {
    it('should redirect on OAuth error', async () => {
      const res = await request(app)
        .get('/api/integrations/slack/callback?error=access_denied');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=access_denied');
    });

    it('should redirect on missing code', async () => {
      const res = await request(app)
        .get('/api/integrations/slack/callback?state={}');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=missing_params');
    });

    it('should redirect on missing state', async () => {
      const res = await request(app)
        .get('/api/integrations/slack/callback?code=abc');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=missing_params');
    });

    it('should redirect on invalid state JSON', async () => {
      const res = await request(app)
        .get('/api/integrations/slack/callback?code=abc&state=invalid-json');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=invalid_state');
    });

    it('should exchange code and save Slack integration', async () => {
      const state = JSON.stringify({ userId: 'user-1', type: 'slack' });
      SlackIntegration.exchangeCode.mockResolvedValue({
        access_token: 'xoxb-token',
        refresh_token: 'refresh-token',
        team_name: 'Test Team',
        team_id: 'T123',
        scope: 'chat:write channels:read',
        token_expires_at: '2024-12-31'
      });
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get(`/api/integrations/slack/callback?code=auth-code&state=${encodeURIComponent(state)}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('success=slack');
      expect(SlackIntegration.exchangeCode).toHaveBeenCalledWith('auth-code');
    });

    it('should save integration with correct data', async () => {
      const state = JSON.stringify({ userId: 'user-1', type: 'slack', provider: null });
      SlackIntegration.exchangeCode.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
        team_name: 'Team',
        team_id: 'T123',
        scope: 'chat:write',
        token_expires_at: '2024-12-31'
      });
      db.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get(`/api/integrations/slack/callback?code=code&state=${encodeURIComponent(state)}`);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO integrations'),
        expect.arrayContaining([
          'user-1',
          'slack',
          'Team',
          expect.any(String), // credentials JSON
          'token',
          'refresh',
          '2024-12-31',
          ['chat:write'],
          expect.any(String) // metadata JSON
        ])
      );
    });

    it('should handle Google Calendar callback', async () => {
      const state = JSON.stringify({ userId: 'user-1', type: 'google_calendar' });
      GoogleCalendarIntegration.exchangeCode.mockResolvedValue({
        access_token: 'token',
        email: 'user@example.com'
      });
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get(`/api/integrations/google_calendar/callback?code=code&state=${encodeURIComponent(state)}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('success=google_calendar');
    });

    it('should handle gmail callback', async () => {
      const state = JSON.stringify({ userId: 'user-1', type: 'gmail' });
      GmailIntegration.exchangeCode.mockResolvedValue({
        access_token: 'token',
        email: 'user@gmail.com'
      });
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get(`/api/integrations/gmail/callback?code=code&state=${encodeURIComponent(state)}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('success=gmail');
    });

    it('should handle CRM callback with provider', async () => {
      const state = JSON.stringify({ userId: 'user-1', type: 'crm', provider: 'hubspot' });
      CRMIntegration.exchangeCode.mockResolvedValue({
        access_token: 'token'
      });
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get(`/api/integrations/crm/callback?code=code&state=${encodeURIComponent(state)}`);

      expect(res.status).toBe(302);
      expect(CRMIntegration.exchangeCode).toHaveBeenCalledWith('code', 'hubspot');
    });

    it('should redirect on unknown integration type', async () => {
      const state = JSON.stringify({ userId: 'user-1', type: 'unknown' });

      const res = await request(app)
        .get(`/api/integrations/unknown/callback?code=code&state=${encodeURIComponent(state)}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=unknown_type');
    });

    it('should log successful integration', async () => {
      const state = JSON.stringify({ userId: 'user-1', type: 'slack' });
      SlackIntegration.exchangeCode.mockResolvedValue({
        access_token: 'token',
        team_name: 'Team'
      });
      db.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get(`/api/integrations/slack/callback?code=code&state=${encodeURIComponent(state)}`);

      expect(logger.info).toHaveBeenCalledWith(
        'Integration connected',
        { type: 'slack', userId: 'user-1', name: 'Team' }
      );
    });

    it('should handle exchange code error', async () => {
      const state = JSON.stringify({ userId: 'user-1', type: 'slack' });
      SlackIntegration.exchangeCode.mockRejectedValue(new Error('Invalid code'));

      const res = await request(app)
        .get(`/api/integrations/slack/callback?code=bad-code&state=${encodeURIComponent(state)}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=Invalid');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================
  // POST /api/integrations/:id/test
  // ==========================================
  describe('POST /api/integrations/:id/test', () => {
    it('should test integration connection successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: '1', type: 'slack', credentials: '{"access_token":"token"}' }]
      }).mockResolvedValueOnce({ rows: [] });

      const mockInstance = {
        testConnection: jest.fn().mockResolvedValue({ success: true, message: 'Connected' })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app).post('/api/integrations/1/test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result.success).toBe(true);
      expect(mockInstance.testConnection).toHaveBeenCalled();
    });

    it('should update status to connected on success', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: '1', type: 'slack', credentials: '{}' }]
      }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      const mockInstance = {
        testConnection: jest.fn().mockResolvedValue({ success: true })
      };
      createIntegration.mockReturnValue(mockInstance);

      await request(app).post('/api/integrations/1/test');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE integrations SET status = $1'),
        ['connected', null, '1']
      );
    });

    it('should update status to error on failure', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: '1', type: 'slack', credentials: '{}' }]
      }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      const mockInstance = {
        testConnection: jest.fn().mockResolvedValue({ success: false, error: 'Connection failed' })
      };
      createIntegration.mockReturnValue(mockInstance);

      await request(app).post('/api/integrations/1/test');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE integrations SET status = $1'),
        ['error', 'Connection failed', '1']
      );
    });

    it('should parse credentials from string', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: '1', type: 'slack', credentials: '{"token":"secret"}' }]
      }).mockResolvedValue({ rows: [] });

      await request(app).post('/api/integrations/1/test');

      expect(createIntegration).toHaveBeenCalledWith('slack', { token: 'secret' });
    });

    it('should handle already parsed credentials object', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: '1', type: 'slack', credentials: { token: 'secret' } }]
      }).mockResolvedValue({ rows: [] });

      await request(app).post('/api/integrations/1/test');

      expect(createIntegration).toHaveBeenCalledWith('slack', { token: 'secret' });
    });

    it('should return 404 if integration not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).post('/api/integrations/nonexistent/test');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Integration not found');
    });

    it('should verify user ownership', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await request(app).post('/api/integrations/123/test');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['123', 'user-1']
      );
    });

    it('should handle test connection error', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: '1', type: 'slack', credentials: '{}' }]
      });

      const mockInstance = {
        testConnection: jest.fn().mockRejectedValue(new Error('Network error'))
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app).post('/api/integrations/1/test');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Network error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================
  // POST /api/integrations/:id/execute
  // ==========================================
  describe('POST /api/integrations/:id/execute', () => {
    beforeEach(() => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: '1', type: 'slack', status: 'connected', credentials: '{}' }]
      }).mockResolvedValue({ rows: [] });
    });

    it('should require action parameter', async () => {
      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Action is required');
    });

    it('should check integration exists', async () => {
      db.query.mockReset();
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/integrations/999/execute')
        .send({ action: 'send_message' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Integration not found');
    });

    it('should check integration status is connected', async () => {
      db.query.mockReset();
      db.query.mockResolvedValue({
        rows: [{ id: '1', type: 'slack', status: 'disconnected', credentials: '{}' }]
      });

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'send_message' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Integration is not connected');
    });

    // Slack Actions
    it('should execute send_message action', async () => {
      const mockInstance = {
        sendMessage: jest.fn().mockResolvedValue({ success: true, ts: '12345' })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'send_message', params: { channel: 'C123', text: 'Hello' } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockInstance.sendMessage).toHaveBeenCalledWith('C123', 'Hello', { channel: 'C123', text: 'Hello' });
    });

    it('should execute list_channels action', async () => {
      const mockInstance = {
        listChannels: jest.fn().mockResolvedValue({ success: true, channels: [] })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'list_channels', params: {} });

      expect(res.status).toBe(200);
      expect(mockInstance.listChannels).toHaveBeenCalled();
    });

    it('should execute get_history action', async () => {
      const mockInstance = {
        getChannelHistory: jest.fn().mockResolvedValue({ success: true, messages: [] })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'get_history', params: { channel: 'C123' } });

      expect(res.status).toBe(200);
      expect(mockInstance.getChannelHistory).toHaveBeenCalledWith('C123', { channel: 'C123' });
    });

    it('should execute list_users action', async () => {
      const mockInstance = {
        listUsers: jest.fn().mockResolvedValue({ success: true, users: [] })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'list_users', params: {} });

      expect(res.status).toBe(200);
      expect(mockInstance.listUsers).toHaveBeenCalled();
    });

    // Google Calendar Actions
    it('should execute list_events action', async () => {
      const mockInstance = {
        listEvents: jest.fn().mockResolvedValue({ success: true, events: [] })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'list_events', params: { calendarId: 'primary' } });

      expect(res.status).toBe(200);
      expect(mockInstance.listEvents).toHaveBeenCalledWith('primary', { calendarId: 'primary' });
    });

    it('should execute create_event action', async () => {
      const mockInstance = {
        createEvent: jest.fn().mockResolvedValue({ success: true, eventId: '123' })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'create_event', params: { calendarId: 'primary', title: 'Meeting' } });

      expect(res.status).toBe(200);
      expect(mockInstance.createEvent).toHaveBeenCalled();
    });

    it('should execute delete_event action', async () => {
      const mockInstance = {
        deleteEvent: jest.fn().mockResolvedValue({ success: true })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'delete_event', params: { calendarId: 'primary', eventId: '123' } });

      expect(res.status).toBe(200);
      expect(mockInstance.deleteEvent).toHaveBeenCalledWith('primary', '123');
    });

    it('should execute list_calendars action', async () => {
      const mockInstance = {
        listCalendars: jest.fn().mockResolvedValue({ success: true, calendars: [] })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'list_calendars', params: {} });

      expect(res.status).toBe(200);
      expect(mockInstance.listCalendars).toHaveBeenCalled();
    });

    // Gmail Actions
    it('should execute list_emails action', async () => {
      const mockInstance = {
        listEmails: jest.fn().mockResolvedValue({ success: true, emails: [] })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'list_emails', params: { maxResults: 10 } });

      expect(res.status).toBe(200);
      expect(mockInstance.listEmails).toHaveBeenCalledWith({ maxResults: 10 });
    });

    it('should execute get_email action', async () => {
      const mockInstance = {
        getEmail: jest.fn().mockResolvedValue({ success: true, email: {} })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'get_email', params: { messageId: 'msg123' } });

      expect(res.status).toBe(200);
      expect(mockInstance.getEmail).toHaveBeenCalledWith('msg123');
    });

    it('should execute send_email action', async () => {
      const mockInstance = {
        sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'msg123' })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'send_email', params: { to: 'test@example.com', subject: 'Test', body: 'Hello' } });

      expect(res.status).toBe(200);
      expect(mockInstance.sendEmail).toHaveBeenCalledWith('test@example.com', 'Test', 'Hello', expect.any(Object));
    });

    it('should execute reply_to_email action', async () => {
      const mockInstance = {
        replyToEmail: jest.fn().mockResolvedValue({ success: true })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'reply_to_email', params: { messageId: 'msg123', body: 'Reply' } });

      expect(res.status).toBe(200);
      expect(mockInstance.replyToEmail).toHaveBeenCalledWith('msg123', 'Reply', expect.any(Object));
    });

    it('should execute search_emails action', async () => {
      const mockInstance = {
        searchEmails: jest.fn().mockResolvedValue({ success: true, emails: [] })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'search_emails', params: { query: 'from:test@example.com' } });

      expect(res.status).toBe(200);
      expect(mockInstance.searchEmails).toHaveBeenCalledWith('from:test@example.com', expect.any(Object));
    });

    // CRM Actions
    it('should execute create_contact action', async () => {
      const mockInstance = {
        createContact: jest.fn().mockResolvedValue({ success: true, contactId: '123' })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'create_contact', params: { email: 'contact@example.com', name: 'John Doe' } });

      expect(res.status).toBe(200);
      expect(mockInstance.createContact).toHaveBeenCalledWith({ email: 'contact@example.com', name: 'John Doe' });
    });

    it('should execute update_contact action', async () => {
      const mockInstance = {
        updateContact: jest.fn().mockResolvedValue({ success: true })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'update_contact', params: { contactId: '123', name: 'Jane Doe' } });

      expect(res.status).toBe(200);
      expect(mockInstance.updateContact).toHaveBeenCalledWith('123', expect.any(Object));
    });

    it('should execute list_contacts action', async () => {
      const mockInstance = {
        listContacts: jest.fn().mockResolvedValue({ success: true, contacts: [] })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'list_contacts', params: {} });

      expect(res.status).toBe(200);
      expect(mockInstance.listContacts).toHaveBeenCalled();
    });

    it('should execute create_deal action', async () => {
      const mockInstance = {
        createDeal: jest.fn().mockResolvedValue({ success: true, dealId: '456' })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'create_deal', params: { name: 'New Deal', amount: 1000 } });

      expect(res.status).toBe(200);
      expect(mockInstance.createDeal).toHaveBeenCalled();
    });

    it('should execute update_deal action', async () => {
      const mockInstance = {
        updateDeal: jest.fn().mockResolvedValue({ success: true })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'update_deal', params: { dealId: '456', stage: 'closed' } });

      expect(res.status).toBe(200);
      expect(mockInstance.updateDeal).toHaveBeenCalledWith('456', expect.any(Object));
    });

    it('should execute list_deals action', async () => {
      const mockInstance = {
        listDeals: jest.fn().mockResolvedValue({ success: true, deals: [] })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'list_deals', params: {} });

      expect(res.status).toBe(200);
      expect(mockInstance.listDeals).toHaveBeenCalled();
    });

    it('should return 400 for unknown action', async () => {
      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'unknown_action', params: {} });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Unknown action: unknown_action');
    });

    it('should include duration in response', async () => {
      const mockInstance = {
        sendMessage: jest.fn().mockResolvedValue({ success: true })
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'send_message', params: { channel: 'C123', text: 'Hi' } });

      expect(res.body.duration).toBeDefined();
      expect(typeof res.body.duration).toBe('number');
    });

    it('should handle execution error', async () => {
      const mockInstance = {
        sendMessage: jest.fn().mockRejectedValue(new Error('API error'))
      };
      createIntegration.mockReturnValue(mockInstance);

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'send_message', params: { channel: 'C123', text: 'Hi' } });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('API error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ==========================================
  // GET /api/integrations/:id/logs
  // ==========================================
  describe('GET /api/integrations/:id/logs', () => {
    it('should return integration logs', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '1' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'log-1',
              action: 'test_connection',
              request_data: '{"test":true}',
              response_data: '{"success":true}',
              result: 'success',
              created_at: '2024-01-01'
            }
          ]
        });

      const res = await request(app).get('/api/integrations/1/logs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.logs).toHaveLength(1);
      expect(res.body.count).toBe(1);
    });

    it('should parse JSON log data', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '1' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'log-1',
              request_data: '{"action":"send"}',
              response_data: '{"status":"ok"}'
            }
          ]
        });

      const res = await request(app).get('/api/integrations/1/logs');

      expect(res.body.logs[0].request_data).toEqual({ action: 'send' });
      expect(res.body.logs[0].response_data).toEqual({ status: 'ok' });
    });

    it('should handle already parsed log data', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '1' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'log-1',
              request_data: { action: 'send' },
              response_data: { status: 'ok' }
            }
          ]
        });

      const res = await request(app).get('/api/integrations/1/logs');

      expect(res.body.logs[0].request_data).toEqual({ action: 'send' });
      expect(res.body.logs[0].response_data).toEqual({ status: 'ok' });
    });

    it('should apply default pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/integrations/1/logs');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        ['1', 50, 0]
      );
    });

    it('should apply custom pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/integrations/1/logs?limit=20&offset=10');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        ['1', '20', '10']
      );
    });

    it('should verify integration ownership', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await request(app).get('/api/integrations/123/logs');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND user_id = $2'),
        ['123', 'user-1']
      );
    });

    it('should return 404 if integration not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/integrations/nonexistent/logs');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Integration not found');
    });

    it('should handle database error', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '1' }] })
        .mockRejectedValueOnce(new Error('Query failed'));

      const res = await request(app).get('/api/integrations/1/logs');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch logs');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return empty array when no logs', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/integrations/1/logs');

      expect(res.status).toBe(200);
      expect(res.body.logs).toEqual([]);
      expect(res.body.count).toBe(0);
    });
  });
});
