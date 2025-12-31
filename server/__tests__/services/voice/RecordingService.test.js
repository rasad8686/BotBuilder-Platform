/**
 * Recording Service Tests
 * Tests for call recording management
 */

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

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const recordingService = require('../../services/voice/RecordingService');
const VoiceStorage = require('../../services/voice/VoiceStorage');
const SpeechToText = require('../../services/voice/SpeechToText');
const FormatConverter = require('../../services/voice/FormatConverter');

describe('RecordingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear internal state
    recordingService.activeRecordings.clear();
    recordingService.recordingMetadata.clear();
  });

  describe('startRecording', () => {
    it('should start a new recording session', () => {
      const result = recordingService.startRecording('call-123', {
        organizationId: 'org-1',
        botId: 'bot-1',
        userId: 'user-1'
      });

      expect(result.recordingId).toBeDefined();
      expect(result.callId).toBe('call-123');
      expect(result.status).toBe('recording');
      expect(recordingService.activeRecordings.size).toBe(1);
    });

    it('should use default options', () => {
      const result = recordingService.startRecording('call-456');

      expect(result.recordingId).toBeDefined();
      expect(result.status).toBe('recording');
    });
  });

  describe('addChunk', () => {
    it('should add audio chunk to recording', () => {
      const { recordingId } = recordingService.startRecording('call-123');
      const chunk = Buffer.from('audio data');

      recordingService.addChunk(recordingId, chunk);

      const session = recordingService.activeRecordings.get(recordingId);
      expect(session.chunks.length).toBe(1);
      expect(session.totalBytes).toBe(chunk.length);
    });

    it('should throw error for non-existent recording', () => {
      expect(() => {
        recordingService.addChunk('non-existent', Buffer.from('data'));
      }).toThrow('Recording not found');
    });

    it('should throw error for inactive recording', () => {
      const { recordingId } = recordingService.startRecording('call-123');
      recordingService.pauseRecording(recordingId);

      expect(() => {
        recordingService.addChunk(recordingId, Buffer.from('data'));
      }).toThrow('Recording is not active');
    });

    it('should track leg information', () => {
      const { recordingId } = recordingService.startRecording('call-123');
      const chunk = Buffer.from('audio data');

      recordingService.addChunk(recordingId, chunk, 'inbound');

      const session = recordingService.activeRecordings.get(recordingId);
      expect(session.chunks[0].leg).toBe('inbound');
    });
  });

  describe('stopRecording', () => {
    it('should stop and save recording', async () => {
      VoiceStorage.store.mockResolvedValue({
        filename: 'recording.wav',
        url: 'https://example.com/recording.wav',
        size: 1000
      });

      const { recordingId } = recordingService.startRecording('call-123', {
        organizationId: 'org-1'
      });
      recordingService.addChunk(recordingId, Buffer.from('audio data'));

      const result = await recordingService.stopRecording(recordingId);

      expect(result.status).toBe('completed');
      expect(result.filename).toBe('recording.wav');
      expect(result.duration).toBeDefined();
      expect(recordingService.activeRecordings.size).toBe(0);
    });

    it('should throw error for non-existent recording', async () => {
      await expect(recordingService.stopRecording('non-existent')).rejects.toThrow('Recording not found');
    });

    it('should convert format when requested', async () => {
      VoiceStorage.store.mockResolvedValue({
        filename: 'recording.mp3',
        url: 'https://example.com/recording.mp3',
        size: 500
      });
      FormatConverter.convert.mockResolvedValue(Buffer.from('converted'));

      const { recordingId } = recordingService.startRecording('call-123', { format: 'wav' });
      recordingService.addChunk(recordingId, Buffer.from('audio data'));

      await recordingService.stopRecording(recordingId, { outputFormat: 'mp3' });

      expect(FormatConverter.convert).toHaveBeenCalled();
    });

    it('should auto-transcribe when requested', async () => {
      VoiceStorage.store.mockResolvedValue({
        filename: 'recording.wav',
        url: 'https://example.com/recording.wav',
        size: 1000
      });
      VoiceStorage.retrieve.mockResolvedValue({ buffer: Buffer.from('audio') });
      SpeechToText.transcribe.mockResolvedValue({ text: 'Hello world' });

      const { recordingId } = recordingService.startRecording('call-123');
      recordingService.addChunk(recordingId, Buffer.from('audio data'));

      const result = await recordingService.stopRecording(recordingId, { autoTranscribe: true });

      expect(result.transcription).toBeDefined();
    });
  });

  describe('pauseRecording', () => {
    it('should pause active recording', () => {
      const { recordingId } = recordingService.startRecording('call-123');

      recordingService.pauseRecording(recordingId);

      const session = recordingService.activeRecordings.get(recordingId);
      expect(session.status).toBe('paused');
      expect(session.pausedAt).toBeDefined();
    });

    it('should throw error for non-existent recording', () => {
      expect(() => {
        recordingService.pauseRecording('non-existent');
      }).toThrow('Recording not found');
    });
  });

  describe('resumeRecording', () => {
    it('should resume paused recording', () => {
      const { recordingId } = recordingService.startRecording('call-123');
      recordingService.pauseRecording(recordingId);

      recordingService.resumeRecording(recordingId);

      const session = recordingService.activeRecordings.get(recordingId);
      expect(session.status).toBe('recording');
      expect(session.resumedAt).toBeDefined();
    });

    it('should throw error for non-existent recording', () => {
      expect(() => {
        recordingService.resumeRecording('non-existent');
      }).toThrow('Recording not found');
    });
  });

  describe('cancelRecording', () => {
    it('should cancel and remove recording', () => {
      const { recordingId } = recordingService.startRecording('call-123');

      recordingService.cancelRecording(recordingId);

      expect(recordingService.activeRecordings.has(recordingId)).toBe(false);
    });

    it('should handle non-existent recording gracefully', () => {
      expect(() => {
        recordingService.cancelRecording('non-existent');
      }).not.toThrow();
    });
  });

  describe('combineChunks', () => {
    it('should combine multiple chunks', () => {
      const chunks = [
        { data: Buffer.from('chunk1') },
        { data: Buffer.from('chunk2') },
        { data: Buffer.from('chunk3') }
      ];

      const combined = recordingService.combineChunks(chunks);

      expect(combined.toString()).toBe('chunk1chunk2chunk3');
    });
  });

  describe('getRecording', () => {
    it('should return recording from metadata', async () => {
      VoiceStorage.store.mockResolvedValue({
        filename: 'test.wav',
        url: 'https://example.com/test.wav',
        size: 1000
      });

      const { recordingId } = recordingService.startRecording('call-123');
      recordingService.addChunk(recordingId, Buffer.from('data'));
      await recordingService.stopRecording(recordingId);

      const result = await recordingService.getRecording(recordingId);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should return active recording info', async () => {
      const { recordingId } = recordingService.startRecording('call-123');

      const result = await recordingService.getRecording(recordingId);

      expect(result.status).toBe('recording');
    });

    it('should return null for non-existent recording', async () => {
      const result = await recordingService.getRecording('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('deleteRecording', () => {
    it('should delete recording', async () => {
      VoiceStorage.store.mockResolvedValue({
        filename: 'test.wav',
        url: 'https://example.com/test.wav',
        size: 1000
      });
      VoiceStorage.delete.mockResolvedValue(true);

      const { recordingId } = recordingService.startRecording('call-123');
      recordingService.addChunk(recordingId, Buffer.from('data'));
      await recordingService.stopRecording(recordingId);

      const result = await recordingService.deleteRecording(recordingId);

      expect(result).toBe(true);
      expect(VoiceStorage.delete).toHaveBeenCalled();
    });

    it('should throw error for non-existent recording', async () => {
      await expect(recordingService.deleteRecording('non-existent')).rejects.toThrow('Recording not found');
    });
  });

  describe('listRecordings', () => {
    beforeEach(async () => {
      VoiceStorage.store.mockResolvedValue({
        filename: 'test.wav',
        url: 'https://example.com/test.wav',
        size: 1000
      });

      // Create some recordings
      for (let i = 1; i <= 3; i++) {
        const { recordingId } = recordingService.startRecording(`call-${i}`, {
          organizationId: 'org-1',
          botId: `bot-${i % 2 + 1}`
        });
        recordingService.addChunk(recordingId, Buffer.from('data'));
        await recordingService.stopRecording(recordingId);
      }
    });

    it('should list all recordings', async () => {
      const result = await recordingService.listRecordings();

      expect(result.recordings.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it('should filter by organizationId', async () => {
      const result = await recordingService.listRecordings({ organizationId: 'org-1' });

      expect(result.recordings.length).toBe(3);
    });

    it('should filter by botId', async () => {
      const result = await recordingService.listRecordings({ botId: 'bot-1' });

      expect(result.recordings.length).toBeGreaterThan(0);
    });

    it('should apply pagination', async () => {
      const result = await recordingService.listRecordings({ limit: 2, offset: 0 });

      expect(result.recordings.length).toBe(2);
    });
  });

  describe('getRecordingStats', () => {
    it('should return statistics', async () => {
      VoiceStorage.store.mockResolvedValue({
        filename: 'test.wav',
        size: 1000
      });

      const { recordingId } = recordingService.startRecording('call-1', { organizationId: 'org-1' });
      recordingService.addChunk(recordingId, Buffer.from('data'));
      await recordingService.stopRecording(recordingId);

      const stats = await recordingService.getRecordingStats({ organizationId: 'org-1' });

      expect(stats.totalRecordings).toBeGreaterThan(0);
      expect(stats.totalDurationFormatted).toBeDefined();
      expect(stats.totalSizeFormatted).toBeDefined();
    });
  });

  describe('exportRecording', () => {
    beforeEach(async () => {
      VoiceStorage.store.mockResolvedValue({
        filename: 'test.wav',
        size: 1000
      });

      const { recordingId } = recordingService.startRecording('call-export');
      recordingService.addChunk(recordingId, Buffer.from('data'));
      await recordingService.stopRecording(recordingId);
    });

    it('should export as JSON', async () => {
      const recordings = Array.from(recordingService.recordingMetadata.keys());
      const recordingId = recordings[0];

      const result = await recordingService.exportRecording(recordingId, 'json');

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toContain('.json');
    });

    it('should export as text', async () => {
      const recordings = Array.from(recordingService.recordingMetadata.keys());
      const recordingId = recordings[0];

      const result = await recordingService.exportRecording(recordingId, 'txt');

      expect(result.contentType).toBe('text/plain');
    });

    it('should throw error for unsupported format', async () => {
      const recordings = Array.from(recordingService.recordingMetadata.keys());
      const recordingId = recordings[0];

      await expect(recordingService.exportRecording(recordingId, 'xyz')).rejects.toThrow('Unsupported export format');
    });

    it('should throw error for non-existent recording', async () => {
      await expect(recordingService.exportRecording('non-existent', 'json')).rejects.toThrow('Recording not found');
    });
  });

  describe('Format utilities', () => {
    describe('formatDuration', () => {
      it('should format seconds correctly', () => {
        expect(recordingService.formatDuration(0)).toBe('00:00:00');
        expect(recordingService.formatDuration(61)).toBe('00:01:01');
        expect(recordingService.formatDuration(3661)).toBe('01:01:01');
      });
    });

    describe('formatTimestamp', () => {
      it('should format timestamp correctly', () => {
        expect(recordingService.formatTimestamp(0)).toBe('0:00');
        expect(recordingService.formatTimestamp(65)).toBe('1:05');
      });
    });

    describe('formatSrtTimestamp', () => {
      it('should format SRT timestamp correctly', () => {
        expect(recordingService.formatSrtTimestamp(0)).toBe('00:00:00,000');
        expect(recordingService.formatSrtTimestamp(3661.5)).toBe('01:01:01,500');
      });
    });

    describe('formatVttTimestamp', () => {
      it('should format VTT timestamp correctly', () => {
        expect(recordingService.formatVttTimestamp(0)).toBe('00:00:00.000');
        expect(recordingService.formatVttTimestamp(3661.5)).toBe('01:01:01.500');
      });
    });

    describe('formatBytes', () => {
      it('should format bytes correctly', () => {
        expect(recordingService.formatBytes(0)).toBe('0 Bytes');
        expect(recordingService.formatBytes(1024)).toBe('1 KB');
        expect(recordingService.formatBytes(1048576)).toBe('1 MB');
      });
    });
  });

  describe('Active recordings', () => {
    it('should return active recordings count', () => {
      recordingService.startRecording('call-1');
      recordingService.startRecording('call-2');

      expect(recordingService.getActiveRecordingsCount()).toBe(2);
    });

    it('should return active recordings list', () => {
      recordingService.startRecording('call-1');
      recordingService.startRecording('call-2');

      const active = recordingService.getActiveRecordings();

      expect(active.length).toBe(2);
      expect(active[0].status).toBe('recording');
    });
  });
});
