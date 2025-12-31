/**
 * Recording Service Tests
 * Tests for the call recording service
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../services/voice/VoiceStorage', () => ({
  store: jest.fn(),
  retrieve: jest.fn(),
  delete: jest.fn()
}));

jest.mock('../../services/voice/SpeechToText', () => ({
  transcribe: jest.fn()
}));

jest.mock('../../services/voice/FormatConverter', () => ({
  convert: jest.fn()
}));

// Require fresh instance for each test
let RecordingService;
const VoiceStorage = require('../../services/voice/VoiceStorage');
const SpeechToText = require('../../services/voice/SpeechToText');
const FormatConverter = require('../../services/voice/FormatConverter');

describe('RecordingService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    RecordingService = require('../../services/voice/RecordingService');
    // Clear internal state
    RecordingService.activeRecordings = new Map();
    RecordingService.recordingMetadata = new Map();
  });

  describe('startRecording', () => {
    it('should start a new recording session', () => {
      const result = RecordingService.startRecording('call-123', {
        organizationId: 'org-1',
        botId: 'bot-1',
        format: 'wav'
      });

      expect(result.recordingId).toBeDefined();
      expect(result.callId).toBe('call-123');
      expect(result.status).toBe('recording');
      expect(RecordingService.activeRecordings.size).toBe(1);
    });

    it('should use default options', () => {
      const result = RecordingService.startRecording('call-123');

      expect(result.recordingId).toContain('rec_');
      expect(result.status).toBe('recording');
    });
  });

  describe('addChunk', () => {
    it('should add audio chunk to recording', () => {
      const { recordingId } = RecordingService.startRecording('call-123');
      const chunk = Buffer.from('audio data');

      RecordingService.addChunk(recordingId, chunk, 'inbound');

      const session = RecordingService.activeRecordings.get(recordingId);
      expect(session.chunks).toHaveLength(1);
      expect(session.totalBytes).toBe(chunk.length);
    });

    it('should throw error for non-existent recording', () => {
      expect(() => {
        RecordingService.addChunk('non-existent', Buffer.from('data'));
      }).toThrow('Recording not found');
    });

    it('should throw error for inactive recording', () => {
      const { recordingId } = RecordingService.startRecording('call-123');
      RecordingService.pauseRecording(recordingId);

      expect(() => {
        RecordingService.addChunk(recordingId, Buffer.from('data'));
      }).toThrow('Recording is not active');
    });
  });

  describe('stopRecording', () => {
    it('should stop and save recording', async () => {
      VoiceStorage.store.mockResolvedValue({
        success: true,
        filename: 'org-1/123_abc.wav',
        url: '/api/voice/files/...',
        size: 1000
      });

      const { recordingId } = RecordingService.startRecording('call-123', {
        organizationId: 'org-1'
      });

      RecordingService.addChunk(recordingId, Buffer.from('audio data'));

      const result = await RecordingService.stopRecording(recordingId);

      expect(result.status).toBe('completed');
      expect(result.filename).toBeDefined();
      expect(VoiceStorage.store).toHaveBeenCalled();
      expect(RecordingService.activeRecordings.has(recordingId)).toBe(false);
    });

    it('should auto-transcribe if requested', async () => {
      VoiceStorage.store.mockResolvedValue({
        success: true,
        filename: 'test.wav',
        size: 1000
      });

      VoiceStorage.retrieve.mockResolvedValue({
        buffer: Buffer.from('audio'),
        contentType: 'audio/wav'
      });

      SpeechToText.transcribe.mockResolvedValue({
        text: 'Hello world'
      });

      const { recordingId } = RecordingService.startRecording('call-123');
      RecordingService.addChunk(recordingId, Buffer.from('audio'));

      const result = await RecordingService.stopRecording(recordingId, {
        autoTranscribe: true
      });

      expect(result.transcription).toBeDefined();
    });

    it('should convert format if requested', async () => {
      VoiceStorage.store.mockResolvedValue({
        success: true,
        filename: 'test.mp3',
        size: 500
      });

      FormatConverter.convert.mockResolvedValue(Buffer.from('converted'));

      const { recordingId } = RecordingService.startRecording('call-123', {
        format: 'wav'
      });
      RecordingService.addChunk(recordingId, Buffer.from('audio'));

      await RecordingService.stopRecording(recordingId, {
        outputFormat: 'mp3'
      });

      expect(FormatConverter.convert).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          inputFormat: 'wav',
          outputFormat: 'mp3'
        })
      );
    });
  });

  describe('pauseRecording', () => {
    it('should pause active recording', () => {
      const { recordingId } = RecordingService.startRecording('call-123');

      RecordingService.pauseRecording(recordingId);

      const session = RecordingService.activeRecordings.get(recordingId);
      expect(session.status).toBe('paused');
    });
  });

  describe('resumeRecording', () => {
    it('should resume paused recording', () => {
      const { recordingId } = RecordingService.startRecording('call-123');
      RecordingService.pauseRecording(recordingId);

      RecordingService.resumeRecording(recordingId);

      const session = RecordingService.activeRecordings.get(recordingId);
      expect(session.status).toBe('recording');
    });
  });

  describe('cancelRecording', () => {
    it('should cancel and discard recording', () => {
      const { recordingId } = RecordingService.startRecording('call-123');

      RecordingService.cancelRecording(recordingId);

      expect(RecordingService.activeRecordings.has(recordingId)).toBe(false);
    });
  });

  describe('getRecording', () => {
    it('should return recording metadata', async () => {
      VoiceStorage.store.mockResolvedValue({
        success: true,
        filename: 'test.wav',
        url: '/test',
        size: 1000
      });

      const { recordingId } = RecordingService.startRecording('call-123');
      RecordingService.addChunk(recordingId, Buffer.from('audio'));
      await RecordingService.stopRecording(recordingId);

      const result = await RecordingService.getRecording(recordingId);

      expect(result.recordingId).toBe(recordingId);
      expect(result.status).toBe('completed');
    });

    it('should return active recording info', async () => {
      const { recordingId } = RecordingService.startRecording('call-123');

      const result = await RecordingService.getRecording(recordingId);

      expect(result.recordingId).toBe(recordingId);
      expect(result.status).toBe('recording');
    });

    it('should return null for non-existent recording', async () => {
      const result = await RecordingService.getRecording('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('transcribeRecording', () => {
    it('should transcribe recording', async () => {
      VoiceStorage.store.mockResolvedValue({
        success: true,
        filename: 'test.wav',
        size: 1000
      });

      VoiceStorage.retrieve.mockResolvedValue({
        buffer: Buffer.from('audio'),
        contentType: 'audio/wav'
      });

      SpeechToText.transcribe.mockResolvedValue({
        text: 'Hello, this is a test',
        segments: []
      });

      const { recordingId } = RecordingService.startRecording('call-123');
      RecordingService.addChunk(recordingId, Buffer.from('audio'));
      await RecordingService.stopRecording(recordingId);

      const result = await RecordingService.transcribeRecording(recordingId, {
        language: 'en'
      });

      expect(result.text).toBe('Hello, this is a test');
      expect(SpeechToText.transcribe).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ language: 'en' })
      );
    });
  });

  describe('deleteRecording', () => {
    it('should delete recording', async () => {
      VoiceStorage.store.mockResolvedValue({
        success: true,
        filename: 'test.wav',
        size: 1000
      });

      VoiceStorage.delete.mockResolvedValue(true);

      const { recordingId } = RecordingService.startRecording('call-123');
      RecordingService.addChunk(recordingId, Buffer.from('audio'));
      await RecordingService.stopRecording(recordingId);

      const result = await RecordingService.deleteRecording(recordingId);

      expect(result).toBe(true);
      expect(VoiceStorage.delete).toHaveBeenCalled();
    });
  });

  describe('listRecordings', () => {
    it('should list recordings with filters', async () => {
      VoiceStorage.store.mockResolvedValue({
        success: true,
        filename: 'test.wav',
        size: 1000
      });

      // Create some recordings
      for (let i = 0; i < 3; i++) {
        const { recordingId } = RecordingService.startRecording(`call-${i}`, {
          organizationId: 'org-1',
          botId: i < 2 ? 'bot-1' : 'bot-2'
        });
        RecordingService.addChunk(recordingId, Buffer.from('audio'));
        await RecordingService.stopRecording(recordingId);
      }

      const result = await RecordingService.listRecordings({
        botId: 'bot-1',
        limit: 10
      });

      expect(result.recordings).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should paginate results', async () => {
      VoiceStorage.store.mockResolvedValue({
        success: true,
        filename: 'test.wav',
        size: 1000
      });

      for (let i = 0; i < 5; i++) {
        const { recordingId } = RecordingService.startRecording(`call-${i}`);
        RecordingService.addChunk(recordingId, Buffer.from('audio'));
        await RecordingService.stopRecording(recordingId);
      }

      const result = await RecordingService.listRecordings({
        limit: 2,
        offset: 2
      });

      expect(result.recordings).toHaveLength(2);
      expect(result.total).toBe(5);
    });
  });

  describe('getRecordingStats', () => {
    it('should return recording statistics', async () => {
      VoiceStorage.store.mockResolvedValue({
        success: true,
        filename: 'test.wav',
        size: 1000
      });

      for (let i = 0; i < 3; i++) {
        const { recordingId } = RecordingService.startRecording(`call-${i}`, {
          organizationId: 'org-1'
        });
        RecordingService.addChunk(recordingId, Buffer.from('a'.repeat(100)));
        await RecordingService.stopRecording(recordingId);
      }

      const stats = await RecordingService.getRecordingStats({
        organizationId: 'org-1'
      });

      expect(stats.totalRecordings).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('exportRecording', () => {
    it('should export as JSON', async () => {
      VoiceStorage.store.mockResolvedValue({
        success: true,
        filename: 'test.wav',
        size: 1000
      });

      const { recordingId } = RecordingService.startRecording('call-123');
      RecordingService.addChunk(recordingId, Buffer.from('audio'));
      await RecordingService.stopRecording(recordingId);

      const exported = await RecordingService.exportRecording(recordingId, 'json');

      expect(exported.contentType).toBe('application/json');
      expect(exported.filename).toContain('.json');
      expect(JSON.parse(exported.data).recordingId).toBe(recordingId);
    });

    it('should export as TXT', async () => {
      VoiceStorage.store.mockResolvedValue({
        success: true,
        filename: 'test.wav',
        size: 1000
      });

      const { recordingId } = RecordingService.startRecording('call-123');
      RecordingService.addChunk(recordingId, Buffer.from('audio'));
      await RecordingService.stopRecording(recordingId);

      const exported = await RecordingService.exportRecording(recordingId, 'txt');

      expect(exported.contentType).toBe('text/plain');
      expect(exported.data).toContain('Recording:');
    });
  });

  describe('getActiveRecordings', () => {
    it('should return all active recordings', () => {
      RecordingService.startRecording('call-1');
      RecordingService.startRecording('call-2');
      RecordingService.startRecording('call-3');

      const active = RecordingService.getActiveRecordings();

      expect(active).toHaveLength(3);
      expect(active[0]).toHaveProperty('recordingId');
      expect(active[0]).toHaveProperty('status');
    });
  });

  describe('getActiveRecordingsCount', () => {
    it('should return count of active recordings', () => {
      RecordingService.startRecording('call-1');
      RecordingService.startRecording('call-2');

      expect(RecordingService.getActiveRecordingsCount()).toBe(2);
    });
  });
});
