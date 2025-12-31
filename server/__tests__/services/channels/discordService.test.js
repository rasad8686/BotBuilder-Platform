/**
 * DiscordService Tests
 * Tests for Discord bot API integration service
 */

// Mock discord.js
const mockChannel = {
  send: jest.fn().mockResolvedValue({ id: 'msg-123' }),
  fetch: jest.fn(),
  sendTyping: jest.fn().mockResolvedValue(true),
  messages: {
    fetch: jest.fn()
  },
  threads: {
    create: jest.fn()
  },
  isThread: jest.fn().mockReturnValue(false)
};

const mockMessage = {
  id: 'msg-123',
  react: jest.fn().mockResolvedValue(true),
  edit: jest.fn().mockResolvedValue(true),
  delete: jest.fn().mockResolvedValue(true),
  startThread: jest.fn(),
  reactions: {
    cache: new Map()
  }
};

const mockClient = {
  login: jest.fn().mockResolvedValue('token'),
  destroy: jest.fn(),
  isReady: jest.fn().mockReturnValue(false),
  user: {
    id: 'bot-123',
    username: 'TestBot',
    discriminator: '0001',
    avatarURL: jest.fn().mockReturnValue('https://avatar.url'),
    createdAt: new Date()
  },
  uptime: 12345,
  channels: {
    fetch: jest.fn().mockResolvedValue(mockChannel)
  },
  guilds: {
    fetch: jest.fn(),
    cache: new Map([['guild-1', { id: 'guild-1' }]])
  },
  users: {
    fetch: jest.fn(),
    cache: new Map()
  }
};

jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => mockClient),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    GuildMessageReactions: 4,
    DirectMessages: 8,
    DirectMessageReactions: 16,
    MessageContent: 32,
    GuildMembers: 64
  },
  Partials: {
    Channel: 1,
    Message: 2,
    Reaction: 4
  },
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setURL: jest.fn().mockReturnThis(),
    setAuthor: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
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
    setURL: jest.fn().mockReturnThis(),
    setDisabled: jest.fn().mockReturnThis()
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
    put: jest.fn().mockResolvedValue({ success: true })
  })),
  Routes: {
    applicationCommands: jest.fn().mockReturnValue('/commands'),
    applicationGuildCommands: jest.fn().mockReturnValue('/guild/commands')
  },
  ChannelType: {
    GuildText: 0,
    DM: 1,
    PublicThread: 11,
    PrivateThread: 12
  },
  PermissionFlagsBits: {
    SendMessages: 1n,
    ViewChannel: 2n
  }
}));

describe('DiscordService', () => {
  let discordService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.isReady.mockReturnValue(false);
    mockClient.login.mockClear();
    mockClient.destroy.mockClear();
    mockChannel.send.mockClear();
    mockClient.channels.fetch.mockClear();
    mockClient.channels.fetch.mockResolvedValue(mockChannel);
    mockChannel.messages.fetch.mockResolvedValue(mockMessage);

    // Get fresh module
    jest.resetModules();
    discordService = require('../../../services/channels/discordService');
  });

  describe('constructor', () => {
    it('should initialize with bots map', () => {
      expect(discordService.bots).toBeInstanceOf(Map);
    });

    it('should initialize with command handlers map', () => {
      expect(discordService.commandHandlers).toBeInstanceOf(Map);
    });

    it('should initialize with webhook secrets map', () => {
      expect(discordService.webhookSecrets).toBeInstanceOf(Map);
    });
  });

  describe('initBot', () => {
    it('should create and store bot instance', () => {
      const client = discordService.initBot('bot-token-123');

      expect(discordService.bots.has('bot-token-123')).toBe(true);
      expect(client).toBeDefined();
    });

    it('should return existing bot if already initialized', () => {
      const client1 = discordService.initBot('bot-token-123');
      const client2 = discordService.initBot('bot-token-123');

      expect(client1).toBe(client2);
    });

    it('should accept options', () => {
      const options = { customOption: true };
      const client = discordService.initBot('bot-token-456', options);

      expect(client._options).toEqual(options);
    });
  });

  describe('getBot', () => {
    it('should create bot if not exists', () => {
      const client = discordService.getBot('bot-token-789');

      expect(discordService.bots.has('bot-token-789')).toBe(true);
    });

    it('should return existing bot', () => {
      discordService.initBot('bot-token-123');
      const client = discordService.getBot('bot-token-123');

      expect(client).toBeDefined();
    });
  });

  describe('connectBot', () => {
    it('should login if not ready', async () => {
      mockClient.isReady.mockReturnValue(false);

      await discordService.connectBot('bot-token-123');

      expect(mockClient.login).toHaveBeenCalledWith('bot-token-123');
    });

    it('should not login if already ready', async () => {
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token-123');

      await discordService.connectBot('bot-token-123');

      expect(mockClient.login).not.toHaveBeenCalled();
    });
  });

  describe('removeBot', () => {
    it('should destroy and remove bot', () => {
      discordService.initBot('bot-token-123');
      discordService.removeBot('bot-token-123');

      expect(mockClient.destroy).toHaveBeenCalled();
      expect(discordService.bots.has('bot-token-123')).toBe(false);
    });

    it('should handle non-existent bot', () => {
      expect(() => discordService.removeBot('non-existent')).not.toThrow();
    });
  });

  describe('registerSlashCommands', () => {
    it('should register guild-specific commands', async () => {
      const commands = [
        { name: 'test', description: 'Test command' }
      ];

      const result = await discordService.registerSlashCommands(
        'bot-token',
        'client-id',
        commands,
        'guild-id'
      );

      expect(result.success).toBe(true);
      expect(result.commandCount).toBe(1);
    });

    it('should register global commands', async () => {
      const commands = [
        { name: 'test', description: 'Test command' }
      ];

      const result = await discordService.registerSlashCommands(
        'bot-token',
        'client-id',
        commands
      );

      expect(result.success).toBe(true);
    });

    it('should handle commands with options', async () => {
      const commands = [
        {
          name: 'ask',
          description: 'Ask a question',
          options: [
            { name: 'question', type: 'string', description: 'Your question', required: true },
            { name: 'count', type: 'integer', description: 'Count' },
            { name: 'enabled', type: 'boolean', description: 'Enabled' },
            { name: 'user', type: 'user', description: 'User' },
            { name: 'channel', type: 'channel', description: 'Channel' }
          ]
        }
      ];

      const result = await discordService.registerSlashCommands(
        'bot-token',
        'client-id',
        commands
      );

      expect(result.success).toBe(true);
    });
  });

  describe('getDefaultSlashCommands', () => {
    it('should return array of default commands', () => {
      const commands = discordService.getDefaultSlashCommands();

      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    });

    it('should include help command', () => {
      const commands = discordService.getDefaultSlashCommands();
      const help = commands.find(c => c.name === 'help');

      expect(help).toBeDefined();
      expect(help.description).toBeDefined();
    });

    it('should include ask command with options', () => {
      const commands = discordService.getDefaultSlashCommands();
      const ask = commands.find(c => c.name === 'ask');

      expect(ask).toBeDefined();
      expect(ask.options).toBeDefined();
      expect(ask.options.length).toBeGreaterThan(0);
    });

    it('should include status command', () => {
      const commands = discordService.getDefaultSlashCommands();
      expect(commands.some(c => c.name === 'status')).toBe(true);
    });

    it('should include clear command', () => {
      const commands = discordService.getDefaultSlashCommands();
      expect(commands.some(c => c.name === 'clear')).toBe(true);
    });

    it('should include info command', () => {
      const commands = discordService.getDefaultSlashCommands();
      expect(commands.some(c => c.name === 'info')).toBe(true);
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      mockClient.isReady.mockReturnValue(true);
      mockClient.channels.fetch.mockResolvedValue(mockChannel);
      mockChannel.send.mockResolvedValue({ id: 'msg-123' });
    });

    it('should send text message', async () => {
      discordService.initBot('bot-token');

      await discordService.sendMessage('bot-token', 'channel-123', 'Hello!');

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel-123');
      expect(mockChannel.send).toHaveBeenCalledWith({ content: 'Hello!' });
    });

    it('should include embeds if provided', async () => {
      discordService.initBot('bot-token');

      await discordService.sendMessage('bot-token', 'channel-123', 'Hello!', {
        embeds: [{ title: 'Test' }]
      });

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [{ title: 'Test' }] })
      );
    });

    it('should include components if provided', async () => {
      discordService.initBot('bot-token');
      const components = [{ type: 1 }];

      await discordService.sendMessage('bot-token', 'channel-123', 'Hello!', { components });

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({ components })
      );
    });

    it('should include reply reference if provided', async () => {
      discordService.initBot('bot-token');

      await discordService.sendMessage('bot-token', 'channel-123', 'Hello!', {
        replyTo: 'original-msg-123'
      });

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          reply: { messageReference: 'original-msg-123' }
        })
      );
    });

    it('should throw error if channel not found', async () => {
      discordService.initBot('bot-token');
      mockClient.channels.fetch.mockResolvedValue(null);

      await expect(
        discordService.sendMessage('bot-token', 'channel-123', 'Hello!')
      ).rejects.toThrow('Channel not found');
    });
  });

  describe('sendEmbed', () => {
    beforeEach(() => {
      mockClient.isReady.mockReturnValue(true);
      mockClient.channels.fetch.mockResolvedValue(mockChannel);
      mockChannel.send.mockResolvedValue({ id: 'msg-123' });
    });

    it('should send embed message', async () => {
      discordService.initBot('bot-token');

      await discordService.sendEmbed('bot-token', 'channel-123', {
        title: 'Test Embed',
        description: 'Test description'
      });

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) })
      );
    });

    it('should include content if provided', async () => {
      discordService.initBot('bot-token');

      await discordService.sendEmbed('bot-token', 'channel-123', { title: 'Test' }, {
        content: 'Additional text'
      });

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Additional text' })
      );
    });

    it('should include components if provided', async () => {
      discordService.initBot('bot-token');
      const components = [{ type: 1 }];

      await discordService.sendEmbed('bot-token', 'channel-123', { title: 'Test' }, { components });

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({ components })
      );
    });
  });

  describe('buildEmbed', () => {
    it('should build embed with all properties', () => {
      const config = {
        title: 'Test Title',
        description: 'Test Description',
        color: '#FF0000',
        url: 'https://example.com'
      };

      const embed = discordService.buildEmbed(config);

      expect(embed.setTitle).toHaveBeenCalledWith('Test Title');
      expect(embed.setDescription).toHaveBeenCalledWith('Test Description');
      expect(embed.setColor).toHaveBeenCalledWith('#FF0000');
      expect(embed.setURL).toHaveBeenCalledWith('https://example.com');
    });

    it('should handle empty config', () => {
      expect(() => discordService.buildEmbed({})).not.toThrow();
    });

    it('should set author if provided', () => {
      const config = {
        author: { name: 'Test Author', iconURL: 'https://icon.url', url: 'https://author.url' }
      };

      const embed = discordService.buildEmbed(config);

      expect(embed.setAuthor).toHaveBeenCalledWith({
        name: 'Test Author',
        iconURL: 'https://icon.url',
        url: 'https://author.url'
      });
    });

    it('should set footer if provided', () => {
      const config = {
        footer: { text: 'Footer text', iconURL: 'https://footer-icon.url' }
      };

      const embed = discordService.buildEmbed(config);

      expect(embed.setFooter).toHaveBeenCalledWith({
        text: 'Footer text',
        iconURL: 'https://footer-icon.url'
      });
    });

    it('should set thumbnail if provided', () => {
      const config = { thumbnail: 'https://thumbnail.url' };

      const embed = discordService.buildEmbed(config);

      expect(embed.setThumbnail).toHaveBeenCalledWith('https://thumbnail.url');
    });

    it('should set image if provided', () => {
      const config = { image: 'https://image.url' };

      const embed = discordService.buildEmbed(config);

      expect(embed.setImage).toHaveBeenCalledWith('https://image.url');
    });

    it('should add fields if provided', () => {
      const config = {
        fields: [
          { name: 'Field 1', value: 'Value 1', inline: true },
          { name: 'Field 2', value: 'Value 2' }
        ]
      };

      const embed = discordService.buildEmbed(config);

      expect(embed.addFields).toHaveBeenCalledTimes(2);
    });
  });

  describe('buildSuccessEmbed', () => {
    it('should build success embed with green color', () => {
      const embed = discordService.buildSuccessEmbed('Success', 'Operation completed');

      expect(embed.setColor).toHaveBeenCalledWith(0x00FF00);
      expect(embed.setTimestamp).toHaveBeenCalled();
    });
  });

  describe('buildErrorEmbed', () => {
    it('should build error embed with red color', () => {
      const embed = discordService.buildErrorEmbed('Error', 'Something went wrong');

      expect(embed.setColor).toHaveBeenCalledWith(0xFF0000);
      expect(embed.setTimestamp).toHaveBeenCalled();
    });
  });

  describe('buildInfoEmbed', () => {
    it('should build info embed with blue color', () => {
      const embed = discordService.buildInfoEmbed('Info', 'Some information');

      expect(embed.setColor).toHaveBeenCalledWith(0x0099FF);
      expect(embed.setTimestamp).toHaveBeenCalled();
    });

    it('should include fields if provided', () => {
      const fields = [{ name: 'Field', value: 'Value' }];
      const embed = discordService.buildInfoEmbed('Info', 'Description', fields);

      expect(embed.addFields).toHaveBeenCalled();
    });
  });

  describe('buildAIResponseEmbed', () => {
    it('should build AI response embed', () => {
      const embed = discordService.buildAIResponseEmbed('What is AI?', 'AI is...', 'TestBot');

      expect(embed.setColor).toHaveBeenCalledWith(0x7289DA);
      expect(embed.addFields).toHaveBeenCalled();
    });
  });

  describe('buildButtonRow', () => {
    it('should build button row with buttons', () => {
      const buttons = [
        { customId: 'btn-1', label: 'Button 1', style: 'primary' },
        { customId: 'btn-2', label: 'Button 2', style: 'secondary' }
      ];

      const row = discordService.buildButtonRow(buttons);

      expect(row.addComponents).toHaveBeenCalled();
    });

    it('should handle disabled buttons', () => {
      const buttons = [
        { customId: 'btn-1', label: 'Disabled', disabled: true }
      ];

      const row = discordService.buildButtonRow(buttons);

      expect(row.addComponents).toHaveBeenCalled();
    });

    it('should handle URL buttons', () => {
      const buttons = [
        { label: 'Visit', url: 'https://example.com' }
      ];

      const row = discordService.buildButtonRow(buttons);

      expect(row.addComponents).toHaveBeenCalled();
    });
  });

  describe('getButtonStyle', () => {
    it('should return correct button styles', () => {
      expect(discordService.getButtonStyle('primary')).toBe(1);
      expect(discordService.getButtonStyle('secondary')).toBe(2);
      expect(discordService.getButtonStyle('success')).toBe(3);
      expect(discordService.getButtonStyle('danger')).toBe(4);
      expect(discordService.getButtonStyle('link')).toBe(5);
    });

    it('should default to primary for unknown style', () => {
      expect(discordService.getButtonStyle('unknown')).toBe(1);
    });
  });

  describe('buildSelectMenu', () => {
    it('should build select menu with options', () => {
      const config = {
        customId: 'select-1',
        placeholder: 'Choose an option',
        options: [
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' }
        ]
      };

      const row = discordService.buildSelectMenu(config);

      expect(row.addComponents).toHaveBeenCalled();
    });

    it('should handle min/max values', () => {
      const config = {
        customId: 'select-1',
        placeholder: 'Choose',
        minValues: 1,
        maxValues: 3,
        options: [{ label: 'Option', value: 'opt' }]
      };

      const row = discordService.buildSelectMenu(config);

      expect(row.addComponents).toHaveBeenCalled();
    });
  });

  describe('buildInteractiveMessage', () => {
    it('should build message with string content', () => {
      const result = discordService.buildInteractiveMessage('Hello');

      expect(result.content).toBe('Hello');
    });

    it('should build message with embed', () => {
      const result = discordService.buildInteractiveMessage({
        embed: { title: 'Test' },
        text: 'Additional text'
      });

      expect(result.embeds).toBeDefined();
      expect(result.content).toBe('Additional text');
    });

    it('should include button components', () => {
      const components = [
        { type: 'buttons', buttons: [{ customId: 'btn', label: 'Click' }] }
      ];

      const result = discordService.buildInteractiveMessage('Hello', components);

      expect(result.components).toBeDefined();
      expect(result.components.length).toBe(1);
    });

    it('should include select components', () => {
      const components = [
        { type: 'select', customId: 'sel', options: [{ label: 'Opt', value: 'opt' }] }
      ];

      const result = discordService.buildInteractiveMessage('Hello', components);

      expect(result.components).toBeDefined();
    });
  });

  describe('createThread', () => {
    it('should create thread from message', async () => {
      const mockThread = { id: 'thread-123', name: 'Discussion' };
      mockMessage.startThread.mockResolvedValue(mockThread);
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      const thread = await discordService.createThread('bot-token', 'channel-123', 'msg-123', {
        name: 'New Thread'
      });

      expect(mockMessage.startThread).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Thread' })
      );
    });
  });

  describe('createStandaloneThread', () => {
    it('should create standalone thread', async () => {
      const mockThread = {
        id: 'thread-123',
        send: jest.fn().mockResolvedValue({ id: 'msg-123' })
      };
      mockChannel.threads.create.mockResolvedValue(mockThread);
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      const thread = await discordService.createStandaloneThread('bot-token', 'channel-123', {
        name: 'Standalone Thread',
        initialMessage: 'Welcome!'
      });

      expect(mockChannel.threads.create).toHaveBeenCalled();
      expect(mockThread.send).toHaveBeenCalledWith('Welcome!');
    });
  });

  describe('sendToThread', () => {
    it('should send message to thread', async () => {
      const mockThread = {
        isThread: jest.fn().mockReturnValue(true),
        send: jest.fn().mockResolvedValue({ id: 'msg-123' })
      };
      mockClient.channels.fetch.mockResolvedValue(mockThread);
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      await discordService.sendToThread('bot-token', 'thread-123', 'Hello thread!');

      expect(mockThread.send).toHaveBeenCalledWith({ content: 'Hello thread!' });
    });

    it('should throw error for invalid thread', async () => {
      const mockNotThread = {
        isThread: jest.fn().mockReturnValue(false)
      };
      mockClient.channels.fetch.mockResolvedValue(mockNotThread);
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      await expect(
        discordService.sendToThread('bot-token', 'not-thread', 'Hello')
      ).rejects.toThrow('Invalid thread ID');
    });
  });

  describe('archiveThread', () => {
    it('should archive thread', async () => {
      const mockThread = {
        isThread: jest.fn().mockReturnValue(true),
        setArchived: jest.fn().mockResolvedValue(true)
      };
      mockClient.channels.fetch.mockResolvedValue(mockThread);
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      const result = await discordService.archiveThread('bot-token', 'thread-123');

      expect(mockThread.setArchived).toHaveBeenCalledWith(true);
      expect(result).toBe(true);
    });
  });

  describe('unarchiveThread', () => {
    it('should unarchive thread', async () => {
      const mockThread = {
        isThread: jest.fn().mockReturnValue(true),
        setArchived: jest.fn().mockResolvedValue(true)
      };
      mockClient.channels.fetch.mockResolvedValue(mockThread);
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      const result = await discordService.unarchiveThread('bot-token', 'thread-123');

      expect(mockThread.setArchived).toHaveBeenCalledWith(false);
      expect(result).toBe(true);
    });
  });

  describe('replyToInteraction', () => {
    it('should reply to new interaction', async () => {
      const mockInteraction = {
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue(true),
        followUp: jest.fn()
      };

      await discordService.replyToInteraction(mockInteraction, 'Hello!');

      expect(mockInteraction.reply).toHaveBeenCalledWith({ content: 'Hello!' });
    });

    it('should follow up if already replied', async () => {
      const mockInteraction = {
        replied: true,
        deferred: false,
        reply: jest.fn(),
        followUp: jest.fn().mockResolvedValue(true)
      };

      await discordService.replyToInteraction(mockInteraction, 'Follow up');

      expect(mockInteraction.followUp).toHaveBeenCalled();
    });

    it('should handle object response', async () => {
      const mockInteraction = {
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue(true)
      };

      await discordService.replyToInteraction(mockInteraction, {
        content: 'Message',
        ephemeral: true
      });

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Message', ephemeral: true })
      );
    });
  });

  describe('deferReply', () => {
    it('should defer reply if not already replied', async () => {
      const mockInteraction = {
        replied: false,
        deferred: false,
        deferReply: jest.fn().mockResolvedValue(true)
      };

      await discordService.deferReply(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: false });
    });

    it('should not defer if already replied', async () => {
      const mockInteraction = {
        replied: true,
        deferred: false,
        deferReply: jest.fn()
      };

      await discordService.deferReply(mockInteraction);

      expect(mockInteraction.deferReply).not.toHaveBeenCalled();
    });
  });

  describe('editReply', () => {
    it('should edit deferred reply', async () => {
      const mockInteraction = {
        editReply: jest.fn().mockResolvedValue(true)
      };

      await discordService.editReply(mockInteraction, 'Edited message');

      expect(mockInteraction.editReply).toHaveBeenCalledWith({ content: 'Edited message' });
    });
  });

  describe('handleIncomingMessage', () => {
    it('should parse incoming message', () => {
      // Create collections with map method like Discord.js Collection
      const createCollection = (items = []) => {
        const col = {
          map: (fn) => items.map(fn),
          size: items.length
        };
        return col;
      };

      const mockMsg = {
        id: 'msg-123',
        channel: { id: 'channel-123', type: 0, isThread: () => false },
        guild: { id: 'guild-123', name: 'Test Server' },
        author: { id: 'user-123', username: 'testuser', discriminator: '1234', bot: false },
        member: { displayName: 'Test User' },
        content: 'Hello world',
        cleanContent: 'Hello world',
        attachments: createCollection(),
        embeds: createCollection(),
        mentions: {
          users: createCollection(),
          roles: createCollection(),
          channels: createCollection()
        },
        reference: null,
        createdAt: new Date()
      };

      const result = discordService.handleIncomingMessage(mockMsg);

      expect(result.messageId).toBe('msg-123');
      expect(result.channelId).toBe('channel-123');
      expect(result.content).toBe('Hello world');
    });
  });

  describe('getMessageType', () => {
    it('should return text for text messages', () => {
      const mockMsg = {
        attachments: { size: 0 },
        stickers: { size: 0 }
      };

      expect(discordService.getMessageType(mockMsg)).toBe('text');
    });

    it('should return image for image attachments', () => {
      const mockMsg = {
        attachments: {
          size: 1,
          first: () => ({ contentType: 'image/png' })
        }
      };

      expect(discordService.getMessageType(mockMsg)).toBe('image');
    });

    it('should return video for video attachments', () => {
      const mockMsg = {
        attachments: {
          size: 1,
          first: () => ({ contentType: 'video/mp4' })
        }
      };

      expect(discordService.getMessageType(mockMsg)).toBe('video');
    });

    it('should return sticker for sticker messages', () => {
      const mockMsg = {
        attachments: { size: 0 },
        stickers: { size: 1 }
      };

      expect(discordService.getMessageType(mockMsg)).toBe('sticker');
    });
  });

  describe('handleSlashCommand', () => {
    it('should parse slash command interaction', () => {
      const mockInteraction = {
        commandName: 'ask',
        options: {
          data: [{ name: 'question', value: 'What is AI?' }]
        },
        user: { id: 'user-123', username: 'testuser' },
        member: { displayName: 'Test User' },
        channel: { id: 'channel-123' },
        guild: { id: 'guild-123' }
      };

      const result = discordService.handleSlashCommand(mockInteraction);

      expect(result.type).toBe('slash_command');
      expect(result.commandName).toBe('ask');
      expect(result.options.question).toBe('What is AI?');
    });
  });

  describe('handleButtonInteraction', () => {
    it('should parse button interaction', () => {
      const mockInteraction = {
        customId: 'btn-confirm',
        user: { id: 'user-123', username: 'testuser' },
        channel: { id: 'channel-123' },
        message: { id: 'msg-123' },
        guild: { id: 'guild-123' }
      };

      const result = discordService.handleButtonInteraction(mockInteraction);

      expect(result.type).toBe('button');
      expect(result.customId).toBe('btn-confirm');
    });
  });

  describe('handleSelectMenuInteraction', () => {
    it('should parse select menu interaction', () => {
      const mockInteraction = {
        customId: 'select-color',
        values: ['red', 'blue'],
        user: { id: 'user-123', username: 'testuser' },
        channel: { id: 'channel-123' },
        message: { id: 'msg-123' },
        guild: { id: 'guild-123' }
      };

      const result = discordService.handleSelectMenuInteraction(mockInteraction);

      expect(result.type).toBe('select_menu');
      expect(result.values).toEqual(['red', 'blue']);
    });
  });

  describe('getBotInfo', () => {
    it('should return bot info', async () => {
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      const info = await discordService.getBotInfo('bot-token');

      expect(info.id).toBe('bot-123');
      expect(info.username).toBe('TestBot');
    });
  });

  describe('testConnection', () => {
    it('should test bot connection successfully', async () => {
      mockClient.isReady.mockReturnValue(true);

      const result = await discordService.testConnection('bot-token');

      expect(result.success).toBe(true);
      expect(result.botId).toBe('bot-123');
    });

    it('should handle connection failure', async () => {
      mockClient.login.mockRejectedValue(new Error('Invalid token'));

      const result = await discordService.testConnection('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('getGuildInfo', () => {
    it('should fetch guild info', async () => {
      const mockGuild = {
        id: 'guild-123',
        name: 'Test Server',
        memberCount: 100,
        ownerId: 'owner-123',
        createdAt: new Date(),
        iconURL: jest.fn().mockReturnValue('https://icon.url'),
        channels: { cache: { size: 10 } },
        roles: { cache: { size: 5 } }
      };

      mockClient.isReady.mockReturnValue(true);
      mockClient.guilds.fetch.mockResolvedValue(mockGuild);
      discordService.initBot('bot-token');

      const info = await discordService.getGuildInfo('bot-token', 'guild-123');

      expect(info.id).toBe('guild-123');
      expect(info.name).toBe('Test Server');
      expect(info.memberCount).toBe(100);
    });
  });

  describe('getUserInfo', () => {
    it('should fetch user info', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        discriminator: '1234',
        avatarURL: jest.fn().mockReturnValue('https://avatar.url'),
        bot: false,
        createdAt: new Date()
      };

      mockClient.isReady.mockReturnValue(true);
      mockClient.users.fetch.mockResolvedValue(mockUser);
      discordService.initBot('bot-token');

      const info = await discordService.getUserInfo('bot-token', 'user-123');

      expect(info.id).toBe('user-123');
      expect(info.username).toBe('testuser');
    });
  });

  describe('getMemberInfo', () => {
    it('should fetch member info', async () => {
      // Create a collection-like object with map method
      const rolesCache = {
        map: (fn) => [{ id: 'role-1', name: 'Admin' }].map(fn)
      };

      const mockMember = {
        id: 'user-123',
        user: {
          username: 'testuser',
          avatarURL: jest.fn().mockReturnValue('https://user-avatar.url')
        },
        displayName: 'Test User',
        nickname: 'Testy',
        avatarURL: jest.fn().mockReturnValue('https://member-avatar.url'),
        roles: {
          cache: rolesCache
        },
        joinedAt: new Date(),
        premiumSince: null
      };

      const mockGuild = {
        members: {
          fetch: jest.fn().mockResolvedValue(mockMember)
        }
      };

      mockClient.isReady.mockReturnValue(true);
      mockClient.guilds.fetch.mockResolvedValue(mockGuild);
      discordService.initBot('bot-token');

      const info = await discordService.getMemberInfo('bot-token', 'guild-123', 'user-123');

      expect(info.id).toBe('user-123');
      expect(info.displayName).toBe('Test User');
      expect(info.roles).toHaveLength(1);
    });
  });

  describe('addReaction', () => {
    it('should add reaction to message', async () => {
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      const result = await discordService.addReaction('bot-token', 'channel-123', 'msg-123', '👍');

      expect(mockMessage.react).toHaveBeenCalledWith('👍');
      expect(result).toBe(true);
    });
  });

  describe('removeReaction', () => {
    it('should remove reaction from message', async () => {
      const mockReaction = {
        users: {
          remove: jest.fn().mockResolvedValue(true)
        }
      };
      mockMessage.reactions.cache.set('👍', mockReaction);
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      const result = await discordService.removeReaction('bot-token', 'channel-123', 'msg-123', '👍');

      expect(mockReaction.users.remove).toHaveBeenCalledWith('bot-123');
      expect(result).toBe(true);
    });
  });

  describe('editMessage', () => {
    it('should edit message with string content', async () => {
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      await discordService.editMessage('bot-token', 'channel-123', 'msg-123', 'New content');

      expect(mockMessage.edit).toHaveBeenCalledWith({ content: 'New content' });
    });

    it('should edit message with object content', async () => {
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      await discordService.editMessage('bot-token', 'channel-123', 'msg-123', {
        content: 'New content',
        embeds: [{ title: 'Embed' }]
      });

      expect(mockMessage.edit).toHaveBeenCalledWith({
        content: 'New content',
        embeds: [{ title: 'Embed' }]
      });
    });
  });

  describe('deleteMessage', () => {
    it('should delete message', async () => {
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      const result = await discordService.deleteMessage('bot-token', 'channel-123', 'msg-123');

      expect(mockMessage.delete).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('sendTyping', () => {
    it('should send typing indicator', async () => {
      mockClient.isReady.mockReturnValue(true);
      discordService.initBot('bot-token');

      const result = await discordService.sendTyping('bot-token', 'channel-123');

      expect(mockChannel.sendTyping).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
