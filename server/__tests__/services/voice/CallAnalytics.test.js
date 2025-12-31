/**
 * Voice Analytics Service Tests (Call Analytics)
 * Tests for server/services/voice/VoiceAnalytics.js
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

// Mock database
const mockQuery = jest.fn();
jest.mock('../../../db', () => ({
  query: mockQuery
}));

const VoiceAnalytics = require('../../../services/voice/VoiceAnalytics');
const log = require('../../../utils/logger');

describe('VoiceAnalytics Service (Call Analytics)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset in-memory metrics
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
    VoiceAnalytics.sessionMetrics.clear();
  });

  describe('Constructor', () => {
    it('should initialize with default metrics', () => {
      expect(VoiceAnalytics.metrics).toBeDefined();
      expect(VoiceAnalytics.metrics.totalTranscriptions).toBe(0);
      expect(VoiceAnalytics.metrics.successfulTranscriptions).toBe(0);
      expect(VoiceAnalytics.metrics.failedTranscriptions).toBe(0);
      expect(VoiceAnalytics.sessionMetrics).toBeInstanceOf(Map);
    });
  });

  describe('recordTranscription()', () => {
    it('should record successful transcription event', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const event = {
        organizationId: 1,
        userId: 10,
        botId: 5,
        provider: 'whisper',
        language: 'en',
        duration: 120,
        success: true,
        confidence: 0.95,
        wordCount: 50,
        errorType: null,
        processingTime: 1500
      };

      await VoiceAnalytics.recordTranscription(event);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO voice_analytics'),
        [1, 10, 5, 'whisper', 'en', 120, true, 0.95, 50, null, 1500]
      );
      expect(VoiceAnalytics.metrics.totalTranscriptions).toBe(1);
      expect(VoiceAnalytics.metrics.successfulTranscriptions).toBe(1);
    });

    it('should record failed transcription event', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const event = {
        organizationId: 1,
        userId: 10,
        botId: 5,
        provider: 'google',
        language: 'en',
        duration: 30,
        success: false,
        confidence: 0,
        wordCount: 0,
        errorType: 'timeout',
        processingTime: 5000
      };

      await VoiceAnalytics.recordTranscription(event);

      expect(VoiceAnalytics.metrics.failedTranscriptions).toBe(1);
      expect(VoiceAnalytics.metrics.successfulTranscriptions).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const event = {
        organizationId: 1,
        provider: 'whisper',
        language: 'en',
        duration: 120,
        success: true
      };

      await VoiceAnalytics.recordTranscription(event);

      expect(log.error).toHaveBeenCalledWith(
        'Failed to record voice analytics',
        expect.any(Object)
      );
    });

    it('should update metrics even if database fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const event = {
        organizationId: 1,
        provider: 'whisper',
        language: 'en',
        duration: 120,
        success: true,
        confidence: 0.9
      };

      await VoiceAnalytics.recordTranscription(event);

      expect(VoiceAnalytics.metrics.totalTranscriptions).toBe(1);
    });
  });

  describe('updateMetrics()', () => {
    it('should update provider stats correctly', () => {
      const event = {
        provider: 'whisper',
        language: 'en',
        duration: 120,
        success: true,
        confidence: 0.95
      };

      VoiceAnalytics.updateMetrics(event);

      expect(VoiceAnalytics.metrics.byProvider.whisper).toBeDefined();
      expect(VoiceAnalytics.metrics.byProvider.whisper.total).toBe(1);
      expect(VoiceAnalytics.metrics.byProvider.whisper.successful).toBe(1);
      expect(VoiceAnalytics.metrics.byProvider.whisper.totalDuration).toBe(120);
    });

    it('should update language stats correctly', () => {
      const event = {
        provider: 'whisper',
        language: 'fr',
        duration: 60,
        success: true,
        confidence: 0.9
      };

      VoiceAnalytics.updateMetrics(event);

      expect(VoiceAnalytics.metrics.byLanguage.fr).toBeDefined();
      expect(VoiceAnalytics.metrics.byLanguage.fr.total).toBe(1);
      expect(VoiceAnalytics.metrics.byLanguage.fr.successful).toBe(1);
    });

    it('should calculate average confidence correctly', () => {
      VoiceAnalytics.updateMetrics({
        provider: 'whisper',
        language: 'en',
        duration: 60,
        success: true,
        confidence: 0.9
      });

      VoiceAnalytics.updateMetrics({
        provider: 'whisper',
        language: 'en',
        duration: 60,
        success: true,
        confidence: 0.8
      });

      const avgConfidence = VoiceAnalytics.metrics.byProvider.whisper.avgConfidence;
      expect(avgConfidence).toBeCloseTo(0.85, 2);
    });

    it('should track failed transcriptions separately', () => {
      VoiceAnalytics.updateMetrics({
        provider: 'google',
        language: 'en',
        duration: 30,
        success: false,
        confidence: 0
      });

      expect(VoiceAnalytics.metrics.byProvider.google.failed).toBe(1);
      expect(VoiceAnalytics.metrics.byProvider.google.successful).toBe(0);
    });

    it('should accumulate total duration', () => {
      VoiceAnalytics.updateMetrics({
        provider: 'whisper',
        language: 'en',
        duration: 60,
        success: true
      });

      VoiceAnalytics.updateMetrics({
        provider: 'whisper',
        language: 'en',
        duration: 90,
        success: true
      });

      expect(VoiceAnalytics.metrics.totalDuration).toBe(150);
    });
  });

  describe('getStats()', () => {
    it('should return comprehensive statistics', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            total_transcriptions: '100',
            successful: '95',
            failed: '5',
            total_duration: '6000',
            avg_confidence: '0.92',
            avg_processing_time: '1200',
            total_words: '5000'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // provider breakdown
        .mockResolvedValueOnce({ rows: [] }) // language breakdown
        .mockResolvedValueOnce({ rows: [] }) // daily trend
        .mockResolvedValueOnce({ rows: [] }); // error breakdown

      const stats = await VoiceAnalytics.getStats({
        organizationId: 1
      });

      expect(stats.summary.totalTranscriptions).toBe(100);
      expect(stats.summary.successful).toBe(95);
      expect(stats.summary.failed).toBe(5);
      expect(stats.summary.successRate).toBe('95.00%');
      expect(stats.summary.avgConfidence).toBe('0.92');
    });

    it('should filter by organization ID', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VoiceAnalytics.getStats({ organizationId: 1 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $1'),
        expect.arrayContaining([1])
      );
    });

    it('should filter by date range', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VoiceAnalytics.getStats({
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('created_at >='),
        expect.arrayContaining(['2024-01-01', '2024-01-31'])
      );
    });

    it('should filter by provider', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VoiceAnalytics.getStats({ provider: 'whisper' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('provider = $'),
        expect.arrayContaining(['whisper'])
      );
    });

    it('should filter by language', async () => {
      mockQuery.mockResolvedValue({ rows: [{}] });

      await VoiceAnalytics.getStats({ language: 'en' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('language = $'),
        expect.arrayContaining(['en'])
      );
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      await expect(VoiceAnalytics.getStats()).rejects.toThrow('Database error');
      expect(log.error).toHaveBeenCalledWith(
        'Failed to get voice stats',
        expect.any(Object)
      );
    });

    it('should format duration correctly', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            total_transcriptions: '10',
            successful: '10',
            failed: '0',
            total_duration: '7325', // 2h 2m 5s
            avg_confidence: '0.9',
            avg_processing_time: '1000',
            total_words: '500'
          }]
        })
        .mockResolvedValue({ rows: [] });

      const stats = await VoiceAnalytics.getStats();

      expect(stats.summary.totalDurationFormatted).toBe('2h 2m 5s');
    });
  });

  describe('getProviderBreakdown()', () => {
    it('should return provider breakdown', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            provider: 'whisper',
            total: '50',
            successful: '48',
            total_duration: '3000',
            avg_confidence: '0.95'
          },
          {
            provider: 'google',
            total: '30',
            successful: '28',
            total_duration: '1800',
            avg_confidence: '0.90'
          }
        ]
      });

      const breakdown = await VoiceAnalytics.getProviderBreakdown({
        organizationId: 1
      });

      expect(breakdown).toHaveLength(2);
      expect(breakdown[0].provider).toBe('whisper');
      expect(breakdown[0].total).toBe(50);
      expect(breakdown[0].successRate).toBe('96.0%');
    });

    it('should order by total descending', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { provider: 'whisper', total: '100', successful: '95', total_duration: '5000', avg_confidence: '0.9' },
          { provider: 'google', total: '50', successful: '45', total_duration: '2500', avg_confidence: '0.85' }
        ]
      });

      const breakdown = await VoiceAnalytics.getProviderBreakdown({});

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY total DESC'),
        expect.any(Array)
      );
    });
  });

  describe('getLanguageBreakdown()', () => {
    it('should return language breakdown', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            language: 'en',
            total: '80',
            successful: '75',
            total_duration: '4800'
          },
          {
            language: 'es',
            total: '20',
            successful: '18',
            total_duration: '1200'
          }
        ]
      });

      const breakdown = await VoiceAnalytics.getLanguageBreakdown({
        organizationId: 1
      });

      expect(breakdown).toHaveLength(2);
      expect(breakdown[0].language).toBe('en');
      expect(breakdown[0].total).toBe(80);
      expect(breakdown[0].successRate).toBe('93.8%');
    });
  });

  describe('getDailyTrend()', () => {
    it('should return daily trend data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            date: '2024-01-01',
            total: '10',
            successful: '9',
            total_duration: '600'
          },
          {
            date: '2024-01-02',
            total: '15',
            successful: '14',
            total_duration: '900'
          }
        ]
      });

      const trend = await VoiceAnalytics.getDailyTrend({
        organizationId: 1,
        days: 30
      });

      expect(trend).toHaveLength(2);
      expect(trend[0].date).toBe('2024-01-01');
      expect(trend[0].total).toBe(10);
    });

    it('should use default 30 days if not specified', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await VoiceAnalytics.getDailyTrend({ organizationId: 1 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([30])
      );
    });

    it('should prevent SQL injection in days parameter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await VoiceAnalytics.getDailyTrend({
        organizationId: 1,
        days: '30; DROP TABLE voice_analytics;'
      });

      // Should parse to integer and use safely
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([30])
      );
    });
  });

  describe('getErrorBreakdown()', () => {
    it('should return error breakdown', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { error_type: 'timeout', count: '5' },
          { error_type: 'network_error', count: '3' },
          { error_type: 'invalid_audio', count: '2' }
        ]
      });

      const errors = await VoiceAnalytics.getErrorBreakdown({
        organizationId: 1
      });

      expect(errors).toHaveLength(3);
      expect(errors[0].errorType).toBe('timeout');
      expect(errors[0].count).toBe(5);
    });

    it('should limit to top 10 errors', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await VoiceAnalytics.getErrorBreakdown({});

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 10'),
        expect.any(Array)
      );
    });
  });

  describe('getRealTimeMetrics()', () => {
    it('should return current in-memory metrics', () => {
      VoiceAnalytics.metrics = {
        totalTranscriptions: 100,
        successfulTranscriptions: 95,
        failedTranscriptions: 5,
        totalDuration: 6000,
        byProvider: { whisper: { total: 100 } },
        byLanguage: { en: { total: 100 } }
      };

      const metrics = VoiceAnalytics.getRealTimeMetrics();

      expect(metrics.totalTranscriptions).toBe(100);
      expect(metrics.successfulTranscriptions).toBe(95);
      expect(metrics.successRate).toBe('95.00%');
      expect(metrics.totalDurationFormatted).toBe('1h 40m 0s');
    });

    it('should handle zero transcriptions', () => {
      const metrics = VoiceAnalytics.getRealTimeMetrics();

      expect(metrics.successRate).toBe('0%');
    });
  });

  describe('formatDuration()', () => {
    it('should format seconds to readable format', () => {
      expect(VoiceAnalytics.formatDuration(0)).toBe('0s');
      expect(VoiceAnalytics.formatDuration(45)).toBe('45s');
      expect(VoiceAnalytics.formatDuration(90)).toBe('1m 30s');
      expect(VoiceAnalytics.formatDuration(3665)).toBe('1h 1m 5s');
      expect(VoiceAnalytics.formatDuration(7325)).toBe('2h 2m 5s');
    });

    it('should handle null or undefined', () => {
      expect(VoiceAnalytics.formatDuration(null)).toBe('0s');
      expect(VoiceAnalytics.formatDuration(undefined)).toBe('0s');
    });

    it('should only show hours when no minutes or seconds', () => {
      expect(VoiceAnalytics.formatDuration(3600)).toBe('1h');
    });

    it('should only show minutes when no hours or seconds', () => {
      expect(VoiceAnalytics.formatDuration(120)).toBe('2m');
    });
  });

  describe('Session Tracking', () => {
    describe('startSession()', () => {
      it('should start tracking a session', () => {
        VoiceAnalytics.startSession('session_123');

        expect(VoiceAnalytics.sessionMetrics.has('session_123')).toBe(true);
        const session = VoiceAnalytics.sessionMetrics.get('session_123');
        expect(session.startTime).toBeDefined();
        expect(session.transcriptions).toBe(0);
        expect(session.totalDuration).toBe(0);
      });
    });

    describe('updateSession()', () => {
      it('should update session metrics', () => {
        VoiceAnalytics.startSession('session_123');
        VoiceAnalytics.updateSession('session_123', { duration: 60 });

        const session = VoiceAnalytics.sessionMetrics.get('session_123');
        expect(session.transcriptions).toBe(1);
        expect(session.totalDuration).toBe(60);
      });

      it('should handle multiple updates', () => {
        VoiceAnalytics.startSession('session_123');
        VoiceAnalytics.updateSession('session_123', { duration: 30 });
        VoiceAnalytics.updateSession('session_123', { duration: 45 });

        const session = VoiceAnalytics.sessionMetrics.get('session_123');
        expect(session.transcriptions).toBe(2);
        expect(session.totalDuration).toBe(75);
      });

      it('should handle non-existent session gracefully', () => {
        expect(() => {
          VoiceAnalytics.updateSession('nonexistent', { duration: 60 });
        }).not.toThrow();
      });
    });

    describe('endSession()', () => {
      it('should end session and return summary', () => {
        VoiceAnalytics.startSession('session_123');
        VoiceAnalytics.updateSession('session_123', { duration: 60 });

        const summary = VoiceAnalytics.endSession('session_123');

        expect(summary).toBeDefined();
        expect(summary.sessionId).toBe('session_123');
        expect(summary.duration).toBeGreaterThan(0);
        expect(summary.transcriptions).toBe(1);
        expect(summary.totalAudioDuration).toBe(60);
        expect(VoiceAnalytics.sessionMetrics.has('session_123')).toBe(false);
      });

      it('should return null for non-existent session', () => {
        const summary = VoiceAnalytics.endSession('nonexistent');
        expect(summary).toBeNull();
      });
    });
  });
});
