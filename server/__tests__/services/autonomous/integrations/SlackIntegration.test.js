/**
 * SlackIntegration Tests
 * Tests for the Slack integration for autonomous agents
 */

jest.mock('../../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock global fetch
global.fetch = jest.fn();

const SlackIntegration = require('../../../../services/autonomous/integrations/SlackIntegration');

describe('SlackIntegration', () => {
  let slackIntegration;

  beforeEach(() => {
    jest.clearAllMocks();
    slackIntegration = new SlackIntegration({
      access_token: 'xoxb-test-token',
      bot_token: 'xoxb-bot-token',
      team_id: 'T12345'
    });
  });

  describe('constructor', () => {
    it('should initialize with credentials', () => {
      expect(slackIntegration.type).toBe('slack');
      expect(slackIntegration.name).toBe('Slack');
      expect(slackIntegration.accessToken).toBe('xoxb-test-token');
      expect(slackIntegration.botToken).toBe('xoxb-bot-token');
      expect(slackIntegration.teamId).toBe('T12345');
    });

    it('should initialize with default values', () => {
      const integration = new SlackIntegration();
      expect(integration.accessToken).toBeUndefined();
      expect(integration.botToken).toBeUndefined();
    });
  });

  describe('getOAuthConfig', () => {
    it('should return OAuth2 configuration', () => {
      const config = SlackIntegration.getOAuthConfig();

      expect(config.authorizationUrl).toContain('slack.com/oauth');
      expect(config.tokenUrl).toContain('slack.com/api');
      expect(config.scopes).toContain('channels:read');
      expect(config.scopes).toContain('chat:write');
    });
  });

  describe('exchangeCode', () => {
    it('should exchange authorization code for tokens', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          access_token: 'new-access-token',
          team: { id: 'T123', name: 'Test Team' },
          scope: 'chat:write',
          token_type: 'bot'
        })
      });

      const result = await SlackIntegration.exchangeCode('auth-code');

      expect(result.access_token).toBe('new-access-token');
      expect(result.team_id).toBe('T123');
      expect(result.team_name).toBe('Test Team');
    });

    it('should throw error on failed exchange', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: false,
          error: 'invalid_code'
        })
      });

      await expect(SlackIntegration.exchangeCode('bad-code'))
        .rejects.toThrow('invalid_code');
    });
  });

  describe('request', () => {
    it('should make GET request to Slack API', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          data: 'test'
        })
      });

      const result = await slackIntegration.request('auth.test');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/auth.test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer xoxb-bot-token'
          })
        })
      );
      expect(result.data).toBe('test');
    });

    it('should make POST request with body', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true })
      });

      await slackIntegration.request('chat.postMessage', 'POST', {
        channel: 'C123',
        text: 'Hello'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ channel: 'C123', text: 'Hello' })
        })
      );
    });

    it('should throw error when no token available', async () => {
      const noTokenIntegration = new SlackIntegration();

      await expect(noTokenIntegration.request('auth.test'))
        .rejects.toThrow('No access token available');
    });

    it('should throw error on API error', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: false,
          error: 'channel_not_found'
        })
      });

      await expect(slackIntegration.request('conversations.info'))
        .rejects.toThrow('channel_not_found');
    });

    it('should use access token if bot token not available', async () => {
      const accessOnlyIntegration = new SlackIntegration({
        access_token: 'xoxp-access-token'
      });

      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true })
      });

      await accessOnlyIntegration.request('auth.test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer xoxp-access-token'
          })
        })
      );
    });
  });

  describe('sendMessage', () => {
    it('should send a simple message', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          channel: 'C123',
          ts: '1234567890.123',
          message: { text: 'Hello' }
        })
      });

      const result = await slackIntegration.sendMessage('C123', 'Hello');

      expect(result.success).toBe(true);
      expect(result.channel).toBe('C123');
      expect(result.timestamp).toBe('1234567890.123');
    });

    it('should send message with blocks', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          channel: 'C123',
          ts: '123',
          message: {}
        })
      });

      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'Hello' } }];
      await slackIntegration.sendMessage('C123', 'Hello', { blocks });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('blocks')
        })
      );
    });

    it('should send message with attachments', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          channel: 'C123',
          ts: '123',
          message: {}
        })
      });

      const attachments = [{ text: 'Attachment' }];
      await slackIntegration.sendMessage('C123', 'Hello', { attachments });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('attachments')
        })
      );
    });

    it('should send thread reply', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          channel: 'C123',
          ts: '123',
          message: {}
        })
      });

      await slackIntegration.sendMessage('C123', 'Reply', { thread_ts: '111.222' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('thread_ts')
        })
      );
    });
  });

  describe('listChannels', () => {
    it('should list channels with default options', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          channels: [
            { id: 'C1', name: 'general', is_private: false, is_archived: false, num_members: 10, topic: { value: 'Topic' }, purpose: { value: 'Purpose' } },
            { id: 'C2', name: 'random', is_private: false, is_archived: false, num_members: 5, topic: {}, purpose: {} }
          ],
          response_metadata: { next_cursor: 'cursor123' }
        })
      });

      const result = await slackIntegration.listChannels();

      expect(result.success).toBe(true);
      expect(result.channels).toHaveLength(2);
      expect(result.channels[0].id).toBe('C1');
      expect(result.channels[0].name).toBe('general');
      expect(result.nextCursor).toBe('cursor123');
    });

    it('should apply custom options', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          channels: [],
          response_metadata: {}
        })
      });

      await slackIntegration.listChannels({
        types: 'private_channel',
        excludeArchived: false,
        limit: 50,
        cursor: 'prevCursor'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('types=private_channel'),
        expect.any(Object)
      );
    });
  });

  describe('getChannelHistory', () => {
    it('should get channel history', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          messages: [
            { type: 'message', user: 'U1', text: 'Hello', ts: '123', thread_ts: null, reply_count: 0 },
            { type: 'message', user: 'U2', text: 'Hi', ts: '124', thread_ts: '123', reply_count: 2 }
          ],
          has_more: true
        })
      });

      const result = await slackIntegration.getChannelHistory('C123');

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].text).toBe('Hello');
      expect(result.hasMore).toBe(true);
    });

    it('should apply time filters', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          messages: [],
          has_more: false
        })
      });

      await slackIntegration.getChannelHistory('C123', {
        oldest: '1234567890',
        latest: '1234567899',
        limit: 25
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('oldest=1234567890'),
        expect.any(Object)
      );
    });
  });

  describe('listUsers', () => {
    it('should list non-bot, non-deleted users', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          members: [
            { id: 'U1', name: 'user1', real_name: 'User One', is_bot: false, deleted: false, is_admin: true, profile: { display_name: 'U1', email: 'u1@test.com', image_72: 'http://avatar' } },
            { id: 'U2', name: 'bot', is_bot: true, deleted: false },
            { id: 'U3', name: 'deleted', is_bot: false, deleted: true }
          ],
          response_metadata: { next_cursor: '' }
        })
      });

      const result = await slackIntegration.listUsers();

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(1);
      expect(result.users[0].name).toBe('user1');
      expect(result.users[0].isAdmin).toBe(true);
    });

    it('should apply pagination options', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          members: [],
          response_metadata: { next_cursor: 'next' }
        })
      });

      await slackIntegration.listUsers({ limit: 50, cursor: 'prev' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        expect.any(Object)
      );
    });
  });

  describe('getUserInfo', () => {
    it('should get user information', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          user: {
            id: 'U123',
            name: 'testuser',
            real_name: 'Test User',
            is_admin: false,
            tz: 'America/New_York',
            profile: {
              email: 'test@example.com',
              title: 'Developer'
            }
          }
        })
      });

      const result = await slackIntegration.getUserInfo('U123');

      expect(result.success).toBe(true);
      expect(result.user.id).toBe('U123');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.timezone).toBe('America/New_York');
    });
  });

  describe('createChannel', () => {
    it('should create a public channel', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          channel: {
            id: 'C_NEW',
            name: 'new-channel'
          }
        })
      });

      const result = await slackIntegration.createChannel('New Channel');

      expect(result.success).toBe(true);
      expect(result.channel.id).toBe('C_NEW');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('new-channel')
        })
      );
    });

    it('should create a private channel', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          channel: { id: 'G_NEW', name: 'private-channel' }
        })
      });

      await slackIntegration.createChannel('Private Channel', true);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"is_private":true')
        })
      );
    });

    it('should convert spaces to dashes in channel name', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          channel: { id: 'C1', name: 'my-new-channel' }
        })
      });

      await slackIntegration.createChannel('My New Channel');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('my-new-channel')
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should return success on valid connection', async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve({
          ok: true,
          team: 'Test Team',
          user: 'testbot',
          team_id: 'T123',
          user_id: 'U123'
        })
      });

      const result = await slackIntegration.testConnection();

      expect(result.success).toBe(true);
      expect(result.team).toBe('Test Team');
      expect(result.teamId).toBe('T123');
    });

    it('should return failure on invalid connection', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await slackIntegration.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('getAvailableActions', () => {
    it('should return list of available actions', () => {
      const actions = SlackIntegration.getAvailableActions();

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.find(a => a.name === 'send_message')).toBeDefined();
      expect(actions.find(a => a.name === 'list_channels')).toBeDefined();
      expect(actions.find(a => a.name === 'get_history')).toBeDefined();
      expect(actions.find(a => a.name === 'list_users')).toBeDefined();
    });

    it('should define parameters for each action', () => {
      const actions = SlackIntegration.getAvailableActions();

      const sendMessage = actions.find(a => a.name === 'send_message');
      expect(sendMessage.parameters.channel.required).toBe(true);
      expect(sendMessage.parameters.text.required).toBe(true);
    });
  });
});
