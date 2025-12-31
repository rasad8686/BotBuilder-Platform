/**
 * Voice Recording Service Tests
 * Tests for server/services/voice/RecordingService.js
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

// Mock VoiceStorage
const mockVoiceStorage = {
  store: jest.fn(),
  retrieve: jest.fn(),
  delete: jest.fn()
};

jest.mock('../../../services/voice/VoiceStorage', () => mockVoiceStorage);

// Mock SpeechToText
const mockSpeechToText = {
  transcribe: jest.fn()
};

jest.mock('../../../services/voice/SpeechToText', () => mockSpeechToText);

// Mock FormatConverter
const mockFormatConverter = {
  convert: jest.fn()
};

jest.mock('../../../services/voice/FormatConverter', () => mockFormatConverter);

const RecordingService = require('../../../services/voice/RecordingService');
const log = require('../../../utils/logger');

describe('RecordingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear recording maps
    RecordingService.activeRecordings.clear();
    RecordingService.recordingMetadata.clear();
  });

  describe('startRecording()', () => {
    it('should start new recording session', () => {
      const result = RecordingService.startRecording('call_123', {
        organizationId: 1,
        botId: 5,
        userId: 10,
        format: 'wav',
        channels: 2,
        sampleRate: 16000
      });

      expect(result.recordingId).toBeDefined();
      expect(result.callId).toBe('call_123');
      expect(result.status).toBe('recording');
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(RecordingService.activeRecordings.has(result.recordingId)).toBe(true);
    });

    it('should use default options', () => {
      const result = RecordingService.startRecording('call_123', {
        organizationId: 1
      });

      const session = RecordingService.activeRecordings.get(result.recordingId);
      expect(session.format).toBe('wav');
      expect(session.channels).toBe(2);
      expect(session.sampleRate).toBe(16000);
      expect(session.recordBothLegs).toBe(true);
    });

    it('should generate unique recording IDs', () => {
      const result1 = RecordingService.startRecording('call_123', {});
      const result2 = RecordingService.startRecording('call_456', {});

      expect(result1.recordingId).not.toBe(result2.recordingId);
    });

    it('should log recording start', () => {
      const result = RecordingService.startRecording('call_123', {
        organizationId: 1
      });

      expect(log.info).toHaveBeenCalledWith(
        'Recording started',
        expect.objectContaining({
          recordingId: result.recordingId,
          callId: 'call_123'
        })
      );
    });
  });

  describe('addChunk()', () => {
    it('should add audio chunk to recording', () => {
      const result = RecordingService.startRecording('call_123', {});
      const chunk = Buffer.from('audio data');

      RecordingService.addChunk(result.recordingId, chunk);

      const session = RecordingService.activeRecordings.get(result.recordingId);
      expect(session.chunks).toHaveLength(1);
      expect(session.totalBytes).toBe(chunk.length);
    });

    it('should add multiple chunks', () => {
      const result = RecordingService.startRecording('call_123', {});
      const chunk1 = Buffer.from('audio data 1');
      const chunk2 = Buffer.from('audio data 2');

      RecordingService.addChunk(result.recordingId, chunk1);
      RecordingService.addChunk(result.recordingId, chunk2);

      const session = RecordingService.activeRecordings.get(result.recordingId);
      expect(session.chunks).toHaveLength(2);
      expect(session.totalBytes).toBe(chunk1.length + chunk2.length);
    });

    it('should support dual-channel recording with leg parameter', () => {
      const result = RecordingService.startRecording('call_123', {});

      RecordingService.addChunk(result.recordingId, Buffer.from('inbound'), 'inbound');
      RecordingService.addChunk(result.recordingId, Buffer.from('outbound'), 'outbound');

      const session = RecordingService.activeRecordings.get(result.recordingId);
      expect(session.chunks[0].leg).toBe('inbound');
      expect(session.chunks[1].leg).toBe('outbound');
    });

    it('should throw error for non-existent recording', () => {
      expect(() => {
        RecordingService.addChunk('invalid_id', Buffer.from('data'));
      }).toThrow('Recording not found: invalid_id');
    });

    it('should throw error if recording is not active', () => {
      const result = RecordingService.startRecording('call_123', {});
      const session = RecordingService.activeRecordings.get(result.recordingId);
      session.status = 'paused';

      expect(() => {
        RecordingService.addChunk(result.recordingId, Buffer.from('data'));
      }).toThrow('Recording is not active');
    });

    it('should add timestamp to each chunk', () => {
      const result = RecordingService.startRecording('call_123', {});
      const beforeTime = Date.now();

      RecordingService.addChunk(result.recordingId, Buffer.from('data'));

      const session = RecordingService.activeRecordings.get(result.recordingId);
      expect(session.chunks[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe('stopRecording()', () => {
    it('should stop and save recording successfully', async () => {
      mockVoiceStorage.store.mockResolvedValueOnce({
        filename: 'recording.wav',
        url: '/api/voice/files/recording.wav',
        size: 1024
      });

      const result = RecordingService.startRecording('call_123', {
        organizationId: 1,
        botId: 5,
        userId: 10
      });

      RecordingService.addChunk(result.recordingId, Buffer.from('audio data'));

      const metadata = await RecordingService.stopRecording(result.recordingId);

      expect(metadata.status).toBe('completed');
      expect(metadata.recordingId).toBe(result.recordingId);
      expect(metadata.filename).toBe('recording.wav');
      expect(metadata.duration).toBeGreaterThan(0);
      expect(RecordingService.activeRecordings.has(result.recordingId)).toBe(false);
      expect(RecordingService.recordingMetadata.has(result.recordingId)).toBe(true);
    });

    it('should combine all chunks into single buffer', async () => {
      mockVoiceStorage.store.mockResolvedValueOnce({
        filename: 'recording.wav',
        url: '/api/voice/files/recording.wav',
        size: 2048
      });

      const result = RecordingService.startRecording('call_123', {});

      RecordingService.addChunk(result.recordingId, Buffer.from('chunk1'));
      RecordingService.addChunk(result.recordingId, Buffer.from('chunk2'));
      RecordingService.addChunk(result.recordingId, Buffer.from('chunk3'));

      await RecordingService.stopRecording(result.recordingId);

      expect(mockVoiceStorage.store).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.any(Object)
      );
    });

    it('should convert format if outputFormat specified', async () => {
      mockFormatConverter.convert.mockResolvedValueOnce(Buffer.from('converted'));
      mockVoiceStorage.store.mockResolvedValueOnce({
        filename: 'recording.mp3',
        url: '/api/voice/files/recording.mp3',
        size: 512
      });

      const result = RecordingService.startRecording('call_123', {
        format: 'wav'
      });

      RecordingService.addChunk(result.recordingId, Buffer.from('audio'));

      await RecordingService.stopRecording(result.recordingId, {
        outputFormat: 'mp3'
      });

      expect(mockFormatConverter.convert).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          inputFormat: 'wav',
          outputFormat: 'mp3'
        })
      );
    });

    it('should auto-transcribe if requested', async () => {
      mockVoiceStorage.store.mockResolvedValueOnce({
        filename: 'recording.wav',
        url: '/api/voice/files/recording.wav',
        size: 1024
      });

      mockVoiceStorage.retrieve.mockResolvedValueOnce({
        buffer: Buffer.from('audio'),
        metadata: {}
      });

      mockSpeechToText.transcribe.mockResolvedValueOnce({
        success: true,
        text: 'Hello world',
        confidence: 0.95
      });

      const result = RecordingService.startRecording('call_123', {});
      RecordingService.addChunk(result.recordingId, Buffer.from('audio'));

      const metadata = await RecordingService.stopRecording(result.recordingId, {
        autoTranscribe: true
      });

      expect(metadata.transcription).toBeDefined();
      expect(metadata.transcription.text).toBe('Hello world');
    });

    it('should handle auto-transcription errors gracefully', async () => {
      mockVoiceStorage.store.mockResolvedValueOnce({
        filename: 'recording.wav',
        url: '/api/voice/files/recording.wav',
        size: 1024
      });

      mockVoiceStorage.retrieve.mockResolvedValueOnce({
        buffer: Buffer.from('audio'),
        metadata: {}
      });

      mockSpeechToText.transcribe.mockRejectedValueOnce(new Error('Transcription failed'));

      const result = RecordingService.startRecording('call_123', {});
      RecordingService.addChunk(result.recordingId, Buffer.from('audio'));

      const metadata = await RecordingService.stopRecording(result.recordingId, {
        autoTranscribe: true
      });

      expect(metadata.transcription).toBeUndefined();
      expect(log.error).toHaveBeenCalledWith(
        'Auto-transcription failed',
        expect.any(Object)
      );
    });

    it('should throw error for non-existent recording', async () => {
      await expect(
        RecordingService.stopRecording('invalid_id')
      ).rejects.toThrow('Recording not found: invalid_id');
    });

    it('should handle storage errors', async () => {
      mockVoiceStorage.store.mockRejectedValueOnce(new Error('Storage failed'));

      const result = RecordingService.startRecording('call_123', {});
      RecordingService.addChunk(result.recordingId, Buffer.from('audio'));

      await expect(
        RecordingService.stopRecording(result.recordingId)
      ).rejects.toThrow('Storage failed');

      const session = RecordingService.activeRecordings.get(result.recordingId);
      expect(session.status).toBe('failed');
      expect(session.error).toBe('Storage failed');
    });

    it('should store recording metadata', async () => {
      mockVoiceStorage.store.mockResolvedValueOnce({
        filename: 'recording.wav',
        url: '/api/voice/files/recording.wav',
        size: 1024
      });

      const result = RecordingService.startRecording('call_123', {
        organizationId: 1,
        botId: 5
      });

      RecordingService.addChunk(result.recordingId, Buffer.from('audio'));

      await RecordingService.stopRecording(result.recordingId);

      expect(mockVoiceStorage.store).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          organizationId: 1,
          botId: 5,
          metadata: expect.objectContaining({
            callId: 'call_123'
          })
        })
      );
    });
  });

  describe('pauseRecording()', () => {
    it('should pause active recording', () => {
      const result = RecordingService.startRecording('call_123', {});

      RecordingService.pauseRecording(result.recordingId);

      const session = RecordingService.activeRecordings.get(result.recordingId);
      expect(session.status).toBe('paused');
      expect(session.pausedAt).toBeInstanceOf(Date);
    });

    it('should not pause if already paused', () => {
      const result = RecordingService.startRecording('call_123', {});
      RecordingService.pauseRecording(result.recordingId);

      const pausedAt1 = RecordingService.activeRecordings.get(result.recordingId).pausedAt;

      RecordingService.pauseRecording(result.recordingId);

      const pausedAt2 = RecordingService.activeRecordings.get(result.recordingId).pausedAt;
      expect(pausedAt1).toBe(pausedAt2);
    });

    it('should throw error for non-existent recording', () => {
      expect(() => {
        RecordingService.pauseRecording('invalid_id');
      }).toThrow('Recording not found: invalid_id');
    });

    it('should log pause event', () => {
      const result = RecordingService.startRecording('call_123', {});

      RecordingService.pauseRecording(result.recordingId);

      expect(log.info).toHaveBeenCalledWith(
        'Recording paused',
        expect.objectContaining({ recordingId: result.recordingId })
      );
    });
  });

  describe('resumeRecording()', () => {
    it('should resume paused recording', () => {
      const result = RecordingService.startRecording('call_123', {});
      RecordingService.pauseRecording(result.recordingId);

      RecordingService.resumeRecording(result.recordingId);

      const session = RecordingService.activeRecordings.get(result.recordingId);
      expect(session.status).toBe('recording');
      expect(session.resumedAt).toBeInstanceOf(Date);
    });

    it('should not resume if not paused', () => {
      const result = RecordingService.startRecording('call_123', {});

      RecordingService.resumeRecording(result.recordingId);

      const session = RecordingService.activeRecordings.get(result.recordingId);
      expect(session.resumedAt).toBeUndefined();
    });

    it('should throw error for non-existent recording', () => {
      expect(() => {
        RecordingService.resumeRecording('invalid_id');
      }).toThrow('Recording not found: invalid_id');
    });

    it('should log resume event', () => {
      const result = RecordingService.startRecording('call_123', {});
      RecordingService.pauseRecording(result.recordingId);

      RecordingService.resumeRecording(result.recordingId);

      expect(log.info).toHaveBeenCalledWith(
        'Recording resumed',
        expect.objectContaining({ recordingId: result.recordingId })
      );
    });
  });

  describe('cancelRecording()', () => {
    it('should cancel and discard recording', () => {
      const result = RecordingService.startRecording('call_123', {});
      RecordingService.addChunk(result.recordingId, Buffer.from('audio'));

      RecordingService.cancelRecording(result.recordingId);

      expect(RecordingService.activeRecordings.has(result.recordingId)).toBe(false);
    });

    it('should handle non-existent recording gracefully', () => {
      expect(() => {
        RecordingService.cancelRecording('invalid_id');
      }).not.toThrow();
    });

    it('should log cancellation', () => {
      const result = RecordingService.startRecording('call_123', {});

      RecordingService.cancelRecording(result.recordingId);

      expect(log.info).toHaveBeenCalledWith(
        'Recording cancelled',
        expect.objectContaining({ recordingId: result.recordingId })
      );
    });
  });

  describe('getRecording()', () => {
    it('should get recording from metadata', async () => {
      const mockMetadata = {
        recordingId: 'rec_123',
        callId: 'call_123',
        status: 'completed'
      };

      RecordingService.recordingMetadata.set('rec_123', mockMetadata);

      const recording = await RecordingService.getRecording('rec_123');

      expect(recording).toEqual(mockMetadata);
    });

    it('should get active recording info', async () => {
      const result = RecordingService.startRecording('call_123', {});

      const recording = await RecordingService.getRecording(result.recordingId);

      expect(recording.recordingId).toBe(result.recordingId);
      expect(recording.status).toBe('recording');
      expect(recording.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return null for non-existent recording', async () => {
      const recording = await RecordingService.getRecording('invalid_id');
      expect(recording).toBeNull();
    });
  });

  describe('getRecordingAudio()', () => {
    it('should retrieve recording audio', async () => {
      const mockMetadata = {
        recordingId: 'rec_123',
        filename: 'recording.wav'
      };

      RecordingService.recordingMetadata.set('rec_123', mockMetadata);

      mockVoiceStorage.retrieve.mockResolvedValueOnce({
        buffer: Buffer.from('audio data'),
        metadata: {},
        contentType: 'audio/wav'
      });

      const result = await RecordingService.getRecordingAudio('rec_123');

      expect(result.buffer).toBeDefined();
      expect(result.metadata).toEqual(mockMetadata);
      expect(mockVoiceStorage.retrieve).toHaveBeenCalledWith('recording.wav');
    });

    it('should throw error if recording not found', async () => {
      await expect(
        RecordingService.getRecordingAudio('invalid_id')
      ).rejects.toThrow('Recording not found: invalid_id');
    });

    it('should throw error if filename missing', async () => {
      RecordingService.recordingMetadata.set('rec_123', {
        recordingId: 'rec_123'
      });

      await expect(
        RecordingService.getRecordingAudio('rec_123')
      ).rejects.toThrow('Recording not found: rec_123');
    });
  });

  describe('transcribeRecording()', () => {
    it('should transcribe recording', async () => {
      const mockMetadata = {
        recordingId: 'rec_123',
        filename: 'recording.wav'
      };

      RecordingService.recordingMetadata.set('rec_123', mockMetadata);

      mockVoiceStorage.retrieve.mockResolvedValueOnce({
        buffer: Buffer.from('audio'),
        metadata: {}
      });

      mockSpeechToText.transcribe.mockResolvedValueOnce({
        success: true,
        text: 'Hello world',
        confidence: 0.95
      });

      const result = await RecordingService.transcribeRecording('rec_123');

      expect(result.text).toBe('Hello world');
      expect(mockSpeechToText.transcribe).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          language: 'en',
          model: 'whisper-1',
          timestamps: true,
          speakerDiarization: false
        })
      );
    });

    it('should support custom transcription options', async () => {
      const mockMetadata = {
        recordingId: 'rec_123',
        filename: 'recording.wav'
      };

      RecordingService.recordingMetadata.set('rec_123', mockMetadata);

      mockVoiceStorage.retrieve.mockResolvedValueOnce({
        buffer: Buffer.from('audio'),
        metadata: {}
      });

      mockSpeechToText.transcribe.mockResolvedValueOnce({
        success: true,
        text: 'Bonjour'
      });

      await RecordingService.transcribeRecording('rec_123', {
        language: 'fr',
        model: 'whisper-large',
        speakerDiarization: true
      });

      expect(mockSpeechToText.transcribe).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          language: 'fr',
          model: 'whisper-large',
          speakerDiarization: true
        })
      );
    });

    it('should update metadata with transcription', async () => {
      const mockMetadata = {
        recordingId: 'rec_123',
        filename: 'recording.wav'
      };

      RecordingService.recordingMetadata.set('rec_123', mockMetadata);

      mockVoiceStorage.retrieve.mockResolvedValueOnce({
        buffer: Buffer.from('audio'),
        metadata: {}
      });

      mockSpeechToText.transcribe.mockResolvedValueOnce({
        success: true,
        text: 'Test transcription'
      });

      await RecordingService.transcribeRecording('rec_123');

      const updatedMetadata = RecordingService.recordingMetadata.get('rec_123');
      expect(updatedMetadata.transcription.text).toBe('Test transcription');
      expect(updatedMetadata.transcribedAt).toBeInstanceOf(Date);
    });
  });

  describe('deleteRecording()', () => {
    it('should delete recording successfully', async () => {
      const mockMetadata = {
        recordingId: 'rec_123',
        filename: 'recording.wav'
      };

      RecordingService.recordingMetadata.set('rec_123', mockMetadata);

      mockVoiceStorage.delete.mockResolvedValueOnce(true);

      const result = await RecordingService.deleteRecording('rec_123');

      expect(result).toBe(true);
      expect(mockVoiceStorage.delete).toHaveBeenCalledWith('recording.wav');
      expect(RecordingService.recordingMetadata.has('rec_123')).toBe(false);
    });

    it('should throw error if recording not found', async () => {
      await expect(
        RecordingService.deleteRecording('invalid_id')
      ).rejects.toThrow('Recording not found: invalid_id');
    });

    it('should log deletion', async () => {
      const mockMetadata = {
        recordingId: 'rec_123',
        filename: 'recording.wav'
      };

      RecordingService.recordingMetadata.set('rec_123', mockMetadata);

      mockVoiceStorage.delete.mockResolvedValueOnce(true);

      await RecordingService.deleteRecording('rec_123');

      expect(log.info).toHaveBeenCalledWith(
        'Recording deleted',
        expect.objectContaining({ recordingId: 'rec_123' })
      );
    });
  });

  describe('listRecordings()', () => {
    beforeEach(() => {
      // Add sample recordings
      RecordingService.recordingMetadata.set('rec_1', {
        recordingId: 'rec_1',
        organizationId: 1,
        botId: 5,
        callId: 'call_1',
        status: 'completed',
        startedAt: new Date('2024-01-01')
      });

      RecordingService.recordingMetadata.set('rec_2', {
        recordingId: 'rec_2',
        organizationId: 1,
        botId: 6,
        callId: 'call_2',
        status: 'completed',
        startedAt: new Date('2024-01-02')
      });

      RecordingService.recordingMetadata.set('rec_3', {
        recordingId: 'rec_3',
        organizationId: 2,
        botId: 7,
        callId: 'call_3',
        status: 'completed',
        startedAt: new Date('2024-01-03')
      });
    });

    it('should list all recordings', async () => {
      const result = await RecordingService.listRecordings();

      expect(result.recordings).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by organization ID', async () => {
      const result = await RecordingService.listRecordings({
        organizationId: 1
      });

      expect(result.recordings).toHaveLength(2);
      expect(result.recordings.every(r => r.organizationId === 1)).toBe(true);
    });

    it('should filter by bot ID', async () => {
      const result = await RecordingService.listRecordings({
        botId: 5
      });

      expect(result.recordings).toHaveLength(1);
      expect(result.recordings[0].botId).toBe(5);
    });

    it('should filter by call ID', async () => {
      const result = await RecordingService.listRecordings({
        callId: 'call_2'
      });

      expect(result.recordings).toHaveLength(1);
      expect(result.recordings[0].callId).toBe('call_2');
    });

    it('should filter by status', async () => {
      RecordingService.recordingMetadata.get('rec_1').status = 'failed';

      const result = await RecordingService.listRecordings({
        status: 'failed'
      });

      expect(result.recordings).toHaveLength(1);
      expect(result.recordings[0].status).toBe('failed');
    });

    it('should filter by date range', async () => {
      const result = await RecordingService.listRecordings({
        startDate: '2024-01-02',
        endDate: '2024-01-03'
      });

      expect(result.recordings).toHaveLength(2);
    });

    it('should sort by date descending', async () => {
      const result = await RecordingService.listRecordings();

      expect(result.recordings[0].recordingId).toBe('rec_3');
      expect(result.recordings[2].recordingId).toBe('rec_1');
    });

    it('should apply pagination', async () => {
      const result = await RecordingService.listRecordings({
        limit: 2,
        offset: 1
      });

      expect(result.recordings).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(1);
    });
  });

  describe('getRecordingStats()', () => {
    beforeEach(() => {
      RecordingService.recordingMetadata.set('rec_1', {
        recordingId: 'rec_1',
        organizationId: 1,
        duration: 120,
        size: 1024,
        transcription: { text: 'Hello' },
        startedAt: new Date()
      });

      RecordingService.recordingMetadata.set('rec_2', {
        recordingId: 'rec_2',
        organizationId: 1,
        duration: 180,
        size: 2048,
        startedAt: new Date()
      });
    });

    it('should calculate statistics', async () => {
      const stats = await RecordingService.getRecordingStats({
        organizationId: 1
      });

      expect(stats.totalRecordings).toBe(2);
      expect(stats.totalDuration).toBe(300);
      expect(stats.totalSize).toBe(3072);
      expect(stats.avgDuration).toBe(150);
      expect(stats.transcribedCount).toBe(1);
      expect(stats.transcriptionRate).toBe('50.0');
    });

    it('should format durations and sizes', async () => {
      const stats = await RecordingService.getRecordingStats({
        organizationId: 1
      });

      expect(stats.totalDurationFormatted).toBe('00:05:00');
      expect(stats.totalSizeFormatted).toBe('3 KB');
    });

    it('should handle empty results', async () => {
      RecordingService.recordingMetadata.clear();

      const stats = await RecordingService.getRecordingStats({});

      expect(stats.totalRecordings).toBe(0);
      expect(stats.avgDuration).toBe(0);
      expect(stats.transcriptionRate).toBe(0);
    });
  });

  describe('Format Utilities', () => {
    describe('formatDuration()', () => {
      it('should format duration as HH:MM:SS', () => {
        expect(RecordingService.formatDuration(0)).toBe('00:00:00');
        expect(RecordingService.formatDuration(65)).toBe('00:01:05');
        expect(RecordingService.formatDuration(3665)).toBe('01:01:05');
      });
    });

    describe('formatTimestamp()', () => {
      it('should format timestamp as M:SS', () => {
        expect(RecordingService.formatTimestamp(0)).toBe('0:00');
        expect(RecordingService.formatTimestamp(65)).toBe('1:05');
        expect(RecordingService.formatTimestamp(125)).toBe('2:05');
      });
    });

    describe('formatBytes()', () => {
      it('should format bytes to human readable', () => {
        expect(RecordingService.formatBytes(0)).toBe('0 Bytes');
        expect(RecordingService.formatBytes(1024)).toBe('1 KB');
        expect(RecordingService.formatBytes(1048576)).toBe('1 MB');
        expect(RecordingService.formatBytes(1073741824)).toBe('1 GB');
      });
    });
  });

  describe('getActiveRecordingsCount()', () => {
    it('should return count of active recordings', () => {
      RecordingService.startRecording('call_1', {});
      RecordingService.startRecording('call_2', {});

      expect(RecordingService.getActiveRecordingsCount()).toBe(2);
    });

    it('should return 0 when no active recordings', () => {
      expect(RecordingService.getActiveRecordingsCount()).toBe(0);
    });
  });

  describe('getActiveRecordings()', () => {
    it('should return list of active recordings', () => {
      const rec1 = RecordingService.startRecording('call_1', {});
      const rec2 = RecordingService.startRecording('call_2', {});

      const active = RecordingService.getActiveRecordings();

      expect(active).toHaveLength(2);
      expect(active[0].recordingId).toBe(rec1.recordingId);
      expect(active[1].recordingId).toBe(rec2.recordingId);
    });

    it('should include duration and bytes info', () => {
      const rec = RecordingService.startRecording('call_1', {});
      RecordingService.addChunk(rec.recordingId, Buffer.from('audio data'));

      const active = RecordingService.getActiveRecordings();

      expect(active[0].duration).toBeGreaterThanOrEqual(0);
      expect(active[0].totalBytes).toBeGreaterThan(0);
    });
  });
});
