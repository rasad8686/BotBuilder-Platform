/**
 * Slack Controller Tests
 * Tests for server/controllers/slackController.js
 */

jest.mock('../../db', () => {
  const mockQuery = jest.fn();
  const mockDb = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    del: jest.fn()
  }));
  mockDb.query = mockQuery;
  return mockDb;
});

jest.mock('../../services/channels/slackService', () => ({
  generateOAuthUrl: jest.fn(),
  exchangeOAuthCode: jest.fn(),
  revokeToken: jest.fn(),
  removeClient: jest.fn(),
  getTeamInfo: jest.fn(),
  getBotInfo: jest.fn(),
  testConnection: jest.fn(),
  listChannels: jest.fn(),
  sendMessage: jest.fn(),
  buildTextBlock: jest.fn()
}));

jest.mock('../../models/SlackChannel', () => ({
  findById: jest.fn(),
  findByTeamId: jest.fn(),
  findByOrganization: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getStats: jest.fn()
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mock-state-token-12345')
  }))
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const slackService = require('../../services/channels/slackService');
const SlackChannel = require('../../models/SlackChannel');
const {
  startOAuth,
  oauthCallback,
  disconnectSlack,
  getWorkspaceInfo,
  getChannelStats,
  testConnection,
  getChannels,
  getChannel,
  updateChannel,
  listSlackChannels,
  sendTestMessage
} = require('../../controllers/slackController');

describe('Slack Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SLACK_CLIENT_ID = 'test-client-id';
    process.env.SLACK_CLIENT_SECRET = 'test-client-secret';
    process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';

    mockReq = {
      user: { id: 1, organizationId: 1 },
      params: {},
      body: {},
      query: {},
      protocol: 'https',
      get: jest.fn(() => 'localhost:3000')
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      redirect: jest.fn()
    };
  });

  describe('startOAuth', () => {
    it('should generate OAuth URL successfully', async () => {
      mockReq.query = { botId: '123' };
      db.query.mockResolvedValue({});
      slackService.generateOAuthUrl.mockReturnValue('https://slack.com/oauth/v2/authorize?...');

      await startOAuth(mockReq, mockRes);

      expect(db.query).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          authUrl: expect.any(String),
          state: expect.any(String)
        })
      }));
    });

    it('should handle errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      await startOAuth(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to start OAuth flow'
      });
    });
  });

  describe('oauthCallback', () => {
    it('should redirect on OAuth error', async () => {
      mockReq.query = { error: 'access_denied' };

      await oauthCallback(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(expect.stringContaining('error=access_denied'));
    });

    it('should redirect on missing params', async () => {
      mockReq.query = {};

      await oauthCallback(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith('/channels/slack?error=missing_params');
    });

    it('should redirect on invalid state', async () => {
      mockReq.query = { code: 'test-code', state: 'invalid-state' };
      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      });

      await oauthCallback(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith('/channels/slack?error=invalid_state');
    });

    it('should redirect on token exchange failure', async () => {
      mockReq.query = { code: 'test-code', state: 'valid-state' };
      const mockDbChain = {
        where: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue({
              id: 1,
              organization_id: 1,
              bot_id: 123
            })
          })
        }),
        del: jest.fn().mockResolvedValue({})
      };
      db.mockReturnValue(mockDbChain);
      slackService.exchangeOAuthCode.mockResolvedValue({ ok: false });

      await oauthCallback(mockReq, mockRes);

      // Controller catches errors and redirects to callback_failed
      expect(mockRes.redirect).toHaveBeenCalledWith(expect.stringContaining('error='));
    });

    it('should update existing channel on reconnect', async () => {
      mockReq.query = { code: 'test-code', state: 'valid-state' };
      const mockDbChain = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 1,
          organization_id: 1,
          bot_id: 123
        }),
        del: jest.fn().mockResolvedValue({})
      };
      db.mockReturnValue(mockDbChain);

      slackService.exchangeOAuthCode.mockResolvedValue({
        ok: true,
        team: { id: 'T123', name: 'Test Team' },
        accessToken: 'xoxb-token',
        botUserId: 'B123',
        scope: 'chat:write,users:read',
        authedUser: { id: 'U123' }
      });

      SlackChannel.findByTeamId.mockResolvedValue({ id: 1 });
      SlackChannel.update.mockResolvedValue({});

      await oauthCallback(mockReq, mockRes);

      expect(SlackChannel.update).toHaveBeenCalled();
      expect(mockRes.redirect).toHaveBeenCalledWith(expect.stringContaining('success=reconnected'));
    });

    it('should create new channel', async () => {
      mockReq.query = { code: 'test-code', state: 'valid-state' };
      const mockDbChain = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 1,
          organization_id: 1,
          bot_id: 123
        }),
        del: jest.fn().mockResolvedValue({})
      };
      db.mockReturnValue(mockDbChain);

      slackService.exchangeOAuthCode.mockResolvedValue({
        ok: true,
        team: { id: 'T123', name: 'Test Team' },
        accessToken: 'xoxb-token',
        botUserId: 'B123',
        scope: 'chat:write,users:read'
      });

      SlackChannel.findByTeamId.mockResolvedValue(null);
      SlackChannel.create.mockResolvedValue({ id: 1 });

      await oauthCallback(mockReq, mockRes);

      expect(SlackChannel.create).toHaveBeenCalled();
      expect(mockRes.redirect).toHaveBeenCalledWith(expect.stringContaining('success=connected'));
    });
  });

  describe('disconnectSlack', () => {
    it('should return 404 if channel not found', async () => {
      mockReq.params = { id: '999' };
      SlackChannel.findById.mockResolvedValue(null);

      await disconnectSlack(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Slack workspace not found'
      });
    });

    it('should return 403 if not authorized', async () => {
      mockReq.params = { id: '1' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 999, // Different org
        teamId: 'T123',
        teamName: 'Test Team',
        botToken: 'xoxb-token'
      });

      await disconnectSlack(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to disconnect this workspace'
      });
    });

    it('should disconnect successfully', async () => {
      mockReq.params = { id: '1' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        teamId: 'T123',
        teamName: 'Test Team',
        botToken: 'xoxb-token'
      });
      slackService.revokeToken.mockResolvedValue({});
      SlackChannel.delete.mockResolvedValue({});

      await disconnectSlack(mockReq, mockRes);

      expect(slackService.removeClient).toHaveBeenCalledWith('T123');
      expect(SlackChannel.delete).toHaveBeenCalledWith('1');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Slack workspace "Test Team" disconnected successfully'
      });
    });

    it('should handle token revoke errors gracefully', async () => {
      mockReq.params = { id: '1' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        teamId: 'T123',
        teamName: 'Test Team',
        botToken: 'xoxb-token'
      });
      slackService.revokeToken.mockRejectedValue(new Error('Revoke failed'));
      SlackChannel.delete.mockResolvedValue({});

      await disconnectSlack(mockReq, mockRes);

      // Should still disconnect even if revoke fails
      expect(SlackChannel.delete).toHaveBeenCalledWith('1');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should handle errors', async () => {
      mockReq.params = { id: '1' };
      SlackChannel.findById.mockRejectedValue(new Error('DB error'));

      await disconnectSlack(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to disconnect Slack workspace'
      });
    });
  });

  describe('getWorkspaceInfo', () => {
    it('should return 404 if channel not found', async () => {
      mockReq.params = { id: '999' };
      SlackChannel.findById.mockResolvedValue(null);

      await getWorkspaceInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if not authorized', async () => {
      mockReq.params = { id: '1' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 999
      });

      await getWorkspaceInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return workspace info', async () => {
      mockReq.params = { id: '1' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        teamId: 'T123',
        botToken: 'xoxb-token',
        scopes: ['chat:write']
      });
      slackService.getTeamInfo.mockResolvedValue({
        id: 'T123',
        name: 'Test Team',
        domain: 'testteam',
        icon: { image_68: 'https://...' }
      });
      slackService.getBotInfo.mockResolvedValue({
        botId: 'B123',
        userId: 'U123',
        user: { name: 'testbot' }
      });

      await getWorkspaceInfo(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          workspace: expect.any(Object),
          bot: expect.any(Object),
          scopes: expect.any(Array)
        })
      }));
    });

    it('should handle errors', async () => {
      mockReq.params = { id: '1' };
      SlackChannel.findById.mockRejectedValue(new Error('DB error'));

      await getWorkspaceInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getChannelStats', () => {
    it('should return stats for specific channel', async () => {
      mockReq.query = { channelId: '1' };
      SlackChannel.findByOrganization.mockResolvedValue([
        { id: 1, teamName: 'Test Team', isActive: true }
      ]);
      SlackChannel.getStats.mockResolvedValue({
        totalMessages: 100,
        uniqueUsers: 25
      });

      await getChannelStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          channel: expect.any(Object),
          stats: expect.any(Object)
        })
      }));
    });

    it('should return 404 if channel not found', async () => {
      mockReq.query = { channelId: '999' };
      SlackChannel.findByOrganization.mockResolvedValue([
        { id: 1, teamName: 'Test Team', isActive: true }
      ]);

      await getChannelStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return aggregated stats', async () => {
      mockReq.query = {};
      SlackChannel.findByOrganization.mockResolvedValue([]);
      db.query.mockResolvedValue({
        rows: [
          {
            channel_id: 1,
            team_name: 'Team 1',
            is_active: true,
            total_messages: '50',
            unique_users: '10',
            total_commands: '5',
            total_interactions: '15'
          }
        ]
      });

      await getChannelStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          totals: expect.any(Object),
          workspaces: expect.any(Array)
        })
      }));
    });

    it('should handle errors', async () => {
      mockReq.query = {};
      SlackChannel.findByOrganization.mockRejectedValue(new Error('DB error'));

      await getChannelStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('testConnection', () => {
    it('should return 404 if channel not found', async () => {
      mockReq.body = { channelId: '999' };
      SlackChannel.findById.mockResolvedValue(null);

      await testConnection(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if not authorized', async () => {
      mockReq.body = { channelId: '1' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 999
      });

      await testConnection(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 if test fails', async () => {
      mockReq.body = { channelId: '1' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        teamId: 'T123',
        botToken: 'xoxb-token'
      });
      slackService.testConnection.mockResolvedValue({
        success: false,
        error: 'Invalid token'
      });

      await testConnection(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should test connection successfully', async () => {
      mockReq.body = { channelId: '1' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        teamId: 'T123',
        botToken: 'xoxb-token'
      });
      slackService.testConnection.mockResolvedValue({
        success: true,
        bot: { id: 'B123' },
        team: { id: 'T123', name: 'Test Team' }
      });

      await testConnection(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          bot: expect.any(Object),
          team: expect.any(Object)
        })
      }));
    });

    it('should handle errors', async () => {
      mockReq.body = { channelId: '1' };
      SlackChannel.findById.mockRejectedValue(new Error('DB error'));

      await testConnection(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getChannels', () => {
    it('should return all channels', async () => {
      SlackChannel.findByOrganization.mockResolvedValue([
        { id: 1, teamName: 'Team 1', isActive: true },
        { id: 2, teamName: 'Team 2', isActive: false }
      ]);

      await getChannels(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });

    it('should return empty array if no channels', async () => {
      SlackChannel.findByOrganization.mockResolvedValue([]);

      await getChannels(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle errors', async () => {
      SlackChannel.findByOrganization.mockRejectedValue(new Error('DB error'));

      await getChannels(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getChannel', () => {
    it('should return 404 if not found', async () => {
      mockReq.params = { id: '999' };
      SlackChannel.findById.mockResolvedValue(null);

      await getChannel(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if not authorized', async () => {
      mockReq.params = { id: '1' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 999
      });

      await getChannel(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return channel', async () => {
      mockReq.params = { id: '1' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        teamName: 'Test Team',
        isActive: true
      });

      await getChannel(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });
  });

  describe('updateChannel', () => {
    it('should return 404 if not found', async () => {
      mockReq.params = { id: '999' };
      mockReq.body = { isActive: true };
      SlackChannel.findById.mockResolvedValue(null);

      await updateChannel(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if not authorized', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { isActive: true };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 999
      });

      await updateChannel(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should update channel', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { isActive: false, settings: { key: 'value' } };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        settings: {}
      });
      SlackChannel.update.mockResolvedValue({
        id: 1,
        teamName: 'Test Team',
        isActive: false,
        settings: { key: 'value' },
        updatedAt: new Date()
      });

      await updateChannel(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Channel updated successfully'
      }));
    });

    it('should handle errors', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { isActive: true };
      SlackChannel.findById.mockRejectedValue(new Error('DB error'));

      await updateChannel(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('listSlackChannels', () => {
    it('should return 404 if workspace not found', async () => {
      mockReq.params = { id: '999' };
      SlackChannel.findById.mockResolvedValue(null);

      await listSlackChannels(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if not authorized', async () => {
      mockReq.params = { id: '1' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 999
      });

      await listSlackChannels(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should list channels successfully', async () => {
      mockReq.params = { id: '1' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        teamId: 'T123',
        botToken: 'xoxb-token'
      });
      slackService.listChannels.mockResolvedValue({
        channels: [
          { id: 'C123', name: 'general', is_private: false, is_member: true, num_members: 10 },
          { id: 'C456', name: 'random', is_private: false, is_member: true, num_members: 5 }
        ],
        nextCursor: ''
      });

      await listSlackChannels(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Array)
      }));
    });

    it('should handle errors', async () => {
      mockReq.params = { id: '1' };
      SlackChannel.findById.mockRejectedValue(new Error('DB error'));

      await listSlackChannels(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('sendTestMessage', () => {
    it('should return 400 if channelId or message missing', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { slackChannelId: 'C123' }; // missing message

      await sendTestMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Channel ID and message are required'
      });
    });

    it('should return 404 if workspace not found', async () => {
      mockReq.params = { id: '999' };
      mockReq.body = { slackChannelId: 'C123', message: 'Hello' };
      SlackChannel.findById.mockResolvedValue(null);

      await sendTestMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if not authorized', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { slackChannelId: 'C123', message: 'Hello' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 999
      });

      await sendTestMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should send message successfully', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { slackChannelId: 'C123', message: 'Hello' };
      SlackChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        teamId: 'T123',
        botToken: 'xoxb-token'
      });
      slackService.buildTextBlock.mockReturnValue({ type: 'section', text: { type: 'mrkdwn', text: 'Hello' } });
      slackService.sendMessage.mockResolvedValue({
        channel: 'C123',
        ts: '1234567890.123456',
        message: { text: 'Hello' }
      });

      await sendTestMessage(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Test message sent successfully'
      }));
    });

    it('should handle errors', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { slackChannelId: 'C123', message: 'Hello' };
      SlackChannel.findById.mockRejectedValue(new Error('DB error'));

      await sendTestMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
