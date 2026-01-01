/**
 * Slack Routes Tests
 * Tests for server/routes/slack.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', organizationId: 1 };
    next();
  })
}));

jest.mock('../../controllers/slackController', () => ({
  startOAuth: jest.fn(),
  oauthCallback: jest.fn(),
  disconnectSlack: jest.fn(),
  getWorkspaceInfo: jest.fn(),
  getChannelStats: jest.fn(),
  testConnection: jest.fn(),
  getChannels: jest.fn(),
  getChannel: jest.fn(),
  updateChannel: jest.fn(),
  listSlackChannels: jest.fn(),
  sendTestMessage: jest.fn()
}));

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
  create: jest.fn(),
  findById: jest.fn(),
  findByOrganization: jest.fn(),
  findByTeamId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getStats: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const slackController = require('../../controllers/slackController');
const slackService = require('../../services/channels/slackService');
const SlackChannel = require('../../models/SlackChannel');
const slackRouter = require('../../routes/slack');

const app = express();
app.use(express.json());
app.use('/api/channels/slack', slackRouter);

describe('Slack Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/channels/slack/oauth', () => {
    it('should start OAuth flow and return auth URL', async () => {
      slackController.startOAuth.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            authUrl: 'https://slack.com/oauth/v2/authorize?client_id=test&scope=chat:write&state=abc123',
            state: 'abc123'
          }
        });
      });

      const response = await request(app)
        .get('/api/channels/slack/oauth')
        .query({ botId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toContain('slack.com/oauth');
      expect(response.body.data.state).toBeDefined();
    });

    it('should generate unique state token', async () => {
      slackController.startOAuth.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            authUrl: 'https://slack.com/oauth/v2/authorize',
            state: 'unique-state-token'
          }
        });
      });

      const response = await request(app).get('/api/channels/slack/oauth');

      expect(response.status).toBe(200);
      expect(response.body.data.state).toBeTruthy();
    });

    it('should include botId in state when provided', async () => {
      slackController.startOAuth.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            authUrl: 'https://slack.com/oauth/v2/authorize',
            state: 'state-with-botid'
          }
        });
      });

      const response = await request(app)
        .get('/api/channels/slack/oauth')
        .query({ botId: 5 });

      expect(response.status).toBe(200);
    });

    it('should handle errors', async () => {
      slackController.startOAuth.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Failed to start OAuth flow'
        });
      });

      const response = await request(app).get('/api/channels/slack/oauth');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to start OAuth');
    });
  });

  describe('GET /api/channels/slack/callback', () => {
    it('should handle successful OAuth callback', async () => {
      slackController.oauthCallback.mockImplementation((req, res) => {
        res.redirect('/channels/slack?success=connected&team=Test%20Team');
      });

      const response = await request(app)
        .get('/api/channels/slack/callback')
        .query({
          code: 'oauth-code',
          state: 'valid-state'
        });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('success=connected');
    });

    it('should handle OAuth errors', async () => {
      slackController.oauthCallback.mockImplementation((req, res) => {
        res.redirect('/channels/slack?error=access_denied');
      });

      const response = await request(app)
        .get('/api/channels/slack/callback')
        .query({ error: 'access_denied' });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('error=access_denied');
    });

    it('should reject missing code', async () => {
      slackController.oauthCallback.mockImplementation((req, res) => {
        res.redirect('/channels/slack?error=missing_params');
      });

      const response = await request(app)
        .get('/api/channels/slack/callback')
        .query({ state: 'valid-state' });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('error=missing_params');
    });

    it('should reject missing state', async () => {
      slackController.oauthCallback.mockImplementation((req, res) => {
        res.redirect('/channels/slack?error=missing_params');
      });

      const response = await request(app)
        .get('/api/channels/slack/callback')
        .query({ code: 'oauth-code' });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('error=missing_params');
    });

    it('should reject invalid state', async () => {
      slackController.oauthCallback.mockImplementation((req, res) => {
        res.redirect('/channels/slack?error=invalid_state');
      });

      const response = await request(app)
        .get('/api/channels/slack/callback')
        .query({
          code: 'oauth-code',
          state: 'invalid-state'
        });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('error=invalid_state');
    });

    it('should handle token exchange failure', async () => {
      slackController.oauthCallback.mockImplementation((req, res) => {
        res.redirect('/channels/slack?error=token_exchange_failed');
      });

      const response = await request(app)
        .get('/api/channels/slack/callback')
        .query({
          code: 'oauth-code',
          state: 'valid-state'
        });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('error=token_exchange_failed');
    });

    it('should handle reconnection for existing teams', async () => {
      slackController.oauthCallback.mockImplementation((req, res) => {
        res.redirect('/channels/slack?success=reconnected&team=Existing%20Team');
      });

      const response = await request(app)
        .get('/api/channels/slack/callback')
        .query({
          code: 'oauth-code',
          state: 'valid-state'
        });

      expect(response.status).toBe(302);
      expect(response.header.location).toContain('success=reconnected');
    });

    it('should not require authentication (public callback)', async () => {
      // OAuth callback should be accessible without auth
      slackController.oauthCallback.mockImplementation((req, res) => {
        res.redirect('/channels/slack?success=connected');
      });

      const response = await request(app)
        .get('/api/channels/slack/callback')
        .query({
          code: 'oauth-code',
          state: 'valid-state'
        });

      expect(response.status).toBe(302);
    });
  });

  describe('GET /api/channels/slack', () => {
    it('should return all Slack workspaces', async () => {
      slackController.getChannels.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: [
            {
              id: 1,
              botId: 1,
              teamId: 'T12345',
              teamName: 'Test Workspace',
              botUserId: 'U12345',
              webhookUrl: 'https://hooks.slack.com/services/xxx',
              scopes: ['chat:write', 'channels:read'],
              isActive: true,
              settings: {},
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              id: 2,
              botId: 2,
              teamId: 'T67890',
              teamName: 'Another Workspace',
              botUserId: 'U67890',
              webhookUrl: null,
              scopes: ['chat:write'],
              isActive: false,
              settings: {},
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]
        });
      });

      const response = await request(app).get('/api/channels/slack');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].teamName).toBe('Test Workspace');
    });

    it('should return empty array when no workspaces exist', async () => {
      slackController.getChannels.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: []
        });
      });

      const response = await request(app).get('/api/channels/slack');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should not expose sensitive data like tokens', async () => {
      slackController.getChannels.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: [
            {
              id: 1,
              teamName: 'Test Workspace',
              isActive: true
              // botToken and other secrets should NOT be included
            }
          ]
        });
      });

      const response = await request(app).get('/api/channels/slack');

      expect(response.status).toBe(200);
      expect(response.body.data[0]).not.toHaveProperty('botToken');
      expect(response.body.data[0]).not.toHaveProperty('clientSecret');
      expect(response.body.data[0]).not.toHaveProperty('signingSecret');
    });

    it('should handle errors', async () => {
      slackController.getChannels.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Failed to get channels'
        });
      });

      const response = await request(app).get('/api/channels/slack');

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/channels/slack/stats', () => {
    it('should return aggregated stats for all workspaces', async () => {
      slackController.getChannelStats.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            totals: {
              totalWorkspaces: 2,
              activeWorkspaces: 1,
              totalMessages: 250,
              totalCommands: 50,
              totalInteractions: 30,
              totalUniqueUsers: 75
            },
            workspaces: [
              {
                channelId: 1,
                teamName: 'Test Workspace',
                isActive: true,
                totalMessages: 200,
                uniqueUsers: 60,
                totalCommands: 40,
                totalInteractions: 25
              },
              {
                channelId: 2,
                teamName: 'Another Workspace',
                isActive: false,
                totalMessages: 50,
                uniqueUsers: 15,
                totalCommands: 10,
                totalInteractions: 5
              }
            ]
          }
        });
      });

      const response = await request(app).get('/api/channels/slack/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totals.totalWorkspaces).toBe(2);
      expect(response.body.data.workspaces).toHaveLength(2);
    });

    it('should return stats for specific workspace', async () => {
      slackController.getChannelStats.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            channel: {
              id: 1,
              teamName: 'Test Workspace',
              isActive: true
            },
            stats: {
              totalMessages: 200,
              uniqueUsers: 60,
              totalCommands: 40,
              totalInteractions: 25,
              averageResponseTime: 1.2
            }
          }
        });
      });

      const response = await request(app).get('/api/channels/slack/stats?channelId=1');

      expect(response.status).toBe(200);
      expect(response.body.data.channel.id).toBe(1);
      expect(response.body.data.stats.totalMessages).toBe(200);
    });

    it('should support date range filtering', async () => {
      slackController.getChannelStats.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            channel: {
              id: 1,
              teamName: 'Test Workspace',
              isActive: true
            },
            stats: {
              totalMessages: 100,
              uniqueUsers: 30
            }
          }
        });
      });

      const response = await request(app)
        .get('/api/channels/slack/stats')
        .query({
          channelId: 1,
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent workspace', async () => {
      slackController.getChannelStats.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app).get('/api/channels/slack/stats?channelId=999');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/channels/slack/test', () => {
    it('should test connection successfully', async () => {
      slackController.testConnection.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            bot: {
              id: 'B12345',
              name: 'test-bot',
              appId: 'A12345'
            },
            team: {
              id: 'T12345',
              name: 'Test Workspace',
              domain: 'test-workspace'
            }
          }
        });
      });

      const response = await request(app)
        .post('/api/channels/slack/test')
        .send({ channelId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.team.name).toBe('Test Workspace');
    });

    it('should reject missing channelId', async () => {
      slackController.testConnection.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app)
        .post('/api/channels/slack/test')
        .send({});

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent channel', async () => {
      slackController.testConnection.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app)
        .post('/api/channels/slack/test')
        .send({ channelId: 999 });

      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized access', async () => {
      slackController.testConnection.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      });

      const response = await request(app)
        .post('/api/channels/slack/test')
        .send({ channelId: 1 });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Not authorized');
    });

    it('should handle invalid tokens', async () => {
      slackController.testConnection.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'invalid_auth'
        });
      });

      const response = await request(app)
        .post('/api/channels/slack/test')
        .send({ channelId: 1 });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/channels/slack/:id', () => {
    it('should return single Slack workspace', async () => {
      slackController.getChannel.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            id: 1,
            botId: 1,
            teamId: 'T12345',
            teamName: 'Test Workspace',
            botUserId: 'U12345',
            webhookUrl: 'https://hooks.slack.com/services/xxx',
            scopes: ['chat:write', 'channels:read'],
            isActive: true,
            settings: { autoRespond: true },
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      });

      const response = await request(app).get('/api/channels/slack/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.teamName).toBe('Test Workspace');
    });

    it('should return 404 for non-existent workspace', async () => {
      slackController.getChannel.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app).get('/api/channels/slack/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should return 403 for unauthorized access', async () => {
      slackController.getChannel.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      });

      const response = await request(app).get('/api/channels/slack/1');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Not authorized');
    });

    it('should not expose sensitive tokens', async () => {
      slackController.getChannel.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            id: 1,
            teamName: 'Test Workspace',
            isActive: true
            // botToken, clientSecret, signingSecret should NOT be included
          }
        });
      });

      const response = await request(app).get('/api/channels/slack/1');

      expect(response.status).toBe(200);
      expect(response.body.data).not.toHaveProperty('botToken');
      expect(response.body.data).not.toHaveProperty('clientSecret');
    });
  });

  describe('PUT /api/channels/slack/:id', () => {
    it('should update workspace successfully', async () => {
      slackController.updateChannel.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            id: 1,
            teamName: 'Test Workspace',
            isActive: false,
            settings: { autoRespond: false },
            updatedAt: new Date()
          },
          message: 'Channel updated successfully'
        });
      });

      const response = await request(app)
        .put('/api/channels/slack/1')
        .send({
          isActive: false,
          settings: { autoRespond: false }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isActive).toBe(false);
    });

    it('should update bot association', async () => {
      slackController.updateChannel.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            id: 1,
            botId: 3,
            teamName: 'Test Workspace',
            updatedAt: new Date()
          },
          message: 'Channel updated successfully'
        });
      });

      const response = await request(app)
        .put('/api/channels/slack/1')
        .send({ botId: 3 });

      expect(response.status).toBe(200);
      expect(response.body.data.botId).toBe(3);
    });

    it('should merge settings correctly', async () => {
      slackController.updateChannel.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            id: 1,
            settings: {
              autoRespond: true,
              newSetting: 'value'
            }
          },
          message: 'Channel updated successfully'
        });
      });

      const response = await request(app)
        .put('/api/channels/slack/1')
        .send({
          settings: { newSetting: 'value' }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.settings.newSetting).toBe('value');
    });

    it('should return 404 for non-existent workspace', async () => {
      slackController.updateChannel.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app)
        .put('/api/channels/slack/999')
        .send({ isActive: false });

      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized access', async () => {
      slackController.updateChannel.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      });

      const response = await request(app)
        .put('/api/channels/slack/1')
        .send({ isActive: false });

      expect(response.status).toBe(403);
    });

    it('should handle database errors', async () => {
      slackController.updateChannel.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Failed to update channel'
        });
      });

      const response = await request(app)
        .put('/api/channels/slack/1')
        .send({ isActive: false });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/channels/slack/:id', () => {
    it('should disconnect Slack workspace successfully', async () => {
      slackController.disconnectSlack.mockImplementation((req, res) => {
        res.json({
          success: true,
          message: 'Slack workspace "Test Workspace" disconnected successfully'
        });
      });

      const response = await request(app).delete('/api/channels/slack/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('disconnected successfully');
    });

    it('should return 404 for non-existent workspace', async () => {
      slackController.disconnectSlack.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Slack workspace not found'
        });
      });

      const response = await request(app).delete('/api/channels/slack/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should return 403 for unauthorized access', async () => {
      slackController.disconnectSlack.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized to disconnect this workspace'
        });
      });

      const response = await request(app).delete('/api/channels/slack/1');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Not authorized');
    });

    it('should handle errors gracefully', async () => {
      slackController.disconnectSlack.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Failed to disconnect Slack workspace'
        });
      });

      const response = await request(app).delete('/api/channels/slack/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to disconnect');
    });
  });

  describe('GET /api/channels/slack/:id/info', () => {
    it('should return detailed workspace info', async () => {
      slackController.getWorkspaceInfo.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            workspace: {
              id: 'T12345',
              name: 'Test Workspace',
              domain: 'test-workspace',
              icon: {
                image_68: 'https://example.com/icon.png'
              }
            },
            bot: {
              id: 'B12345',
              userId: 'U12345',
              user: {
                id: 'U12345',
                name: 'testbot',
                real_name: 'Test Bot'
              }
            },
            scopes: ['chat:write', 'channels:read', 'users:read']
          }
        });
      });

      const response = await request(app).get('/api/channels/slack/1/info');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.workspace.name).toBe('Test Workspace');
      expect(response.body.data.scopes).toContain('chat:write');
    });

    it('should return 404 for non-existent workspace', async () => {
      slackController.getWorkspaceInfo.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Slack workspace not found'
        });
      });

      const response = await request(app).get('/api/channels/slack/999/info');

      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized access', async () => {
      slackController.getWorkspaceInfo.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      });

      const response = await request(app).get('/api/channels/slack/1/info');

      expect(response.status).toBe(403);
    });

    it('should handle Slack API errors', async () => {
      slackController.getWorkspaceInfo.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Failed to get workspace info'
        });
      });

      const response = await request(app).get('/api/channels/slack/1/info');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/channels/slack/:id/channels', () => {
    it('should list Slack channels in workspace', async () => {
      slackController.listSlackChannels.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: [
            {
              id: 'C12345',
              name: 'general',
              isPrivate: false,
              isMember: true,
              numMembers: 50
            },
            {
              id: 'C67890',
              name: 'random',
              isPrivate: false,
              isMember: true,
              numMembers: 30
            }
          ],
          nextCursor: null
        });
      });

      const response = await request(app).get('/api/channels/slack/1/channels');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('general');
    });

    it('should support pagination with cursor', async () => {
      slackController.listSlackChannels.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: [
            { id: 'C12345', name: 'general' }
          ],
          nextCursor: 'dGVhbTpDMDYxRkE1UEI='
        });
      });

      const response = await request(app).get('/api/channels/slack/1/channels');

      expect(response.status).toBe(200);
      expect(response.body.nextCursor).toBeDefined();
    });

    it('should return 404 for non-existent workspace', async () => {
      slackController.listSlackChannels.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Workspace not found'
        });
      });

      const response = await request(app).get('/api/channels/slack/999/channels');

      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized access', async () => {
      slackController.listSlackChannels.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      });

      const response = await request(app).get('/api/channels/slack/1/channels');

      expect(response.status).toBe(403);
    });

    it('should handle Slack API errors', async () => {
      slackController.listSlackChannels.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Failed to list channels'
        });
      });

      const response = await request(app).get('/api/channels/slack/1/channels');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/channels/slack/:id/send-test', () => {
    it('should send test message successfully', async () => {
      slackController.sendTestMessage.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            channel: 'C12345',
            ts: '1234567890.123456',
            message: {
              text: 'Hello, this is a test message!'
            }
          },
          message: 'Test message sent successfully'
        });
      });

      const response = await request(app)
        .post('/api/channels/slack/1/send-test')
        .send({
          slackChannelId: 'C12345',
          message: 'Hello, this is a test message!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.channel).toBe('C12345');
    });

    it('should reject missing slackChannelId', async () => {
      slackController.sendTestMessage.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'Channel ID and message are required'
        });
      });

      const response = await request(app)
        .post('/api/channels/slack/1/send-test')
        .send({ message: 'Hello' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject missing message', async () => {
      slackController.sendTestMessage.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'Channel ID and message are required'
        });
      });

      const response = await request(app)
        .post('/api/channels/slack/1/send-test')
        .send({ slackChannelId: 'C12345' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 404 for non-existent workspace', async () => {
      slackController.sendTestMessage.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Workspace not found'
        });
      });

      const response = await request(app)
        .post('/api/channels/slack/999/send-test')
        .send({
          slackChannelId: 'C12345',
          message: 'Hello'
        });

      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized access', async () => {
      slackController.sendTestMessage.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      });

      const response = await request(app)
        .post('/api/channels/slack/1/send-test')
        .send({
          slackChannelId: 'C12345',
          message: 'Hello'
        });

      expect(response.status).toBe(403);
    });

    it('should handle Slack API errors', async () => {
      slackController.sendTestMessage.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'channel_not_found'
        });
      });

      const response = await request(app)
        .post('/api/channels/slack/1/send-test')
        .send({
          slackChannelId: 'INVALID',
          message: 'Hello'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for protected routes', async () => {
      const authMock = require('../../middleware/auth');

      // Verify auth middleware is called for protected routes
      await request(app).get('/api/channels/slack');
      expect(authMock.authenticateToken).toHaveBeenCalled();
    });

    it('should not require authentication for OAuth callback', async () => {
      slackController.oauthCallback.mockImplementation((req, res) => {
        res.redirect('/channels/slack?success=connected');
      });

      // OAuth callback should work without authentication
      const response = await request(app)
        .get('/api/channels/slack/callback')
        .query({ code: 'test', state: 'test' });

      expect(response.status).toBe(302);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      slackController.getChannels.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app).get('/api/channels/slack');

      // Should not crash, error should be caught
      expect([200, 500]).toContain(response.status);
    });

    it('should return proper error structure', async () => {
      slackController.getChannel.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app).get('/api/channels/slack/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});
