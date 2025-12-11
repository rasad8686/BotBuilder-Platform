/**
 * BaseProvider Tests
 * Tests for server/channels/providers/BaseProvider.js
 */

const BaseProvider = require('../../channels/providers/BaseProvider');

describe('BaseProvider', () => {
  describe('constructor', () => {
    it('should throw error when instantiated directly', () => {
      expect(() => new BaseProvider()).toThrow('BaseProvider is abstract and cannot be instantiated directly');
    });

    it('should allow subclass instantiation', () => {
      class TestProvider extends BaseProvider {
        constructor() {
          super({ testConfig: true });
        }
      }

      const provider = new TestProvider();
      expect(provider.config.testConfig).toBe(true);
      expect(provider.name).toBe('base');
      expect(provider.version).toBe('1.0.0');
    });
  });

  describe('abstract methods', () => {
    let provider;

    beforeAll(() => {
      class TestProvider extends BaseProvider {
        constructor() {
          super();
        }
      }
      provider = new TestProvider();
    });

    it('initialize should throw error', async () => {
      await expect(provider.initialize({})).rejects.toThrow('Method initialize() must be implemented');
    });

    it('send should throw error', async () => {
      await expect(provider.send({}, {})).rejects.toThrow('Method send() must be implemented');
    });

    it('sendTextMessage should throw error', async () => {
      await expect(provider.sendTextMessage({}, 'to', 'text')).rejects.toThrow('Method sendTextMessage() must be implemented');
    });

    it('sendMediaMessage should throw error', async () => {
      await expect(provider.sendMediaMessage({}, 'to', 'image', 'url')).rejects.toThrow('Method sendMediaMessage() must be implemented');
    });

    it('sendTemplate should throw error', async () => {
      await expect(provider.sendTemplate({}, 'to', 'template', 'en')).rejects.toThrow('Method sendTemplate() must be implemented');
    });

    it('receive should throw error', async () => {
      await expect(provider.receive({})).rejects.toThrow('Method receive() must be implemented');
    });

    it('verify should throw error', () => {
      expect(() => provider.verify({}, 'secret')).toThrow('Method verify() must be implemented');
    });

    it('handleChallenge should throw error', () => {
      expect(() => provider.handleChallenge({}, 'token')).toThrow('Method handleChallenge() must be implemented');
    });

    it('processWebhook should throw error', async () => {
      await expect(provider.processWebhook({}, {}, {})).rejects.toThrow('Method processWebhook() must be implemented');
    });

    it('getMessageStatus should throw error', async () => {
      await expect(provider.getMessageStatus({}, 'messageId')).rejects.toThrow('Method getMessageStatus() must be implemented');
    });

    it('markAsRead should throw error', async () => {
      await expect(provider.markAsRead({}, 'messageId')).rejects.toThrow('Method markAsRead() must be implemented');
    });

    it('uploadMedia should throw error', async () => {
      await expect(provider.uploadMedia({}, Buffer.from(''), 'image/png')).rejects.toThrow('Method uploadMedia() must be implemented');
    });

    it('downloadMedia should throw error', async () => {
      await expect(provider.downloadMedia({}, 'mediaId')).rejects.toThrow('Method downloadMedia() must be implemented');
    });

    it('validateCredentials should throw error', async () => {
      await expect(provider.validateCredentials({})).rejects.toThrow('Method validateCredentials() must be implemented');
    });
  });

  describe('optional methods with default implementations', () => {
    let provider;

    beforeAll(() => {
      class TestProvider extends BaseProvider {
        constructor() {
          super();
        }
      }
      provider = new TestProvider();
    });

    it('sendTypingIndicator should return true by default', async () => {
      const result = await provider.sendTypingIndicator({}, 'to', true);
      expect(result).toBe(true);
    });

    it('getUserProfile should return null by default', async () => {
      const result = await provider.getUserProfile({}, 'userId');
      expect(result).toBeNull();
    });

    it('refreshToken should return null by default', async () => {
      const result = await provider.refreshToken({});
      expect(result).toBeNull();
    });
  });

  describe('getCapabilities', () => {
    let provider;

    beforeAll(() => {
      class TestProvider extends BaseProvider {
        constructor() {
          super();
        }
      }
      provider = new TestProvider();
    });

    it('should return default capabilities', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities.textMessages).toBe(true);
      expect(capabilities.mediaMessages).toBe(false);
      expect(capabilities.templates).toBe(false);
      expect(capabilities.reactions).toBe(false);
      expect(capabilities.replies).toBe(false);
      expect(capabilities.typing).toBe(false);
      expect(capabilities.readReceipts).toBe(false);
      expect(capabilities.locationMessages).toBe(false);
      expect(capabilities.contactMessages).toBe(false);
      expect(capabilities.interactiveMessages).toBe(false);
    });
  });

  describe('formatPhoneNumber', () => {
    let provider;

    beforeAll(() => {
      class TestProvider extends BaseProvider {
        constructor() {
          super();
        }
      }
      provider = new TestProvider();
    });

    it('should add + prefix if missing', () => {
      const result = provider.formatPhoneNumber('1234567890');
      expect(result).toBe('+1234567890');
    });

    it('should keep + prefix if present', () => {
      const result = provider.formatPhoneNumber('+1234567890');
      expect(result).toBe('+1234567890');
    });

    it('should remove non-numeric characters except +', () => {
      const result = provider.formatPhoneNumber('(123) 456-7890');
      expect(result).toBe('+1234567890');
    });

    it('should handle international format', () => {
      const result = provider.formatPhoneNumber('+1 (555) 123-4567');
      expect(result).toBe('+15551234567');
    });
  });

  describe('log', () => {
    let provider;
    let consoleSpy;

    beforeAll(() => {
      class TestProvider extends BaseProvider {
        constructor() {
          super();
          this.name = 'test';
        }
      }
      provider = new TestProvider();
    });

    beforeEach(() => {
      consoleSpy = {
        info: jest.spyOn(console, 'info').mockImplementation(),
        error: jest.spyOn(console, 'error').mockImplementation(),
        warn: jest.spyOn(console, 'warn').mockImplementation(),
        debug: jest.spyOn(console, 'debug').mockImplementation()
      };
    });

    afterEach(() => {
      Object.values(consoleSpy).forEach(spy => spy.mockRestore());
    });

    it('should log info messages', () => {
      provider.log('info', 'Test message', { data: 'test' });
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      provider.log('error', 'Error message', { error: 'test' });
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      provider.log('warn', 'Warning message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should log debug messages', () => {
      provider.log('debug', 'Debug message');
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should include provider name in log', () => {
      provider.log('info', 'Test');
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[test]'),
        expect.any(Object)
      );
    });
  });
});
