/**
 * A/B Test Service
 * Handles all business logic for A/B testing system
 */

const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class ABTestService {
  // ==================== TESTS CRUD ====================

  /**
   * Get all A/B tests with pagination
   */
  async getTests(workspaceId, options = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    try {
      const hasTable = await db.schema.hasTable('ab_tests');
      if (!hasTable) {
        return { tests: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }

      let query = db('ab_tests')
        .where('workspace_id', workspaceId)
        .orderBy('created_at', 'desc');

      if (status) {
        query = query.where('status', status);
      }

      const [tests, countResult] = await Promise.all([
        query.clone().limit(limit).offset(offset),
        db('ab_tests').where('workspace_id', workspaceId).count('id as total').first()
      ]);

      const total = countResult?.total ? parseInt(countResult.total) : 0;

      return {
        tests: tests || [],
        pagination: {
          page,
          limit,
          total,
          totalPages: total > 0 ? Math.ceil(total / limit) : 0
        }
      };
    } catch (error) {
      console.error('getTests error:', error.message);
      return { tests: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
  }

  /**
   * Get single A/B test with variants and analytics
   */
  async getTestById(id, workspaceId) {
    const test = await db('ab_tests')
      .where({ id, workspace_id: workspaceId })
      .first();

    if (!test) return null;

    const variants = await db('ab_test_variants')
      .where('test_id', id)
      .orderBy('name', 'asc');

    // Get aggregate stats for each variant
    const stats = await db('ab_test_analytics')
      .where('test_id', id)
      .select('variant_id')
      .sum('impressions as total_impressions')
      .sum('conversions as total_conversions')
      .sum('total_value as total_value')
      .groupBy('variant_id');

    const statsMap = {};
    stats.forEach(s => {
      statsMap[s.variant_id] = {
        impressions: parseInt(s.total_impressions) || 0,
        conversions: parseInt(s.total_conversions) || 0,
        totalValue: parseFloat(s.total_value) || 0
      };
    });

    const variantsWithStats = variants.map(v => ({
      ...v,
      stats: statsMap[v.id] || { impressions: 0, conversions: 0, totalValue: 0 }
    }));

    return {
      ...test,
      variants: variantsWithStats
    };
  }

  /**
   * Create new A/B test with default variants
   */
  async createTest(workspaceId, data) {
    const testId = uuidv4();
    const now = new Date();

    const testData = {
      id: testId,
      workspace_id: workspaceId,
      name: data.name,
      description: data.description || null,
      status: 'draft',
      test_type: data.test_type,
      goal_metric: data.goal_metric || 'conversion',
      traffic_split: JSON.stringify(data.traffic_split || { A: 50, B: 50 }),
      auto_winner_enabled: data.auto_winner_enabled || false,
      auto_winner_threshold: data.auto_winner_threshold || 95,
      created_at: now,
      updated_at: now
    };

    await db('ab_tests').insert(testData);

    // Create default variants A (control) and B
    const variantA = {
      id: uuidv4(),
      test_id: testId,
      name: 'A',
      is_control: true,
      content: JSON.stringify(data.variants?.A?.content || {}),
      created_at: now,
      updated_at: now
    };

    const variantB = {
      id: uuidv4(),
      test_id: testId,
      name: 'B',
      is_control: false,
      content: JSON.stringify(data.variants?.B?.content || {}),
      created_at: now,
      updated_at: now
    };

    await db('ab_test_variants').insert([variantA, variantB]);

    return this.getTestById(testId, workspaceId);
  }

  /**
   * Update A/B test
   */
  async updateTest(id, workspaceId, data) {
    const updateData = { updated_at: new Date() };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.goal_metric !== undefined) updateData.goal_metric = data.goal_metric;
    if (data.traffic_split !== undefined) updateData.traffic_split = JSON.stringify(data.traffic_split);
    if (data.auto_winner_enabled !== undefined) updateData.auto_winner_enabled = data.auto_winner_enabled;
    if (data.auto_winner_threshold !== undefined) updateData.auto_winner_threshold = data.auto_winner_threshold;

    const [test] = await db('ab_tests')
      .where({ id, workspace_id: workspaceId })
      .update(updateData)
      .returning('*');

    return test;
  }

  /**
   * Delete A/B test
   */
  async deleteTest(id, workspaceId) {
    const deleted = await db('ab_tests')
      .where({ id, workspace_id: workspaceId })
      .del();

    return deleted > 0;
  }

  /**
   * Duplicate A/B test
   */
  async duplicateTest(id, workspaceId) {
    const original = await this.getTestById(id, workspaceId);
    if (!original) return null;

    const newTestId = uuidv4();
    const now = new Date();

    // Create new test
    const newTestData = {
      id: newTestId,
      workspace_id: workspaceId,
      name: `${original.name} (Copy)`,
      description: original.description,
      status: 'draft',
      test_type: original.test_type,
      goal_metric: original.goal_metric,
      traffic_split: original.traffic_split,
      auto_winner_enabled: original.auto_winner_enabled,
      auto_winner_threshold: original.auto_winner_threshold,
      created_at: now,
      updated_at: now
    };

    await db('ab_tests').insert(newTestData);

    // Duplicate variants
    if (original.variants && original.variants.length > 0) {
      const newVariants = original.variants.map(v => ({
        id: uuidv4(),
        test_id: newTestId,
        name: v.name,
        is_control: v.is_control,
        content: v.content,
        created_at: now,
        updated_at: now
      }));

      await db('ab_test_variants').insert(newVariants);
    }

    return this.getTestById(newTestId, workspaceId);
  }

  // ==================== STATUS MANAGEMENT ====================

  /**
   * Start A/B test
   */
  async startTest(id, workspaceId) {
    const [test] = await db('ab_tests')
      .where({ id, workspace_id: workspaceId, status: 'draft' })
      .update({
        status: 'running',
        started_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return test;
  }

  /**
   * Pause A/B test
   */
  async pauseTest(id, workspaceId) {
    const [test] = await db('ab_tests')
      .where({ id, workspace_id: workspaceId, status: 'running' })
      .update({
        status: 'paused',
        updated_at: new Date()
      })
      .returning('*');

    return test;
  }

  /**
   * Resume A/B test
   */
  async resumeTest(id, workspaceId) {
    const [test] = await db('ab_tests')
      .where({ id, workspace_id: workspaceId, status: 'paused' })
      .update({
        status: 'running',
        updated_at: new Date()
      })
      .returning('*');

    return test;
  }

  /**
   * Complete A/B test
   */
  async completeTest(id, workspaceId) {
    const [test] = await db('ab_tests')
      .where({ id, workspace_id: workspaceId })
      .whereIn('status', ['running', 'paused'])
      .update({
        status: 'completed',
        ended_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return test;
  }

  /**
   * Declare winner variant
   */
  async declareWinner(id, workspaceId, variantId) {
    // Get variant name
    const variant = await db('ab_test_variants')
      .where({ id: variantId, test_id: id })
      .first();

    if (!variant) return null;

    // Calculate confidence
    const testData = await this.getTestById(id, workspaceId);
    const control = testData.variants.find(v => v.is_control);
    const winner = testData.variants.find(v => v.id === variantId);

    let confidence = null;
    if (control && winner && control.stats && winner.stats) {
      const result = this.calculateSignificance(control.stats, winner.stats);
      confidence = result.confidence;
    }

    const [test] = await db('ab_tests')
      .where({ id, workspace_id: workspaceId })
      .update({
        status: 'completed',
        winner_variant: variant.name,
        winner_confidence: confidence,
        ended_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return test;
  }

  // ==================== VARIANTS ====================

  /**
   * Get variants for a test
   */
  async getVariants(testId) {
    return db('ab_test_variants')
      .where('test_id', testId)
      .orderBy('name', 'asc');
  }

  /**
   * Create new variant
   */
  async createVariant(testId, data) {
    const variantData = {
      id: uuidv4(),
      test_id: testId,
      name: data.name,
      is_control: data.is_control || false,
      content: JSON.stringify(data.content || {}),
      created_at: new Date(),
      updated_at: new Date()
    };

    const [variant] = await db('ab_test_variants').insert(variantData).returning('*');
    return variant;
  }

  /**
   * Update variant
   */
  async updateVariant(testId, variantId, data) {
    const updateData = { updated_at: new Date() };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.is_control !== undefined) updateData.is_control = data.is_control;
    if (data.content !== undefined) updateData.content = JSON.stringify(data.content);

    const [variant] = await db('ab_test_variants')
      .where({ id: variantId, test_id: testId })
      .update(updateData)
      .returning('*');

    return variant;
  }

  /**
   * Delete variant
   */
  async deleteVariant(testId, variantId) {
    const deleted = await db('ab_test_variants')
      .where({ id: variantId, test_id: testId })
      .del();

    return deleted > 0;
  }

  // ==================== ASSIGNMENT LOGIC ====================

  /**
   * Assign visitor to a variant
   */
  async assignVariant(testId, visitorId, userId = null) {
    // Check existing assignment
    const existing = await db('ab_test_assignments')
      .where({ test_id: testId, visitor_id: visitorId })
      .first();

    if (existing) {
      const variant = await db('ab_test_variants')
        .where('id', existing.variant_id)
        .first();
      return variant;
    }

    // Get test with variants
    const test = await db('ab_tests').where('id', testId).first();
    if (!test || test.status !== 'running') return null;

    const variants = await db('ab_test_variants')
      .where('test_id', testId)
      .orderBy('name', 'asc');

    if (variants.length === 0) return null;

    // Select variant based on traffic split
    const trafficSplit = typeof test.traffic_split === 'string'
      ? JSON.parse(test.traffic_split)
      : test.traffic_split;

    const selectedVariant = this.selectVariantByTrafficSplit(variants, trafficSplit);

    // Create assignment
    await db('ab_test_assignments').insert({
      id: uuidv4(),
      test_id: testId,
      variant_id: selectedVariant.id,
      visitor_id: visitorId,
      user_id: userId,
      assigned_at: new Date()
    });

    // Update daily analytics impressions
    await this.incrementImpressions(testId, selectedVariant.id);

    return selectedVariant;
  }

  /**
   * Select variant based on traffic split weights
   */
  selectVariantByTrafficSplit(variants, trafficSplit) {
    const weights = variants.map(v => trafficSplit[v.name] || 0);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    if (totalWeight === 0) {
      return variants[0];
    }

    const random = Math.random() * totalWeight;
    let cumulative = 0;

    for (let i = 0; i < variants.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return variants[i];
      }
    }

    return variants[variants.length - 1];
  }

  /**
   * Get assigned variant for visitor
   */
  async getAssignedVariant(testId, visitorId) {
    const assignment = await db('ab_test_assignments')
      .where({ test_id: testId, visitor_id: visitorId })
      .first();

    if (!assignment) return null;

    const variant = await db('ab_test_variants')
      .where('id', assignment.variant_id)
      .first();

    return variant;
  }

  // ==================== CONVERSIONS ====================

  /**
   * Record a conversion
   */
  async recordConversion(testId, visitorId, data) {
    // Get assignment
    const assignment = await db('ab_test_assignments')
      .where({ test_id: testId, visitor_id: visitorId })
      .first();

    if (!assignment) return null;

    const conversionData = {
      id: uuidv4(),
      test_id: testId,
      variant_id: assignment.variant_id,
      visitor_id: visitorId,
      user_id: data.userId || null,
      conversion_type: data.type,
      conversion_value: data.value || null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      converted_at: new Date()
    };

    const [conversion] = await db('ab_test_conversions').insert(conversionData).returning('*');

    // Update daily analytics
    await this.incrementConversions(testId, assignment.variant_id, data.value);

    return conversion;
  }

  /**
   * Increment impressions in daily analytics
   */
  async incrementImpressions(testId, variantId) {
    const today = new Date().toISOString().split('T')[0];

    const existing = await db('ab_test_analytics')
      .where({ test_id: testId, variant_id: variantId, date: today })
      .first();

    if (existing) {
      await db('ab_test_analytics')
        .where({ test_id: testId, variant_id: variantId, date: today })
        .increment('impressions', 1)
        .increment('unique_visitors', 1);
    } else {
      await db('ab_test_analytics').insert({
        id: uuidv4(),
        test_id: testId,
        variant_id: variantId,
        date: today,
        impressions: 1,
        conversions: 0,
        conversion_rate: 0,
        total_value: 0,
        unique_visitors: 1,
        created_at: new Date()
      });
    }

    await this.updateConversionRate(testId, variantId, today);
  }

  /**
   * Increment conversions in daily analytics
   */
  async incrementConversions(testId, variantId, value = 0) {
    const today = new Date().toISOString().split('T')[0];

    await db('ab_test_analytics')
      .where({ test_id: testId, variant_id: variantId, date: today })
      .increment('conversions', 1)
      .increment('total_value', value || 0);

    await this.updateConversionRate(testId, variantId, today);
  }

  /**
   * Update conversion rate in daily analytics
   */
  async updateConversionRate(testId, variantId, date) {
    const stats = await db('ab_test_analytics')
      .where({ test_id: testId, variant_id: variantId, date })
      .first();

    if (stats && stats.impressions > 0) {
      const rate = (stats.conversions / stats.impressions) * 100;
      await db('ab_test_analytics')
        .where({ test_id: testId, variant_id: variantId, date })
        .update({ conversion_rate: rate.toFixed(4) });
    }
  }

  // ==================== ANALYTICS ====================

  /**
   * Get test analytics summary
   */
  async getTestAnalytics(testId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    let query = db('ab_test_analytics')
      .where('test_id', testId)
      .select('variant_id')
      .sum('impressions as total_impressions')
      .sum('conversions as total_conversions')
      .sum('total_value as total_value')
      .sum('unique_visitors as total_visitors')
      .groupBy('variant_id');

    if (startDate) query = query.where('date', '>=', startDate);
    if (endDate) query = query.where('date', '<=', endDate);

    const stats = await query;

    // Get variant names
    const variants = await db('ab_test_variants')
      .where('test_id', testId);

    const variantMap = {};
    variants.forEach(v => { variantMap[v.id] = v; });

    const results = stats.map(s => {
      const impressions = parseInt(s.total_impressions) || 0;
      const conversions = parseInt(s.total_conversions) || 0;
      const variant = variantMap[s.variant_id] || {};

      return {
        variantId: s.variant_id,
        variantName: variant.name,
        isControl: variant.is_control,
        impressions,
        conversions,
        conversionRate: impressions > 0 ? ((conversions / impressions) * 100).toFixed(2) : 0,
        totalValue: parseFloat(s.total_value) || 0,
        uniqueVisitors: parseInt(s.total_visitors) || 0
      };
    });

    // Calculate statistical significance between control and variants
    const control = results.find(r => r.isControl);
    const variantsWithSignificance = results.map(r => {
      if (r.isControl || !control) {
        return { ...r, significance: null };
      }

      const sig = this.calculateSignificance(
        { impressions: control.impressions, conversions: control.conversions },
        { impressions: r.impressions, conversions: r.conversions }
      );

      return { ...r, significance: sig };
    });

    return variantsWithSignificance;
  }

  /**
   * Get daily analytics
   */
  async getDailyAnalytics(testId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    let query = db('ab_test_analytics')
      .where('test_id', testId)
      .orderBy('date', 'asc');

    if (startDate) query = query.where('date', '>=', startDate);
    if (endDate) query = query.where('date', '<=', endDate);

    const daily = await query;

    // Get variant names
    const variants = await db('ab_test_variants').where('test_id', testId);
    const variantMap = {};
    variants.forEach(v => { variantMap[v.id] = v.name; });

    return daily.map(d => ({
      ...d,
      variantName: variantMap[d.variant_id]
    }));
  }

  /**
   * Get overview analytics for workspace
   */
  async getOverviewAnalytics(workspaceId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    // Get active tests
    const tests = await db('ab_tests')
      .where('workspace_id', workspaceId)
      .whereIn('status', ['running', 'completed'])
      .select('id', 'name', 'status', 'test_type', 'winner_variant');

    const testIds = tests.map(t => t.id);
    if (testIds.length === 0) {
      return { tests: [], totals: { impressions: 0, conversions: 0, activeTests: 0 } };
    }

    // Get aggregate stats per test
    let statsQuery = db('ab_test_analytics')
      .whereIn('test_id', testIds)
      .select('test_id')
      .sum('impressions as total_impressions')
      .sum('conversions as total_conversions')
      .groupBy('test_id');

    if (startDate) statsQuery = statsQuery.where('date', '>=', startDate);
    if (endDate) statsQuery = statsQuery.where('date', '<=', endDate);

    const stats = await statsQuery;
    const statsMap = {};
    stats.forEach(s => {
      statsMap[s.test_id] = {
        impressions: parseInt(s.total_impressions) || 0,
        conversions: parseInt(s.total_conversions) || 0
      };
    });

    const testsWithStats = tests.map(t => ({
      ...t,
      stats: statsMap[t.id] || { impressions: 0, conversions: 0 }
    }));

    // Calculate totals
    const totals = {
      impressions: Object.values(statsMap).reduce((a, b) => a + b.impressions, 0),
      conversions: Object.values(statsMap).reduce((a, b) => a + b.conversions, 0),
      activeTests: tests.filter(t => t.status === 'running').length
    };

    return { tests: testsWithStats, totals };
  }

  // ==================== STATISTICAL SIGNIFICANCE ====================

  /**
   * Calculate statistical significance between control and test variant
   */
  calculateSignificance(controlStats, testStats) {
    const n1 = controlStats.impressions;
    const n2 = testStats.impressions;
    const c1 = controlStats.conversions;
    const c2 = testStats.conversions;

    // Need minimum sample size
    if (n1 < 30 || n2 < 30) {
      return {
        significant: false,
        confidence: 0,
        lift: 0,
        zScore: 0,
        message: 'Insufficient sample size'
      };
    }

    const p1 = c1 / n1; // Control conversion rate
    const p2 = c2 / n2; // Test conversion rate

    // Pooled proportion
    const pPooled = (c1 + c2) / (n1 + n2);

    // Standard error
    const se = Math.sqrt(pPooled * (1 - pPooled) * (1/n1 + 1/n2));

    if (se === 0) {
      return {
        significant: false,
        confidence: 0,
        lift: 0,
        zScore: 0,
        message: 'Cannot calculate - zero variance'
      };
    }

    // Z-score
    const zScore = (p2 - p1) / se;

    // Calculate confidence (two-tailed)
    const confidence = this.zScoreToConfidence(Math.abs(zScore));

    // Lift percentage
    const lift = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0;

    return {
      significant: confidence >= 95,
      confidence: parseFloat(confidence.toFixed(2)),
      lift: parseFloat(lift.toFixed(2)),
      zScore: parseFloat(zScore.toFixed(4)),
      controlRate: parseFloat((p1 * 100).toFixed(2)),
      testRate: parseFloat((p2 * 100).toFixed(2))
    };
  }

  /**
   * Convert Z-score to confidence percentage
   */
  zScoreToConfidence(z) {
    // Approximation of standard normal CDF
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    const cdf = 0.5 * (1.0 + sign * y);

    // Two-tailed confidence
    return (2 * cdf - 1) * 100;
  }
}

module.exports = new ABTestService();
