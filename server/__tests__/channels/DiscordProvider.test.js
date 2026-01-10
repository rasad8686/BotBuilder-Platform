/**
 * DiscordProvider Tests
 * Tests for server/channels/providers/DiscordProvider.js
 */

// Mock discordService BEFORE any requires
jest.mock('../../services/channels/discordService', () => ({
  initBot: jest.fn().mockReturnValue({}),
  getBot: jest.fn().mockReturnValue({}),
  connectBot: jest.fn().mockResolvedValue({
    user: { id: '123', username: 'TestBot' },
    channels: { fetch: jest.fn() }
  }),
  removeBot: jest.fn(),
  sendMessage: jest.fn().mockResolvedValue({ id: 'msg123' }),
  sendEmbed: jest.fn().mockResolvedValue({ id: 'msg456' }),
  sendTyping: jest.fn().mockResolvedValue(true),
  createThread: jest.fn().mockResolvedValue({ id: 'thread123' }),
  createStandaloneThread: jest.fn().mockResolvedValue({ id: 'thread456' }),
  sendToThread: jest.fn().mockResolvedValue({ id: 'msg789' }),
  registerSlashCommands: jest.fn().mockResolvedValue({ success: true }),
  getDefaultSlashCommands: jest.fn().mockReturnValue([]),
  handleIncomingMessage: jest.fn().mockReturnValue({ type: 'text' }),
  handleSlashCommand: jest.fn().mockReturnValue({ type: 'slash_command' }),
  handleButtonInteraction: jest.fn().mockReturnValue({ type: 'button' }),
  handleSelectMenuInteraction: jest.fn().mockReturnValue({ type: 'select_menu' }),
  replyToInteraction: jest.fn().mockResolvedValue({}),
  deferReply: jest.fn().mockResolvedValue({}),
  testConnection: jest.fn().mockResolvedValue({ success: true, botId: '123' }),
  getUserInfo: jest.fn().mockResolvedValue({ id: '123', username: 'User' }),
  getGuildInfo: jest.fn().mockResolvedValue({ id: '456', name: 'Server' }),
  getMemberInfo: jest.fn().mockResolvedValue({ id: '789', displayName: 'Member' }),
  editMessage: jest.fn().mockResolvedValue({}),
  deleteMessage: jest.fn().mockResolvedValue(true),
  addReaction: jest.fn().mockResolvedValue(true),
  buildEmbed: jest.fn().mockReturnValue({}),
  buildButtonRow: jest.fn().mockReturnValue({}),
  buildSelectMenu: jest.fn().mockReturnValue({}),
  buildInteractiveMessage: jest.fn().mockReturnValue({})
}));

// Mock discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    login: jest.fn().mockResolvedValue(true),
    destroy: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
    user: {
      id: '123456789',
      username: 'TestBot',
      discriminator: '1234',
      avatarURL: jest.fn().mockReturnValue('https://cdn.discordapp.com/avatar.png')
    },
    channels: {
      fetch: jest.fn().mockResolvedValue({
        id: '987654321',
        send: jest.fn().mockResolvedValue({ id: 'msg123' }),
        sendTyping: jest.fn().mockResolvedValue(true),
        isThread: jest.fn().mockReturnValue(false),
        messages: {
          fetch: jest.fn().mockResolvedValue({
            id: 'msg123',
            edit: jest.fn().mockResolvedValue({}),
            delete: jest.fn().mockResolvedValue(true),
            react: jest.fn().mockResolvedValue(true),
            startThread: jest.fn().mockResolvedValue({ id: 'thread123' })
          })
        }
      })
    },
    guilds: {
      fetch: jest.fn().mockResolvedValue({
        id: '111222333',
        name: 'Test Server',
        memberCount: 100
      }),
      cache: { size: 5 }
    },
    users: {
      fetch: jest.fn().mockResolvedValue({
        id: '444555666',
        username: 'TestUser',
        discriminator: '5678',
        avatarURL: jest.fn().mockReturnValue('https://cdn.discordapp.com/avatar2.png')
      }),
      cache: { size: 50 }
    },
    uptime: 3600000
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    GuildMessageReactions: 3,
    DirectMessages: 4,
    DirectMessageReactions: 5,
    MessageContent: 6,
    GuildMembers: 7
  },
  Partials: {
    Channel: 1,
    Message: 2,
    Reaction: 3
  },
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setURL: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setAuthor: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis()
  })),
  ActionRowBuilder: jest.fn().mockImplementation(() => ({
    addComponents: jest.fn().mockReturnThis()
  })),
  ButtonBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setEmoji: jest.fn().mockReturnThis(),
    setDisabled: jest.fn().mockReturnThis(),
    setURL: jest.fn().mockReturnThis()
  })),
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5
  },
  StringSelectMenuBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setPlaceholder: jest.fn().mockReturnThis(),
    setMinValues: jest.fn().mockReturnThis(),
    setMaxValues: jest.fn().mockReturnThis(),
    addOptions: jest.fn().mockReturnThis()
  })),
  SlashCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addStringOption: jest.fn().mockReturnThis(),
    addIntegerOption: jest.fn().mockReturnThis(),
    addBooleanOption: jest.fn().mockReturnThis(),
    addUserOption: jest.fn().mockReturnThis(),
    addChannelOption: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({})
  })),
  REST: jest.fn().mockImplementation(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue([])
  })),
  Routes: {
    applicationCommands: jest.fn().mockReturnValue('/applications/123/commands'),
    applicationGuildCommands: jest.fn().mockReturnValue('/applications/123/guilds/456/commands')
  },
  ChannelType: {
    PublicThread: 11,
    PrivateThread: 12
  },
  PermissionFlagsBits: {}
}));

// Require after mocks are defined
const DiscordProvider = require('../../channels/providers/DiscordProvider');

describe('DiscordProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new DiscordProvider();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a DiscordProvider instance', () => {
      expect(provider).toBeInstanceOf(DiscordProvider);
      expect(provider.name).toBe('discord');
      expect(provider.version).toBe('1.0.0');
    });

    it('should have rate limits configured', () => {
      expect(provider.rateLimits).toBeDefined();
      expect(provider.rateLimits.messagesPerSecond).toBe(5);
      expect(provider.rateLimits.messagesPerMinute).toBe(120);
    });

    it('should initialize rate limit trackers', () => {
      expect(provider.rateLimitTrackers).toBeInstanceOf(Map);
    });
  });

  describe('initialize', () => {
    it('should initialize with bot token', async () => {
      const channel = {
        bot_token: 'test_token',
        client_id: 'test_client_id'
      };

      const result = await provider.initialize(channel);
      expect(result).toBe(true);
    });

    it('should handle initialization failure', async () => {
      const discordService = require('../../services/channels/discordService');
      discordService.connectBot.mockRejectedValueOnce(new Error('Connection failed'));

      const channel = {
        bot_token: 'invalid_token',
        client_id: 'test_client_id'
      };

      const result = await provider.initialize(channel);
      expect(result).toBe(false);
    });
  });

  describe('send', () => {
    const channel = {
      bot_token: 'test_token',
      client_id: 'test_client_id'
    };

    it('should send text message', async () => {
      const message = {
        type: 'text',
        to: 'channel123',
        text: 'Hello, Discord!'
      };

      const result = await provider.send(channel, message);
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should send embed message', async () => {
      const message = {
        type: 'embed',
        to: 'channel123',
        embed: {
          title: 'Test Embed',
          description: 'Test description',
          color: '#7289DA'
        }
      };

      const result = await provider.send(channel, message);
      expect(result.success).toBe(true);
    });

    it('should handle send failure', async () => {
      const discordService = require('../../services/channels/discordService');
      discordService.sendMessage.mockRejectedValueOnce(new Error('Send failed'));

      const message = {
        type: 'text',
        to: 'channel123',
        text: 'Test'
      };

      const result = await provider.send(channel, message);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Send failed');
    });
  });

  describe('sendTextMessage', () => {
    it('should send text message using send method', async () => {
      const channel = { bot_token: 'test_token' };
      const spy = jest.spyOn(provider, 'send');

      await provider.sendTextMessage(channel, 'channel123', 'Hello!');

      expect(spy).toHaveBeenCalledWith(channel, {
        type: 'text',
        to: 'channel123',
        text: 'Hello!',
        options: {}
      });
    });
  });

  describe('sendMediaMessage', () => {
    it('should send media as embed', async () => {
      const channel = { bot_token: 'test_token' };
      const spy = jest.spyOn(provider, 'send');

      await provider.sendMediaMessage(channel, 'channel123', 'image', 'https://example.com/image.png', {
        caption: 'Test image'
      });

      expect(spy).toHaveBeenCalled();
      const callArgs = spy.mock.calls[0][1];
      expect(callArgs.type).toBe('embed');
      expect(callArgs.embed.image).toBe('https://example.com/image.png');
    });
  });

  describe('sendInteractive', () => {
    it('should send interactive message with components', async () => {
      const channel = { bot_token: 'test_token' };
      const spy = jest.spyOn(provider, 'send');

      await provider.sendInteractive(channel, 'channel123', 'Choose an option:', [
        { type: 'buttons', buttons: [{ label: 'Click me', customId: 'btn1' }] }
      ]);

      expect(spy).toHaveBeenCalledWith(channel, expect.objectContaining({
        type: 'interactive'
      }));
    });
  });

  describe('verify', () => {
    it('should verify webhook with valid signature headers', () => {
      const request = {
        headers: {
          'x-signature-ed25519': 'valid_signature',
          'x-signature-timestamp': '1234567890'
        }
      };

      const result = provider.verify(request, 'secret');
      expect(result).toBe(true);
    });

    it('should fail verification without signature headers', () => {
      const request = {
        headers: {}
      };

      const result = provider.verify(request, 'secret');
      expect(result).toBe(false);
    });
  });

  describe('handleChallenge', () => {
    it('should return null (Discord does not use challenges)', () => {
      const result = provider.handleChallenge({}, 'token');
      expect(result).toBeNull();
    });
  });

  describe('getCapabilities', () => {
    it('should return Discord capabilities', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities.textMessages).toBe(true);
      expect(capabilities.mediaMessages).toBe(true);
      expect(capabilities.templates).toBe(false);
      expect(capabilities.reactions).toBe(true);
      expect(capabilities.replies).toBe(true);
      expect(capabilities.typing).toBe(true);
      expect(capabilities.embeds).toBe(true);
      expect(capabilities.threads).toBe(true);
      expect(capabilities.slashCommands).toBe(true);
      expect(capabilities.interactiveMessages).toBe(true);
    });
  });

  describe('sendTypingIndicator', () => {
    it('should send typing indicator', async () => {
      const channel = { bot_token: 'test_token' };

      const result = await provider.sendTypingIndicator(channel, 'channel123', true);
      expect(result).toBe(true);
    });

    it('should not send when typing is false', async () => {
      const channel = { bot_token: 'test_token' };

      const result = await provider.sendTypingIndicator(channel, 'channel123', false);
      expect(result).toBe(true);
    });
  });

  describe('validateCredentials', () => {
    it('should validate credentials successfully', async () => {
      const credentials = { botToken: 'valid_token' };

      const result = await provider.validateCredentials(credentials);
      expect(result).toBe(true);
    });

    it('should handle invalid credentials', async () => {
      const discordService = require('../../services/channels/discordService');
      discordService.testConnection.mockResolvedValueOnce({ success: false });

      const credentials = { botToken: 'invalid_token' };

      const result = await provider.validateCredentials(credentials);
      expect(result).toBe(false);
    });
  });

  describe('getMessageStatus', () => {
    it('should return delivered status (Discord messages are instant)', async () => {
      const channel = { bot_token: 'test_token' };

      const result = await provider.getMessageStatus(channel, 'msg123');

      expect(result.status).toBe('delivered');
      expect(result.messageId).toBe('msg123');
    });
  });

  describe('markAsRead', () => {
    it('should return true (Discord bots cannot mark as read)', async () => {
      const channel = { bot_token: 'test_token' };

      const result = await provider.markAsRead(channel, 'msg123');
      expect(result).toBe(true);
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile', async () => {
      const channel = { bot_token: 'test_token' };

      const result = await provider.getUserProfile(channel, 'user123');

      expect(result).toBeDefined();
      expect(result.id).toBe('123');
      expect(result.username).toBe('User');
    });

    it('should handle user not found', async () => {
      const discordService = require('../../services/channels/discordService');
      discordService.getUserInfo.mockRejectedValueOnce(new Error('User not found'));

      const channel = { bot_token: 'test_token' };

      const result = await provider.getUserProfile(channel, 'unknown');
      expect(result).toBeNull();
    });
  });

  describe('Discord specific methods', () => {
    const channel = { bot_token: 'test_token', client_id: 'client123' };

    describe('createThread', () => {
      it('should create a thread from a message', async () => {
        const discordService = require('../../services/channels/discordService');

        await provider.createThread(channel, 'channel123', 'msg123', { name: 'Discussion' });

        expect(discordService.createThread).toHaveBeenCalledWith(
          'test_token',
          'channel123',
          'msg123',
          { name: 'Discussion' }
        );
      });
    });

    describe('sendToThread', () => {
      it('should send message to a thread', async () => {
        const discordService = require('../../services/channels/discordService');

        await provider.sendToThread(channel, 'thread123', 'Hello thread!');

        expect(discordService.sendToThread).toHaveBeenCalledWith(
          'test_token',
          'thread123',
          'Hello thread!',
          {}
        );
      });
    });

    describe('registerSlashCommands', () => {
      it('should register slash commands', async () => {
        const discordService = require('../../services/channels/discordService');
        const commands = [
          { name: 'test', description: 'Test command' }
        ];

        await provider.registerSlashCommands(channel, commands);

        expect(discordService.registerSlashCommands).toHaveBeenCalledWith(
          'test_token',
          'client123',
          commands,
          null
        );
      });

      it('should register guild-specific commands', async () => {
        const discordService = require('../../services/channels/discordService');
        const commands = [{ name: 'test', description: 'Test' }];

        await provider.registerSlashCommands(channel, commands, 'guild123');

        expect(discordService.registerSlashCommands).toHaveBeenCalledWith(
          'test_token',
          'client123',
          commands,
          'guild123'
        );
      });
    });

    describe('editMessage', () => {
      it('should edit a message', async () => {
        const discordService = require('../../services/channels/discordService');

        await provider.editMessage(channel, 'channel123', 'msg123', 'Updated content');

        expect(discordService.editMessage).toHaveBeenCalledWith(
          'test_token',
          'channel123',
          'msg123',
          'Updated content',
          {}
        );
      });
    });

    describe('deleteMessage', () => {
      it('should delete a message', async () => {
        const discordService = require('../../services/channels/discordService');

        await provider.deleteMessage(channel, 'channel123', 'msg123');

        expect(discordService.deleteMessage).toHaveBeenCalledWith(
          'test_token',
          'channel123',
          'msg123'
        );
      });
    });

    describe('addReaction', () => {
      it('should add a reaction to a message', async () => {
        const discordService = require('../../services/channels/discordService');

        await provider.addReaction(channel, 'channel123', 'msg123', '👍');

        expect(discordService.addReaction).toHaveBeenCalledWith(
          'test_token',
          'channel123',
          'msg123',
          '👍'
        );
      });
    });

    describe('getGuildInfo', () => {
      it('should get guild information', async () => {
        const discordService = require('../../services/channels/discordService');

        const result = await provider.getGuildInfo(channel, 'guild123');

        expect(discordService.getGuildInfo).toHaveBeenCalledWith('test_token', 'guild123');
        expect(result.id).toBe('456');
        expect(result.name).toBe('Server');
      });
    });

    describe('getMemberInfo', () => {
      it('should get member information', async () => {
        const discordService = require('../../services/channels/discordService');

        const result = await provider.getMemberInfo(channel, 'guild123', 'user123');

        expect(discordService.getMemberInfo).toHaveBeenCalledWith('test_token', 'guild123', 'user123');
        expect(result.id).toBe('789');
        expect(result.displayName).toBe('Member');
      });
    });
  });

  describe('rate limiting', () => {
    it('should track rate limits', async () => {
      const channel = { bot_token: 'test_token' };

      // First message should go through immediately
      await provider.checkRateLimit('test_token', 'channel123');

      expect(provider.rateLimitTrackers.has('test_token:channel123')).toBe(true);
    });

    it('should update tracker on each message', async () => {
      await provider.checkRateLimit('test_token', 'channel123');
      const tracker = provider.rateLimitTrackers.get('test_token:channel123');

      expect(tracker.messagesThisMinute).toBe(1);
      expect(tracker.lastMessage).toBeDefined();
    });
  });

  describe('delay helper', () => {
    it('should delay for specified time', async () => {
      const start = Date.now();
      await provider.delay(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some margin
    });
  });

  describe('sendEmbed', () => {
    it('should send embed message', async () => {
      const channel = { bot_token: 'test_token' };
      const spy = jest.spyOn(provider, 'send');

      await provider.sendEmbed(channel, 'channel123', {
        title: 'Test',
        description: 'Description'
      });

      expect(spy).toHaveBeenCalledWith(channel, expect.objectContaining({
        type: 'embed'
      }));
    });
  });

  describe('sendTemplate', () => {
    it('should send template as interactive embed', async () => {
      const channel = { bot_token: 'test_token' };
      const spy = jest.spyOn(provider, 'send');

      await provider.sendTemplate(channel, 'channel123', 'Welcome', 'en', [
        { type: 'button', text: 'Click', callback_data: 'btn1' }
      ]);

      expect(spy).toHaveBeenCalledWith(channel, expect.objectContaining({
        type: 'interactive'
      }));
    });

    it('should handle template without components', async () => {
      const channel = { bot_token: 'test_token' };
      const spy = jest.spyOn(provider, 'send');

      await provider.sendTemplate(channel, 'channel123', 'Welcome', 'en', []);

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('receive', () => {
    it('should handle MESSAGE_CREATE event', async () => {
      const discordService = require('../../services/channels/discordService');

      const result = await provider.receive({
        type: 'MESSAGE_CREATE',
        message: { content: 'Hello' }
      });

      expect(discordService.handleIncomingMessage).toHaveBeenCalled();
      expect(result.type).toBe('text');
    });

    it('should handle slash command interaction', async () => {
      const discordService = require('../../services/channels/discordService');

      const result = await provider.receive({
        type: 'INTERACTION_CREATE',
        interaction: { type: 2, commandName: 'help' }
      });

      expect(discordService.handleSlashCommand).toHaveBeenCalled();
      expect(result.type).toBe('slash_command');
    });

    it('should handle button interaction', async () => {
      const discordService = require('../../services/channels/discordService');

      const result = await provider.receive({
        type: 'INTERACTION_CREATE',
        interaction: { type: 3, componentType: 2, customId: 'btn1' }
      });

      expect(discordService.handleButtonInteraction).toHaveBeenCalled();
      expect(result.type).toBe('button');
    });

    it('should handle select menu interaction', async () => {
      const discordService = require('../../services/channels/discordService');

      const result = await provider.receive({
        type: 'INTERACTION_CREATE',
        interaction: { type: 3, componentType: 3, customId: 'menu1' }
      });

      expect(discordService.handleSelectMenuInteraction).toHaveBeenCalled();
      expect(result.type).toBe('select_menu');
    });

    it('should return payload for unknown types', async () => {
      const payload = { type: 'UNKNOWN', data: {} };
      const result = await provider.receive(payload);
      expect(result).toEqual(payload);
    });
  });

  describe('processWebhook', () => {
    it('should process webhook and return events', async () => {
      jest.spyOn(provider, 'receive').mockResolvedValueOnce({
        type: 'text',
        userId: 'user123',
        username: 'testuser',
        displayName: 'Test User',
        channelId: 'channel123',
        channelType: 'text',
        guildId: 'guild123',
        guildName: 'Test Guild',
        messageId: 'msg123',
        content: 'Hello'
      });

      const events = await provider.processWebhook({}, { type: 'MESSAGE_CREATE' }, {});

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('text');
      expect(events[0].from.id).toBe('user123');
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(provider, 'receive').mockRejectedValueOnce(new Error('Parse error'));

      const events = await provider.processWebhook({}, {}, {});

      expect(events).toHaveLength(0);
    });
  });

  describe('uploadMedia', () => {
    it('should return media directly (Discord handles upload)', async () => {
      const channel = { bot_token: 'test_token' };
      const media = 'https://example.com/image.png';

      const result = await provider.uploadMedia(channel, media, 'image/png');

      expect(result).toBe(media);
    });
  });

  describe('downloadMedia', () => {
    it('should return download info', async () => {
      const channel = { bot_token: 'test_token' };
      const mediaId = 'https://cdn.discord.com/attachments/123/456/image.png';

      const result = await provider.downloadMedia(channel, mediaId);

      expect(result.url).toBe(mediaId);
      expect(result.directDownload).toBe(true);
    });
  });

  describe('sendEmbedMessage', () => {
    it('should send embed via service', async () => {
      const discordService = require('../../services/channels/discordService');
      const channel = { bot_token: 'test_token' };

      await provider.sendEmbedMessage(channel, 'channel123', { title: 'Test' });

      expect(discordService.sendEmbed).toHaveBeenCalledWith(
        'test_token',
        'channel123',
        { title: 'Test' },
        {}
      );
    });
  });

  describe('replyToInteraction', () => {
    it('should reply to interaction', async () => {
      const discordService = require('../../services/channels/discordService');
      const interaction = { id: 'int123' };

      await provider.replyToInteraction(interaction, { content: 'Response' });

      expect(discordService.replyToInteraction).toHaveBeenCalledWith(
        interaction,
        { content: 'Response' }
      );
    });
  });

  describe('deferInteraction', () => {
    it('should defer interaction reply', async () => {
      const discordService = require('../../services/channels/discordService');
      const interaction = { id: 'int123' };

      await provider.deferInteraction(interaction, true);

      expect(discordService.deferReply).toHaveBeenCalledWith(interaction, true);
    });
  });

  describe('send method branches', () => {
    const channel = { bot_token: 'test_token', client_id: 'client123' };

    it('should handle interactive message type', async () => {
      const discordService = require('../../services/channels/discordService');
      discordService.connectBot.mockResolvedValueOnce({
        channels: {
          fetch: jest.fn().mockResolvedValue({
            send: jest.fn().mockResolvedValue({ id: 'msg999' })
          })
        }
      });

      const result = await provider.send(channel, {
        type: 'interactive',
        to: 'channel123',
        content: 'Choose:',
        components: [{ type: 'buttons' }]
      });

      expect(result.success).toBe(true);
    });

    it('should handle thread message type', async () => {
      const discordService = require('../../services/channels/discordService');

      const result = await provider.send(channel, {
        type: 'thread',
        to: 'channel123',
        threadName: 'New Thread',
        text: 'Initial message'
      });

      expect(discordService.createStandaloneThread).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should default to text for unknown type', async () => {
      const discordService = require('../../services/channels/discordService');

      const result = await provider.send(channel, {
        type: 'unknown_type',
        to: 'channel123',
        text: 'Hello'
      });

      expect(discordService.sendMessage).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('sendMediaMessage branches', () => {
    it('should handle non-image media', async () => {
      const channel = { bot_token: 'test_token' };
      const spy = jest.spyOn(provider, 'send');

      await provider.sendMediaMessage(channel, 'channel123', 'video', 'https://example.com/video.mp4', {
        caption: 'My video'
      });

      expect(spy).toHaveBeenCalled();
      const callArgs = spy.mock.calls[0][1];
      expect(callArgs.embed.url).toBe('https://example.com/video.mp4');
      expect(callArgs.embed.description).toContain('Download video');
    });
  });

  describe('initialize branches', () => {
    it('should initialize with clientId instead of client_id', async () => {
      const discordService = require('../../services/channels/discordService');
      const channel = {
        botToken: 'test_token',
        clientId: 'test_client'
      };

      await provider.initialize(channel);

      expect(discordService.connectBot).toHaveBeenCalledWith('test_token');
      expect(discordService.registerSlashCommands).toHaveBeenCalled();
    });

    it('should skip slash commands if no client ID', async () => {
      const discordService = require('../../services/channels/discordService');
      discordService.registerSlashCommands.mockClear();

      const channel = {
        bot_token: 'test_token'
      };

      await provider.initialize(channel);

      expect(discordService.registerSlashCommands).not.toHaveBeenCalled();
    });
  });

  describe('sendTypingIndicator error handling', () => {
    it('should return false on error', async () => {
      const discordService = require('../../services/channels/discordService');
      discordService.sendTyping.mockRejectedValueOnce(new Error('Typing failed'));

      const channel = { bot_token: 'test_token' };
      const result = await provider.sendTypingIndicator(channel, 'channel123', true);

      expect(result).toBe(false);
    });
  });

  describe('checkRateLimit advanced scenarios', () => {
    it('should wait when messages per minute exceeded', async () => {
      const tracker = {
        lastMessage: Date.now() - 1000,
        messagesThisSecond: 0,
        messagesThisMinute: 120,
        minuteStart: Date.now() - 30000
      };
      provider.rateLimitTrackers.set('test:ch', tracker);

      const delaySpy = jest.spyOn(provider, 'delay').mockResolvedValue();

      await provider.checkRateLimit('test', 'ch');

      expect(delaySpy).toHaveBeenCalled();
    });

    it('should reset minute counter after 60 seconds', async () => {
      const tracker = {
        lastMessage: Date.now() - 1000,
        messagesThisSecond: 0,
        messagesThisMinute: 50,
        minuteStart: Date.now() - 70000
      };
      provider.rateLimitTrackers.set('test2:ch2', tracker);

      await provider.checkRateLimit('test2', 'ch2');

      expect(tracker.messagesThisMinute).toBe(1);
    });
  });
});
