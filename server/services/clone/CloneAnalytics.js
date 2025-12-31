/**
 * Clone Analytics Service
 * Performance metrics and usage analytics for clones
 */

const db = require('../../db');
const log = require('../../utils/logger');

class CloneAnalytics {
  constructor() {
    this.metrics = [
      'total_responses',
      'avg_rating',
      'response_time',
      'similarity_score',
      'token_usage',
      'edit_rate'
    ];
  }

  /**
   * Get comprehensive analytics for a clone
   * @param {string} cloneId - Clone ID
   * @param {string} userId - User ID
   * @param {Object} options - Analytics options
   * @returns {Promise<Object>} Analytics data
   */
  async getCloneAnalytics(cloneId, userId, options = {}) {
    try {
      const { startDate, endDate, granularity = 'day' } = options;

      // Verify ownership
      const cloneCheck = await db.query(
        `SELECT * FROM work_clones WHERE id = $1 AND user_id = $2`,
        [cloneId, userId]
      );

      if (cloneCheck.rows.length === 0) {
        return { success: false, error: 'Clone not found' };
      }

      const clone = cloneCheck.rows[0];

      // Get overview metrics
      const overview = await this._getOverviewMetrics(cloneId, startDate, endDate);

      // Get time series data
      const timeSeries = await this._getTimeSeriesData(cloneId, startDate, endDate, granularity);

      // Get response type breakdown
      const responseTypes = await this._getResponseTypeBreakdown(cloneId, startDate, endDate);

      // Get quality metrics
      const quality = await this._getQualityMetrics(cloneId, startDate, endDate);

      // Get training data analysis
      const training = await this._getTrainingAnalysis(cloneId);

      // Get comparison with other clones (if user has multiple)
      const comparison = await this._getComparisonMetrics(cloneId, userId);

      return {
        success: true,
        analytics: {
          clone: {
            id: clone.id,
            name: clone.name,
            status: clone.status,
            createdAt: clone.created_at,
            lastTrainedAt: clone.last_trained_at,
            trainingScore: clone.training_score
          },
          overview,
          timeSeries,
          responseTypes,
          quality,
          training,
          comparison,
          period: { startDate, endDate, granularity }
        }
      };
    } catch (error) {
      log.error('Error getting clone analytics', { error: error.message, cloneId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get overview metrics
   * @private
   */
  async _getOverviewMetrics(cloneId, startDate, endDate) {
    let dateFilter = '';
    const params = [cloneId];

    if (startDate) {
      params.push(startDate);
      dateFilter += ` AND created_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      dateFilter += ` AND created_at <= $${params.length}`;
    }

    const result = await db.query(
      `SELECT
        COUNT(*) as total_responses,
        COUNT(DISTINCT DATE(created_at)) as active_days,
        AVG(rating)::decimal(3,2) as avg_rating,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_ratings,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative_ratings,
        AVG(latency_ms)::int as avg_latency_ms,
        MIN(latency_ms) as min_latency_ms,
        MAX(latency_ms) as max_latency_ms,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        AVG(similarity_score)::decimal(3,2) as avg_similarity,
        COUNT(CASE WHEN was_edited THEN 1 END) as edited_count,
        COUNT(CASE WHEN was_used THEN 1 END) as used_count
       FROM clone_responses
       WHERE clone_id = $1 ${dateFilter}`,
      params
    );

    const stats = result.rows[0];

    return {
      totalResponses: parseInt(stats.total_responses) || 0,
      activeDays: parseInt(stats.active_days) || 0,
      avgRating: parseFloat(stats.avg_rating) || 0,
      positiveRatings: parseInt(stats.positive_ratings) || 0,
      negativeRatings: parseInt(stats.negative_ratings) || 0,
      avgLatencyMs: parseInt(stats.avg_latency_ms) || 0,
      latencyRange: {
        min: parseInt(stats.min_latency_ms) || 0,
        max: parseInt(stats.max_latency_ms) || 0
      },
      tokenUsage: {
        input: parseInt(stats.total_input_tokens) || 0,
        output: parseInt(stats.total_output_tokens) || 0,
        total: (parseInt(stats.total_input_tokens) || 0) + (parseInt(stats.total_output_tokens) || 0)
      },
      avgSimilarity: parseFloat(stats.avg_similarity) || 0,
      editRate: stats.total_responses > 0
        ? ((parseInt(stats.edited_count) / parseInt(stats.total_responses)) * 100).toFixed(1)
        : 0,
      usageRate: stats.total_responses > 0
        ? ((parseInt(stats.used_count) / parseInt(stats.total_responses)) * 100).toFixed(1)
        : 0
    };
  }

  /**
   * Get time series data
   * @private
   */
  async _getTimeSeriesData(cloneId, startDate, endDate, granularity) {
    const dateFormat = granularity === 'hour' ? 'YYYY-MM-DD HH24:00'
      : granularity === 'week' ? 'IYYY-IW'
      : granularity === 'month' ? 'YYYY-MM'
      : 'YYYY-MM-DD';

    let dateFilter = '';
    const params = [cloneId];

    if (startDate) {
      params.push(startDate);
      dateFilter += ` AND created_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      dateFilter += ` AND created_at <= $${params.length}`;
    }

    const result = await db.query(
      `SELECT
        TO_CHAR(created_at, '${dateFormat}') as period,
        COUNT(*) as response_count,
        AVG(rating)::decimal(3,2) as avg_rating,
        AVG(latency_ms)::int as avg_latency,
        SUM(input_tokens + output_tokens) as total_tokens,
        AVG(similarity_score)::decimal(3,2) as avg_similarity
       FROM clone_responses
       WHERE clone_id = $1 ${dateFilter}
       GROUP BY period
       ORDER BY period`,
      params
    );

    return result.rows.map(row => ({
      period: row.period,
      responseCount: parseInt(row.response_count),
      avgRating: parseFloat(row.avg_rating) || null,
      avgLatency: parseInt(row.avg_latency),
      totalTokens: parseInt(row.total_tokens),
      avgSimilarity: parseFloat(row.avg_similarity) || null
    }));
  }

  /**
   * Get response type breakdown
   * @private
   */
  async _getResponseTypeBreakdown(cloneId, startDate, endDate) {
    let dateFilter = '';
    const params = [cloneId];

    if (startDate) {
      params.push(startDate);
      dateFilter += ` AND created_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      dateFilter += ` AND created_at <= $${params.length}`;
    }

    const result = await db.query(
      `SELECT
        response_type,
        COUNT(*) as count,
        AVG(rating)::decimal(3,2) as avg_rating,
        AVG(latency_ms)::int as avg_latency,
        AVG(similarity_score)::decimal(3,2) as avg_similarity
       FROM clone_responses
       WHERE clone_id = $1 ${dateFilter}
       GROUP BY response_type
       ORDER BY count DESC`,
      params
    );

    return result.rows.map(row => ({
      type: row.response_type,
      count: parseInt(row.count),
      avgRating: parseFloat(row.avg_rating) || null,
      avgLatency: parseInt(row.avg_latency),
      avgSimilarity: parseFloat(row.avg_similarity) || null
    }));
  }

  /**
   * Get quality metrics
   * @private
   */
  async _getQualityMetrics(cloneId, startDate, endDate) {
    let dateFilter = '';
    const params = [cloneId];

    if (startDate) {
      params.push(startDate);
      dateFilter += ` AND created_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      dateFilter += ` AND created_at <= $${params.length}`;
    }

    // Rating distribution
    const ratingDist = await db.query(
      `SELECT
        rating,
        COUNT(*) as count
       FROM clone_responses
       WHERE clone_id = $1 AND rating IS NOT NULL ${dateFilter}
       GROUP BY rating
       ORDER BY rating`,
      params
    );

    // Similarity score distribution
    const similarityDist = await db.query(
      `SELECT
        CASE
          WHEN similarity_score >= 0.9 THEN 'excellent'
          WHEN similarity_score >= 0.7 THEN 'good'
          WHEN similarity_score >= 0.5 THEN 'fair'
          ELSE 'needs_improvement'
        END as quality_level,
        COUNT(*) as count
       FROM clone_responses
       WHERE clone_id = $1 AND similarity_score IS NOT NULL ${dateFilter}
       GROUP BY quality_level`,
      params
    );

    // Common feedback themes
    const feedbackResult = await db.query(
      `SELECT feedback
       FROM clone_responses
       WHERE clone_id = $1 AND feedback IS NOT NULL ${dateFilter}
       ORDER BY created_at DESC
       LIMIT 100`,
      params
    );

    return {
      ratingDistribution: ratingDist.rows.map(r => ({
        rating: r.rating,
        count: parseInt(r.count)
      })),
      qualityDistribution: similarityDist.rows.map(r => ({
        level: r.quality_level,
        count: parseInt(r.count)
      })),
      recentFeedback: feedbackResult.rows.map(r => r.feedback).filter(Boolean).slice(0, 10)
    };
  }

  /**
   * Get training data analysis
   * @private
   */
  async _getTrainingAnalysis(cloneId) {
    const result = await db.query(
      `SELECT
        data_type,
        COUNT(*) as count,
        AVG(quality_score)::decimal(3,2) as avg_quality,
        COUNT(CASE WHEN is_processed THEN 1 END) as processed_count,
        COUNT(CASE WHEN is_approved THEN 1 END) as approved_count
       FROM clone_training_data
       WHERE clone_id = $1
       GROUP BY data_type`,
      [cloneId]
    );

    return {
      byType: result.rows.map(r => ({
        type: r.data_type,
        count: parseInt(r.count),
        avgQuality: parseFloat(r.avg_quality) || 0,
        processedCount: parseInt(r.processed_count),
        approvedCount: parseInt(r.approved_count)
      })),
      totalSamples: result.rows.reduce((sum, r) => sum + parseInt(r.count), 0)
    };
  }

  /**
   * Get comparison with user's other clones
   * @private
   */
  async _getComparisonMetrics(cloneId, userId) {
    const result = await db.query(
      `SELECT
        wc.id,
        wc.name,
        COUNT(cr.id) as response_count,
        AVG(cr.rating)::decimal(3,2) as avg_rating,
        AVG(cr.similarity_score)::decimal(3,2) as avg_similarity,
        wc.training_score
       FROM work_clones wc
       LEFT JOIN clone_responses cr ON cr.clone_id = wc.id
       WHERE wc.user_id = $1
       GROUP BY wc.id, wc.name, wc.training_score
       ORDER BY response_count DESC
       LIMIT 5`,
      [userId]
    );

    return result.rows.map(r => ({
      id: r.id,
      name: r.name,
      responseCount: parseInt(r.response_count) || 0,
      avgRating: parseFloat(r.avg_rating) || 0,
      avgSimilarity: parseFloat(r.avg_similarity) || 0,
      trainingScore: r.training_score || 0,
      isCurrent: r.id === cloneId
    }));
  }

  /**
   * Compare two clones
   * @param {string} cloneId1 - First clone ID
   * @param {string} cloneId2 - Second clone ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Comparison result
   */
  async compareClones(cloneId1, cloneId2, userId) {
    try {
      // Get analytics for both clones
      const [analytics1, analytics2] = await Promise.all([
        this.getCloneAnalytics(cloneId1, userId, {}),
        this.getCloneAnalytics(cloneId2, userId, {})
      ]);

      if (!analytics1.success || !analytics2.success) {
        return { success: false, error: 'Could not fetch analytics for one or both clones' };
      }

      const a1 = analytics1.analytics;
      const a2 = analytics2.analytics;

      return {
        success: true,
        comparison: {
          clones: [
            { id: cloneId1, name: a1.clone.name },
            { id: cloneId2, name: a2.clone.name }
          ],
          metrics: {
            totalResponses: [a1.overview.totalResponses, a2.overview.totalResponses],
            avgRating: [a1.overview.avgRating, a2.overview.avgRating],
            avgLatency: [a1.overview.avgLatencyMs, a2.overview.avgLatencyMs],
            avgSimilarity: [a1.overview.avgSimilarity, a2.overview.avgSimilarity],
            editRate: [parseFloat(a1.overview.editRate), parseFloat(a2.overview.editRate)],
            tokenUsage: [a1.overview.tokenUsage.total, a2.overview.tokenUsage.total],
            trainingScore: [a1.clone.trainingScore, a2.clone.trainingScore]
          },
          winner: this._determineWinner(a1.overview, a2.overview),
          recommendations: this._generateRecommendations(a1, a2)
        }
      };
    } catch (error) {
      log.error('Error comparing clones', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get dashboard summary for all user's clones
   * @param {string} userId - User ID
   * @param {Object} options - Options
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboard(userId, options = {}) {
    try {
      const { startDate, endDate } = options;

      // Get all clones summary
      const clonesResult = await db.query(
        `SELECT
          wc.id, wc.name, wc.status, wc.training_score,
          COUNT(cr.id) as response_count,
          AVG(cr.rating)::decimal(3,2) as avg_rating,
          MAX(cr.created_at) as last_used
         FROM work_clones wc
         LEFT JOIN clone_responses cr ON cr.clone_id = wc.id
         WHERE wc.user_id = $1
         GROUP BY wc.id
         ORDER BY response_count DESC`,
        [userId]
      );

      // Get total usage across all clones
      let dateFilter = '';
      const params = [userId];
      if (startDate) {
        params.push(startDate);
        dateFilter += ` AND cr.created_at >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate);
        dateFilter += ` AND cr.created_at <= $${params.length}`;
      }

      const totalResult = await db.query(
        `SELECT
          COUNT(*) as total_responses,
          AVG(cr.rating)::decimal(3,2) as avg_rating,
          SUM(cr.input_tokens + cr.output_tokens) as total_tokens
         FROM clone_responses cr
         JOIN work_clones wc ON wc.id = cr.clone_id
         WHERE wc.user_id = $1 ${dateFilter}`,
        params
      );

      return {
        success: true,
        dashboard: {
          clones: clonesResult.rows.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
            trainingScore: c.training_score,
            responseCount: parseInt(c.response_count) || 0,
            avgRating: parseFloat(c.avg_rating) || null,
            lastUsed: c.last_used
          })),
          totals: {
            cloneCount: clonesResult.rows.length,
            totalResponses: parseInt(totalResult.rows[0].total_responses) || 0,
            avgRating: parseFloat(totalResult.rows[0].avg_rating) || 0,
            totalTokens: parseInt(totalResult.rows[0].total_tokens) || 0
          },
          period: { startDate, endDate }
        }
      };
    } catch (error) {
      log.error('Error getting dashboard', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Determine winner in comparison
   * @private
   */
  _determineWinner(o1, o2) {
    let score1 = 0, score2 = 0;

    if (o1.avgRating > o2.avgRating) score1++; else if (o2.avgRating > o1.avgRating) score2++;
    if (o1.avgSimilarity > o2.avgSimilarity) score1++; else if (o2.avgSimilarity > o1.avgSimilarity) score2++;
    if (parseFloat(o1.editRate) < parseFloat(o2.editRate)) score1++; else if (parseFloat(o2.editRate) < parseFloat(o1.editRate)) score2++;
    if (o1.avgLatencyMs < o2.avgLatencyMs) score1++; else if (o2.avgLatencyMs < o1.avgLatencyMs) score2++;

    if (score1 > score2) return { winner: 1, score: `${score1}-${score2}` };
    if (score2 > score1) return { winner: 2, score: `${score2}-${score1}` };
    return { winner: 0, score: 'tie' };
  }

  /**
   * Generate recommendations based on comparison
   * @private
   */
  _generateRecommendations(a1, a2) {
    const recommendations = [];

    if (a1.overview.avgRating < 3.5) {
      recommendations.push(`Consider improving ${a1.clone.name} - low average rating`);
    }
    if (a2.overview.avgRating < 3.5) {
      recommendations.push(`Consider improving ${a2.clone.name} - low average rating`);
    }
    if (parseFloat(a1.overview.editRate) > 30) {
      recommendations.push(`${a1.clone.name} has high edit rate - may need more training`);
    }
    if (parseFloat(a2.overview.editRate) > 30) {
      recommendations.push(`${a2.clone.name} has high edit rate - may need more training`);
    }

    return recommendations;
  }
}

module.exports = CloneAnalytics;
