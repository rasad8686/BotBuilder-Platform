/**
 * Slack Webhook Routes Tests
 * Tests for Slack webhook endpoints
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../../db', () => {
  const mockDb = jest.fn(() => mockDb);
  mockDb.where = jest.fn(() => mockDb);
  mockDb.first = jest.fn();
  mockDb.insert = jest.fn(() => Promise.resolve([1]));
  mockDb.update = jest.fn(() => Promise.resolve(1));
  mockDb.select = jest.fn(() => mockDb);
  mockDb.returning = jest.fn(() => Promise.resolve([{ id: 1 }]));
  return mockDb;
});

jest.mock('../../../services/channels/slackService', () => ({
  verifySignature: jest.fn(() => true),
  handleEventCallback: jest.fn((body) => ({
    type: body.type || 'message',
    teamId: body.team_id,
    userId: body.event?.user,
    channelId: body.event?.channel,
    text: body.event?.text,
    ts: body.event?.ts,
    threadTs: body.event?.thread_ts,
    botId: body.event?.bot_id,
    challenge: body.challenge
  })),
  handleSlashCommand: jest.fn((payload) => ({
    command: payload.command,
    text: payload.text,
    teamId: payload.team_id,
    userId: payload.user_id,
    userName: payload.user_name,
    channelId: payload.channel_id,
    responseUrl: payload.response_url,
    triggerId: payload.trigger_id
  })),
  handleInteractiveMessage: jest.fn((payload) => ({
    type: payload.type,
    teamId: payload.team?.id,
    userId: payload.user?.id,
    userName: payload.user?.name,
    channelId: payload.channel?.id,
    triggerId: payload.trigger_id,
    responseUrl: payload.response_url,
    actions: payload.actions
  })),
  sendMessage: jest.fn(() => Promise.resolve({ ok: true })),
  buildTextBlock: jest.fn((text) => ({ type: 'section', text: { type: 'mrkdwn', text } })),
  buildDivider: jest.fn(() => ({ type: 'divider' })),
  buildContextBlock: jest.fn((elements) => ({ type: 'context', elements }))
}));

const db = require('../../../db');
const slackService = require('../../../services/channels/slackService');

// Import router after mocks
const slackWebhook = require('../../../routes/webhooks/slack');

describe('Slack Webhook Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/webhooks/slack', slackWebhook);
    jest.clearAllMocks();
  });

  describe('Signature Verification Middleware', () => {
    it('should return 401 if signature headers are missing', async () => {
      const response = await request(app)
        .post('/api/webhooks/slack/events')
        .send({ type: 'url_verification', challenge: 'test123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing signature headers');
    });

    it('should return 401 if signature is invalid', async () => {
      slackService.verifySignature.mockReturnValueOnce(false);

      const response = await request(app)
        .post('/api/webhooks/slack/events')
        .set('x-slack-signature', 'invalid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ type: 'url_verification', challenge: 'test123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid signature');
    });

    it('should return 401 if no signing secret configured', async () => {
      const originalEnv = process.env.SLACK_SIGNING_SECRET;
      delete process.env.SLACK_SIGNING_SECRET;
      db.first.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/webhooks/slack/events')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ type: 'url_verification', challenge: 'test123', team_id: 'T123' });

      process.env.SLACK_SIGNING_SECRET = originalEnv;
      expect(response.status).toBe(401);
    });
  });

  describe('POST /events', () => {
    beforeEach(() => {
      process.env.SLACK_SIGNING_SECRET = 'test-secret';
    });

    it('should handle URL verification challenge', async () => {
      slackService.handleEventCallback.mockReturnValueOnce({
        type: 'url_verification',
        challenge: 'test-challenge-123'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/events')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ type: 'url_verification', challenge: 'test-challenge-123' });

      expect(response.status).toBe(200);
      expect(response.body.challenge).toBe('test-challenge-123');
    });

    it('should acknowledge if channel not found', async () => {
      db.first.mockResolvedValue(null);
      slackService.handleEventCallback.mockReturnValueOnce({
        type: 'message',
        teamId: 'T123',
        text: 'Hello'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/events')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ team_id: 'T123', event: { type: 'message', text: 'Hello' } });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    it('should store and process message events', async () => {
      db.first
        .mockResolvedValueOnce({ id: 1, team_id: 'T123', is_active: true, signing_secret: 'secret' })
        .mockResolvedValueOnce({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 })
        .mockResolvedValueOnce({ id: 1, name: 'TestBot', status: 'active' });

      slackService.handleEventCallback.mockReturnValueOnce({
        type: 'message',
        teamId: 'T123',
        userId: 'U123',
        channelId: 'C123',
        text: 'Hello bot!',
        ts: '1234567890.123456'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/events')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          team_id: 'T123',
          event: { type: 'message', user: 'U123', channel: 'C123', text: 'Hello bot!' }
        });

      expect(response.status).toBe(200);
      expect(db.insert).toHaveBeenCalled();
    });

    it('should ignore bot messages', async () => {
      db.first.mockResolvedValue({ id: 1, team_id: 'T123', is_active: true });
      slackService.handleEventCallback.mockReturnValueOnce({
        type: 'message',
        teamId: 'T123',
        botId: 'B123',
        text: 'Bot message'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/events')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          team_id: 'T123',
          event: { type: 'message', bot_id: 'B123', text: 'Bot message' }
        });

      expect(response.status).toBe(200);
    });

    it('should handle app_mention events', async () => {
      db.first
        .mockResolvedValueOnce({ id: 1, team_id: 'T123', is_active: true, signing_secret: 'secret' })
        .mockResolvedValueOnce({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 })
        .mockResolvedValueOnce({ id: 1, name: 'TestBot', status: 'active' });

      slackService.handleEventCallback.mockReturnValueOnce({
        type: 'app_mention',
        teamId: 'T123',
        userId: 'U123',
        channelId: 'C123',
        text: '<@BOT123> help me'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/events')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          team_id: 'T123',
          event: { type: 'app_mention', user: 'U123', text: '<@BOT123> help me' }
        });

      expect(response.status).toBe(200);
    });

    it('should handle errors gracefully', async () => {
      slackService.handleEventCallback.mockImplementationOnce(() => {
        throw new Error('Parse error');
      });

      const response = await request(app)
        .post('/api/webhooks/slack/events')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ type: 'message' });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });

  describe('POST /commands', () => {
    beforeEach(() => {
      process.env.SLACK_SIGNING_SECRET = 'test-secret';
    });

    it('should return error if workspace not connected', async () => {
      db.first.mockResolvedValue(null);
      slackService.handleSlashCommand.mockReturnValueOnce({
        command: '/botbuilder',
        teamId: 'T123'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/commands')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ command: '/botbuilder', team_id: 'T123' });

      expect(response.status).toBe(200);
      expect(response.body.text).toContain('not connected');
    });

    it('should handle /bb command without args', async () => {
      db.first.mockResolvedValue({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 });
      slackService.handleSlashCommand.mockReturnValueOnce({
        command: '/bb',
        text: '',
        teamId: 'T123',
        userId: 'U123'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/commands')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ command: '/bb', text: '', team_id: 'T123' });

      expect(response.status).toBe(200);
      expect(response.body.response_type).toBe('ephemeral');
      expect(response.body.blocks).toBeDefined();
    });

    it('should handle /bb help command', async () => {
      db.first.mockResolvedValue({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 });
      slackService.handleSlashCommand.mockReturnValueOnce({
        command: '/bb',
        text: 'help',
        teamId: 'T123'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/commands')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ command: '/bb', text: 'help', team_id: 'T123' });

      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Help');
    });

    it('should handle /bb status command', async () => {
      db.first
        .mockResolvedValueOnce({ id: 1, team_id: 'T123', is_active: true, signing_secret: 'secret' })
        .mockResolvedValueOnce({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 })
        .mockResolvedValueOnce({ id: 1, name: 'TestBot', status: 'active' });

      slackService.handleSlashCommand.mockReturnValueOnce({
        command: '/bb',
        text: 'status',
        teamId: 'T123'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/commands')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ command: '/bb', text: 'status', team_id: 'T123' });

      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Status');
    });

    it('should handle /bb ask command', async () => {
      db.first.mockResolvedValue({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 });
      slackService.handleSlashCommand.mockReturnValueOnce({
        command: '/bb',
        text: 'ask What is the weather?',
        teamId: 'T123'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/commands')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ command: '/bb', text: 'ask What is the weather?', team_id: 'T123' });

      expect(response.status).toBe(200);
      expect(response.body.response_type).toBe('in_channel');
    });

    it('should handle unknown subcommand', async () => {
      db.first.mockResolvedValue({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 });
      slackService.handleSlashCommand.mockReturnValueOnce({
        command: '/bb',
        text: 'unknown',
        teamId: 'T123'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/commands')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ command: '/bb', text: 'unknown', team_id: 'T123' });

      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Unknown command');
    });

    it('should handle unknown slash command', async () => {
      db.first.mockResolvedValue({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 });
      slackService.handleSlashCommand.mockReturnValueOnce({
        command: '/unknowncommand',
        teamId: 'T123'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/commands')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ command: '/unknowncommand', team_id: 'T123' });

      expect(response.status).toBe(200);
      expect(response.body.text).toBe('Unknown command');
    });

    it('should store command in database', async () => {
      db.first.mockResolvedValue({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 });
      slackService.handleSlashCommand.mockReturnValueOnce({
        command: '/bb',
        text: 'help',
        teamId: 'T123',
        userId: 'U123',
        userName: 'testuser',
        channelId: 'C123',
        responseUrl: 'https://hooks.slack.com/...',
        triggerId: 'T123'
      });

      await request(app)
        .post('/api/webhooks/slack/commands')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ command: '/bb', text: 'help', team_id: 'T123' });

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      slackService.handleSlashCommand.mockImplementationOnce(() => {
        throw new Error('Parse error');
      });

      const response = await request(app)
        .post('/api/webhooks/slack/commands')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ command: '/bb' });

      expect(response.status).toBe(200);
      expect(response.body.text).toContain('error');
    });
  });

  describe('POST /interactive', () => {
    beforeEach(() => {
      process.env.SLACK_SIGNING_SECRET = 'test-secret';
    });

    it('should acknowledge if channel not found', async () => {
      db.first.mockResolvedValue(null);
      slackService.handleInteractiveMessage.mockReturnValueOnce({
        type: 'block_actions',
        teamId: 'T123'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/interactive')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ payload: JSON.stringify({ type: 'block_actions', team: { id: 'T123' } }) });

      expect(response.status).toBe(200);
    });

    it('should handle block_actions', async () => {
      db.first.mockResolvedValue({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 });
      slackService.handleInteractiveMessage.mockReturnValueOnce({
        type: 'block_actions',
        teamId: 'T123',
        userId: 'U123',
        actions: [{ action_id: 'button_click', value: 'test' }]
      });

      const response = await request(app)
        .post('/api/webhooks/slack/interactive')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          payload: JSON.stringify({
            type: 'block_actions',
            team: { id: 'T123' },
            user: { id: 'U123' },
            actions: [{ action_id: 'button_click' }]
          })
        });

      expect(response.status).toBe(200);
    });

    it('should handle view_submission', async () => {
      db.first.mockResolvedValue({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 });
      slackService.handleInteractiveMessage.mockReturnValueOnce({
        type: 'view_submission',
        teamId: 'T123',
        userId: 'U123'
      });

      const response = await request(app)
        .post('/api/webhooks/slack/interactive')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          payload: JSON.stringify({
            type: 'view_submission',
            team: { id: 'T123' },
            user: { id: 'U123' },
            view: { callback_id: 'modal_submit' }
          })
        });

      expect(response.status).toBe(200);
      expect(response.body.response_action).toBe('clear');
    });

    it('should handle view_submission with errors', async () => {
      db.first.mockResolvedValue({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 });
      slackService.handleInteractiveMessage.mockReturnValueOnce({
        type: 'view_submission',
        teamId: 'T123'
      });

      // Mock processInteraction to return errors
      const response = await request(app)
        .post('/api/webhooks/slack/interactive')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          payload: JSON.stringify({
            type: 'view_submission',
            team: { id: 'T123' }
          })
        });

      expect(response.status).toBe(200);
    });

    it('should store interaction in database', async () => {
      db.first.mockResolvedValue({ id: 1, team_id: 'T123', is_active: true, bot_id: 1 });
      slackService.handleInteractiveMessage.mockReturnValueOnce({
        type: 'block_actions',
        teamId: 'T123',
        userId: 'U123',
        userName: 'testuser',
        channelId: 'C123',
        triggerId: 'T123',
        responseUrl: 'https://hooks.slack.com/...'
      });

      await request(app)
        .post('/api/webhooks/slack/interactive')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          payload: JSON.stringify({
            type: 'block_actions',
            team: { id: 'T123' }
          })
        });

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      slackService.handleInteractiveMessage.mockImplementationOnce(() => {
        throw new Error('Parse error');
      });

      const response = await request(app)
        .post('/api/webhooks/slack/interactive')
        .set('x-slack-signature', 'valid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ payload: 'invalid json' });

      expect(response.status).toBe(200);
    });
  });
});
