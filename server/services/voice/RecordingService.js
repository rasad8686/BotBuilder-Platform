/**
 * Call Recording Service
 * Manages call recordings: capture, store, retrieve, transcribe, and delete
 */

const VoiceStorage = require('./VoiceStorage');
const SpeechToText = require('./SpeechToText');
const FormatConverter = require('./FormatConverter');
const log = require('../../utils/logger');

class RecordingService {
  constructor() {
    this.activeRecordings = new Map();
    this.recordingMetadata = new Map();
  }

  /**
   * Start a new recording session
   * @param {string} callId - The call identifier
   * @param {Object} options - Recording options
   * @returns {Object} Recording session info
   */
  startRecording(callId, options = {}) {
    const {
      organizationId,
      botId,
      userId,
      format = 'wav',
      channels = 2,
      sampleRate = 16000,
      recordBothLegs = true
    } = options;

    const recordingId = `rec_${Date.now()}_${callId}`;

    const session = {
      recordingId,
      callId,
      organizationId,
      botId,
      userId,
      format,
      channels,
      sampleRate,
      recordBothLegs,
      startedAt: new Date(),
      chunks: [],
      totalBytes: 0,
      status: 'recording'
    };

    this.activeRecordings.set(recordingId, session);

    log.info('Recording started', { recordingId, callId });

    return {
      recordingId,
      callId,
      startedAt: session.startedAt,
      status: 'recording'
    };
  }

  /**
   * Add audio chunk to active recording
   * @param {string} recordingId - The recording identifier
   * @param {Buffer} chunk - Audio chunk buffer
   * @param {string} leg - 'inbound' or 'outbound' for dual-channel recording
   */
  addChunk(recordingId, chunk, leg = 'mixed') {
    const session = this.activeRecordings.get(recordingId);

    if (!session) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    if (session.status !== 'recording') {
      throw new Error(`Recording is not active: ${recordingId}`);
    }

    session.chunks.push({
      data: chunk,
      leg,
      timestamp: Date.now()
    });
    session.totalBytes += chunk.length;
  }

  /**
   * Stop and save recording
   * @param {string} recordingId - The recording identifier
   * @param {Object} options - Stop options
   * @returns {Object} Final recording info
   */
  async stopRecording(recordingId, options = {}) {
    const session = this.activeRecordings.get(recordingId);

    if (!session) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    session.status = 'processing';
    session.stoppedAt = new Date();
    session.duration = (session.stoppedAt - session.startedAt) / 1000;

    try {
      // Combine all chunks into single buffer
      const audioBuffer = this.combineChunks(session.chunks);

      // Convert format if needed
      let finalBuffer = audioBuffer;
      if (options.outputFormat && options.outputFormat !== session.format) {
        finalBuffer = await FormatConverter.convert(audioBuffer, {
          inputFormat: session.format,
          outputFormat: options.outputFormat,
          sampleRate: session.sampleRate
        });
        session.format = options.outputFormat;
      }

      // Store the recording
      const storageResult = await VoiceStorage.store(finalBuffer, {
        organizationId: session.organizationId,
        botId: session.botId,
        userId: session.userId,
        format: session.format,
        metadata: {
          callId: session.callId,
          recordingId,
          duration: session.duration,
          channels: session.channels,
          sampleRate: session.sampleRate
        }
      });

      // Update metadata
      const metadata = {
        recordingId,
        callId: session.callId,
        organizationId: session.organizationId,
        botId: session.botId,
        userId: session.userId,
        filename: storageResult.filename,
        url: storageResult.url,
        duration: session.duration,
        size: storageResult.size,
        format: session.format,
        channels: session.channels,
        sampleRate: session.sampleRate,
        startedAt: session.startedAt,
        stoppedAt: session.stoppedAt,
        status: 'completed'
      };

      this.recordingMetadata.set(recordingId, metadata);

      // Auto-transcribe if requested
      if (options.autoTranscribe) {
        try {
          const transcription = await this.transcribeRecording(recordingId);
          metadata.transcription = transcription;
        } catch (error) {
          log.error('Auto-transcription failed', { recordingId, error: error.message });
        }
      }

      // Clean up active recording
      this.activeRecordings.delete(recordingId);

      log.info('Recording completed', { recordingId, duration: session.duration });

      return metadata;
    } catch (error) {
      session.status = 'failed';
      session.error = error.message;
      log.error('Recording failed', { recordingId, error: error.message });
      throw error;
    }
  }

  /**
   * Pause active recording
   * @param {string} recordingId - The recording identifier
   */
  pauseRecording(recordingId) {
    const session = this.activeRecordings.get(recordingId);

    if (!session) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    if (session.status === 'recording') {
      session.status = 'paused';
      session.pausedAt = new Date();
      log.info('Recording paused', { recordingId });
    }
  }

  /**
   * Resume paused recording
   * @param {string} recordingId - The recording identifier
   */
  resumeRecording(recordingId) {
    const session = this.activeRecordings.get(recordingId);

    if (!session) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    if (session.status === 'paused') {
      session.status = 'recording';
      session.resumedAt = new Date();
      log.info('Recording resumed', { recordingId });
    }
  }

  /**
   * Cancel and discard recording
   * @param {string} recordingId - The recording identifier
   */
  cancelRecording(recordingId) {
    const session = this.activeRecordings.get(recordingId);

    if (session) {
      session.status = 'cancelled';
      this.activeRecordings.delete(recordingId);
      log.info('Recording cancelled', { recordingId });
    }
  }

  /**
   * Combine audio chunks into single buffer
   * @param {Array} chunks - Array of chunk objects
   * @returns {Buffer} Combined audio buffer
   */
  combineChunks(chunks) {
    const buffers = chunks.map(c => c.data);
    return Buffer.concat(buffers);
  }

  /**
   * Get recording by ID
   * @param {string} recordingId - The recording identifier
   * @returns {Object} Recording metadata
   */
  async getRecording(recordingId) {
    // Check in-memory metadata first
    if (this.recordingMetadata.has(recordingId)) {
      return this.recordingMetadata.get(recordingId);
    }

    // Check if recording is active
    if (this.activeRecordings.has(recordingId)) {
      const session = this.activeRecordings.get(recordingId);
      return {
        recordingId,
        callId: session.callId,
        status: session.status,
        startedAt: session.startedAt,
        duration: (Date.now() - session.startedAt.getTime()) / 1000
      };
    }

    return null;
  }

  /**
   * Get recording audio file
   * @param {string} recordingId - The recording identifier
   * @returns {Object} Audio buffer and metadata
   */
  async getRecordingAudio(recordingId) {
    const metadata = await this.getRecording(recordingId);

    if (!metadata || !metadata.filename) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    const audio = await VoiceStorage.retrieve(metadata.filename);

    return {
      ...audio,
      metadata
    };
  }

  /**
   * Transcribe a recording
   * @param {string} recordingId - The recording identifier
   * @param {Object} options - Transcription options
   * @returns {Object} Transcription result
   */
  async transcribeRecording(recordingId, options = {}) {
    const audio = await this.getRecordingAudio(recordingId);

    const transcription = await SpeechToText.transcribe(audio.buffer, {
      language: options.language || 'en',
      model: options.model || 'whisper-1',
      timestamps: options.timestamps !== false,
      speakerDiarization: options.speakerDiarization || false
    });

    // Update metadata with transcription
    if (this.recordingMetadata.has(recordingId)) {
      const metadata = this.recordingMetadata.get(recordingId);
      metadata.transcription = transcription;
      metadata.transcribedAt = new Date();
    }

    log.info('Recording transcribed', { recordingId });

    return transcription;
  }

  /**
   * Delete a recording
   * @param {string} recordingId - The recording identifier
   * @returns {boolean} Success
   */
  async deleteRecording(recordingId) {
    const metadata = await this.getRecording(recordingId);

    if (!metadata) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    if (metadata.filename) {
      await VoiceStorage.delete(metadata.filename);
    }

    this.recordingMetadata.delete(recordingId);

    log.info('Recording deleted', { recordingId });

    return true;
  }

  /**
   * List recordings with filters
   * @param {Object} filters - Filter options
   * @returns {Array} List of recordings
   */
  async listRecordings(filters = {}) {
    const {
      organizationId,
      botId,
      callId,
      startDate,
      endDate,
      status,
      limit = 50,
      offset = 0
    } = filters;

    let recordings = Array.from(this.recordingMetadata.values());

    // Apply filters
    if (organizationId) {
      recordings = recordings.filter(r => r.organizationId === organizationId);
    }
    if (botId) {
      recordings = recordings.filter(r => r.botId === botId);
    }
    if (callId) {
      recordings = recordings.filter(r => r.callId === callId);
    }
    if (status) {
      recordings = recordings.filter(r => r.status === status);
    }
    if (startDate) {
      recordings = recordings.filter(r => new Date(r.startedAt) >= new Date(startDate));
    }
    if (endDate) {
      recordings = recordings.filter(r => new Date(r.startedAt) <= new Date(endDate));
    }

    // Sort by date descending
    recordings.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    // Apply pagination
    const total = recordings.length;
    recordings = recordings.slice(offset, offset + limit);

    return {
      recordings,
      total,
      limit,
      offset
    };
  }

  /**
   * Get recording statistics
   * @param {Object} filters - Filter options
   * @returns {Object} Statistics
   */
  async getRecordingStats(filters = {}) {
    const { organizationId, botId, startDate, endDate } = filters;

    let recordings = Array.from(this.recordingMetadata.values());

    // Apply filters
    if (organizationId) {
      recordings = recordings.filter(r => r.organizationId === organizationId);
    }
    if (botId) {
      recordings = recordings.filter(r => r.botId === botId);
    }
    if (startDate) {
      recordings = recordings.filter(r => new Date(r.startedAt) >= new Date(startDate));
    }
    if (endDate) {
      recordings = recordings.filter(r => new Date(r.startedAt) <= new Date(endDate));
    }

    const totalRecordings = recordings.length;
    const totalDuration = recordings.reduce((sum, r) => sum + (r.duration || 0), 0);
    const totalSize = recordings.reduce((sum, r) => sum + (r.size || 0), 0);
    const transcribedCount = recordings.filter(r => r.transcription).length;

    return {
      totalRecordings,
      totalDuration,
      totalDurationFormatted: this.formatDuration(totalDuration),
      totalSize,
      totalSizeFormatted: this.formatBytes(totalSize),
      avgDuration: totalRecordings > 0 ? totalDuration / totalRecordings : 0,
      transcribedCount,
      transcriptionRate: totalRecordings > 0 ? (transcribedCount / totalRecordings * 100).toFixed(1) : 0
    };
  }

  /**
   * Export recording with transcription
   * @param {string} recordingId - The recording identifier
   * @param {string} format - Export format (json, txt, srt, vtt)
   * @returns {Object} Exported data
   */
  async exportRecording(recordingId, format = 'json') {
    const metadata = await this.getRecording(recordingId);

    if (!metadata) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    switch (format) {
      case 'json':
        return {
          contentType: 'application/json',
          filename: `${recordingId}.json`,
          data: JSON.stringify(metadata, null, 2)
        };

      case 'txt':
        return {
          contentType: 'text/plain',
          filename: `${recordingId}.txt`,
          data: this.formatAsText(metadata)
        };

      case 'srt':
        return {
          contentType: 'text/srt',
          filename: `${recordingId}.srt`,
          data: this.formatAsSrt(metadata)
        };

      case 'vtt':
        return {
          contentType: 'text/vtt',
          filename: `${recordingId}.vtt`,
          data: this.formatAsVtt(metadata)
        };

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Format metadata as plain text
   */
  formatAsText(metadata) {
    let text = `Recording: ${metadata.recordingId}\n`;
    text += `Call ID: ${metadata.callId}\n`;
    text += `Date: ${metadata.startedAt}\n`;
    text += `Duration: ${this.formatDuration(metadata.duration)}\n\n`;

    if (metadata.transcription) {
      text += `--- Transcription ---\n\n`;
      if (typeof metadata.transcription === 'string') {
        text += metadata.transcription;
      } else if (metadata.transcription.text) {
        text += metadata.transcription.text;
      } else if (metadata.transcription.segments) {
        for (const segment of metadata.transcription.segments) {
          text += `[${this.formatTimestamp(segment.start)}] ${segment.text}\n`;
        }
      }
    }

    return text;
  }

  /**
   * Format transcription as SRT subtitles
   */
  formatAsSrt(metadata) {
    if (!metadata.transcription?.segments) {
      return '';
    }

    let srt = '';
    let index = 1;

    for (const segment of metadata.transcription.segments) {
      srt += `${index}\n`;
      srt += `${this.formatSrtTimestamp(segment.start)} --> ${this.formatSrtTimestamp(segment.end)}\n`;
      srt += `${segment.text}\n\n`;
      index++;
    }

    return srt;
  }

  /**
   * Format transcription as WebVTT
   */
  formatAsVtt(metadata) {
    if (!metadata.transcription?.segments) {
      return 'WEBVTT\n\n';
    }

    let vtt = 'WEBVTT\n\n';

    for (const segment of metadata.transcription.segments) {
      vtt += `${this.formatVttTimestamp(segment.start)} --> ${this.formatVttTimestamp(segment.end)}\n`;
      vtt += `${segment.text}\n\n`;
    }

    return vtt;
  }

  /**
   * Format seconds as HH:MM:SS
   */
  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Format SRT timestamp (HH:MM:SS,mmm)
   */
  formatSrtTimestamp(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Format VTT timestamp (HH:MM:SS.mmm)
   */
  formatVttTimestamp(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get active recordings count
   */
  getActiveRecordingsCount() {
    return this.activeRecordings.size;
  }

  /**
   * Get all active recordings
   */
  getActiveRecordings() {
    return Array.from(this.activeRecordings.values()).map(session => ({
      recordingId: session.recordingId,
      callId: session.callId,
      status: session.status,
      startedAt: session.startedAt,
      duration: (Date.now() - session.startedAt.getTime()) / 1000,
      totalBytes: session.totalBytes
    }));
  }
}

// Export singleton instance
module.exports = new RecordingService();
