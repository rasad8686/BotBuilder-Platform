/**
 * FacebookService Tests
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../channels/providers/FacebookProvider', () => {
  return jest.fn().mockImplementation(() => ({
    getPageInfo: jest.fn().mockResolvedValue({ success: true, page: { name: 'Test Page' } }),
    sendText: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
    sendImage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-2' }),
    sendVideo: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-3' }),
    sendAudio: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-4' }),
    sendFile: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-5' }),
    sendGenericTemplate: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-6' }),
    sendButtonTemplate: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-7' }),
    sendQuickReplies: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-8' }),
    sendReceiptTemplate: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-9' }),
    sendMediaTemplate: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-10' }),
    getUserProfile: jest.fn().mockResolvedValue({ success: true, profile: { name: 'User' } }),
    setPersistentMenu: jest.fn().mockResolvedValue({ success: true }),
    deletePersistentMenu: jest.fn().mockResolvedValue({ success: true }),
    setGetStartedButton: jest.fn().mockResolvedValue({ success: true }),
    setGreetingText: jest.fn().mockResolvedValue({ success: true })
  }));
});

// Mock global fetch
global.fetch = jest.fn();

const db = require('../../../db');
const FacebookProvider = require('../../../channels/providers/FacebookProvider');

describe('FacebookService', () => {
  let FacebookService;
  let mockProviderInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    mockProviderInstance = new FacebookProvider();

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });

    FacebookService = require('../../../services/channels/facebookService');
  });

  describe('connectPage', () => {
    it('should connect a new Facebook page', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({ rows: [{ id: 1, page_id: 'page-123' }] }); // Insert

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await FacebookService.connectPage({
        userId: 'user-1',
        organizationId: 1,
        pageId: 'page-123',
        pageName: 'Test Page',
        accessToken: 'token-123',
        botId: 'bot-1'
      });

      expect(result.success).toBe(true);
      expect(result.page).toBeDefined();
    });

    it('should update existing page connection', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Existing found
        .mockResolvedValueOnce({ rows: [{ id: 1, page_id: 'page-123' }] }); // Update

      const result = await FacebookService.connectPage({
        userId: 'user-1',
        organizationId: 1,
        pageId: 'page-123',
        accessToken: 'token-123'
      });

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
    });

    it('should return error for invalid access token', async () => {
      mockProviderInstance.getPageInfo.mockResolvedValue({ success: false, error: 'Invalid token' });
      jest.resetModules();
      FacebookProvider.mockImplementation(() => mockProviderInstance);
      FacebookService = require('../../../services/channels/facebookService');

      const result = await FacebookService.connectPage({
        userId: 'user-1',
        pageId: 'page-123',
        accessToken: 'invalid'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid page access token');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const result = await FacebookService.connectPage({
        userId: 'user-1',
        pageId: 'page-123',
        accessToken: 'token'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  describe('disconnectPage', () => {
    it('should disconnect a page', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await FacebookService.disconnectPage('page-123', 'user-1');

      expect(result.success).toBe(true);
    });

    it('should return error if page not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await FacebookService.disconnectPage('invalid', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Page not found');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const result = await FacebookService.disconnectPage('page-123', 'user-1');

      expect(result.success).toBe(false);
    });
  });

  describe('getConnectedPages', () => {
    it('should return connected pages for user', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, page_id: 'page-1', page_name: 'Page 1' },
          { id: 2, page_id: 'page-2', page_name: 'Page 2' }
        ]
      });

      const result = await FacebookService.getConnectedPages('user-1');

      expect(result.success).toBe(true);
      expect(result.pages).toHaveLength(2);
    });

    it('should filter by organization', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await FacebookService.getConnectedPages('user-1', 1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        expect.arrayContaining([1])
      );
    });

    it('should handle error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const result = await FacebookService.getConnectedPages('user-1');

      expect(result.success).toBe(false);
    });
  });

  describe('getPage', () => {
    it('should return page by ID', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, page_id: 'page-123', page_name: 'Test Page' }]
      });

      const result = await FacebookService.getPage('page-123');

      expect(result.success).toBe(true);
      expect(result.page.page_id).toBe('page-123');
    });

    it('should return error if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await FacebookService.getPage('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Page not found');
    });
  });

  describe('updatePageSettings', () => {
    it('should update page settings', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, settings: { autoReply: true } }]
      });

      const result = await FacebookService.updatePageSettings('page-123', 'user-1', { autoReply: true });

      expect(result.success).toBe(true);
    });

    it('should return error if page not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await FacebookService.updatePageSettings('invalid', 'user-1', {});

      expect(result.success).toBe(false);
    });
  });

  describe('setupWebhookSubscription', () => {
    it('should subscribe to webhook fields', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await FacebookService.setupWebhookSubscription('page-123', 'token');

      expect(result.success).toBe(true);
    });

    it('should handle API error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Unauthorized' } })
      });

      const result = await FacebookService.setupWebhookSubscription('page-123', 'token');

      expect(result.success).toBe(false);
    });
  });

  describe('sendText', () => {
    it('should send text message', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, access_token: 'token', user_id: 'user-1' }]
      }).mockResolvedValue({ rows: [] });

      const result = await FacebookService.sendText('page-123', 'recipient-1', 'Hello');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-1');
    });

    it('should return error if page not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await FacebookService.sendText('invalid', 'recipient-1', 'Hello');

      expect(result.success).toBe(false);
    });
  });

  describe('sendImage', () => {
    it('should send image message', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, access_token: 'token', user_id: 'user-1' }]
      }).mockResolvedValue({ rows: [] });

      const result = await FacebookService.sendImage('page-123', 'recipient-1', 'http://example.com/image.jpg');

      expect(result.success).toBe(true);
    });
  });

  describe('sendVideo', () => {
    it('should send video message', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, access_token: 'token', user_id: 'user-1' }]
      }).mockResolvedValue({ rows: [] });

      const result = await FacebookService.sendVideo('page-123', 'recipient-1', 'http://example.com/video.mp4');

      expect(result.success).toBe(true);
    });
  });

  describe('sendAudio', () => {
    it('should send audio message', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, access_token: 'token', user_id: 'user-1' }]
      }).mockResolvedValue({ rows: [] });

      const result = await FacebookService.sendAudio('page-123', 'recipient-1', 'http://example.com/audio.mp3');

      expect(result.success).toBe(true);
    });
  });

  describe('sendFile', () => {
    it('should send file message', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, access_token: 'token', user_id: 'user-1' }]
      }).mockResolvedValue({ rows: [] });

      const result = await FacebookService.sendFile('page-123', 'recipient-1', 'http://example.com/doc.pdf');

      expect(result.success).toBe(true);
    });
  });

  describe('sendGenericTemplate', () => {
    it('should send generic template', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, access_token: 'token', user_id: 'user-1' }]
      }).mockResolvedValue({ rows: [] });

      const elements = [{ title: 'Item 1', subtitle: 'Description' }];
      const result = await FacebookService.sendGenericTemplate('page-123', 'recipient-1', elements);

      expect(result.success).toBe(true);
    });
  });

  describe('sendButtonTemplate', () => {
    it('should send button template', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, access_token: 'token', user_id: 'user-1' }]
      }).mockResolvedValue({ rows: [] });

      const buttons = [{ type: 'postback', title: 'Button', payload: 'PAYLOAD' }];
      const result = await FacebookService.sendButtonTemplate('page-123', 'recipient-1', 'Choose an option', buttons);

      expect(result.success).toBe(true);
    });
  });

  describe('sendQuickReplies', () => {
    it('should send quick replies', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, access_token: 'token', user_id: 'user-1' }]
      }).mockResolvedValue({ rows: [] });

      const quickReplies = [{ content_type: 'text', title: 'Yes', payload: 'YES' }];
      const result = await FacebookService.sendQuickReplies('page-123', 'recipient-1', 'Question?', quickReplies);

      expect(result.success).toBe(true);
    });
  });

  describe('sendTemplate', () => {
    beforeEach(() => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, access_token: 'token', user_id: 'user-1' }]
      }).mockResolvedValue({ rows: [] });
    });

    it('should send generic template type', async () => {
      const result = await FacebookService.sendTemplate('page-123', 'recipient-1', 'generic', {
        elements: [{ title: 'Item' }]
      });

      expect(result.success).toBe(true);
    });

    it('should send button template type', async () => {
      const result = await FacebookService.sendTemplate('page-123', 'recipient-1', 'button', {
        text: 'Choose',
        buttons: []
      });

      expect(result.success).toBe(true);
    });

    it('should send receipt template type', async () => {
      const result = await FacebookService.sendTemplate('page-123', 'recipient-1', 'receipt', {
        recipient_name: 'John'
      });

      expect(result.success).toBe(true);
    });

    it('should send media template type', async () => {
      const result = await FacebookService.sendTemplate('page-123', 'recipient-1', 'media', {
        mediaType: 'image',
        attachmentId: 'attach-1',
        buttons: []
      });

      expect(result.success).toBe(true);
    });

    it('should return error for unknown template type', async () => {
      const result = await FacebookService.sendTemplate('page-123', 'recipient-1', 'unknown', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown template type');
    });
  });

  describe('getPageInfo', () => {
    it('should get page info from Facebook', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, access_token: 'token' }]
      });

      const result = await FacebookService.getPageInfo('page-123');

      expect(result.success).toBe(true);
    });

    it('should return error if page not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await FacebookService.getPageInfo('invalid');

      expect(result.success).toBe(false);
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, access_token: 'token' }]
      });

      const result = await FacebookService.getUserProfile('page-123', 'user-456');

      expect(result.success).toBe(true);
    });
  });

  describe('setPersistentMenu', () => {
    it('should set persistent menu', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, access_token: 'token', user_id: 'user-1' }]
      }).mockResolvedValue({ rows: [{ id: 1 }] });

      const menuItems = [{ type: 'postback', title: 'Menu', payload: 'MENU' }];
      const result = await FacebookService.setPersistentMenu('page-123', menuItems);

      expect(result.success).toBe(true);
    });
  });

  describe('deletePersistentMenu', () => {
    it('should delete persistent menu', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, access_token: 'token' }]
      });

      const result = await FacebookService.deletePersistentMenu('page-123');

      expect(result.success).toBe(true);
    });
  });

  describe('setGetStartedButton', () => {
    it('should set get started button', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, access_token: 'token' }]
      });

      const result = await FacebookService.setGetStartedButton('page-123', 'GET_STARTED');

      expect(result.success).toBe(true);
    });
  });

  describe('setGreetingText', () => {
    it('should set greeting text', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, access_token: 'token', user_id: 'user-1' }]
      }).mockResolvedValue({ rows: [{ id: 1 }] });

      const greetings = [{ locale: 'default', text: 'Hello!' }];
      const result = await FacebookService.setGreetingText('page-123', greetings);

      expect(result.success).toBe(true);
    });
  });

  describe('setWelcomeMessage', () => {
    it('should set welcome message', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const result = await FacebookService.setWelcomeMessage('page-123', 'user-1', 'Welcome!');

      expect(result.success).toBe(true);
    });

    it('should handle error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const result = await FacebookService.setWelcomeMessage('page-123', 'user-1', 'Welcome!');

      expect(result.success).toBe(false);
    });
  });

  describe('getConversations', () => {
    it('should return conversations', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, sender_id: 'sender-1' }]
      }).mockResolvedValue({ rows: [{ count: 1 }] });

      const result = await FacebookService.getConversations('page-123');

      expect(result.success).toBe(true);
      expect(result.conversations).toBeDefined();
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ rows: [{ count: 0 }] });

      await FacebookService.getConversations('page-123', { status: 'active' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.any(Array)
      );
    });
  });

  describe('getConversationMessages', () => {
    it('should return conversation messages', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Hello' },
          { id: 2, content: 'Hi' }
        ]
      });

      const result = await FacebookService.getConversationMessages('conv-1');

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
    });
  });

  describe('getPageStats', () => {
    it('should return page statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_conversations: 10,
          active_conversations: 5,
          total_messages: 100,
          incoming_messages: 50,
          outgoing_messages: 50
        }]
      }).mockResolvedValue({
        rows: [
          { date: '2024-01-01', new_conversations: 2, messages: 10 }
        ]
      });

      const result = await FacebookService.getPageStats('page-123');

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.daily).toBeDefined();
    });
  });

  describe('getMessageTypeStats', () => {
    it('should return message type distribution', async () => {
      db.query.mockResolvedValue({
        rows: [
          { type: 'text', count: 50 },
          { type: 'image', count: 20 }
        ]
      });

      const result = await FacebookService.getMessageTypeStats('page-123');

      expect(result.success).toBe(true);
      expect(result.stats).toHaveLength(2);
    });
  });

  describe('logMessage', () => {
    it('should log message to database', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'conv-1' }] })
        .mockResolvedValue({ rowCount: 1 });

      await FacebookService.logMessage('page-123', 'recipient-1', 'text', 'Hello', 'outgoing', 'msg-1');

      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should not log if conversation not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await FacebookService.logMessage('page-123', 'recipient-1', 'text', 'Hello', 'outgoing', 'msg-1');

      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('testCredentials', () => {
    it('should return success for valid credentials', async () => {
      const result = await FacebookService.testCredentials('valid-token');

      expect(result.success).toBe(true);
      expect(result.page).toBeDefined();
    });

    it('should return error for invalid credentials', async () => {
      mockProviderInstance.getPageInfo.mockResolvedValue({ success: false, error: 'Invalid' });
      jest.resetModules();
      FacebookProvider.mockImplementation(() => mockProviderInstance);
      FacebookService = require('../../../services/channels/facebookService');

      const result = await FacebookService.testCredentials('invalid');

      expect(result.success).toBe(false);
    });
  });

  describe('exchangeToken', () => {
    it('should exchange short-lived token for long-lived token', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'long-lived-token',
          expires_in: 5184000
        })
      });

      const result = await FacebookService.exchangeToken('short-token');

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('long-lived-token');
    });

    it('should handle exchange error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Invalid token' } })
      });

      const result = await FacebookService.exchangeToken('invalid');

      expect(result.success).toBe(false);
    });
  });

  describe('getUserPages', () => {
    it('should return user pages', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'page-1', name: 'Page 1', access_token: 'token-1', category: 'Business' },
            { id: 'page-2', name: 'Page 2', access_token: 'token-2', category: 'Brand' }
          ]
        })
      });

      const result = await FacebookService.getUserPages('user-token');

      expect(result.success).toBe(true);
      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].id).toBe('page-1');
    });

    it('should handle API error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Unauthorized' } })
      });

      const result = await FacebookService.getUserPages('invalid');

      expect(result.success).toBe(false);
    });
  });
});
