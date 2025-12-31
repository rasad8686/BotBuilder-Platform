/**
 * Integrations Routes Tests
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
    { type: 'slack', name: 'Slack' },
    { type: 'google_calendar', name: 'Google Calendar' }
  ])
}));

const db = require('../../db');
const {
  SlackIntegration,
  GoogleCalendarIntegration,
  createIntegration
} = require('../../services/autonomous/integrations');
const integrationsRouter = require('../../routes/integrations');

describe('Integrations Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/integrations', integrationsRouter);
  });

  describe('GET /api/integrations/available', () => {
    it('should return available integrations', async () => {
      const res = await request(app).get('/api/integrations/available');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.integrations).toHaveLength(2);
    });
  });

  describe('GET /api/integrations', () => {
    it('should return user integrations', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: '1', type: 'slack', name: 'Slack', status: 'connected', config: '{}', metadata: '{}' }
        ]
      });

      const res = await request(app).get('/api/integrations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.integrations).toHaveLength(1);
    });

    it('should parse JSON config and metadata', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: '1', type: 'slack', config: '{"key":"value"}', metadata: '{"team":"test"}' }
        ]
      });

      const res = await request(app).get('/api/integrations');

      expect(res.body.integrations[0].config).toEqual({ key: 'value' });
      expect(res.body.integrations[0].metadata).toEqual({ team: 'test' });
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/integrations');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch integrations');
    });
  });

  describe('GET /api/integrations/:id', () => {
    it('should return single integration', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: '1', type: 'slack', name: 'Slack', config: '{}', metadata: '{}' }]
      });

      const res = await request(app).get('/api/integrations/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.integration.id).toBe('1');
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/integrations/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Integration not found');
    });
  });

  describe('DELETE /api/integrations/:id', () => {
    it('should delete integration', async () => {
      db.query.mockResolvedValue({ rows: [{ id: '1' }] });

      const res = await request(app).delete('/api/integrations/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).delete('/api/integrations/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/integrations/:type/auth', () => {
    it('should return Slack auth URL', async () => {
      const res = await request(app).get('/api/integrations/slack/auth');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.authUrl).toContain('slack.com');
    });

    it('should return Google Calendar auth URL', async () => {
      const res = await request(app).get('/api/integrations/google_calendar/auth');

      expect(res.status).toBe(200);
      expect(res.body.authUrl).toContain('google.com');
    });

    it('should return Gmail auth URL', async () => {
      const res = await request(app).get('/api/integrations/gmail/auth');

      expect(res.status).toBe(200);
      expect(res.body.authUrl).toContain('google.com');
    });

    it('should return CRM auth URL with provider', async () => {
      const res = await request(app).get('/api/integrations/crm/auth?provider=hubspot');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for unknown type', async () => {
      const res = await request(app).get('/api/integrations/unknown/auth');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Unknown integration type');
    });
  });

  describe('GET /api/integrations/:type/callback', () => {
    it('should redirect on oauth error', async () => {
      const res = await request(app)
        .get('/api/integrations/slack/callback?error=access_denied');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=access_denied');
    });

    it('should redirect on missing params', async () => {
      const res = await request(app)
        .get('/api/integrations/slack/callback');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=missing_params');
    });

    it('should redirect on invalid state', async () => {
      const res = await request(app)
        .get('/api/integrations/slack/callback?code=abc&state=invalid');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=invalid_state');
    });

    it('should exchange code and save Slack integration', async () => {
      const state = JSON.stringify({ userId: 'user-1', type: 'slack' });
      SlackIntegration.exchangeCode.mockResolvedValue({
        access_token: 'token',
        team_name: 'Test Team',
        team_id: 'T123'
      });
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get(`/api/integrations/slack/callback?code=auth-code&state=${encodeURIComponent(state)}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('success=slack');
    });

    it('should redirect on unknown type in callback', async () => {
      const state = JSON.stringify({ userId: 'user-1', type: 'unknown' });

      const res = await request(app)
        .get(`/api/integrations/unknown/callback?code=abc&state=${encodeURIComponent(state)}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=unknown_type');
    });
  });

  describe('POST /api/integrations/:id/test', () => {
    it('should test integration connection', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: '1', type: 'slack', credentials: '{"access_token":"token"}' }]
      }).mockResolvedValue({ rows: [] });

      createIntegration.mockReturnValue({
        testConnection: jest.fn().mockResolvedValue({ success: true })
      });

      const res = await request(app).post('/api/integrations/1/test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if integration not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).post('/api/integrations/nonexistent/test');

      expect(res.status).toBe(404);
    });
  });

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

    it('should execute send_message action', async () => {
      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'send_message', params: { channel: 'C123', text: 'Hello' } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should execute list_channels action', async () => {
      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'list_channels', params: {} });

      expect(res.status).toBe(200);
    });

    it('should execute list_events action', async () => {
      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'list_events', params: { calendarId: 'primary' } });

      expect(res.status).toBe(200);
    });

    it('should execute create_event action', async () => {
      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'create_event', params: { calendarId: 'primary', title: 'Meeting' } });

      expect(res.status).toBe(200);
    });

    it('should execute send_email action', async () => {
      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'send_email', params: { to: 'test@example.com', subject: 'Test', body: 'Hello' } });

      expect(res.status).toBe(200);
    });

    it('should execute create_contact action', async () => {
      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'create_contact', params: { email: 'test@example.com' } });

      expect(res.status).toBe(200);
    });

    it('should return 400 for unknown action', async () => {
      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'unknown_action', params: {} });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Unknown action: unknown_action');
    });

    it('should check integration status', async () => {
      db.query.mockReset();
      db.query.mockResolvedValue({
        rows: [{ id: '1', type: 'slack', status: 'disconnected', credentials: '{}' }]
      });

      const res = await request(app)
        .post('/api/integrations/1/execute')
        .send({ action: 'send_message', params: {} });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Integration is not connected');
    });
  });

  describe('GET /api/integrations/:id/logs', () => {
    it('should return integration logs', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '1' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 'log-1', action: 'test', request_data: '{}', response_data: '{}' }
          ]
        });

      const res = await request(app).get('/api/integrations/1/logs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.logs).toHaveLength(1);
    });

    it('should return 404 if integration not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/integrations/nonexistent/logs');

      expect(res.status).toBe(404);
    });

    it('should apply pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/integrations/1/logs?limit=10&offset=5');

      expect(res.status).toBe(200);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        ['1', '10', '5']
      );
    });
  });
});
