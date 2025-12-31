/**
 * Twilio Voice Service Tests
 * Tests for server/services/voice/TwilioService.js
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

// Mock Twilio SDK
const mockCalls = {
  create: jest.fn(),
  update: jest.fn()
};

const mockCall = jest.fn().mockReturnValue({
  fetch: jest.fn(),
  update: jest.fn()
});

const mockRecordings = {
  list: jest.fn()
};

const mockIncomingPhoneNumbers = {
  create: jest.fn(),
  remove: jest.fn()
};

const mockIncomingPhoneNumber = jest.fn().mockReturnValue({
  remove: jest.fn()
});

const mockAvailablePhoneNumbers = jest.fn().mockReturnValue({
  local: {
    list: jest.fn()
  }
});

const mockTwilioClient = jest.fn(() => ({
  calls: Object.assign(mockCalls, mockCall),
  recordings: mockRecordings,
  incomingPhoneNumbers: Object.assign(mockIncomingPhoneNumbers, mockIncomingPhoneNumber),
  availablePhoneNumbers: mockAvailablePhoneNumbers
}));

const mockVoiceResponse = jest.fn(function() {
  this.instructions = [];

  this.say = jest.fn((options, text) => {
    this.instructions.push({ type: 'say', options, text });
    return this;
  });

  this.gather = jest.fn((options) => {
    const gatherObj = {
      say: jest.fn((sayOptions, sayText) => {
        this.instructions.push({
          type: 'gather',
          options,
          say: { options: sayOptions, text: sayText }
        });
        return gatherObj;
      })
    };
    this.instructions.push({ type: 'gather', options });
    return gatherObj;
  });

  this.play = jest.fn((url) => {
    this.instructions.push({ type: 'play', url });
    return this;
  });

  this.hangup = jest.fn(() => {
    this.instructions.push({ type: 'hangup' });
    return this;
  });

  this.toString = jest.fn(() => '<Response>...</Response>');
});

const mockValidateRequest = jest.fn();

jest.mock('twilio', () => {
  const actualTwilio = mockTwilioClient;
  actualTwilio.twiml = {
    VoiceResponse: mockVoiceResponse
  };
  actualTwilio.validateRequest = mockValidateRequest;
  return actualTwilio;
});

const TwilioService = require('../../../services/voice/TwilioService');
const log = require('../../../utils/logger');

describe('TwilioService', () => {
  let twilioService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
    process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
  });

  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with env credentials', () => {
      twilioService = new TwilioService();

      expect(twilioService.accountSid).toBe('test_account_sid');
      expect(twilioService.authToken).toBe('test_auth_token');
      expect(twilioService.client).toBeDefined();
    });

    it('should initialize with config credentials', () => {
      twilioService = new TwilioService({
        accountSid: 'config_sid',
        authToken: 'config_token'
      });

      expect(twilioService.accountSid).toBe('config_sid');
      expect(twilioService.authToken).toBe('config_token');
    });

    it('should handle missing credentials gracefully', () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;

      twilioService = new TwilioService();

      expect(twilioService.client).toBeNull();
    });

    it('should log warning if Twilio SDK not available', () => {
      const originalRequire = require('twilio');
      jest.mock('twilio', () => {
        throw new Error('Module not found');
      });

      twilioService = new TwilioService();

      expect(log.warn).toHaveBeenCalledWith(
        'Twilio SDK not available',
        expect.any(Object)
      );
    });
  });

  describe('isConfigured()', () => {
    it('should return true when client is configured', () => {
      twilioService = new TwilioService();

      expect(twilioService.isConfigured()).toBe(true);
    });

    it('should return false when client is not configured', () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;

      twilioService = new TwilioService();

      expect(twilioService.isConfigured()).toBe(false);
    });
  });

  describe('makeCall()', () => {
    beforeEach(() => {
      twilioService = new TwilioService();
    });

    it('should make outbound call successfully', async () => {
      const mockCallResponse = {
        sid: 'call_123',
        status: 'queued',
        direction: 'outbound-api',
        from: '+1234567890',
        to: '+0987654321'
      };

      mockCalls.create.mockResolvedValueOnce(mockCallResponse);

      const result = await twilioService.makeCall(
        '+1234567890',
        '+0987654321',
        'https://example.com/twiml'
      );

      expect(result.success).toBe(true);
      expect(result.call.sid).toBe('call_123');
      expect(result.call.status).toBe('queued');
      expect(mockCalls.create).toHaveBeenCalledWith({
        from: '+1234567890',
        to: '+0987654321',
        url: 'https://example.com/twiml',
        method: 'POST',
        statusCallback: 'https://example.com/twiml/status',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: false,
        timeout: 30,
        machineDetection: 'Enable'
      });
    });

    it('should make call with custom options', async () => {
      const mockCallResponse = {
        sid: 'call_123',
        status: 'queued',
        direction: 'outbound-api',
        from: '+1234567890',
        to: '+0987654321'
      };

      mockCalls.create.mockResolvedValueOnce(mockCallResponse);

      await twilioService.makeCall(
        '+1234567890',
        '+0987654321',
        'https://example.com/twiml',
        {
          record: true,
          timeout: 60,
          machineDetection: 'DetectMessageEnd'
        }
      );

      expect(mockCalls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          record: true,
          timeout: 60,
          machineDetection: 'DetectMessageEnd'
        })
      );
    });

    it('should return error when Twilio not configured', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      twilioService = new TwilioService();

      const result = await twilioService.makeCall(
        '+1234567890',
        '+0987654321',
        'https://example.com/twiml'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Twilio not configured');
    });

    it('should handle call creation errors', async () => {
      mockCalls.create.mockRejectedValueOnce(new Error('Invalid phone number'));

      const result = await twilioService.makeCall(
        '+1234567890',
        'invalid',
        'https://example.com/twiml'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number');
      expect(log.error).toHaveBeenCalledWith(
        'Error making call',
        expect.any(Object)
      );
    });
  });

  describe('endCall()', () => {
    beforeEach(() => {
      twilioService = new TwilioService();
    });

    it('should end call successfully', async () => {
      const mockCallInstance = {
        update: jest.fn().mockResolvedValueOnce({ status: 'completed' })
      };

      mockCall.mockReturnValueOnce(mockCallInstance);

      const result = await twilioService.endCall('call_123');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(mockCallInstance.update).toHaveBeenCalledWith({ status: 'completed' });
    });

    it('should return error when Twilio not configured', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      twilioService = new TwilioService();

      const result = await twilioService.endCall('call_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Twilio not configured');
    });

    it('should handle end call errors', async () => {
      const mockCallInstance = {
        update: jest.fn().mockRejectedValueOnce(new Error('Call not found'))
      };

      mockCall.mockReturnValueOnce(mockCallInstance);

      const result = await twilioService.endCall('invalid_call');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Call not found');
      expect(log.error).toHaveBeenCalledWith(
        'Error ending call',
        expect.any(Object)
      );
    });
  });

  describe('getCall()', () => {
    beforeEach(() => {
      twilioService = new TwilioService();
    });

    it('should get call details successfully', async () => {
      const mockCallData = {
        sid: 'call_123',
        status: 'completed',
        direction: 'outbound-api',
        from: '+1234567890',
        to: '+0987654321',
        duration: '120',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:02:00Z')
      };

      const mockCallInstance = {
        fetch: jest.fn().mockResolvedValueOnce(mockCallData)
      };

      mockCall.mockReturnValueOnce(mockCallInstance);

      const result = await twilioService.getCall('call_123');

      expect(result.success).toBe(true);
      expect(result.call.sid).toBe('call_123');
      expect(result.call.duration).toBe('120');
    });

    it('should handle get call errors', async () => {
      const mockCallInstance = {
        fetch: jest.fn().mockRejectedValueOnce(new Error('Call not found'))
      };

      mockCall.mockReturnValueOnce(mockCallInstance);

      const result = await twilioService.getCall('invalid_call');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Call not found');
    });
  });

  describe('searchAvailableNumbers()', () => {
    beforeEach(() => {
      twilioService = new TwilioService();
    });

    it('should search available numbers successfully', async () => {
      const mockNumbers = [
        {
          phoneNumber: '+1234567890',
          friendlyName: '(123) 456-7890',
          locality: 'New York',
          region: 'NY',
          capabilities: { voice: true, sms: true }
        }
      ];

      mockAvailablePhoneNumbers.mockReturnValueOnce({
        local: {
          list: jest.fn().mockResolvedValueOnce(mockNumbers)
        }
      });

      const result = await twilioService.searchAvailableNumbers('US');

      expect(result.success).toBe(true);
      expect(result.numbers).toHaveLength(1);
      expect(result.numbers[0].phoneNumber).toBe('+1234567890');
    });

    it('should search with custom options', async () => {
      const mockList = jest.fn().mockResolvedValueOnce([]);

      mockAvailablePhoneNumbers.mockReturnValueOnce({
        local: { list: mockList }
      });

      await twilioService.searchAvailableNumbers('US', {
        areaCode: '212',
        contains: '555',
        limit: 10
      });

      expect(mockList).toHaveBeenCalledWith({
        voiceEnabled: true,
        limit: 10,
        areaCode: '212',
        contains: '555'
      });
    });

    it('should handle search errors', async () => {
      mockAvailablePhoneNumbers.mockReturnValueOnce({
        local: {
          list: jest.fn().mockRejectedValueOnce(new Error('Invalid country code'))
        }
      });

      const result = await twilioService.searchAvailableNumbers('XX');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid country code');
    });
  });

  describe('purchaseNumber()', () => {
    beforeEach(() => {
      twilioService = new TwilioService();
    });

    it('should purchase number successfully', async () => {
      const mockNumberData = {
        sid: 'phone_123',
        phoneNumber: '+1234567890',
        friendlyName: '(123) 456-7890',
        capabilities: { voice: true, sms: true }
      };

      mockIncomingPhoneNumbers.create.mockResolvedValueOnce(mockNumberData);

      const result = await twilioService.purchaseNumber(
        '+1234567890',
        'https://example.com/webhook'
      );

      expect(result.success).toBe(true);
      expect(result.number.sid).toBe('phone_123');
      expect(mockIncomingPhoneNumbers.create).toHaveBeenCalledWith({
        phoneNumber: '+1234567890',
        voiceUrl: 'https://example.com/webhook',
        voiceMethod: 'POST',
        statusCallback: 'https://example.com/webhook/status',
        statusCallbackMethod: 'POST'
      });
    });

    it('should handle purchase errors', async () => {
      mockIncomingPhoneNumbers.create.mockRejectedValueOnce(
        new Error('Number not available')
      );

      const result = await twilioService.purchaseNumber(
        '+1234567890',
        'https://example.com/webhook'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Number not available');
    });
  });

  describe('releaseNumber()', () => {
    beforeEach(() => {
      twilioService = new TwilioService();
    });

    it('should release number successfully', async () => {
      const mockPhoneInstance = {
        remove: jest.fn().mockResolvedValueOnce(true)
      };

      mockIncomingPhoneNumber.mockReturnValueOnce(mockPhoneInstance);

      const result = await twilioService.releaseNumber('phone_123');

      expect(result.success).toBe(true);
      expect(mockPhoneInstance.remove).toHaveBeenCalled();
    });

    it('should handle release errors', async () => {
      const mockPhoneInstance = {
        remove: jest.fn().mockRejectedValueOnce(new Error('Number not found'))
      };

      mockIncomingPhoneNumber.mockReturnValueOnce(mockPhoneInstance);

      const result = await twilioService.releaseNumber('invalid_phone');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Number not found');
    });
  });

  describe('getRecording()', () => {
    beforeEach(() => {
      twilioService = new TwilioService();
    });

    it('should get recording successfully', async () => {
      const mockRecordings = [
        {
          sid: 'rec_123',
          duration: '120',
          uri: '/2010-04-01/Accounts/AC123/Recordings/rec_123.json'
        }
      ];

      mockRecordings.list.mockResolvedValueOnce(mockRecordings);

      const result = await twilioService.getRecording('call_123');

      expect(result.success).toBe(true);
      expect(result.recording.sid).toBe('rec_123');
      expect(result.recording.url).toContain('.mp3');
    });

    it('should handle no recording found', async () => {
      mockRecordings.list.mockResolvedValueOnce([]);

      const result = await twilioService.getRecording('call_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No recording found');
    });

    it('should handle recording errors', async () => {
      mockRecordings.list.mockRejectedValueOnce(new Error('API error'));

      const result = await twilioService.getRecording('call_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });

  describe('generateTwiML()', () => {
    beforeEach(() => {
      twilioService = new TwilioService();
      mockVoiceResponse.mockClear();
    });

    it('should generate TwiML with say instruction', () => {
      const twiml = twilioService.generateTwiML({
        say: 'Hello, world!'
      });

      expect(twiml).toBe('<Response>...</Response>');
      expect(mockVoiceResponse).toHaveBeenCalled();
    });

    it('should generate TwiML with custom voice and language', () => {
      twilioService.generateTwiML({
        say: 'Bonjour',
        voice: 'Polly.Mathieu',
        language: 'fr-FR'
      });

      const instance = mockVoiceResponse.mock.results[0].value;
      expect(instance.say).toHaveBeenCalledWith(
        {
          voice: 'Polly.Mathieu',
          language: 'fr-FR'
        },
        'Bonjour'
      );
    });

    it('should generate TwiML with gather instruction', () => {
      twilioService.generateTwiML({
        gather: {
          action: 'https://example.com/gather',
          say: 'Please say something',
          input: 'speech',
          language: 'en-US'
        }
      });

      const instance = mockVoiceResponse.mock.results[0].value;
      expect(instance.gather).toHaveBeenCalled();
    });

    it('should generate TwiML with play instruction', () => {
      twilioService.generateTwiML({
        play: 'https://example.com/audio.mp3'
      });

      const instance = mockVoiceResponse.mock.results[0].value;
      expect(instance.play).toHaveBeenCalledWith('https://example.com/audio.mp3');
    });

    it('should generate TwiML with hangup instruction', () => {
      twilioService.generateTwiML({
        hangup: true
      });

      const instance = mockVoiceResponse.mock.results[0].value;
      expect(instance.hangup).toHaveBeenCalled();
    });

    it('should generate TwiML with multiple instructions', () => {
      twilioService.generateTwiML({
        say: 'Goodbye',
        hangup: true
      });

      const instance = mockVoiceResponse.mock.results[0].value;
      expect(instance.say).toHaveBeenCalled();
      expect(instance.hangup).toHaveBeenCalled();
    });
  });

  describe('validateWebhook()', () => {
    beforeEach(() => {
      twilioService = new TwilioService();
    });

    it('should validate webhook signature successfully', () => {
      mockValidateRequest.mockReturnValueOnce(true);

      const result = twilioService.validateWebhook(
        'valid_signature',
        'https://example.com/webhook',
        { param1: 'value1' }
      );

      expect(result).toBe(true);
      expect(mockValidateRequest).toHaveBeenCalledWith(
        'test_auth_token',
        'valid_signature',
        'https://example.com/webhook',
        { param1: 'value1' }
      );
    });

    it('should reject invalid webhook signature', () => {
      mockValidateRequest.mockReturnValueOnce(false);

      const result = twilioService.validateWebhook(
        'invalid_signature',
        'https://example.com/webhook',
        { param1: 'value1' }
      );

      expect(result).toBe(false);
    });

    it('should handle validation errors', () => {
      mockValidateRequest.mockImplementationOnce(() => {
        throw new Error('Validation error');
      });

      const result = twilioService.validateWebhook(
        'signature',
        'https://example.com/webhook',
        {}
      );

      expect(result).toBe(false);
      expect(log.error).toHaveBeenCalledWith(
        'Error validating webhook',
        expect.any(Object)
      );
    });
  });
});
