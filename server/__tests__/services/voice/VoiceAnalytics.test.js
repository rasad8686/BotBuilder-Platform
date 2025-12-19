/**
 * Voice Analytics Service Tests
 * Tests for server/services/voice/VoiceAnalytics.js
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const db = require('../../../db');
const VoiceAnalytics = require('../../../services/voice/VoiceAnalytics');

describe('VoiceAnalytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset metrics
    VoiceAnalytics.metrics = {
      totalTranscriptions: 0,
      successfulTranscriptions: 0,
      failedTranscriptions: 0,
      totalDuration: 0,
      averageConfidence: 0,
      byProvider: {},
      byLanguage: {},
      hourlyStats: []
    };
    VoiceAnalytics.sessionMetrics = new Map();
  });

  describe('recordTranscription()', () => {
    it('should record successful transcription', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await VoiceAnalytics.recordTranscription({
        organizationId: 1,
        userId: 1,
        provider: 'whisper',
        language: 'en',
        duration: 10,
        success: true,
        confidence: 0.95,
        wordCount: 50
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO voice_analytics'),
        expect.any(Array)
      );
    });

    it('should record failed transcription', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await VoiceAnalytics.recordTranscription({
        organizationId: 1,
        provider: 'whisper',
        language: 'en',
        success: false,
        errorType: 'timeout'
      });

      expect(db.query).toHaveBeenCalled();
    });

    it('should update in-memory metrics', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await VoiceAnalytics.recordTranscription({
        provider: 'whisper',
        language: 'en',
        duration: 10,
        success: true,
        confidence: 0.95
      });

      expect(VoiceAnalytics.metrics.totalTranscriptions).toBe(1);
      expect(VoiceAnalytics.metrics.successfulTranscriptions).toBe(1);
      expect(VoiceAnalytics.metrics.totalDuration).toBe(10);
    });

    it('should track failed transcriptions separately', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await VoiceAnalytics.recordTranscription({
        provider: 'whisper',
        language: 'en',
        success: false
      });

      expect(VoiceAnalytics.metrics.failedTranscriptions).toBe(1);
      expect(VoiceAnalytics.metrics.successfulTranscriptions).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      // Should not throw
      await expect(VoiceAnalytics.recordTranscription({
        provider: 'whisper',
        success: true
      })).resolves.not.toThrow();
    });
  });

  describe('updateMetrics()', () => {
    it('should update provider stats', () => {
      VoiceAnalytics.updateMetrics({
        provider: 'whisper',
        success: true,
        duration: 10,
        confidence: 0.95
      });

      expect(VoiceAnalytics.metrics.byProvider['whisper']).toBeDefined();
      expect(VoiceAnalytics.metrics.byProvider['whisper'].total).toBe(1);
      expect(VoiceAnalytics.metrics.byProvider['whisper'].successful).toBe(1);
    });

    it('should update language stats', () => {
      VoiceAnalytics.updateMetrics({
        provider: 'whisper',
        language: 'en',
        success: true
      });

      expect(VoiceAnalytics.metrics.byLanguage['en']).toBeDefined();
      expect(VoiceAnalytics.metrics.byLanguage['en'].total).toBe(1);
    });

    it('should accumulate stats for same provider', () => {
      VoiceAnalytics.updateMetrics({
        provider: 'whisper',
        success: true,
        duration: 10
      });

      VoiceAnalytics.updateMetrics({
        provider: 'whisper',
        success: true,
        duration: 15
      });

      expect(VoiceAnalytics.metrics.byProvider['whisper'].total).toBe(2);
      expect(VoiceAnalytics.metrics.byProvider['whisper'].totalDuration).toBe(25);
    });
  });

  describe('getStats()', () => {
    it('should return stats from database', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_transcriptions: '100',
            successful: '95',
            failed: '5',
            total_duration: '500',
            avg_confidence: '0.92',
            avg_processing_time: '150',
            total_words: '5000'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // provider breakdown
        .mockResolvedValueOnce({ rows: [] }) // language breakdown
        .mockResolvedValueOnce({ rows: [] }) // daily trend
        .mockResolvedValueOnce({ rows: [] }); // error breakdown

      const stats = await VoiceAnalytics.getStats({ organizationId: 1 });

      expect(stats).toHaveProperty('summary');
      expect(stats).toHaveProperty('byProvider');
      expect(stats).toHaveProperty('byLanguage');
      expect(stats).toHaveProperty('dailyTrend');
      expect(stats.summary.totalTranscriptions).toBe(100);
    });

    it('should filter by organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_transcriptions: '50' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await VoiceAnalytics.getStats({ organizationId: 1 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        expect.arrayContaining([1])
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      db.query
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await VoiceAnalytics.getStats({ startDate, endDate });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at'),
        expect.any(Array)
      );
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(VoiceAnalytics.getStats({}))
        .rejects.toThrow();
    });
  });

  describe('getRealTimeMetrics()', () => {
    it('should return current metrics', () => {
      VoiceAnalytics.metrics.totalTranscriptions = 100;
      VoiceAnalytics.metrics.successfulTranscriptions = 95;
      VoiceAnalytics.metrics.totalDuration = 500;

      const metrics = VoiceAnalytics.getRealTimeMetrics();

      expect(metrics.totalTranscriptions).toBe(100);
      expect(metrics.successfulTranscriptions).toBe(95);
      expect(metrics.successRate).toBe('95.00%');
    });

    it('should calculate success rate', () => {
      VoiceAnalytics.metrics.totalTranscriptions = 10;
      VoiceAnalytics.metrics.successfulTranscriptions = 8;

      const metrics = VoiceAnalytics.getRealTimeMetrics();

      expect(metrics.successRate).toBe('80.00%');
    });

    it('should handle zero transcriptions', () => {
      const metrics = VoiceAnalytics.getRealTimeMetrics();

      expect(metrics.successRate).toBe('0%');
    });
  });

  describe('formatDuration()', () => {
    it('should format seconds to readable string', () => {
      expect(VoiceAnalytics.formatDuration(30)).toBe('30s');
      expect(VoiceAnalytics.formatDuration(90)).toBe('1m 30s');
      expect(VoiceAnalytics.formatDuration(3661)).toBe('1h 1m 1s');
    });

    it('should handle zero', () => {
      expect(VoiceAnalytics.formatDuration(0)).toBe('0s');
    });

    it('should handle null/undefined', () => {
      expect(VoiceAnalytics.formatDuration(null)).toBe('0s');
      expect(VoiceAnalytics.formatDuration(undefined)).toBe('0s');
    });
  });

  describe('session tracking', () => {
    it('should start session', () => {
      VoiceAnalytics.startSession('session-1');

      expect(VoiceAnalytics.sessionMetrics.has('session-1')).toBe(true);
    });

    it('should end session and return summary', () => {
      VoiceAnalytics.startSession('session-1');
      VoiceAnalytics.updateSession('session-1', { duration: 10 });
      VoiceAnalytics.updateSession('session-1', { duration: 15 });

      const summary = VoiceAnalytics.endSession('session-1');

      expect(summary).toHaveProperty('sessionId');
      expect(summary).toHaveProperty('transcriptions');
      expect(summary.transcriptions).toBe(2);
      expect(VoiceAnalytics.sessionMetrics.has('session-1')).toBe(false);
    });

    it('should return null for non-existent session', () => {
      const summary = VoiceAnalytics.endSession('non-existent');

      expect(summary).toBeNull();
    });

    it('should update session metrics', () => {
      VoiceAnalytics.startSession('session-1');
      VoiceAnalytics.updateSession('session-1', { duration: 10 });

      const session = VoiceAnalytics.sessionMetrics.get('session-1');
      expect(session.transcriptions).toBe(1);
      expect(session.totalDuration).toBe(10);
    });
  });
});
