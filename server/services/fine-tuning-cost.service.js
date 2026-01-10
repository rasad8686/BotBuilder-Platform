/**
 * @fileoverview Fine-Tuning Cost Tracking Service
 * @description Handles cost calculation, tracking, and budget management for fine-tuning jobs
 * @module services/fine-tuning-cost.service
 */

const db = require('../config/db');
const log = require('../utils/logger');

// OpenAI Fine-Tuning Pricing (per 1K tokens)
const MODEL_PRICING = {
  // GPT-3.5 Turbo
  'gpt-3.5-turbo': {
    training: 0.008,
    input: 0.003,
    output: 0.006,
    currency: 'USD'
  },
  'gpt-3.5-turbo-0125': {
    training: 0.008,
    input: 0.003,
    output: 0.006,
    currency: 'USD'
  },
  'gpt-3.5-turbo-1106': {
    training: 0.008,
    input: 0.003,
    output: 0.006,
    currency: 'USD'
  },
  // GPT-4
  'gpt-4': {
    training: 0.03,
    input: 0.03,
    output: 0.06,
    currency: 'USD'
  },
  'gpt-4-0613': {
    training: 0.03,
    input: 0.03,
    output: 0.06,
    currency: 'USD'
  },
  // GPT-4 Turbo
  'gpt-4-turbo': {
    training: 0.03,
    input: 0.01,
    output: 0.03,
    currency: 'USD'
  },
  'gpt-4-turbo-preview': {
    training: 0.03,
    input: 0.01,
    output: 0.03,
    currency: 'USD'
  },
  // Legacy models
  'davinci-002': {
    training: 0.006,
    input: 0.012,
    output: 0.012,
    currency: 'USD'
  },
  'babbage-002': {
    training: 0.0004,
    input: 0.0016,
    output: 0.0016,
    currency: 'USD'
  },
  // Claude models (Anthropic - estimated pricing)
  'claude-3-haiku': {
    training: 0.001,
    input: 0.00025,
    output: 0.00125,
    currency: 'USD'
  },
  'claude-3-sonnet': {
    training: 0.005,
    input: 0.003,
    output: 0.015,
    currency: 'USD'
  },
  'claude-3-opus': {
    training: 0.025,
    input: 0.015,
    output: 0.075,
    currency: 'USD'
  }
};

// Default model if not found
const DEFAULT_PRICING = {
  training: 0.008,
  input: 0.003,
  output: 0.006,
  currency: 'USD'
};

class FineTuningCostService {
  /**
   * Get pricing for a specific model
   * @param {string} model - Model name
   * @returns {Object} Pricing information
   */
  getModelPricing(model) {
    // Normalize model name
    const normalizedModel = model?.toLowerCase().trim() || 'gpt-3.5-turbo';

    // Try exact match first
    if (MODEL_PRICING[normalizedModel]) {
      return {
        model: normalizedModel,
        ...MODEL_PRICING[normalizedModel]
      };
    }

    // Try partial match (e.g., "gpt-3.5-turbo-fine-tuned" -> "gpt-3.5-turbo")
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
      if (normalizedModel.includes(key) || key.includes(normalizedModel)) {
        return {
          model: key,
          ...pricing
        };
      }
    }

    // Return default pricing
    return {
      model: normalizedModel,
      ...DEFAULT_PRICING
    };
  }

  /**
   * Get all available model pricing
   * @returns {Object} All model pricing
   */
  getAllModelPricing() {
    return MODEL_PRICING;
  }

  /**
   * Calculate estimated training cost
   * @param {number} tokenCount - Total tokens in training data
   * @param {string} model - Base model name
   * @param {number} epochs - Number of training epochs
   * @returns {Object} Cost estimation
   */
  calculateTrainingCost(tokenCount, model, epochs = 3) {
    const pricing = this.getModelPricing(model);
    const tokensInThousands = tokenCount / 1000;

    // Training cost = tokens * epochs * price per 1K tokens
    const trainingCost = tokensInThousands * epochs * pricing.training;

    return {
      model: pricing.model,
      tokenCount,
      epochs,
      pricePerThousandTokens: pricing.training,
      estimatedCost: parseFloat(trainingCost.toFixed(6)),
      currency: pricing.currency,
      breakdown: {
        baseTokenCost: tokensInThousands * pricing.training,
        epochMultiplier: epochs,
        totalCost: trainingCost
      }
    };
  }

  /**
   * Estimate cost from file size (rough approximation)
   * @param {number} fileSizeBytes - File size in bytes
   * @param {string} model - Base model
   * @param {number} epochs - Training epochs
   * @returns {Object} Cost estimation
   */
  estimateCostFromFileSize(fileSizeBytes, model, epochs = 3) {
    // Rough estimate: ~4 characters per token, ~1 byte per character
    const estimatedTokens = Math.ceil(fileSizeBytes / 4);
    return this.calculateTrainingCost(estimatedTokens, model, epochs);
  }

  /**
   * Track actual cost from OpenAI usage
   * @param {number} jobId - Fine-tune job ID
   * @param {Object} usage - Usage data from OpenAI
   * @returns {Object} Updated cost record
   */
  async trackActualCost(jobId, usage) {
    try {
      const { total_tokens, training_tokens, prompt_tokens, completion_tokens } = usage;

      // Get job details
      const job = await db('fine_tune_jobs').where('id', jobId).first();
      if (!job) {
        throw new Error('Job not found');
      }

      const model = await db('fine_tune_models').where('id', job.fine_tune_model_id).first();
      if (!model) {
        throw new Error('Model not found');
      }

      const pricing = this.getModelPricing(model.base_model);
      const tokensInThousands = (total_tokens || training_tokens || 0) / 1000;
      const actualCost = tokensInThousands * pricing.training;

      // Update or create cost record
      const existingCost = await db('fine_tuning_costs').where('job_id', jobId).first();

      if (existingCost) {
        await db('fine_tuning_costs')
          .where('id', existingCost.id)
          .update({
            actual_cost: actualCost,
            tokens_used: total_tokens || training_tokens || 0,
            training_tokens: training_tokens || 0,
            status: 'completed',
            usage_details: JSON.stringify(usage),
            completed_at: new Date()
          });
      } else {
        await db('fine_tuning_costs').insert({
          organization_id: model.organization_id,
          user_id: model.user_id,
          job_id: jobId,
          model_id: model.id,
          base_model: model.base_model,
          actual_cost: actualCost,
          tokens_used: total_tokens || training_tokens || 0,
          training_tokens: training_tokens || 0,
          status: 'completed',
          usage_details: JSON.stringify(usage),
          completed_at: new Date()
        });
      }

      // Update model training cost
      await db('fine_tune_models')
        .where('id', model.id)
        .update({ training_cost: actualCost });

      // Update budget spend
      await this.updateBudgetSpend(model.organization_id, actualCost);

      log.info(`Tracked actual cost for job ${jobId}: $${actualCost.toFixed(6)}`);

      return {
        jobId,
        actualCost,
        tokensUsed: total_tokens || training_tokens || 0,
        currency: pricing.currency
      };
    } catch (error) {
      log.error('Error tracking actual cost:', error);
      throw error;
    }
  }

  /**
   * Create estimated cost record before training
   * @param {Object} data - Cost data
   * @returns {Object} Created cost record
   */
  async createCostEstimate(data) {
    const {
      organizationId,
      userId,
      modelId,
      baseModel,
      tokenCount,
      epochs
    } = data;

    const estimation = this.calculateTrainingCost(tokenCount, baseModel, epochs);

    const [costRecord] = await db('fine_tuning_costs')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        model_id: modelId,
        base_model: baseModel,
        estimated_cost: estimation.estimatedCost,
        tokens_used: tokenCount,
        epochs,
        status: 'estimated',
        usage_details: JSON.stringify(estimation.breakdown)
      })
      .returning('*');

    return costRecord;
  }

  /**
   * Update cost record with job ID
   * @param {number} costId - Cost record ID
   * @param {number} jobId - Job ID
   */
  async updateCostWithJob(costId, jobId) {
    await db('fine_tuning_costs')
      .where('id', costId)
      .update({
        job_id: jobId,
        status: 'training'
      });
  }

  /**
   * Get cost history for organization
   * @param {number} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Object} Cost history with pagination
   */
  async getCostHistory(organizationId, options = {}) {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      status,
      model
    } = options;

    let query = db('fine_tuning_costs')
      .where('organization_id', organizationId);

    if (startDate) {
      query = query.where('created_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('created_at', '<=', endDate);
    }

    if (status) {
      query = query.where('status', status);
    }

    if (model) {
      query = query.where('base_model', model);
    }

    const countResult = await query.clone().count('* as total').first();
    const total = parseInt(countResult.total);

    const costs = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    // Get totals
    const totals = await db('fine_tuning_costs')
      .where('organization_id', organizationId)
      .select(
        db.raw('SUM(estimated_cost) as total_estimated'),
        db.raw('SUM(actual_cost) as total_actual'),
        db.raw('SUM(tokens_used) as total_tokens')
      )
      .first();

    return {
      costs,
      totals: {
        estimated: parseFloat(totals.total_estimated || 0),
        actual: parseFloat(totals.total_actual || 0),
        tokens: parseInt(totals.total_tokens || 0)
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get cost breakdown by model
   * @param {number} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Array} Cost by model
   */
  async getCostByModel(organizationId, options = {}) {
    const { startDate, endDate } = options;

    let query = db('fine_tuning_costs')
      .where('organization_id', organizationId);

    if (startDate) {
      query = query.where('created_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('created_at', '<=', endDate);
    }

    const costByModel = await query
      .select('base_model')
      .sum('estimated_cost as estimated_total')
      .sum('actual_cost as actual_total')
      .sum('tokens_used as total_tokens')
      .count('* as job_count')
      .groupBy('base_model')
      .orderBy('actual_total', 'desc');

    return costByModel.map(row => ({
      model: row.base_model,
      estimatedTotal: parseFloat(row.estimated_total || 0),
      actualTotal: parseFloat(row.actual_total || 0),
      totalTokens: parseInt(row.total_tokens || 0),
      jobCount: parseInt(row.job_count || 0)
    }));
  }

  /**
   * Get monthly cost summary
   * @param {number} organizationId - Organization ID
   * @param {number} months - Number of months to look back
   * @returns {Array} Monthly cost summary
   */
  async getMonthlyCostSummary(organizationId, months = 6) {
    const result = await db('fine_tuning_costs')
      .where('organization_id', organizationId)
      .where('created_at', '>=', db.raw(`NOW() - INTERVAL '${months} months'`))
      .select(
        db.raw("TO_CHAR(created_at, 'YYYY-MM') as month"),
        db.raw('SUM(actual_cost) as total_cost'),
        db.raw('SUM(tokens_used) as total_tokens'),
        db.raw('COUNT(*) as job_count')
      )
      .groupBy(db.raw("TO_CHAR(created_at, 'YYYY-MM')"))
      .orderBy('month', 'asc');

    return result.map(row => ({
      month: row.month,
      totalCost: parseFloat(row.total_cost || 0),
      totalTokens: parseInt(row.total_tokens || 0),
      jobCount: parseInt(row.job_count || 0)
    }));
  }

  // ==================== BUDGET MANAGEMENT ====================

  /**
   * Get or create budget for organization
   * @param {number} organizationId - Organization ID
   * @returns {Object} Budget record
   */
  async getBudget(organizationId) {
    let budget = await db('fine_tuning_budgets')
      .where('organization_id', organizationId)
      .first();

    if (!budget) {
      [budget] = await db('fine_tuning_budgets')
        .insert({
          organization_id: organizationId,
          monthly_limit: 0,
          current_spend: 0,
          alert_threshold: '80',
          alert_enabled: true,
          auto_stop: false,
          period_start: new Date()
        })
        .returning('*');
    }

    return budget;
  }

  /**
   * Set budget limit
   * @param {number} organizationId - Organization ID
   * @param {Object} budgetData - Budget settings
   * @returns {Object} Updated budget
   */
  async setBudget(organizationId, budgetData) {
    const {
      monthlyLimit,
      alertThreshold,
      alertEnabled,
      autoStop
    } = budgetData;

    const budget = await this.getBudget(organizationId);

    const updates = {
      updated_at: new Date()
    };

    if (monthlyLimit !== undefined) updates.monthly_limit = monthlyLimit;
    if (alertThreshold !== undefined) updates.alert_threshold = String(alertThreshold);
    if (alertEnabled !== undefined) updates.alert_enabled = alertEnabled;
    if (autoStop !== undefined) updates.auto_stop = autoStop;

    await db('fine_tuning_budgets')
      .where('id', budget.id)
      .update(updates);

    return this.getBudget(organizationId);
  }

  /**
   * Update budget spend
   * @param {number} organizationId - Organization ID
   * @param {number} amount - Amount to add
   */
  async updateBudgetSpend(organizationId, amount) {
    const budget = await this.getBudget(organizationId);

    await db('fine_tuning_budgets')
      .where('id', budget.id)
      .increment('current_spend', amount);
  }

  /**
   * Reset budget for new period
   * @param {number} organizationId - Organization ID
   */
  async resetBudget(organizationId) {
    await db('fine_tuning_budgets')
      .where('organization_id', organizationId)
      .update({
        current_spend: 0,
        period_start: new Date()
      });
  }

  /**
   * Get budget alert status
   * @param {number} organizationId - Organization ID
   * @returns {Object} Budget alert information
   */
  async getBudgetAlert(organizationId) {
    const budget = await this.getBudget(organizationId);

    if (!budget.monthly_limit || budget.monthly_limit === 0) {
      return {
        hasLimit: false,
        status: 'unlimited',
        percentage: 0,
        remaining: null
      };
    }

    const percentage = (budget.current_spend / budget.monthly_limit) * 100;
    const threshold = parseInt(budget.alert_threshold) || 80;

    let status = 'ok';
    if (percentage >= 100) {
      status = 'exceeded';
    } else if (percentage >= threshold) {
      status = 'warning';
    }

    return {
      hasLimit: true,
      monthlyLimit: parseFloat(budget.monthly_limit),
      currentSpend: parseFloat(budget.current_spend),
      remaining: parseFloat(budget.monthly_limit) - parseFloat(budget.current_spend),
      percentage: Math.round(percentage * 100) / 100,
      threshold,
      status,
      alertEnabled: budget.alert_enabled,
      autoStop: budget.auto_stop,
      periodStart: budget.period_start
    };
  }

  /**
   * Check if budget allows training
   * @param {number} organizationId - Organization ID
   * @param {number} estimatedCost - Estimated cost for training
   * @returns {Object} Budget check result
   */
  async checkBudgetForTraining(organizationId, estimatedCost) {
    const budget = await this.getBudget(organizationId);

    // No limit set
    if (!budget.monthly_limit || budget.monthly_limit === 0) {
      return {
        allowed: true,
        reason: null
      };
    }

    const projectedSpend = parseFloat(budget.current_spend) + estimatedCost;
    const wouldExceed = projectedSpend > parseFloat(budget.monthly_limit);

    if (wouldExceed && budget.auto_stop) {
      return {
        allowed: false,
        reason: 'Budget limit would be exceeded',
        currentSpend: parseFloat(budget.current_spend),
        monthlyLimit: parseFloat(budget.monthly_limit),
        estimatedCost,
        projectedSpend
      };
    }

    return {
      allowed: true,
      warning: wouldExceed ? 'This training will exceed your monthly budget' : null,
      currentSpend: parseFloat(budget.current_spend),
      monthlyLimit: parseFloat(budget.monthly_limit),
      estimatedCost,
      projectedSpend
    };
  }
}

module.exports = new FineTuningCostService();
