/**
 * Fine-Tuning Test & Deployment Service
 *
 * Handles model testing, comparison, benchmarking, and deployment
 */

const db = require('../config/db');
const log = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class FineTuningTestService {
  constructor() {
    this.providers = {
      openai: null,
      anthropic: null
    };
  }

  /**
   * Initialize AI provider
   */
  async getProvider(model) {
    if (model.base_model.startsWith('gpt')) {
      if (!this.providers.openai) {
        const OpenAI = require('openai');
        this.providers.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
      }
      return { type: 'openai', client: this.providers.openai };
    } else if (model.base_model.startsWith('claude')) {
      if (!this.providers.anthropic) {
        const Anthropic = require('@anthropic-ai/sdk');
        this.providers.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        });
      }
      return { type: 'anthropic', client: this.providers.anthropic };
    }
    throw new Error(`Unsupported model: ${model.base_model}`);
  }

  // ==========================================
  // MODEL TESTING
  // ==========================================

  /**
   * Test a fine-tuned model with a prompt
   */
  async testModel(modelId, testPrompt, options = {}) {
    const startTime = Date.now();

    try {
      // Get model details
      const model = await db('fine_tune_models')
        .where({ id: modelId })
        .first();

      if (!model) {
        throw new Error('Model not found');
      }

      if (model.status !== 'completed') {
        throw new Error('Model training not completed');
      }

      const { systemMessage, maxTokens = 500, temperature = 0.7 } = options;
      const provider = await this.getProvider(model);

      let response;
      let tokensUsed = 0;

      if (provider.type === 'openai') {
        const messages = [];
        if (systemMessage) {
          messages.push({ role: 'system', content: systemMessage });
        }
        messages.push({ role: 'user', content: testPrompt });

        const completion = await provider.client.chat.completions.create({
          model: model.model_id || model.base_model,
          messages,
          max_tokens: maxTokens,
          temperature
        });

        response = completion.choices[0]?.message?.content || '';
        tokensUsed = completion.usage?.total_tokens || 0;
      } else if (provider.type === 'anthropic') {
        const result = await provider.client.messages.create({
          model: model.model_id || model.base_model,
          max_tokens: maxTokens,
          system: systemMessage || '',
          messages: [{ role: 'user', content: testPrompt }]
        });

        response = result.content[0]?.text || '';
        tokensUsed = (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0);
      }

      const latencyMs = Date.now() - startTime;

      // Save test result
      const testResult = await this.saveTestResult(modelId, {
        test_prompt: testPrompt,
        response,
        latency_ms: latencyMs,
        tokens_used: tokensUsed,
        temperature,
        max_tokens: maxTokens,
        system_message: systemMessage
      });

      return {
        testId: testResult.id,
        response,
        latencyMs,
        tokensUsed,
        model: {
          id: model.id,
          name: model.name,
          baseModel: model.base_model,
          fineTunedModelId: model.model_id
        }
      };
    } catch (error) {
      log.error('Model test failed', { modelId, error: error.message });
      throw error;
    }
  }

  /**
   * Compare multiple models with test prompts
   */
  async compareModels(modelIds, testPrompts, options = {}) {
    const results = [];

    for (const prompt of testPrompts) {
      const promptResults = {
        prompt,
        models: []
      };

      // Test each model in parallel
      const modelPromises = modelIds.map(async (modelId) => {
        try {
          const result = await this.testModel(modelId, prompt, options);
          return {
            modelId,
            modelName: result.model.name,
            response: result.response,
            latencyMs: result.latencyMs,
            tokensUsed: result.tokensUsed,
            success: true
          };
        } catch (error) {
          return {
            modelId,
            error: error.message,
            success: false
          };
        }
      });

      promptResults.models = await Promise.all(modelPromises);
      results.push(promptResults);
    }

    // Calculate aggregate statistics
    const stats = this.calculateComparisonStats(results, modelIds);

    return {
      comparisons: results,
      statistics: stats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate comparison statistics
   */
  calculateComparisonStats(results, modelIds) {
    const stats = {};

    for (const modelId of modelIds) {
      const modelResults = results.flatMap(r =>
        r.models.filter(m => m.modelId === modelId && m.success)
      );

      if (modelResults.length === 0) {
        stats[modelId] = { error: 'No successful tests' };
        continue;
      }

      const latencies = modelResults.map(r => r.latencyMs);
      const tokens = modelResults.map(r => r.tokensUsed);

      stats[modelId] = {
        modelName: modelResults[0].modelName,
        totalTests: modelResults.length,
        avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
        minLatencyMs: Math.min(...latencies),
        maxLatencyMs: Math.max(...latencies),
        avgTokensUsed: Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length),
        totalTokensUsed: tokens.reduce((a, b) => a + b, 0)
      };
    }

    return stats;
  }

  /**
   * Run benchmark test suite
   */
  async runBenchmark(modelId, testDataset, options = {}) {
    const model = await db('fine_tune_models')
      .where({ id: modelId })
      .first();

    if (!model) {
      throw new Error('Model not found');
    }

    const benchmarkId = uuidv4();
    const results = [];
    const startTime = Date.now();

    // Parse test dataset
    const testCases = Array.isArray(testDataset) ? testDataset : JSON.parse(testDataset);

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      try {
        const result = await this.testModel(modelId, testCase.prompt || testCase.input, {
          systemMessage: testCase.systemMessage || options.systemMessage,
          maxTokens: options.maxTokens,
          temperature: options.temperature
        });

        results.push({
          index: i,
          prompt: testCase.prompt || testCase.input,
          expectedOutput: testCase.expected || testCase.output,
          actualOutput: result.response,
          latencyMs: result.latencyMs,
          tokensUsed: result.tokensUsed,
          match: testCase.expected
            ? this.calculateSimilarity(result.response, testCase.expected)
            : null,
          success: true
        });
      } catch (error) {
        results.push({
          index: i,
          prompt: testCase.prompt || testCase.input,
          error: error.message,
          success: false
        });
      }
    }

    const totalTime = Date.now() - startTime;

    // Calculate benchmark metrics
    const successfulTests = results.filter(r => r.success);
    const metrics = {
      totalTests: results.length,
      successfulTests: successfulTests.length,
      failedTests: results.length - successfulTests.length,
      successRate: (successfulTests.length / results.length) * 100,
      avgLatencyMs: successfulTests.length > 0
        ? Math.round(successfulTests.reduce((a, r) => a + r.latencyMs, 0) / successfulTests.length)
        : 0,
      totalLatencyMs: totalTime,
      avgTokensUsed: successfulTests.length > 0
        ? Math.round(successfulTests.reduce((a, r) => a + r.tokensUsed, 0) / successfulTests.length)
        : 0,
      avgMatchScore: successfulTests.filter(r => r.match !== null).length > 0
        ? successfulTests.filter(r => r.match !== null).reduce((a, r) => a + r.match, 0) /
          successfulTests.filter(r => r.match !== null).length
        : null
    };

    // Save benchmark to database
    await db('fine_tuning_tests').insert({
      model_id: modelId,
      test_type: 'benchmark',
      test_prompt: JSON.stringify({ benchmarkId, testCases: testCases.length }),
      response: JSON.stringify({ metrics, results: results.slice(0, 10) }), // Store first 10 results
      latency_ms: totalTime,
      tokens_used: successfulTests.reduce((a, r) => a + r.tokensUsed, 0),
      metadata: JSON.stringify(metrics),
      created_at: new Date()
    });

    return {
      benchmarkId,
      modelId,
      modelName: model.name,
      metrics,
      results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate text similarity (simple implementation)
   */
  calculateSimilarity(text1, text2) {
    const normalize = (text) => text.toLowerCase().trim().replace(/\s+/g, ' ');
    const a = normalize(text1);
    const b = normalize(text2);

    if (a === b) return 1;

    // Simple word overlap score
    const wordsA = new Set(a.split(' '));
    const wordsB = new Set(b.split(' '));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;

    return intersection / union;
  }

  /**
   * Get test history for a model
   */
  async getTestHistory(modelId, options = {}) {
    const { limit = 50, offset = 0, testType } = options;

    let query = db('fine_tuning_tests')
      .where({ model_id: modelId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (testType) {
      query = query.where({ test_type: testType });
    }

    const tests = await query;

    const total = await db('fine_tuning_tests')
      .where({ model_id: modelId })
      .count('* as count')
      .first();

    return {
      tests: tests.map(t => ({
        ...t,
        metadata: t.metadata ? JSON.parse(t.metadata) : null
      })),
      total: parseInt(total.count),
      limit,
      offset
    };
  }

  /**
   * Save test result
   */
  async saveTestResult(modelId, result) {
    const [testResult] = await db('fine_tuning_tests')
      .insert({
        model_id: modelId,
        test_type: 'single',
        test_prompt: result.test_prompt,
        response: result.response,
        latency_ms: result.latency_ms,
        tokens_used: result.tokens_used,
        metadata: JSON.stringify({
          temperature: result.temperature,
          max_tokens: result.max_tokens,
          system_message: result.system_message
        }),
        created_at: new Date()
      })
      .returning('*');

    return testResult;
  }

  // ==========================================
  // MODEL DEPLOYMENT
  // ==========================================

  /**
   * Deploy model to a bot
   */
  async deployModel(modelId, botId, userId) {
    // Verify model exists and is completed
    const model = await db('fine_tune_models')
      .where({ id: modelId })
      .first();

    if (!model) {
      throw new Error('Model not found');
    }

    if (model.status !== 'completed') {
      throw new Error('Model training not completed');
    }

    // Verify bot exists
    const bot = await db('bots')
      .where({ id: botId })
      .first();

    if (!bot) {
      throw new Error('Bot not found');
    }

    // Check if deployment already exists
    const existing = await db('fine_tuning_deployments')
      .where({ model_id: modelId, bot_id: botId, is_active: true })
      .first();

    if (existing) {
      throw new Error('Model already deployed to this bot');
    }

    // Create deployment
    const [deployment] = await db('fine_tuning_deployments')
      .insert({
        model_id: modelId,
        bot_id: botId,
        deployed_by: userId,
        is_active: true,
        is_default: false,
        deployed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // Update bot's AI settings to use this model
    await db('bots')
      .where({ id: botId })
      .update({
        ai_model: model.model_id || model.base_model,
        ai_settings: db.raw(`
          COALESCE(ai_settings, '{}'::jsonb) || ?::jsonb
        `, [JSON.stringify({
          fine_tuned_model_id: model.model_id,
          fine_tune_model_db_id: modelId,
          deployment_id: deployment.id
        })]),
        updated_at: new Date()
      });

    log.info('Model deployed', { modelId, botId, deploymentId: deployment.id });

    return {
      deployment,
      model: {
        id: model.id,
        name: model.name,
        modelId: model.model_id
      },
      bot: {
        id: bot.id,
        name: bot.name
      }
    };
  }

  /**
   * Undeploy model from a bot
   */
  async undeployModel(modelId, botId) {
    // Find active deployment
    const deployment = await db('fine_tuning_deployments')
      .where({ model_id: modelId, bot_id: botId, is_active: true })
      .first();

    if (!deployment) {
      throw new Error('No active deployment found');
    }

    // Deactivate deployment
    await db('fine_tuning_deployments')
      .where({ id: deployment.id })
      .update({
        is_active: false,
        undeployed_at: new Date(),
        updated_at: new Date()
      });

    // Get the model's base model
    const model = await db('fine_tune_models')
      .where({ id: modelId })
      .first();

    // Revert bot's AI settings
    await db('bots')
      .where({ id: botId })
      .update({
        ai_model: model ? model.base_model : 'gpt-3.5-turbo',
        ai_settings: db.raw(`
          ai_settings - 'fine_tuned_model_id' - 'fine_tune_model_db_id' - 'deployment_id'
        `),
        updated_at: new Date()
      });

    log.info('Model undeployed', { modelId, botId, deploymentId: deployment.id });

    return { success: true, deploymentId: deployment.id };
  }

  /**
   * Get all deployed models for an organization
   */
  async getDeployedModels(organizationId) {
    const deployments = await db('fine_tuning_deployments as d')
      .join('fine_tune_models as m', 'd.model_id', 'm.id')
      .join('bots as b', 'd.bot_id', 'b.id')
      .leftJoin('users as u', 'd.deployed_by', 'u.id')
      .where({ 'm.organization_id': organizationId, 'd.is_active': true })
      .select(
        'd.*',
        'm.name as model_name',
        'm.model_id as fine_tuned_model_id',
        'm.base_model',
        'b.name as bot_name',
        'u.name as deployed_by_name'
      )
      .orderBy('d.deployed_at', 'desc');

    return deployments;
  }

  /**
   * Set default model for organization
   */
  async setDefaultModel(modelId, organizationId) {
    // Verify model belongs to organization
    const model = await db('fine_tune_models')
      .where({ id: modelId, organization_id: organizationId })
      .first();

    if (!model) {
      throw new Error('Model not found in organization');
    }

    if (model.status !== 'completed') {
      throw new Error('Model training not completed');
    }

    // Remove default from other models
    await db('fine_tune_models')
      .where({ organization_id: organizationId })
      .update({ is_default: false });

    // Set this model as default
    await db('fine_tune_models')
      .where({ id: modelId })
      .update({ is_default: true, updated_at: new Date() });

    // Update organization settings
    await db('organizations')
      .where({ id: organizationId })
      .update({
        settings: db.raw(`
          COALESCE(settings, '{}'::jsonb) || ?::jsonb
        `, [JSON.stringify({
          default_fine_tuned_model: modelId,
          default_ai_model: model.model_id || model.base_model
        })]),
        updated_at: new Date()
      });

    log.info('Default model set', { modelId, organizationId });

    return { success: true, model };
  }

  /**
   * Get deployment status for a model
   */
  async getDeploymentStatus(modelId) {
    const deployments = await db('fine_tuning_deployments as d')
      .join('bots as b', 'd.bot_id', 'b.id')
      .where({ 'd.model_id': modelId })
      .select(
        'd.*',
        'b.name as bot_name',
        'b.id as bot_id'
      )
      .orderBy('d.deployed_at', 'desc');

    const activeCount = deployments.filter(d => d.is_active).length;

    return {
      modelId,
      totalDeployments: deployments.length,
      activeDeployments: activeCount,
      deployments
    };
  }

  // ==========================================
  // A/B TESTING FOR MODELS
  // ==========================================

  /**
   * Create A/B test for models
   */
  async createModelABTest(modelAId, modelBId, trafficSplit = 50, options = {}) {
    const { name, description, organizationId, userId } = options;

    // Verify both models exist and are completed
    const [modelA, modelB] = await Promise.all([
      db('fine_tune_models').where({ id: modelAId }).first(),
      db('fine_tune_models').where({ id: modelBId }).first()
    ]);

    if (!modelA || !modelB) {
      throw new Error('One or both models not found');
    }

    if (modelA.status !== 'completed' || modelB.status !== 'completed') {
      throw new Error('Both models must be completed');
    }

    const [abTest] = await db('fine_tuning_model_ab_tests')
      .insert({
        organization_id: organizationId,
        name: name || `${modelA.name} vs ${modelB.name}`,
        description,
        model_a_id: modelAId,
        model_b_id: modelBId,
        traffic_split_a: trafficSplit,
        traffic_split_b: 100 - trafficSplit,
        status: 'draft',
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return {
      abTest,
      modelA: { id: modelA.id, name: modelA.name },
      modelB: { id: modelB.id, name: modelB.name }
    };
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId) {
    const test = await db('fine_tuning_model_ab_tests')
      .where({ id: testId })
      .first();

    if (!test) {
      throw new Error('A/B test not found');
    }

    // Get results for both models
    const results = await db('fine_tuning_model_ab_results')
      .where({ ab_test_id: testId })
      .orderBy('created_at', 'desc');

    const modelAResults = results.filter(r => r.model_id === test.model_a_id);
    const modelBResults = results.filter(r => r.model_id === test.model_b_id);

    const calculateStats = (modelResults) => {
      if (modelResults.length === 0) {
        return { count: 0, avgLatency: 0, avgRating: null, preferenceRate: 0 };
      }

      const latencies = modelResults.map(r => r.latency_ms);
      const ratings = modelResults.filter(r => r.user_rating !== null).map(r => r.user_rating);
      const preferred = modelResults.filter(r => r.is_preferred).length;

      return {
        count: modelResults.length,
        avgLatency: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
        avgRating: ratings.length > 0
          ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)
          : null,
        preferenceRate: ((preferred / modelResults.length) * 100).toFixed(1)
      };
    };

    return {
      test,
      modelA: {
        id: test.model_a_id,
        stats: calculateStats(modelAResults),
        recentResults: modelAResults.slice(0, 10)
      },
      modelB: {
        id: test.model_b_id,
        stats: calculateStats(modelBResults),
        recentResults: modelBResults.slice(0, 10)
      },
      totalResponses: results.length
    };
  }

  /**
   * Select winner model
   */
  async selectWinnerModel(testId, winnerModelId = null) {
    const results = await this.getABTestResults(testId);
    const { test, modelA, modelB } = results;

    let winner;
    let reason;

    if (winnerModelId) {
      // Manual selection
      winner = winnerModelId;
      reason = 'manual_selection';
    } else {
      // Auto-determine based on metrics
      const scoreA = this.calculateModelScore(modelA.stats);
      const scoreB = this.calculateModelScore(modelB.stats);

      if (Math.abs(scoreA - scoreB) < 0.05) {
        throw new Error('Results are too close. Need more data or manual selection.');
      }

      winner = scoreA > scoreB ? test.model_a_id : test.model_b_id;
      reason = 'auto_calculated';
    }

    // Update test with winner
    await db('fine_tuning_model_ab_tests')
      .where({ id: testId })
      .update({
        status: 'completed',
        winner_model_id: winner,
        completed_at: new Date(),
        updated_at: new Date()
      });

    return {
      testId,
      winnerModelId: winner,
      reason,
      modelAScore: this.calculateModelScore(modelA.stats),
      modelBScore: this.calculateModelScore(modelB.stats)
    };
  }

  /**
   * Calculate model score from stats
   */
  calculateModelScore(stats) {
    if (stats.count === 0) return 0;

    let score = 0;

    // Rating score (0-5 scaled to 0-0.5)
    if (stats.avgRating !== null) {
      score += (parseFloat(stats.avgRating) / 5) * 0.5;
    }

    // Preference rate (0-100 scaled to 0-0.3)
    score += (parseFloat(stats.preferenceRate) / 100) * 0.3;

    // Latency score (inverse - lower is better, scaled to 0-0.2)
    // Assuming good latency is < 1000ms
    const latencyScore = Math.max(0, 1 - (stats.avgLatency / 2000));
    score += latencyScore * 0.2;

    return score;
  }

  /**
   * Record A/B test result
   */
  async recordABTestResult(testId, modelId, data) {
    const [result] = await db('fine_tuning_model_ab_results')
      .insert({
        ab_test_id: testId,
        model_id: modelId,
        prompt: data.prompt,
        response: data.response,
        latency_ms: data.latencyMs,
        tokens_used: data.tokensUsed,
        user_rating: data.userRating || null,
        is_preferred: data.isPreferred || false,
        session_id: data.sessionId,
        created_at: new Date()
      })
      .returning('*');

    return result;
  }

  /**
   * Start A/B test
   */
  async startABTest(testId) {
    await db('fine_tuning_model_ab_tests')
      .where({ id: testId })
      .update({
        status: 'running',
        started_at: new Date(),
        updated_at: new Date()
      });

    return db('fine_tuning_model_ab_tests').where({ id: testId }).first();
  }

  /**
   * Stop A/B test
   */
  async stopABTest(testId) {
    await db('fine_tuning_model_ab_tests')
      .where({ id: testId })
      .update({
        status: 'paused',
        updated_at: new Date()
      });

    return db('fine_tuning_model_ab_tests').where({ id: testId }).first();
  }
}

module.exports = new FineTuningTestService();
