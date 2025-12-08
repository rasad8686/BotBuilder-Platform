const db = require('../db');

class NLUAnalytics {
  /**
   * Log an NLU analysis result
   */
  async logAnalysis(botId, organizationId, data) {
    const {
      message,
      detectedIntentId,
      detectedIntentName,
      confidence,
      entitiesExtracted,
      matched,
      responseTimeMs,
      userSessionId
    } = data;

    await db.query(
      `INSERT INTO nlu_logs
       (bot_id, organization_id, message, detected_intent_id, detected_intent_name,
        confidence, entities_extracted, matched, response_time_ms, user_session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        botId,
        organizationId,
        message,
        detectedIntentId || null,
        detectedIntentName || null,
        confidence || 0,
        JSON.stringify(entitiesExtracted || []),
        matched || false,
        responseTimeMs || 0,
        userSessionId || null
      ]
    );
  }

  /**
   * Get intent usage statistics
   */
  async getIntentStats(botId, organizationId, days = 30) {
    const result = await db.query(
      `SELECT
        nl.detected_intent_id as intent_id,
        COALESCE(nl.detected_intent_name, i.name, 'Unknown') as name,
        i.display_name,
        COUNT(*) as hit_count,
        ROUND(AVG(nl.confidence)::numeric, 4) as avg_confidence,
        MAX(nl.created_at) as last_used,
        COUNT(CASE WHEN nl.matched = true THEN 1 END) as matched_count
       FROM nlu_logs nl
       LEFT JOIN intents i ON nl.detected_intent_id = i.id
       WHERE nl.bot_id = $1
         AND nl.organization_id = $2
         AND nl.created_at >= NOW() - INTERVAL '1 day' * $3
         AND nl.detected_intent_id IS NOT NULL
       GROUP BY nl.detected_intent_id, nl.detected_intent_name, i.name, i.display_name
       ORDER BY hit_count DESC`,
      [botId, organizationId, days]
    );

    return result.rows.map(row => ({
      intentId: row.intent_id,
      name: row.name,
      displayName: row.display_name,
      hitCount: parseInt(row.hit_count),
      avgConfidence: parseFloat(row.avg_confidence) || 0,
      matchedCount: parseInt(row.matched_count),
      lastUsed: row.last_used
    }));
  }

  /**
   * Get entity extraction statistics
   */
  async getEntityStats(botId, organizationId, days = 30) {
    const result = await db.query(
      `SELECT
        entity_data->>'entityId' as entity_id,
        entity_data->>'entityName' as entity_name,
        COUNT(*) as extraction_count,
        COUNT(DISTINCT entity_data->>'value') as unique_values
       FROM nlu_logs nl,
       LATERAL jsonb_array_elements(nl.entities_extracted) as entity_data
       WHERE nl.bot_id = $1
         AND nl.organization_id = $2
         AND nl.created_at >= NOW() - INTERVAL '1 day' * $3
         AND jsonb_array_length(nl.entities_extracted) > 0
       GROUP BY entity_data->>'entityId', entity_data->>'entityName'
       ORDER BY extraction_count DESC`,
      [botId, organizationId, days]
    );

    return result.rows.map(row => ({
      entityId: row.entity_id,
      entityName: row.entity_name,
      extractionCount: parseInt(row.extraction_count),
      uniqueValues: parseInt(row.unique_values)
    }));
  }

  /**
   * Get confidence score distribution
   */
  async getConfidenceDistribution(botId, organizationId) {
    const ranges = [
      { min: 0, max: 0.2, label: 'Very Low (0-20%)' },
      { min: 0.2, max: 0.4, label: 'Low (20-40%)' },
      { min: 0.4, max: 0.6, label: 'Medium (40-60%)' },
      { min: 0.6, max: 0.8, label: 'High (60-80%)' },
      { min: 0.8, max: 1.0, label: 'Very High (80-100%)' }
    ];

    const result = await db.query(
      `SELECT
        CASE
          WHEN confidence >= 0 AND confidence < 0.2 THEN 0
          WHEN confidence >= 0.2 AND confidence < 0.4 THEN 1
          WHEN confidence >= 0.4 AND confidence < 0.6 THEN 2
          WHEN confidence >= 0.6 AND confidence < 0.8 THEN 3
          WHEN confidence >= 0.8 AND confidence <= 1.0 THEN 4
          ELSE -1
        END as range_idx,
        COUNT(*) as count
       FROM nlu_logs
       WHERE bot_id = $1 AND organization_id = $2
       GROUP BY range_idx
       ORDER BY range_idx`,
      [botId, organizationId]
    );

    const distribution = ranges.map((range, idx) => {
      const found = result.rows.find(r => parseInt(r.range_idx) === idx);
      return {
        ...range,
        count: found ? parseInt(found.count) : 0
      };
    });

    const total = distribution.reduce((sum, d) => sum + d.count, 0);

    return {
      ranges: distribution,
      total
    };
  }

  /**
   * Get low confidence messages
   */
  async getLowConfidenceMessages(botId, organizationId, limit = 50, threshold = 0.5) {
    const result = await db.query(
      `SELECT
        nl.message,
        nl.detected_intent_name as detected_intent,
        nl.confidence,
        nl.created_at as timestamp,
        nl.entities_extracted
       FROM nlu_logs nl
       WHERE nl.bot_id = $1
         AND nl.organization_id = $2
         AND nl.confidence < $3
         AND nl.confidence > 0
       ORDER BY nl.confidence ASC, nl.created_at DESC
       LIMIT $4`,
      [botId, organizationId, threshold, limit]
    );

    return result.rows.map(row => ({
      message: row.message,
      detectedIntent: row.detected_intent,
      confidence: parseFloat(row.confidence),
      timestamp: row.timestamp,
      entitiesExtracted: row.entities_extracted
    }));
  }

  /**
   * Get unmatched messages (no intent detected)
   */
  async getUnmatchedMessages(botId, organizationId, limit = 50) {
    // Get unmatched messages
    const result = await db.query(
      `SELECT
        nl.message,
        nl.created_at as timestamp
       FROM nlu_logs nl
       WHERE nl.bot_id = $1
         AND nl.organization_id = $2
         AND (nl.matched = false OR nl.detected_intent_id IS NULL)
       ORDER BY nl.created_at DESC
       LIMIT $3`,
      [botId, organizationId, limit]
    );

    // Get all intents for suggestion
    const intentsResult = await db.query(
      `SELECT id, name, display_name FROM intents
       WHERE bot_id = $1 AND organization_id = $2`,
      [botId, organizationId]
    );

    const intents = intentsResult.rows;

    return result.rows.map(row => ({
      message: row.message,
      timestamp: row.timestamp,
      suggestedIntent: this.suggestIntent(row.message, intents)
    }));
  }

  /**
   * Simple intent suggestion based on keyword matching
   */
  suggestIntent(message, intents) {
    if (!intents || intents.length === 0) return null;

    const messageLower = message.toLowerCase();

    for (const intent of intents) {
      const keywords = intent.name.toLowerCase().split('_');
      for (const keyword of keywords) {
        if (keyword.length > 2 && messageLower.includes(keyword)) {
          return {
            intentId: intent.id,
            intentName: intent.name,
            displayName: intent.display_name
          };
        }
      }
    }

    return null;
  }

  /**
   * Get training gaps (intents with few examples)
   */
  async getTrainingGaps(botId, organizationId) {
    const result = await db.query(
      `SELECT
        i.id as intent_id,
        i.name,
        i.display_name,
        COUNT(ie.id) as example_count,
        COALESCE(
          (SELECT COUNT(*) FROM nlu_logs nl
           WHERE nl.detected_intent_id = i.id
           AND nl.created_at >= NOW() - INTERVAL '30 days'), 0
        ) as usage_count
       FROM intents i
       LEFT JOIN intent_examples ie ON i.id = ie.intent_id
       WHERE i.bot_id = $1 AND i.organization_id = $2
       GROUP BY i.id, i.name, i.display_name
       ORDER BY example_count ASC, usage_count DESC`,
      [botId, organizationId]
    );

    return result.rows.map(row => {
      const exampleCount = parseInt(row.example_count);
      const usageCount = parseInt(row.usage_count);

      let recommendation = '';
      let priority = 'low';

      if (exampleCount === 0) {
        recommendation = 'Critical: No examples. Add at least 5-10 training examples.';
        priority = 'critical';
      } else if (exampleCount < 3) {
        recommendation = 'High: Very few examples. Add more diverse training examples.';
        priority = 'high';
      } else if (exampleCount < 5) {
        recommendation = 'Medium: Consider adding more examples for better accuracy.';
        priority = 'medium';
      } else if (exampleCount < 10 && usageCount > 50) {
        recommendation = 'Medium: High usage with moderate examples. Consider adding more.';
        priority = 'medium';
      } else {
        recommendation = 'Good: Sufficient examples for training.';
        priority = 'low';
      }

      return {
        intentId: row.intent_id,
        name: row.name,
        displayName: row.display_name,
        exampleCount,
        usageCount,
        recommendation,
        priority
      };
    });
  }

  /**
   * Get daily NLU usage statistics
   */
  async getDailyUsage(botId, organizationId, days = 30) {
    const result = await db.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as total_queries,
        ROUND(AVG(confidence)::numeric, 4) as avg_confidence,
        COUNT(CASE WHEN matched = true THEN 1 END) as matched_queries,
        ROUND(AVG(response_time_ms)::numeric, 2) as avg_response_time
       FROM nlu_logs
       WHERE bot_id = $1
         AND organization_id = $2
         AND created_at >= NOW() - INTERVAL '1 day' * $3
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [botId, organizationId, days]
    );

    return result.rows.map(row => ({
      date: row.date,
      totalQueries: parseInt(row.total_queries),
      avgConfidence: parseFloat(row.avg_confidence) || 0,
      matchedQueries: parseInt(row.matched_queries),
      matchRate: row.total_queries > 0
        ? Math.round((row.matched_queries / row.total_queries) * 100)
        : 0,
      avgResponseTime: parseFloat(row.avg_response_time) || 0
    }));
  }

  /**
   * Get overall NLU summary
   */
  async getSummary(botId, organizationId, days = 30) {
    const result = await db.query(
      `SELECT
        COUNT(*) as total_queries,
        ROUND(AVG(confidence)::numeric, 4) as avg_confidence,
        COUNT(CASE WHEN matched = true THEN 1 END) as matched_queries,
        COUNT(CASE WHEN confidence < 0.5 THEN 1 END) as low_confidence_queries,
        COUNT(DISTINCT detected_intent_id) as unique_intents_used,
        ROUND(AVG(response_time_ms)::numeric, 2) as avg_response_time
       FROM nlu_logs
       WHERE bot_id = $1
         AND organization_id = $2
         AND created_at >= NOW() - INTERVAL '1 day' * $3`,
      [botId, organizationId, days]
    );

    const row = result.rows[0];
    const totalQueries = parseInt(row.total_queries) || 0;

    return {
      totalQueries,
      avgConfidence: parseFloat(row.avg_confidence) || 0,
      matchedQueries: parseInt(row.matched_queries) || 0,
      matchRate: totalQueries > 0
        ? Math.round((row.matched_queries / totalQueries) * 100)
        : 0,
      lowConfidenceQueries: parseInt(row.low_confidence_queries) || 0,
      uniqueIntentsUsed: parseInt(row.unique_intents_used) || 0,
      avgResponseTime: parseFloat(row.avg_response_time) || 0,
      period: `${days} days`
    };
  }
}

module.exports = new NLUAnalytics();
