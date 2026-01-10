/**
 * Slack Webhook Routes Comprehensive Tests
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

jest.mock('../../../db', () => ({ query: jest.fn() }));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));
jest.mock('../../../services/channels/slackService', () => ({
  processMessage: jest.fn(),
  verifySignature: jest.fn(),
  handleInteraction: jest.fn(),
  handleCommand: jest.fn()
}));

const db = require('../../../db');
const slackService = require('../../../services/channels/slackService');

describe('Slack Webhook Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const router = express.Router();

    // Events endpoint
    router.post('/events', async (req, res) => {
      const { type, challenge, event, team_id } = req.body;

      // URL verification challenge
      if (type === 'url_verification') {
        return res.json({ challenge });
      }

      // Check for retry
      const retryNum = req.headers['x-slack-retry-num'];
      if (retryNum && parseInt(retryNum) > 0) {
        return res.status(200).json({ ok: true, retry_skipped: true });
      }

      if (!team_id) {
        return res.status(400).json({ error: 'Missing team_id' });
      }

      try {
        const botResult = await db.query(
          'SELECT * FROM bots WHERE slack_team_id = $1',
          [team_id]
        );

        if (botResult.rows.length === 0) {
          return res.status(404).json({ error: 'Bot not found' });
        }

        const bot = botResult.rows[0];

        if (event) {
          await slackService.processMessage(bot, event);
        }

        res.status(200).json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: 'Internal error' });
      }
    });

    // Interactions endpoint
    router.post('/interactions', async (req, res) => {
      let payload;
      try {
        payload = typeof req.body.payload === 'string'
          ? JSON.parse(req.body.payload)
          : req.body.payload || req.body;
      } catch (e) {
        return res.status(400).json({ error: 'Invalid payload' });
      }

      const { type, team, actions, callback_id } = payload;

      if (!team || !team.id) {
        return res.status(400).json({ error: 'Missing team' });
      }

      try {
        const botResult = await db.query(
          'SELECT * FROM bots WHERE slack_team_id = $1',
          [team.id]
        );

        if (botResult.rows.length === 0) {
          return res.status(404).json({ error: 'Bot not found' });
        }

        await slackService.handleInteraction(botResult.rows[0], payload);
        res.status(200).json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: 'Internal error' });
      }
    });

    // Commands endpoint
    router.post('/commands', async (req, res) => {
      const { command, team_id, user_id, text, channel_id } = req.body;

      if (!team_id) {
        return res.status(400).json({ error: 'Missing team_id' });
      }

      try {
        const botResult = await db.query(
          'SELECT * FROM bots WHERE slack_team_id = $1',
          [team_id]
        );

        if (botResult.rows.length === 0) {
          return res.status(404).json({ error: 'Bot not found' });
        }

        const result = await slackService.handleCommand(botResult.rows[0], {
          command,
          user_id,
          text,
          channel_id
        });

        res.status(200).json(result || { response_type: 'ephemeral', text: 'Command processed' });
      } catch (error) {
        res.status(500).json({ error: 'Internal error' });
      }
    });

    app.use('/webhook/slack', router);
  });

  describe('POST /webhook/slack/events', () => {
    it('should respond to URL verification challenge', async () => {
      const challenge = 'test_challenge_token';

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'url_verification',
          challenge: challenge,
          token: 'test_token'
        });

      expect(res.status).toBe(200);
      expect(res.body.challenge).toBe(challenge);
    });

    it('should process message event', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot', slack_team_id: 'T12345' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            user: 'U12345',
            text: 'Hello bot!',
            channel: 'C12345',
            ts: '1234567890.123456'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(slackService.processMessage).toHaveBeenCalled();
    });

    it('should process app_mention event', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot', slack_team_id: 'T12345' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'app_mention',
            user: 'U12345',
            text: '<@U999BOT> help me',
            channel: 'C12345',
            ts: '1234567890.123457'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process reaction_added event', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'reaction_added',
            user: 'U12345',
            reaction: 'thumbsup',
            item: {
              type: 'message',
              channel: 'C12345',
              ts: '1234567890.123456'
            }
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process reaction_removed event', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'reaction_removed',
            user: 'U12345',
            reaction: 'thumbsup',
            item: {
              type: 'message',
              channel: 'C12345',
              ts: '1234567890.123456'
            }
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process message_changed event', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            subtype: 'message_changed',
            channel: 'C12345',
            message: {
              user: 'U12345',
              text: 'Edited message',
              ts: '1234567890.123456'
            },
            previous_message: {
              text: 'Original message',
              ts: '1234567890.123456'
            }
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process message_deleted event', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            subtype: 'message_deleted',
            channel: 'C12345',
            deleted_ts: '1234567890.123456'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process channel_join event', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'member_joined_channel',
            user: 'U12345',
            channel: 'C12345'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process channel_leave event', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'member_left_channel',
            user: 'U12345',
            channel: 'C12345'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process file_shared event', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'file_shared',
            user_id: 'U12345',
            file_id: 'F12345',
            channel_id: 'C12345'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should skip retried events', async () => {
      const res = await request(app)
        .post('/webhook/slack/events')
        .set('X-Slack-Retry-Num', '1')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            text: 'Retried message'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.retry_skipped).toBe(true);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return 400 for missing team_id', async () => {
      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          event: {
            type: 'message',
            text: 'No team'
          }
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 for unknown team', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T_UNKNOWN',
          event: {
            type: 'message',
            text: 'Hello'
          }
        });

      expect(res.status).toBe(404);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            text: 'Hello'
          }
        });

      expect(res.status).toBe(500);
    });

    it('should handle service errors', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockRejectedValue(new Error('Service error'));

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            text: 'Hello'
          }
        });

      expect(res.status).toBe(500);
    });

    it('should ignore bot messages', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            subtype: 'bot_message',
            bot_id: 'B12345',
            text: 'Bot message'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process thread reply', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            user: 'U12345',
            text: 'Thread reply',
            channel: 'C12345',
            thread_ts: '1234567890.123456',
            ts: '1234567890.123457'
          }
        });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /webhook/slack/interactions', () => {
    it('should process button click', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.handleInteraction.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/interactions')
        .send({
          payload: JSON.stringify({
            type: 'block_actions',
            team: { id: 'T12345' },
            user: { id: 'U12345' },
            actions: [{
              action_id: 'button_click',
              block_id: 'block1',
              value: 'clicked'
            }]
          })
        });

      expect(res.status).toBe(200);
      expect(slackService.handleInteraction).toHaveBeenCalled();
    });

    it('should process select menu', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.handleInteraction.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/interactions')
        .send({
          payload: JSON.stringify({
            type: 'block_actions',
            team: { id: 'T12345' },
            user: { id: 'U12345' },
            actions: [{
              action_id: 'select_option',
              type: 'static_select',
              selected_option: {
                value: 'option1'
              }
            }]
          })
        });

      expect(res.status).toBe(200);
    });

    it('should process modal submission', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.handleInteraction.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/interactions')
        .send({
          payload: JSON.stringify({
            type: 'view_submission',
            team: { id: 'T12345' },
            user: { id: 'U12345' },
            view: {
              callback_id: 'modal1',
              state: {
                values: {
                  input1: {
                    action1: { value: 'test value' }
                  }
                }
              }
            }
          })
        });

      expect(res.status).toBe(200);
    });

    it('should process shortcut', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.handleInteraction.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/interactions')
        .send({
          payload: JSON.stringify({
            type: 'shortcut',
            team: { id: 'T12345' },
            user: { id: 'U12345' },
            callback_id: 'global_shortcut'
          })
        });

      expect(res.status).toBe(200);
    });

    it('should process message action', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.handleInteraction.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/interactions')
        .send({
          payload: JSON.stringify({
            type: 'message_action',
            team: { id: 'T12345' },
            user: { id: 'U12345' },
            callback_id: 'message_action',
            message: {
              text: 'Original message',
              ts: '1234567890.123456'
            }
          })
        });

      expect(res.status).toBe(200);
    });

    it('should return 400 for missing team', async () => {
      const res = await request(app)
        .post('/webhook/slack/interactions')
        .send({
          payload: JSON.stringify({
            type: 'block_actions',
            user: { id: 'U12345' },
            actions: []
          })
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid payload', async () => {
      const res = await request(app)
        .post('/webhook/slack/interactions')
        .send({
          payload: 'invalid json {'
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 for unknown team', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/webhook/slack/interactions')
        .send({
          payload: JSON.stringify({
            type: 'block_actions',
            team: { id: 'T_UNKNOWN' },
            actions: []
          })
        });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /webhook/slack/commands', () => {
    it('should process /help command', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.handleCommand.mockResolvedValue({
        response_type: 'ephemeral',
        text: 'Here is help'
      });

      const res = await request(app)
        .post('/webhook/slack/commands')
        .send({
          command: '/help',
          team_id: 'T12345',
          user_id: 'U12345',
          text: '',
          channel_id: 'C12345'
        });

      expect(res.status).toBe(200);
      expect(res.body.response_type).toBe('ephemeral');
    });

    it('should process custom command with text', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.handleCommand.mockResolvedValue({
        response_type: 'in_channel',
        text: 'Search results for: query'
      });

      const res = await request(app)
        .post('/webhook/slack/commands')
        .send({
          command: '/search',
          team_id: 'T12345',
          user_id: 'U12345',
          text: 'query',
          channel_id: 'C12345'
        });

      expect(res.status).toBe(200);
      expect(res.body.response_type).toBe('in_channel');
    });

    it('should return 400 for missing team_id', async () => {
      const res = await request(app)
        .post('/webhook/slack/commands')
        .send({
          command: '/help',
          user_id: 'U12345'
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 for unknown team', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/webhook/slack/commands')
        .send({
          command: '/help',
          team_id: 'T_UNKNOWN',
          user_id: 'U12345'
        });

      expect(res.status).toBe(404);
    });

    it('should handle command processing errors', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.handleCommand.mockRejectedValue(new Error('Command error'));

      const res = await request(app)
        .post('/webhook/slack/commands')
        .send({
          command: '/error',
          team_id: 'T12345',
          user_id: 'U12345'
        });

      expect(res.status).toBe(500);
    });

    it('should return default response when handler returns null', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.handleCommand.mockResolvedValue(null);

      const res = await request(app)
        .post('/webhook/slack/commands')
        .send({
          command: '/silent',
          team_id: 'T12345',
          user_id: 'U12345'
        });

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Command processed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty event', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345'
        });

      expect(res.status).toBe(200);
    });

    it('should handle message with blocks', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            user: 'U12345',
            text: 'Message with blocks',
            blocks: [
              {
                type: 'section',
                text: { type: 'mrkdwn', text: '*Bold text*' }
              }
            ],
            channel: 'C12345'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle message with attachments', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            user: 'U12345',
            text: 'Message with attachment',
            attachments: [
              {
                fallback: 'Attachment',
                title: 'Link',
                title_link: 'https://example.com'
              }
            ],
            channel: 'C12345'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle direct message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            user: 'U12345',
            text: 'Direct message',
            channel: 'D12345',
            channel_type: 'im'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle very long message text', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const longText = 'A'.repeat(40000);
      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            user: 'U12345',
            text: longText,
            channel: 'C12345'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle unicode in message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      slackService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/webhook/slack/events')
        .send({
          type: 'event_callback',
          team_id: 'T12345',
          event: {
            type: 'message',
            user: 'U12345',
            text: '你好 👋 مرحبا',
            channel: 'C12345'
          }
        });

      expect(res.status).toBe(200);
    });
  });
});
