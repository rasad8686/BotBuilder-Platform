import { cloneService } from '../../src/services/cloneService';
import api from '../../src/services/api';

jest.mock('../../src/services/api');

const mockApi = api as jest.Mocked<typeof api>;

describe('CloneService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getClones', () => {
    it('should fetch clones successfully', async () => {
      const mockClones = {
        data: [
          {
            id: '1',
            name: 'Test Clone',
            type: 'personality',
            status: 'ready',
            createdAt: '2024-01-01',
          },
        ],
        total: 1,
      };

      mockApi.get.mockResolvedValueOnce({ data: mockClones });

      const result = await cloneService.getClones();

      expect(mockApi.get).toHaveBeenCalledWith('/clones', { params: undefined });
      expect(result).toEqual(mockClones);
    });

    it('should filter clones by type', async () => {
      const params = { type: 'voice', status: 'ready' };
      mockApi.get.mockResolvedValueOnce({ data: { data: [], total: 0 } });

      await cloneService.getClones(params);

      expect(mockApi.get).toHaveBeenCalledWith('/clones', { params });
    });
  });

  describe('getClone', () => {
    it('should fetch a single clone', async () => {
      const mockClone = {
        id: '1',
        name: 'Test Clone',
        type: 'personality',
        status: 'ready',
      };

      mockApi.get.mockResolvedValueOnce({ data: mockClone });

      const result = await cloneService.getClone('1');

      expect(mockApi.get).toHaveBeenCalledWith('/clones/1');
      expect(result).toEqual(mockClone);
    });
  });

  describe('createClone', () => {
    it('should create a clone successfully', async () => {
      const cloneData = {
        name: 'New Clone',
        description: 'A test clone',
        type: 'personality' as const,
        config: {},
      };
      const mockClone = { id: '1', ...cloneData };

      mockApi.post.mockResolvedValueOnce({ data: mockClone });

      const result = await cloneService.createClone(cloneData);

      expect(mockApi.post).toHaveBeenCalledWith('/clones', cloneData);
      expect(result).toEqual(mockClone);
    });
  });

  describe('updateClone', () => {
    it('should update a clone successfully', async () => {
      const updateData = { name: 'Updated Clone' };
      const mockClone = { id: '1', name: 'Updated Clone' };

      mockApi.put.mockResolvedValueOnce({ data: mockClone });

      const result = await cloneService.updateClone('1', updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/clones/1', updateData);
      expect(result.name).toBe('Updated Clone');
    });
  });

  describe('deleteClone', () => {
    it('should delete a clone successfully', async () => {
      mockApi.delete.mockResolvedValueOnce({});

      await cloneService.deleteClone('1');

      expect(mockApi.delete).toHaveBeenCalledWith('/clones/1');
    });
  });

  describe('startTraining', () => {
    it('should start training successfully', async () => {
      mockApi.post.mockResolvedValueOnce({ data: { status: 'training' } });

      const result = await cloneService.startTraining('1');

      expect(mockApi.post).toHaveBeenCalledWith('/clones/1/train');
      expect(result.status).toBe('training');
    });
  });

  describe('getTrainingStatus', () => {
    it('should get training status', async () => {
      const mockStatus = { status: 'training', progress: 50, estimatedTime: 300 };
      mockApi.get.mockResolvedValueOnce({ data: mockStatus });

      const result = await cloneService.getTrainingStatus('1');

      expect(mockApi.get).toHaveBeenCalledWith('/clones/1/training-status');
      expect(result.progress).toBe(50);
    });
  });

  describe('cancelTraining', () => {
    it('should cancel training successfully', async () => {
      mockApi.post.mockResolvedValueOnce({});

      await cloneService.cancelTraining('1');

      expect(mockApi.post).toHaveBeenCalledWith('/clones/1/cancel-training');
    });
  });

  describe('testClone', () => {
    it('should test a clone with a message', async () => {
      const mockResponse = { message: 'Hello! How can I help you?' };
      mockApi.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await cloneService.testClone('1', 'Hello');

      expect(mockApi.post).toHaveBeenCalledWith('/clones/1/test', { message: 'Hello' });
      expect(result.message).toBe('Hello! How can I help you?');
    });
  });

  describe('previewVoice', () => {
    it('should preview voice clone', async () => {
      const mockResponse = { audioUrl: 'https://example.com/audio.mp3' };
      mockApi.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await cloneService.previewVoice('1', 'Test text');

      expect(mockApi.post).toHaveBeenCalledWith('/clones/1/preview-voice', { text: 'Test text' });
      expect(result.audioUrl).toContain('audio');
    });
  });

  describe('shareClone', () => {
    it('should share a clone', async () => {
      const shareOptions = { public: true, allowCopy: true };
      const mockResponse = { shareUrl: 'https://example.com/share/abc123' };
      mockApi.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await cloneService.shareClone('1', shareOptions);

      expect(mockApi.post).toHaveBeenCalledWith('/clones/1/share', shareOptions);
      expect(result.shareUrl).toContain('share');
    });
  });

  describe('getSharedClone', () => {
    it('should get a shared clone', async () => {
      const mockClone = { id: '1', name: 'Shared Clone' };
      mockApi.get.mockResolvedValueOnce({ data: mockClone });

      const result = await cloneService.getSharedClone('abc123');

      expect(mockApi.get).toHaveBeenCalledWith('/clones/shared/abc123');
      expect(result).toEqual(mockClone);
    });
  });

  describe('copySharedClone', () => {
    it('should copy a shared clone', async () => {
      const mockClone = { id: '2', name: 'My Copy' };
      mockApi.post.mockResolvedValueOnce({ data: mockClone });

      const result = await cloneService.copySharedClone('abc123', 'My Copy');

      expect(mockApi.post).toHaveBeenCalledWith('/clones/shared/abc123/copy', { name: 'My Copy' });
      expect(result.name).toBe('My Copy');
    });
  });

  describe('getCloneTemplates', () => {
    it('should get clone templates', async () => {
      const mockTemplates = { data: [{ id: '1', name: 'Template 1' }] };
      mockApi.get.mockResolvedValueOnce({ data: mockTemplates });

      const result = await cloneService.getCloneTemplates();

      expect(mockApi.get).toHaveBeenCalledWith('/clones/templates');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('createFromTemplate', () => {
    it('should create clone from template', async () => {
      const mockClone = { id: '2', name: 'From Template' };
      mockApi.post.mockResolvedValueOnce({ data: mockClone });

      const result = await cloneService.createFromTemplate('template1', 'From Template');

      expect(mockApi.post).toHaveBeenCalledWith('/clones/templates/template1/create', { name: 'From Template' });
      expect(result.name).toBe('From Template');
    });
  });

  describe('getCloneAnalytics', () => {
    it('should get clone analytics', async () => {
      const mockAnalytics = {
        conversations: 100,
        messages: 500,
        avgRating: 4.5,
        ratingTrend: [4.2, 4.3, 4.5],
        messageTrend: [100, 150, 250],
      };
      mockApi.get.mockResolvedValueOnce({ data: mockAnalytics });

      const result = await cloneService.getCloneAnalytics('1');

      expect(mockApi.get).toHaveBeenCalledWith('/clones/1/analytics', { params: undefined });
      expect(result.avgRating).toBe(4.5);
    });
  });

  describe('analyzePersonality', () => {
    it('should analyze personality from text', async () => {
      const mockResult = {
        traits: ['friendly', 'helpful'],
        tone: 'casual',
        formality: 0.3,
        suggestions: ['Be more concise'],
      };
      mockApi.post.mockResolvedValueOnce({ data: mockResult });

      const result = await cloneService.analyzePersonality('Sample text');

      expect(mockApi.post).toHaveBeenCalledWith('/clones/analyze-personality', { text: 'Sample text' });
      expect(result.traits).toContain('friendly');
    });
  });

  describe('getAvailableVoices', () => {
    it('should get available voices', async () => {
      const mockVoices = {
        voices: [
          { id: 'voice1', name: 'Sarah', language: 'en-US', gender: 'female' },
        ],
      };
      mockApi.get.mockResolvedValueOnce({ data: mockVoices });

      const result = await cloneService.getAvailableVoices();

      expect(mockApi.get).toHaveBeenCalledWith('/clones/voices', { params: { provider: undefined } });
      expect(result.voices).toHaveLength(1);
    });
  });

  describe('analyzeWritingStyle', () => {
    it('should analyze writing style', async () => {
      const mockResult = {
        style: 'conversational',
        vocabulary: 'simple',
        avgSentenceLength: 12,
        emoticons: true,
        suggestions: ['Add more variety'],
      };
      mockApi.post.mockResolvedValueOnce({ data: mockResult });

      const result = await cloneService.analyzeWritingStyle(['Sample 1', 'Sample 2']);

      expect(mockApi.post).toHaveBeenCalledWith('/clones/analyze-style', { samples: ['Sample 1', 'Sample 2'] });
      expect(result.style).toBe('conversational');
    });
  });
});
