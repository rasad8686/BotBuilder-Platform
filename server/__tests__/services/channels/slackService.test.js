/**
 * Slack Service Tests
 * Tests for server/services/channels/slackService.js
 */

jest.mock('@slack/web-api', () => {
  const mockClient = {
    chat: {
      postMessage: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      postEphemeral: jest.fn()
    },
    conversations: {
      open: jest.fn(),
      list: jest.fn(),
      info: jest.fn()
    },
    files: {
      uploadV2: jest.fn()
    },
    team: {
      info: jest.fn()
    },
    auth: {
      test: jest.fn(),
      revoke: jest.fn()
    },
    users: {
      info: jest.fn()
    },
    oauth: {
      v2: {
        access: jest.fn()
      }
    }
  };

  return {
    WebClient: jest.fn().mockImplementation(() => mockClient)
  };
});

jest.mock('axios', () => ({
  post: jest.fn()
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('random-state-123')
  }),
  createHmac: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({
      digest: jest.fn().mockReturnValue('mock-signature')
    })
  }),
  timingSafeEqual: jest.fn().mockReturnValue(true)
}));

const { WebClient } = require('@slack/web-api');
const axios = require('axios');
const crypto = require('crypto');
const slackService = require('../../../services/channels/slackService');

describe('Slack Service', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    slackService.clients.clear();
    mockClient = new WebClient();
  });

  describe('Client Management', () => {
    it('should initialize client', () => {
      const client = slackService.initClient('team-123', 'xoxb-token');

      expect(WebClient).toHaveBeenCalledWith('xoxb-token');
      expect(slackService.clients.has('team-123')).toBe(true);
    });

    it('should get existing client', () => {
      slackService.initClient('team-123', 'xoxb-token');
      const client = slackService.getClient('team-123');

      expect(client).toBeDefined();
    });

    it('should create new client if not exists and token provided', () => {
      const client = slackService.getClient('team-456', 'xoxb-new-token');

      expect(WebClient).toHaveBeenCalled();
      expect(client).toBeDefined();
    });

    it('should return undefined if client not exists and no token', () => {
      const client = slackService.getClient('team-789');

      expect(client).toBeUndefined();
    });

    it('should remove client', () => {
      slackService.initClient('team-123', 'xoxb-token');
      slackService.removeClient('team-123');

      expect(slackService.clients.has('team-123')).toBe(false);
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      slackService.initClient('team-123', 'xoxb-token');
      mockClient.chat.postMessage.mockResolvedValue({ ok: true, ts: '123.456' });
    });

    it('should send simple message', async () => {
      const result = await slackService.sendMessage('team-123', 'xoxb-token', 'C123', 'Hello');

      expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: 'Hello'
      });
      expect(result.ok).toBe(true);
    });

    it('should send message with blocks', async () => {
      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'Hello' } }];

      await slackService.sendMessage('team-123', 'xoxb-token', 'C123', 'Hello', blocks);

      expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: 'Hello',
        blocks
      });
    });

    it('should send threaded message', async () => {
      await slackService.sendMessage('team-123', 'xoxb-token', 'C123', 'Reply', null, {
        threadTs: '123.456'
      });

      expect(mockClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          thread_ts: '123.456'
        })
      );
    });

    it('should send message with attachments', async () => {
      const attachments = [{ color: 'good', text: 'Attachment' }];

      await slackService.sendMessage('team-123', 'xoxb-token', 'C123', 'Hello', null, {
        attachments
      });

      expect(mockClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ attachments })
      );
    });

    it('should handle unfurl options', async () => {
      await slackService.sendMessage('team-123', 'xoxb-token', 'C123', 'Hello', null, {
        unfurlLinks: true,
        unfurlMedia: false
      });

      expect(mockClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          unfurl_links: true,
          unfurl_media: false
        })
      );
    });
  });

  describe('sendDirectMessage', () => {
    beforeEach(() => {
      slackService.initClient('team-123', 'xoxb-token');
      mockClient.conversations.open.mockResolvedValue({
        channel: { id: 'D123' }
      });
      mockClient.chat.postMessage.mockResolvedValue({ ok: true });
    });

    it('should open DM and send message', async () => {
      await slackService.sendDirectMessage('team-123', 'xoxb-token', 'U123', 'Hello DM');

      expect(mockClient.conversations.open).toHaveBeenCalledWith({ users: 'U123' });
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'D123',
          text: 'Hello DM'
        })
      );
    });
  });

  describe('updateMessage', () => {
    beforeEach(() => {
      slackService.initClient('team-123', 'xoxb-token');
      mockClient.chat.update.mockResolvedValue({ ok: true });
    });

    it('should update message', async () => {
      await slackService.updateMessage('team-123', 'xoxb-token', 'C123', '123.456', 'Updated');

      expect(mockClient.chat.update).toHaveBeenCalledWith({
        channel: 'C123',
        ts: '123.456',
        text: 'Updated'
      });
    });

    it('should update message with blocks', async () => {
      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'Updated' } }];

      await slackService.updateMessage('team-123', 'xoxb-token', 'C123', '123.456', 'Updated', blocks);

      expect(mockClient.chat.update).toHaveBeenCalledWith({
        channel: 'C123',
        ts: '123.456',
        text: 'Updated',
        blocks
      });
    });
  });

  describe('deleteMessage', () => {
    beforeEach(() => {
      slackService.initClient('team-123', 'xoxb-token');
      mockClient.chat.delete.mockResolvedValue({ ok: true });
    });

    it('should delete message', async () => {
      await slackService.deleteMessage('team-123', 'xoxb-token', 'C123', '123.456');

      expect(mockClient.chat.delete).toHaveBeenCalledWith({
        channel: 'C123',
        ts: '123.456'
      });
    });
  });

  describe('uploadFile', () => {
    beforeEach(() => {
      slackService.initClient('team-123', 'xoxb-token');
      mockClient.files.uploadV2.mockResolvedValue({ ok: true, file: { id: 'F123' } });
    });

    it('should upload file', async () => {
      const result = await slackService.uploadFile('team-123', 'xoxb-token', {
        channels: 'C123',
        content: 'File content',
        filename: 'test.txt',
        filetype: 'text',
        title: 'Test File'
      });

      expect(mockClient.files.uploadV2).toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });
  });

  describe('sendEphemeral', () => {
    beforeEach(() => {
      slackService.initClient('team-123', 'xoxb-token');
      mockClient.chat.postEphemeral.mockResolvedValue({ ok: true });
    });

    it('should send ephemeral message', async () => {
      await slackService.sendEphemeral('team-123', 'xoxb-token', 'C123', 'U123', 'Secret');

      expect(mockClient.chat.postEphemeral).toHaveBeenCalledWith({
        channel: 'C123',
        user: 'U123',
        text: 'Secret'
      });
    });

    it('should send ephemeral with blocks', async () => {
      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'Secret' } }];

      await slackService.sendEphemeral('team-123', 'xoxb-token', 'C123', 'U123', 'Secret', blocks);

      expect(mockClient.chat.postEphemeral).toHaveBeenCalledWith({
        channel: 'C123',
        user: 'U123',
        text: 'Secret',
        blocks
      });
    });
  });

  describe('handleSlashCommand', () => {
    it('should parse slash command payload', () => {
      const payload = {
        command: '/mybot',
        text: 'help me',
        response_url: 'https://hooks.slack.com/response',
        trigger_id: 'trigger-123',
        user_id: 'U123',
        user_name: 'john',
        channel_id: 'C123',
        channel_name: 'general',
        team_id: 'T123',
        team_domain: 'myteam',
        api_app_id: 'A123'
      };

      const result = slackService.handleSlashCommand(payload);

      expect(result).toEqual({
        command: '/mybot',
        text: 'help me',
        responseUrl: 'https://hooks.slack.com/response',
        triggerId: 'trigger-123',
        userId: 'U123',
        userName: 'john',
        channelId: 'C123',
        channelName: 'general',
        teamId: 'T123',
        teamDomain: 'myteam',
        apiAppId: 'A123'
      });
    });
  });

  describe('respondToCommand', () => {
    it('should respond to command', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      await slackService.respondToCommand('https://hooks.slack.com/response', {
        text: 'Response',
        responseType: 'in_channel'
      });

      expect(axios.post).toHaveBeenCalledWith('https://hooks.slack.com/response', {
        response_type: 'in_channel',
        text: 'Response',
        blocks: undefined,
        attachments: undefined
      });
    });

    it('should default to ephemeral response type', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      await slackService.respondToCommand('https://hooks.slack.com/response', {
        text: 'Response'
      });

      expect(axios.post).toHaveBeenCalledWith('https://hooks.slack.com/response',
        expect.objectContaining({
          response_type: 'ephemeral'
        })
      );
    });
  });

  describe('handleInteractiveMessage', () => {
    it('should handle block_actions', () => {
      const payload = {
        type: 'block_actions',
        team: { id: 'T123', domain: 'myteam' },
        user: { id: 'U123', name: 'john' },
        channel: { id: 'C123', name: 'general' },
        trigger_id: 'trigger-123',
        response_url: 'https://hooks.slack.com/response',
        api_app_id: 'A123',
        actions: [
          {
            action_id: 'button-action',
            block_id: 'block-1',
            type: 'button',
            value: 'clicked',
            text: { text: 'Click Me' }
          }
        ],
        message: { ts: '123.456' },
        container: { type: 'message' }
      };

      const result = slackService.handleInteractiveMessage(payload);

      expect(result.type).toBe('block_actions');
      expect(result.teamId).toBe('T123');
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].actionId).toBe('button-action');
    });

    it('should handle view_submission', () => {
      const payload = {
        type: 'view_submission',
        team: { id: 'T123' },
        user: { id: 'U123' },
        trigger_id: 'trigger-123',
        view: {
          id: 'V123',
          state: {
            values: {
              'block-1': {
                'input-action': {
                  value: 'user input'
                }
              }
            }
          }
        }
      };

      const result = slackService.handleInteractiveMessage(payload);

      expect(result.type).toBe('view_submission');
      expect(result.values['input-action']).toBe('user input');
    });

    it('should handle view_closed', () => {
      const payload = {
        type: 'view_closed',
        team: { id: 'T123' },
        user: { id: 'U123' },
        view: { id: 'V123' },
        is_cleared: true
      };

      const result = slackService.handleInteractiveMessage(payload);

      expect(result.type).toBe('view_closed');
      expect(result.isCleared).toBe(true);
    });

    it('should handle shortcut', () => {
      const payload = {
        type: 'shortcut',
        team: { id: 'T123' },
        user: { id: 'U123' },
        callback_id: 'my-shortcut',
        trigger_id: 'trigger-123'
      };

      const result = slackService.handleInteractiveMessage(payload);

      expect(result.type).toBe('shortcut');
      expect(result.callbackId).toBe('my-shortcut');
    });

    it('should handle unknown type', () => {
      const payload = {
        type: 'unknown_type',
        team: { id: 'T123' },
        user: { id: 'U123' }
      };

      const result = slackService.handleInteractiveMessage(payload);

      expect(result.type).toBe('unknown_type');
    });
  });

  describe('parseViewValues', () => {
    it('should parse text input values', () => {
      const values = {
        'block-1': {
          'input-1': { value: 'text value' }
        }
      };

      const result = slackService.parseViewValues(values);

      expect(result['input-1']).toBe('text value');
    });

    it('should parse select option values', () => {
      const values = {
        'block-1': {
          'select-1': { selected_option: { value: 'option-1' } }
        }
      };

      const result = slackService.parseViewValues(values);

      expect(result['select-1']).toBe('option-1');
    });

    it('should parse multi-select values', () => {
      const values = {
        'block-1': {
          'multi-select': {
            selected_options: [
              { value: 'opt-1' },
              { value: 'opt-2' }
            ]
          }
        }
      };

      const result = slackService.parseViewValues(values);

      expect(result['multi-select']).toEqual(['opt-1', 'opt-2']);
    });

    it('should parse date picker values', () => {
      const values = {
        'block-1': {
          'date-picker': { selected_date: '2024-01-15' }
        }
      };

      const result = slackService.parseViewValues(values);

      expect(result['date-picker']).toBe('2024-01-15');
    });

    it('should return empty object for null values', () => {
      const result = slackService.parseViewValues(null);

      expect(result).toEqual({});
    });
  });

  describe('acknowledgeAction', () => {
    it('should not call axios if no update', async () => {
      const result = await slackService.acknowledgeAction('https://hooks.slack.com/response');

      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should send update if provided', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      await slackService.acknowledgeAction('https://hooks.slack.com/response', {
        text: 'Acknowledged'
      });

      expect(axios.post).toHaveBeenCalledWith('https://hooks.slack.com/response', {
        text: 'Acknowledged'
      });
    });
  });

  describe('handleEventCallback', () => {
    it('should handle url_verification', () => {
      const payload = {
        type: 'url_verification',
        challenge: 'abc123'
      };

      const result = slackService.handleEventCallback(payload);

      expect(result.type).toBe('url_verification');
      expect(result.challenge).toBe('abc123');
    });

    it('should handle non-event_callback type', () => {
      const payload = {
        type: 'other_type',
        data: 'something'
      };

      const result = slackService.handleEventCallback(payload);

      expect(result.type).toBe('other_type');
      expect(result.raw).toEqual(payload);
    });

    it('should handle message event', () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123',
        api_app_id: 'A123',
        event_id: 'E123',
        event_time: 1704067200,
        event: {
          type: 'message',
          subtype: undefined,
          channel: 'C123',
          channel_type: 'channel',
          user: 'U123',
          text: 'Hello',
          ts: '123.456',
          thread_ts: undefined
        }
      };

      const result = slackService.handleEventCallback(payload);

      expect(result.type).toBe('message');
      expect(result.channelId).toBe('C123');
      expect(result.text).toBe('Hello');
      expect(result.teamId).toBe('T123');
    });

    it('should handle app_mention event', () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123',
        event_id: 'E123',
        event_time: 1704067200,
        event: {
          type: 'app_mention',
          channel: 'C123',
          user: 'U123',
          text: '<@BOT123> help',
          ts: '123.456'
        }
      };

      const result = slackService.handleEventCallback(payload);

      expect(result.type).toBe('app_mention');
      expect(result.text).toBe('<@BOT123> help');
    });

    it('should handle app_home_opened event', () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123',
        event_id: 'E123',
        event_time: 1704067200,
        event: {
          type: 'app_home_opened',
          user: 'U123',
          channel: 'D123',
          tab: 'home'
        }
      };

      const result = slackService.handleEventCallback(payload);

      expect(result.type).toBe('app_home_opened');
      expect(result.tab).toBe('home');
    });

    it('should handle member_joined_channel event', () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123',
        event_id: 'E123',
        event_time: 1704067200,
        event: {
          type: 'member_joined_channel',
          user: 'U123',
          channel: 'C123',
          channel_type: 'C',
          inviter: 'U456'
        }
      };

      const result = slackService.handleEventCallback(payload);

      expect(result.type).toBe('member_joined_channel');
      expect(result.inviter).toBe('U456');
    });

    it('should handle reaction_added event', () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123',
        event_id: 'E123',
        event_time: 1704067200,
        event: {
          type: 'reaction_added',
          user: 'U123',
          reaction: 'thumbsup',
          item_user: 'U456',
          item: { type: 'message', channel: 'C123', ts: '123.456' }
        }
      };

      const result = slackService.handleEventCallback(payload);

      expect(result.type).toBe('reaction_added');
      expect(result.reaction).toBe('thumbsup');
    });

    it('should handle unknown event type', () => {
      const payload = {
        type: 'event_callback',
        team_id: 'T123',
        event_id: 'E123',
        event_time: 1704067200,
        event: {
          type: 'custom_event',
          data: 'custom data'
        }
      };

      const result = slackService.handleEventCallback(payload);

      expect(result.type).toBe('custom_event');
      expect(result.raw).toBeDefined();
    });
  });

  describe('OAuth Flow', () => {
    describe('generateOAuthUrl', () => {
      it('should generate OAuth URL', () => {
        const url = slackService.generateOAuthUrl({
          clientId: 'client-123',
          scopes: ['chat:write', 'commands'],
          redirectUri: 'https://myapp.com/callback'
        });

        expect(url).toContain('https://slack.com/oauth/v2/authorize');
        expect(url).toContain('client_id=client-123');
        expect(url).toContain('scope=chat%3Awrite%2Ccommands');
        expect(url).toContain('redirect_uri=');
      });

      it('should include user scopes if provided', () => {
        const url = slackService.generateOAuthUrl({
          clientId: 'client-123',
          scopes: ['chat:write'],
          userScopes: ['identity.basic'],
          redirectUri: 'https://myapp.com/callback'
        });

        expect(url).toContain('user_scope=identity.basic');
      });

      it('should use custom state if provided', () => {
        const url = slackService.generateOAuthUrl({
          clientId: 'client-123',
          scopes: ['chat:write'],
          redirectUri: 'https://myapp.com/callback',
          state: 'custom-state-abc'
        });

        expect(url).toContain('state=custom-state-abc');
      });
    });

    describe('exchangeOAuthCode', () => {
      it('should exchange code for tokens', async () => {
        mockClient.oauth.v2.access.mockResolvedValue({
          ok: true,
          access_token: 'xoxb-token',
          token_type: 'bot',
          scope: 'chat:write,commands',
          bot_user_id: 'B123',
          app_id: 'A123',
          team: { id: 'T123', name: 'My Team' },
          authed_user: { id: 'U123', scope: 'identity.basic' }
        });

        const result = await slackService.exchangeOAuthCode('auth-code', {
          clientId: 'client-123',
          clientSecret: 'secret-456',
          redirectUri: 'https://myapp.com/callback'
        });

        expect(result.ok).toBe(true);
        expect(result.accessToken).toBe('xoxb-token');
        expect(result.team.id).toBe('T123');
      });
    });

    describe('revokeToken', () => {
      it('should revoke token', async () => {
        mockClient.auth.revoke.mockResolvedValue({ ok: true });

        const result = await slackService.revokeToken('xoxb-token');

        expect(result.ok).toBe(true);
      });
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const result = slackService.verifySignature(
        'signing-secret',
        'v0=mock-signature',
        timestamp,
        'request-body'
      );

      expect(result).toBe(true);
    });

    it('should reject old timestamps', () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();

      const result = slackService.verifySignature(
        'signing-secret',
        'v0=signature',
        oldTimestamp,
        'request-body'
      );

      expect(result).toBe(false);
    });
  });

  describe('Workspace & Channel Info', () => {
    beforeEach(() => {
      slackService.initClient('team-123', 'xoxb-token');
    });

    describe('getTeamInfo', () => {
      it('should get team info', async () => {
        mockClient.team.info.mockResolvedValue({
          ok: true,
          team: { id: 'T123', name: 'My Team', domain: 'myteam' }
        });

        const result = await slackService.getTeamInfo('team-123', 'xoxb-token');

        expect(result.id).toBe('T123');
        expect(result.name).toBe('My Team');
      });
    });

    describe('getBotInfo', () => {
      it('should get bot info', async () => {
        mockClient.auth.test.mockResolvedValue({
          ok: true,
          url: 'https://myteam.slack.com/',
          team: 'My Team',
          team_id: 'T123',
          user: 'mybot',
          user_id: 'U123',
          bot_id: 'B123',
          is_enterprise_install: false
        });

        const result = await slackService.getBotInfo('team-123', 'xoxb-token');

        expect(result.ok).toBe(true);
        expect(result.botId).toBe('B123');
      });
    });

    describe('listChannels', () => {
      it('should list channels', async () => {
        mockClient.conversations.list.mockResolvedValue({
          ok: true,
          channels: [
            { id: 'C123', name: 'general' },
            { id: 'C456', name: 'random' }
          ],
          response_metadata: { next_cursor: 'cursor-abc' }
        });

        const result = await slackService.listChannels('team-123', 'xoxb-token');

        expect(result.channels).toHaveLength(2);
        expect(result.nextCursor).toBe('cursor-abc');
      });

      it('should list channels with options', async () => {
        mockClient.conversations.list.mockResolvedValue({
          ok: true,
          channels: []
        });

        await slackService.listChannels('team-123', 'xoxb-token', {
          types: 'public_channel',
          excludeArchived: true,
          limit: 50,
          cursor: 'cursor-123'
        });

        expect(mockClient.conversations.list).toHaveBeenCalledWith({
          types: 'public_channel',
          exclude_archived: true,
          limit: 50,
          cursor: 'cursor-123'
        });
      });
    });

    describe('getChannelInfo', () => {
      it('should get channel info', async () => {
        mockClient.conversations.info.mockResolvedValue({
          ok: true,
          channel: { id: 'C123', name: 'general', is_private: false }
        });

        const result = await slackService.getChannelInfo('team-123', 'xoxb-token', 'C123');

        expect(result.id).toBe('C123');
        expect(result.name).toBe('general');
      });
    });

    describe('getUserInfo', () => {
      it('should get user info', async () => {
        mockClient.users.info.mockResolvedValue({
          ok: true,
          user: { id: 'U123', name: 'john', real_name: 'John Doe' }
        });

        const result = await slackService.getUserInfo('team-123', 'xoxb-token', 'U123');

        expect(result.id).toBe('U123');
        expect(result.name).toBe('john');
      });
    });

    describe('testConnection', () => {
      it('should test connection successfully', async () => {
        mockClient.auth.test.mockResolvedValue({
          ok: true,
          bot_id: 'B123'
        });
        mockClient.team.info.mockResolvedValue({
          ok: true,
          team: { id: 'T123', name: 'My Team' }
        });

        const result = await slackService.testConnection('team-123', 'xoxb-token');

        expect(result.success).toBe(true);
        expect(result.bot).toBeDefined();
        expect(result.team).toBeDefined();
      });

      it('should handle connection failure', async () => {
        mockClient.auth.test.mockRejectedValue(new Error('Invalid token'));

        const result = await slackService.testConnection('team-123', 'xoxb-token');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid token');
      });
    });
  });

  describe('Block Kit Builders', () => {
    describe('buildTextBlock', () => {
      it('should build markdown text block', () => {
        const block = slackService.buildTextBlock('Hello *world*');

        expect(block.type).toBe('section');
        expect(block.text.type).toBe('mrkdwn');
        expect(block.text.text).toBe('Hello *world*');
      });

      it('should build plain text block', () => {
        const block = slackService.buildTextBlock('Hello world', 'plain_text');

        expect(block.text.type).toBe('plain_text');
      });
    });

    describe('buildButtonBlock', () => {
      it('should build button block', () => {
        const block = slackService.buildButtonBlock([
          { text: 'Click Me', actionId: 'btn-1', value: 'clicked' }
        ]);

        expect(block.type).toBe('actions');
        expect(block.elements).toHaveLength(1);
        expect(block.elements[0].type).toBe('button');
        expect(block.elements[0].action_id).toBe('btn-1');
      });

      it('should build button with style and confirm', () => {
        const block = slackService.buildButtonBlock([
          {
            text: 'Delete',
            actionId: 'delete-btn',
            value: 'delete',
            style: 'danger',
            confirm: {
              title: 'Are you sure?',
              text: 'This action cannot be undone.',
              confirmText: 'Yes',
              denyText: 'No'
            }
          }
        ]);

        expect(block.elements[0].style).toBe('danger');
        expect(block.elements[0].confirm).toBeDefined();
        expect(block.elements[0].confirm.title.text).toBe('Are you sure?');
      });
    });

    describe('buildDivider', () => {
      it('should build divider block', () => {
        const block = slackService.buildDivider();

        expect(block.type).toBe('divider');
      });
    });

    describe('buildHeader', () => {
      it('should build header block', () => {
        const block = slackService.buildHeader('Welcome!');

        expect(block.type).toBe('header');
        expect(block.text.type).toBe('plain_text');
        expect(block.text.text).toBe('Welcome!');
      });
    });

    describe('buildImageBlock', () => {
      it('should build image block', () => {
        const block = slackService.buildImageBlock('https://example.com/image.png', 'An image');

        expect(block.type).toBe('image');
        expect(block.image_url).toBe('https://example.com/image.png');
        expect(block.alt_text).toBe('An image');
      });

      it('should build image block with title', () => {
        const block = slackService.buildImageBlock('https://example.com/image.png', 'An image', 'My Image');

        expect(block.title.text).toBe('My Image');
      });
    });

    describe('buildContextBlock', () => {
      it('should build context block with text', () => {
        const block = slackService.buildContextBlock([
          { text: 'Some context' }
        ]);

        expect(block.type).toBe('context');
        expect(block.elements[0].type).toBe('mrkdwn');
        expect(block.elements[0].text).toBe('Some context');
      });

      it('should build context block with image', () => {
        const block = slackService.buildContextBlock([
          { type: 'image', url: 'https://example.com/avatar.png', alt: 'Avatar' }
        ]);

        expect(block.elements[0].type).toBe('image');
        expect(block.elements[0].image_url).toBe('https://example.com/avatar.png');
      });
    });

    describe('buildInputBlock', () => {
      it('should build text input block', () => {
        const block = slackService.buildInputBlock({
          blockId: 'input-block',
          label: 'Your Name',
          actionId: 'name-input',
          inputType: 'text',
          placeholder: 'Enter name'
        });

        expect(block.type).toBe('input');
        expect(block.element.type).toBe('plain_text_input');
        expect(block.element.action_id).toBe('name-input');
      });

      it('should build select input block', () => {
        const block = slackService.buildInputBlock({
          blockId: 'select-block',
          label: 'Choose Option',
          actionId: 'option-select',
          inputType: 'select',
          options: [
            { text: 'Option 1', value: 'opt1' },
            { text: 'Option 2', value: 'opt2' }
          ]
        });

        expect(block.element.type).toBe('static_select');
        expect(block.element.options).toHaveLength(2);
      });

      it('should build multi-select input block', () => {
        const block = slackService.buildInputBlock({
          blockId: 'multi-block',
          label: 'Choose Multiple',
          actionId: 'multi-select',
          inputType: 'multi_select',
          options: [
            { text: 'Option 1', value: 'opt1' },
            { text: 'Option 2', value: 'opt2' }
          ]
        });

        expect(block.element.type).toBe('multi_static_select');
      });

      it('should build datepicker input block', () => {
        const block = slackService.buildInputBlock({
          blockId: 'date-block',
          label: 'Select Date',
          actionId: 'date-pick',
          inputType: 'datepicker',
          initialDate: '2024-01-15'
        });

        expect(block.element.type).toBe('datepicker');
        expect(block.element.initial_date).toBe('2024-01-15');
      });

      it('should build users_select input block', () => {
        const block = slackService.buildInputBlock({
          blockId: 'user-block',
          label: 'Select User',
          actionId: 'user-select',
          inputType: 'users_select'
        });

        expect(block.element.type).toBe('users_select');
      });

      it('should build channels_select input block', () => {
        const block = slackService.buildInputBlock({
          blockId: 'channel-block',
          label: 'Select Channel',
          actionId: 'channel-select',
          inputType: 'channels_select'
        });

        expect(block.element.type).toBe('channels_select');
      });
    });
  });
});
