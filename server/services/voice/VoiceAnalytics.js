/**
 * Voice Analytics Service
 * Tracks and analyzes voice transcription metrics
 */

const db = require('../../db');
const log = require('../../utils/logger');

class VoiceAnalytics {
  constructor() {
    this.metrics = {
      totalTranscriptions: 0,
      successfulTranscriptions: 0,
      failedTranscriptions: 0,
      totalDuration: 0,
      averageConfidence: 0,
      byProvider: {},
      byLanguage: {},
      hourlyStats: []
    };
    this.sessionMetrics = new Map();
  }

  /**
   * Record transcription event
   * @param {Object} event - Transcription event data
   */
  async recordTranscription(event) {
    const {
      organizationId,
      userId,
      botId,
      provider,
      language,
      duration,
      success,
      confidence,
      wordCount,
      errorType,
      processingTime
    } = event;

    try {
      // Insert into database
      await db.query(
        `INSERT INTO voice_analytics (
          organization_id, user_id, bot_id, provider, language,
          duration_seconds, success, confidence, word_count,
          error_type, processing_time_ms, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          organizationId, userId, botId, provider, language,
          duration, success, confidence, wordCount,
          errorType, processingTime
        ]
      );

      // Update in-memory metrics
      this.updateMetrics(event);

      log.debug('Voice analytics recorded', { provider, success, duration });

    } catch (error) {
      log.error('Failed to record voice analytics', { error: error.message });
    }
  }

  /**
   * Update in-memory metrics
   * @param {Object} event - Event data
   */
  updateMetrics(event) {
    this.metrics.totalTranscriptions++;

    if (event.success) {
      this.metrics.successfulTranscriptions++;
    } else {
      this.metrics.failedTranscriptions++;
    }

    this.metrics.totalDuration += event.duration || 0;

    // Update provider stats
    if (!this.metrics.byProvider[event.provider]) {
      this.metrics.byProvider[event.provider] = {
        total: 0,
        successful: 0,
        failed: 0,
        totalDuration: 0,
        avgConfidence: 0
      };
    }
    const providerStats = this.metrics.byProvider[event.provider];
    providerStats.total++;
    if (event.success) {
      providerStats.successful++;
      providerStats.avgConfidence =
        (providerStats.avgConfidence * (providerStats.successful - 1) + (event.confidence || 0)) /
        providerStats.successful;
    } else {
      providerStats.failed++;
    }
    providerStats.totalDuration += event.duration || 0;

    // Update language stats
    if (!this.metrics.byLanguage[event.language]) {
      this.metrics.byLanguage[event.language] = {
        total: 0,
        successful: 0,
        failed: 0
      };
    }
    const langStats = this.metrics.byLanguage[event.language];
    langStats.total++;
    if (event.success) {
      langStats.successful++;
    } else {
      langStats.failed++;
    }
  }

  /**
   * Get voice statistics
   * @param {Object} options - Query options
   * @returns {Object} Statistics
   */
  async getStats(options = {}) {
    const {
      organizationId,
      userId,
      botId,
      startDate,
      endDate,
      provider,
      language
    } = options;

    try {
      let query = `
        SELECT
          COUNT(*) as total_transcriptions,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
          SUM(duration_seconds) as total_duration,
          AVG(CASE WHEN success THEN confidence ELSE NULL END) as avg_confidence,
          AVG(processing_time_ms) as avg_processing_time,
          SUM(word_count) as total_words
        FROM voice_analytics
        WHERE 1=1
      `;

      const values = [];
      let paramIndex = 1;

      if (organizationId) {
        query += ` AND organization_id = $${paramIndex}`;
        values.push(organizationId);
        paramIndex++;
      }

      if (userId) {
        query += ` AND user_id = $${paramIndex}`;
        values.push(userId);
        paramIndex++;
      }

      if (botId) {
        query += ` AND bot_id = $${paramIndex}`;
        values.push(botId);
        paramIndex++;
      }

      if (startDate) {
        query += ` AND created_at >= $${paramIndex}`;
        values.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND created_at <= $${paramIndex}`;
        values.push(endDate);
        paramIndex++;
      }

      if (provider) {
        query += ` AND provider = $${paramIndex}`;
        values.push(provider);
        paramIndex++;
      }

      if (language) {
        query += ` AND language = $${paramIndex}`;
        values.push(language);
        paramIndex++;
      }

      const result = await db.query(query, values);
      const stats = result.rows[0];

      // Get breakdown by provider
      const providerBreakdown = await this.getProviderBreakdown(options);

      // Get breakdown by language
      const languageBreakdown = await this.getLanguageBreakdown(options);

      // Get daily trend
      const dailyTrend = await this.getDailyTrend(options);

      // Get error breakdown
      const errorBreakdown = await this.getErrorBreakdown(options);

      return {
        summary: {
          totalTranscriptions: parseInt(stats.total_transcriptions) || 0,
          successful: parseInt(stats.successful) || 0,
          failed: parseInt(stats.failed) || 0,
          successRate: stats.total_transcriptions > 0
            ? ((stats.successful / stats.total_transcriptions) * 100).toFixed(2) + '%'
            : '0%',
          totalDuration: parseFloat(stats.total_duration) || 0,
          totalDurationFormatted: this.formatDuration(stats.total_duration),
          avgConfidence: parseFloat(stats.avg_confidence)?.toFixed(2) || 0,
          avgProcessingTime: parseFloat(stats.avg_processing_time)?.toFixed(0) + 'ms' || '0ms',
          totalWords: parseInt(stats.total_words) || 0
        },
        byProvider: providerBreakdown,
        byLanguage: languageBreakdown,
        dailyTrend,
        errors: errorBreakdown
      };

    } catch (error) {
      log.error('Failed to get voice stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Get provider breakdown
   */
  async getProviderBreakdown(options) {
    let query = `
      SELECT
        provider,
        COUNT(*) as total,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
        SUM(duration_seconds) as total_duration,
        AVG(CASE WHEN success THEN confidence ELSE NULL END) as avg_confidence
      FROM voice_analytics
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (options.organizationId) {
      query += ` AND organization_id = $${paramIndex}`;
      values.push(options.organizationId);
      paramIndex++;
    }

    if (options.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      values.push(options.startDate);
      paramIndex++;
    }

    if (options.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      values.push(options.endDate);
      paramIndex++;
    }

    query += ' GROUP BY provider ORDER BY total DESC';

    const result = await db.query(query, values);

    return result.rows.map(row => ({
      provider: row.provider,
      total: parseInt(row.total),
      successful: parseInt(row.successful),
      successRate: ((row.successful / row.total) * 100).toFixed(1) + '%',
      totalDuration: parseFloat(row.total_duration) || 0,
      avgConfidence: parseFloat(row.avg_confidence)?.toFixed(2) || 0
    }));
  }

  /**
   * Get language breakdown
   */
  async getLanguageBreakdown(options) {
    let query = `
      SELECT
        language,
        COUNT(*) as total,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
        SUM(duration_seconds) as total_duration
      FROM voice_analytics
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (options.organizationId) {
      query += ` AND organization_id = $${paramIndex}`;
      values.push(options.organizationId);
      paramIndex++;
    }

    if (options.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      values.push(options.startDate);
      paramIndex++;
    }

    if (options.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      values.push(options.endDate);
      paramIndex++;
    }

    query += ' GROUP BY language ORDER BY total DESC';

    const result = await db.query(query, values);

    return result.rows.map(row => ({
      language: row.language,
      total: parseInt(row.total),
      successful: parseInt(row.successful),
      successRate: ((row.successful / row.total) * 100).toFixed(1) + '%',
      totalDuration: parseFloat(row.total_duration) || 0
    }));
  }

  /**
   * Get daily trend
   */
  async getDailyTrend(options) {
    const days = options.days || 30;

    let query = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
        SUM(duration_seconds) as total_duration
      FROM voice_analytics
      WHERE created_at >= NOW() - INTERVAL '${days} days'
    `;

    const values = [];
    let paramIndex = 1;

    if (options.organizationId) {
      query += ` AND organization_id = $${paramIndex}`;
      values.push(options.organizationId);
      paramIndex++;
    }

    query += ' GROUP BY DATE(created_at) ORDER BY date ASC';

    const result = await db.query(query, values);

    return result.rows.map(row => ({
      date: row.date,
      total: parseInt(row.total),
      successful: parseInt(row.successful),
      totalDuration: parseFloat(row.total_duration) || 0
    }));
  }

  /**
   * Get error breakdown
   */
  async getErrorBreakdown(options) {
    let query = `
      SELECT
        error_type,
        COUNT(*) as count
      FROM voice_analytics
      WHERE NOT success AND error_type IS NOT NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (options.organizationId) {
      query += ` AND organization_id = $${paramIndex}`;
      values.push(options.organizationId);
      paramIndex++;
    }

    if (options.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      values.push(options.startDate);
      paramIndex++;
    }

    if (options.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      values.push(options.endDate);
      paramIndex++;
    }

    query += ' GROUP BY error_type ORDER BY count DESC LIMIT 10';

    const result = await db.query(query, values);

    return result.rows.map(row => ({
      errorType: row.error_type,
      count: parseInt(row.count)
    }));
  }

  /**
   * Get real-time metrics
   * @returns {Object} Current metrics
   */
  getRealTimeMetrics() {
    const successRate = this.metrics.totalTranscriptions > 0
      ? (this.metrics.successfulTranscriptions / this.metrics.totalTranscriptions * 100).toFixed(2)
      : 0;

    return {
      totalTranscriptions: this.metrics.totalTranscriptions,
      successfulTranscriptions: this.metrics.successfulTranscriptions,
      failedTranscriptions: this.metrics.failedTranscriptions,
      successRate: successRate + '%',
      totalDuration: this.metrics.totalDuration,
      totalDurationFormatted: this.formatDuration(this.metrics.totalDuration),
      byProvider: this.metrics.byProvider,
      byLanguage: this.metrics.byLanguage
    };
  }

  /**
   * Format duration in seconds to readable format
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    if (!seconds) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Start tracking a transcription session
   * @param {string} sessionId - Session ID
   */
  startSession(sessionId) {
    this.sessionMetrics.set(sessionId, {
      startTime: Date.now(),
      transcriptions: 0,
      totalDuration: 0
    });
  }

  /**
   * End tracking a transcription session
   * @param {string} sessionId - Session ID
   * @returns {Object} Session summary
   */
  endSession(sessionId) {
    const session = this.sessionMetrics.get(sessionId);
    if (!session) return null;

    const summary = {
      sessionId,
      duration: Date.now() - session.startTime,
      transcriptions: session.transcriptions,
      totalAudioDuration: session.totalDuration
    };

    this.sessionMetrics.delete(sessionId);
    return summary;
  }

  /**
   * Update session metrics
   * @param {string} sessionId - Session ID
   * @param {Object} data - Update data
   */
  updateSession(sessionId, data) {
    const session = this.sessionMetrics.get(sessionId);
    if (session) {
      session.transcriptions++;
      session.totalDuration += data.duration || 0;
    }
  }
}

// Export singleton instance
module.exports = new VoiceAnalytics();
