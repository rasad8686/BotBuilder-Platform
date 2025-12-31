import { voiceService } from '../../src/services/voiceService';
import api from '../../src/services/api';

jest.mock('../../src/services/api');

const mockApi = api as jest.Mocked<typeof api>;

describe('VoiceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getVoiceBots', () => {
    it('should fetch voice bots successfully', async () => {
      const mockBots = {
        data: [
          {
            id: '1',
            name: 'Support Bot',
            status: 'active',
            phoneNumber: '+1234567890',
            callCount: 100,
            avgDuration: 120,
          },
        ],
        total: 1,
      };

      mockApi.get.mockResolvedValueOnce({ data: mockBots });

      const result = await voiceService.getVoiceBots();

      expect(mockApi.get).toHaveBeenCalledWith('/voice/bots', { params: undefined });
      expect(result).toEqual(mockBots);
    });

    it('should pass filter parameters', async () => {
      const params = { status: 'active', page: 1, limit: 10 };
      mockApi.get.mockResolvedValueOnce({ data: { data: [], total: 0 } });

      await voiceService.getVoiceBots(params);

      expect(mockApi.get).toHaveBeenCalledWith('/voice/bots', { params });
    });
  });

  describe('startTestCall', () => {
    it('should start a test call successfully', async () => {
      const mockCall = { callId: 'call123', status: 'connecting' };
      mockApi.post.mockResolvedValueOnce({ data: mockCall });

      const result = await voiceService.startTestCall('bot123');

      expect(mockApi.post).toHaveBeenCalledWith('/voice/bots/bot123/test-call');
      expect(result).toEqual(mockCall);
    });
  });

  describe('endCall', () => {
    it('should end a call successfully', async () => {
      mockApi.post.mockResolvedValueOnce({ data: { status: 'ended' } });

      const result = await voiceService.endCall('call123');

      expect(mockApi.post).toHaveBeenCalledWith('/voice/calls/call123/end');
      expect(result.status).toBe('ended');
    });
  });

  describe('setMute', () => {
    it('should set mute status successfully', async () => {
      mockApi.post.mockResolvedValueOnce({ data: { muted: true } });

      const result = await voiceService.setMute('call123', true);

      expect(mockApi.post).toHaveBeenCalledWith('/voice/calls/call123/mute', { muted: true });
      expect(result.muted).toBe(true);
    });
  });

  describe('sendDTMF', () => {
    it('should send DTMF tone successfully', async () => {
      mockApi.post.mockResolvedValueOnce({ data: { success: true } });

      const result = await voiceService.sendDTMF('call123', '5');

      expect(mockApi.post).toHaveBeenCalledWith('/voice/calls/call123/dtmf', { digit: '5' });
      expect(result.success).toBe(true);
    });
  });

  describe('getRecordings', () => {
    it('should fetch recordings for a bot', async () => {
      const mockRecordings = {
        data: [
          { id: 'rec1', duration: 60, createdAt: '2024-01-01' },
        ],
        total: 1,
      };
      mockApi.get.mockResolvedValueOnce({ data: mockRecordings });

      const result = await voiceService.getRecordings('bot123');

      expect(mockApi.get).toHaveBeenCalledWith('/voice/bots/bot123/recordings', { params: undefined });
      expect(result).toEqual(mockRecordings);
    });
  });

  describe('transcribeRecording', () => {
    it('should transcribe a recording successfully', async () => {
      const mockTranscript = { text: 'Hello, how can I help you?' };
      mockApi.post.mockResolvedValueOnce({ data: mockTranscript });

      const result = await voiceService.transcribeRecording('rec123');

      expect(mockApi.post).toHaveBeenCalledWith('/voice/recordings/rec123/transcribe');
      expect(result.text).toBe('Hello, how can I help you?');
    });
  });

  describe('getPhoneNumbers', () => {
    it('should fetch available phone numbers', async () => {
      const mockNumbers = {
        data: [
          { number: '+1234567890', country: 'US', type: 'local' },
        ],
      };
      mockApi.get.mockResolvedValueOnce({ data: mockNumbers });

      const result = await voiceService.getPhoneNumbers();

      expect(mockApi.get).toHaveBeenCalledWith('/voice/phone-numbers');
      expect(result).toEqual(mockNumbers);
    });
  });

  describe('purchaseNumber', () => {
    it('should purchase a phone number successfully', async () => {
      const mockResult = { number: '+1234567890', status: 'active' };
      mockApi.post.mockResolvedValueOnce({ data: mockResult });

      const result = await voiceService.purchaseNumber('+1234567890');

      expect(mockApi.post).toHaveBeenCalledWith('/voice/phone-numbers/purchase', { number: '+1234567890' });
      expect(result.status).toBe('active');
    });
  });

  describe('transferCall', () => {
    it('should transfer a call successfully', async () => {
      mockApi.post.mockResolvedValueOnce({ data: { status: 'transferred' } });

      const result = await voiceService.transferCall('call123', '+0987654321');

      expect(mockApi.post).toHaveBeenCalledWith('/voice/calls/call123/transfer', { toNumber: '+0987654321' });
      expect(result.status).toBe('transferred');
    });
  });
});
