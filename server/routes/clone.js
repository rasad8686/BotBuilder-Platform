/**
 * Clone API Routes
 * Handles work clones, training data, and response generation
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const log = require('../utils/logger');
const { CloneEngine, TrainingService, StyleAnalyzer } = require('../services/clone');

// All routes require authentication
router.use(authMiddleware);

// Initialize services
const cloneEngine = new CloneEngine();
const trainingService = new TrainingService();
const styleAnalyzer = new StyleAnalyzer();

// ==========================================
// WORK CLONES CRUD
// ==========================================

/**
 * GET /api/clones
 * Get user's work clones
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT wc.*,
              (SELECT COUNT(*) FROM clone_training_data WHERE clone_id = wc.id) as training_count,
              (SELECT COUNT(*) FROM clone_responses WHERE clone_id = wc.id) as response_count
       FROM work_clones wc
       WHERE wc.user_id = $1
       ORDER BY wc.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      clones: result.rows.map(row => ({
        ...row,
        style_profile: typeof row.style_profile === 'string' ? JSON.parse(row.style_profile) : row.style_profile,
        tone_settings: typeof row.tone_settings === 'string' ? JSON.parse(row.tone_settings) : row.tone_settings,
        vocabulary_preferences: typeof row.vocabulary_preferences === 'string' ? JSON.parse(row.vocabulary_preferences) : row.vocabulary_preferences,
        response_patterns: typeof row.response_patterns === 'string' ? JSON.parse(row.response_patterns) : row.response_patterns,
        settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
      }))
    });
  } catch (error) {
    log.error('Error fetching clones', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch clones' });
  }
});

/**
 * GET /api/clones/:id
 * Get single clone
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT wc.*,
              (SELECT COUNT(*) FROM clone_training_data WHERE clone_id = wc.id) as training_count,
              (SELECT COUNT(*) FROM clone_responses WHERE clone_id = wc.id) as response_count
       FROM work_clones wc
       WHERE wc.id = $1 AND wc.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found' });
    }

    res.json({ success: true, clone: result.rows[0] });
  } catch (error) {
    log.error('Error fetching clone', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch clone' });
  }
});

/**
 * POST /api/clones
 * Create new clone
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.organization_id;
    const {
      name, description, avatar_url, ai_model, temperature, max_tokens,
      base_system_prompt, personality_prompt, writing_style_prompt,
      tone_settings, settings
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await db.query(
      `INSERT INTO work_clones (
        organization_id, user_id, name, description, avatar_url,
        ai_model, temperature, max_tokens, base_system_prompt,
        personality_prompt, writing_style_prompt, tone_settings, settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        orgId, userId, name, description, avatar_url,
        ai_model || 'gpt-4', temperature || 0.7, max_tokens || 2048,
        base_system_prompt, personality_prompt, writing_style_prompt,
        JSON.stringify(tone_settings || {}), JSON.stringify(settings || {})
      ]
    );

    res.status(201).json({ success: true, clone: result.rows[0] });
  } catch (error) {
    log.error('Error creating clone', { error: error.message });
    res.status(500).json({ error: 'Failed to create clone' });
  }
});

/**
 * PUT /api/clones/:id
 * Update clone
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      name, description, avatar_url, status, ai_model, temperature, max_tokens,
      base_system_prompt, personality_prompt, writing_style_prompt,
      style_profile, tone_settings, vocabulary_preferences, response_patterns,
      is_active, settings
    } = req.body;

    const result = await db.query(
      `UPDATE work_clones SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        avatar_url = COALESCE($3, avatar_url),
        status = COALESCE($4, status),
        ai_model = COALESCE($5, ai_model),
        temperature = COALESCE($6, temperature),
        max_tokens = COALESCE($7, max_tokens),
        base_system_prompt = COALESCE($8, base_system_prompt),
        personality_prompt = COALESCE($9, personality_prompt),
        writing_style_prompt = COALESCE($10, writing_style_prompt),
        style_profile = COALESCE($11, style_profile),
        tone_settings = COALESCE($12, tone_settings),
        vocabulary_preferences = COALESCE($13, vocabulary_preferences),
        response_patterns = COALESCE($14, response_patterns),
        is_active = COALESCE($15, is_active),
        settings = COALESCE($16, settings),
        updated_at = NOW()
      WHERE id = $17 AND user_id = $18
      RETURNING *`,
      [
        name, description, avatar_url, status, ai_model, temperature, max_tokens,
        base_system_prompt, personality_prompt, writing_style_prompt,
        style_profile ? JSON.stringify(style_profile) : null,
        tone_settings ? JSON.stringify(tone_settings) : null,
        vocabulary_preferences ? JSON.stringify(vocabulary_preferences) : null,
        response_patterns ? JSON.stringify(response_patterns) : null,
        is_active, settings ? JSON.stringify(settings) : null,
        id, userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found' });
    }

    res.json({ success: true, clone: result.rows[0] });
  } catch (error) {
    log.error('Error updating clone', { error: error.message });
    res.status(500).json({ error: 'Failed to update clone' });
  }
});

/**
 * DELETE /api/clones/:id
 * Delete clone
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM work_clones WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found' });
    }

    res.json({ success: true, message: 'Clone deleted successfully' });
  } catch (error) {
    log.error('Error deleting clone', { error: error.message });
    res.status(500).json({ error: 'Failed to delete clone' });
  }
});

// ==========================================
// TRAINING DATA
// ==========================================

/**
 * GET /api/clones/:id/training
 * Get training data for clone
 */
router.get('/:id/training', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const cloneCheck = await db.query(
      'SELECT id FROM work_clones WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (cloneCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found' });
    }

    const result = await db.query(
      `SELECT * FROM clone_training_data
       WHERE clone_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({ success: true, trainingData: result.rows });
  } catch (error) {
    log.error('Error fetching training data', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch training data' });
  }
});

/**
 * POST /api/clones/:id/training
 * Add training data
 */
router.post('/:id/training', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { data_type, source, original_content, metadata } = req.body;

    // Verify ownership
    const cloneCheck = await db.query(
      'SELECT id FROM work_clones WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (cloneCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found' });
    }

    // Validate training data
    const validation = trainingService.validateTrainingData({ original_content, data_type });
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join(', ') });
    }

    const result = await db.query(
      `INSERT INTO clone_training_data (
        clone_id, data_type, source, original_content, metadata
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [id, data_type, source, original_content, JSON.stringify(metadata || {})]
    );

    // Update training count
    await db.query(
      `UPDATE work_clones SET training_samples_count = training_samples_count + 1 WHERE id = $1`,
      [id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    log.error('Error adding training data', { error: error.message });
    res.status(500).json({ error: 'Failed to add training data' });
  }
});

/**
 * POST /api/clones/:id/training/bulk
 * Add bulk training data
 */
router.post('/:id/training/bulk', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Verify ownership
    const cloneCheck = await db.query(
      'SELECT id FROM work_clones WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (cloneCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found' });
    }

    let added = 0;
    let skipped = 0;

    for (const item of items) {
      const validation = trainingService.validateTrainingData(item);
      if (validation.isValid) {
        await db.query(
          `INSERT INTO clone_training_data (
            clone_id, data_type, source, original_content, metadata
          ) VALUES ($1, $2, $3, $4, $5)`,
          [id, item.data_type, item.source, item.original_content, JSON.stringify(item.metadata || {})]
        );
        added++;
      } else {
        skipped++;
      }
    }

    // Update training count
    await db.query(
      `UPDATE work_clones SET training_samples_count = training_samples_count + $1 WHERE id = $2`,
      [added, id]
    );

    res.json({ success: true, added, skipped });
  } catch (error) {
    log.error('Error adding bulk training data', { error: error.message });
    res.status(500).json({ error: 'Failed to add training data' });
  }
});

/**
 * DELETE /api/clones/:id/training/:dataId
 * Delete training data
 */
router.delete('/:id/training/:dataId', async (req, res) => {
  try {
    const { id, dataId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const cloneCheck = await db.query(
      'SELECT id FROM work_clones WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (cloneCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found' });
    }

    const result = await db.query(
      'DELETE FROM clone_training_data WHERE id = $1 AND clone_id = $2 RETURNING id',
      [dataId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Training data not found' });
    }

    // Update training count
    await db.query(
      `UPDATE work_clones SET training_samples_count = GREATEST(0, training_samples_count - 1) WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Training data deleted' });
  } catch (error) {
    log.error('Error deleting training data', { error: error.message });
    res.status(500).json({ error: 'Failed to delete training data' });
  }
});

// ==========================================
// TRAINING PROCESS
// ==========================================

/**
 * POST /api/clones/:id/train
 * Train clone with uploaded data
 */
router.post('/:id/train', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get clone and verify ownership
    const cloneResult = await db.query(
      'SELECT * FROM work_clones WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (cloneResult.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found' });
    }

    const clone = cloneResult.rows[0];

    // Get unprocessed training data
    const trainingResult = await db.query(
      `SELECT * FROM clone_training_data
       WHERE clone_id = $1 AND is_approved = true
       ORDER BY created_at DESC`,
      [id]
    );

    if (trainingResult.rows.length < 3) {
      return res.status(400).json({ error: 'At least 3 training samples required' });
    }

    // Update status to training
    await db.query(
      "UPDATE work_clones SET status = 'training' WHERE id = $1",
      [id]
    );

    // Process training data
    const processResult = await trainingService.processTrainingData(trainingResult.rows);
    if (!processResult.success) {
      await db.query("UPDATE work_clones SET status = 'draft' WHERE id = $1", [id]);
      return res.status(500).json({ error: processResult.error });
    }

    // Update processed data in database
    for (const data of processResult.processed) {
      await db.query(
        `UPDATE clone_training_data SET
          processed_content = $1,
          extracted_features = $2,
          style_markers = $3,
          quality_score = $4,
          is_processed = true,
          processed_at = NOW()
        WHERE id = $5`,
        [
          data.processed_content,
          JSON.stringify(data.extracted_features),
          JSON.stringify(data.style_markers),
          data.quality_score,
          data.id
        ]
      );
    }

    // Train the clone
    const trainResult = await trainingService.trainClone(clone, processResult.processed);
    if (!trainResult.success) {
      await db.query("UPDATE work_clones SET status = 'draft' WHERE id = $1", [id]);
      return res.status(500).json({ error: trainResult.error });
    }

    // Update clone with training results
    await db.query(
      `UPDATE work_clones SET
        status = 'ready',
        style_profile = $1,
        base_system_prompt = $2,
        training_score = $3,
        last_trained_at = NOW()
      WHERE id = $4`,
      [
        JSON.stringify(trainResult.styleProfile),
        trainResult.trainingPrompt,
        trainResult.trainingScore,
        id
      ]
    );

    res.json({
      success: true,
      message: 'Training completed',
      trainingScore: trainResult.trainingScore,
      samplesUsed: trainResult.samplesUsed
    });
  } catch (error) {
    log.error('Error training clone', { error: error.message });
    await db.query("UPDATE work_clones SET status = 'draft' WHERE id = $1", [req.params.id]);
    res.status(500).json({ error: 'Failed to train clone' });
  }
});

// ==========================================
// RESPONSE GENERATION
// ==========================================

/**
 * POST /api/clones/:id/generate
 * Generate response using clone
 */
router.post('/:id/generate', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { prompt, type, context, options } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get clone and verify
    const cloneResult = await db.query(
      "SELECT * FROM work_clones WHERE id = $1 AND user_id = $2 AND status = 'ready'",
      [id, userId]
    );

    if (cloneResult.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found or not ready' });
    }

    const clone = cloneResult.rows[0];

    // Generate response based on type
    let result;
    switch (type) {
      case 'email':
        result = await cloneEngine.generateEmail(clone, { ...context, ...options });
        break;
      case 'message':
        result = await cloneEngine.generateMessage(clone, { ...context, ...options });
        break;
      case 'document':
        result = await cloneEngine.generateDocument(clone, { ...context, ...options });
        break;
      default:
        result = await cloneEngine.generateResponse(clone, prompt, options);
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Calculate similarity score
    const similarity = await cloneEngine.calculateSimilarity(clone, result.response);

    // Save response
    const responseResult = await db.query(
      `INSERT INTO clone_responses (
        clone_id, user_id, input_prompt, generated_response, response_type,
        context, input_tokens, output_tokens, latency_ms, similarity_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        id, userId, prompt, result.response, type || 'general',
        context?.subject || context?.topic || '', result.inputTokens,
        result.outputTokens, result.latencyMs, similarity
      ]
    );

    res.json({
      success: true,
      response: result.response,
      responseId: responseResult.rows[0].id,
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens
      },
      latencyMs: result.latencyMs,
      similarity
    });
  } catch (error) {
    log.error('Error generating response', { error: error.message });
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

/**
 * POST /api/clones/:id/refine
 * Refine/edit text using clone style
 */
router.post('/:id/refine', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { text, instructions } = req.body;

    if (!text || !instructions) {
      return res.status(400).json({ error: 'Text and instructions are required' });
    }

    // Get clone
    const cloneResult = await db.query(
      "SELECT * FROM work_clones WHERE id = $1 AND user_id = $2 AND status = 'ready'",
      [id, userId]
    );

    if (cloneResult.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found or not ready' });
    }

    const result = await cloneEngine.refineText(cloneResult.rows[0], text, instructions);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      refinedText: result.response,
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens
      }
    });
  } catch (error) {
    log.error('Error refining text', { error: error.message });
    res.status(500).json({ error: 'Failed to refine text' });
  }
});

// ==========================================
// RESPONSE HISTORY
// ==========================================

/**
 * GET /api/clones/:id/responses
 * Get response history for clone
 */
router.get('/:id/responses', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    // Verify ownership
    const cloneCheck = await db.query(
      'SELECT id FROM work_clones WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (cloneCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found' });
    }

    const result = await db.query(
      `SELECT * FROM clone_responses
       WHERE clone_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM clone_responses WHERE clone_id = $1',
      [id]
    );

    res.json({
      success: true,
      responses: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    log.error('Error fetching responses', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

/**
 * POST /api/clones/:id/responses/:responseId/feedback
 * Rate and provide feedback on response
 */
router.post('/:id/responses/:responseId/feedback', async (req, res) => {
  try {
    const { id, responseId } = req.params;
    const userId = req.user.id;
    const { rating, feedback, editedResponse } = req.body;

    // Verify ownership
    const cloneCheck = await db.query(
      'SELECT id FROM work_clones WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (cloneCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found' });
    }

    const result = await db.query(
      `UPDATE clone_responses SET
        rating = COALESCE($1, rating),
        feedback = COALESCE($2, feedback),
        edited_response = COALESCE($3, edited_response),
        was_edited = $4
      WHERE id = $5 AND clone_id = $6
      RETURNING *`,
      [rating, feedback, editedResponse, !!editedResponse, responseId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    res.json({ success: true, response: result.rows[0] });
  } catch (error) {
    log.error('Error saving feedback', { error: error.message });
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// ==========================================
// STYLE ANALYSIS
// ==========================================

/**
 * POST /api/clones/analyze-style
 * Analyze text style without saving
 */
router.post('/analyze-style', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await styleAnalyzer.analyzeStyle(text);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, analysis: result.analysis });
  } catch (error) {
    log.error('Error analyzing style', { error: error.message });
    res.status(500).json({ error: 'Failed to analyze style' });
  }
});

/**
 * GET /api/clones/:id/stats
 * Get clone usage statistics
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const cloneCheck = await db.query(
      'SELECT * FROM work_clones WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (cloneCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Clone not found' });
    }

    // Get statistics
    const statsResult = await db.query(
      `SELECT
        COUNT(*) as total_responses,
        AVG(rating)::decimal(3,2) as avg_rating,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        AVG(latency_ms)::int as avg_latency,
        AVG(similarity_score)::decimal(3,2) as avg_similarity,
        COUNT(CASE WHEN was_edited THEN 1 END) as edited_count,
        COUNT(CASE WHEN was_used THEN 1 END) as used_count
       FROM clone_responses
       WHERE clone_id = $1`,
      [id]
    );

    const trainingStats = await db.query(
      `SELECT
        COUNT(*) as total_samples,
        AVG(quality_score)::decimal(3,2) as avg_quality,
        COUNT(CASE WHEN is_processed THEN 1 END) as processed_count
       FROM clone_training_data
       WHERE clone_id = $1`,
      [id]
    );

    res.json({
      success: true,
      clone: cloneCheck.rows[0],
      usage: statsResult.rows[0],
      training: trainingStats.rows[0]
    });
  } catch (error) {
    log.error('Error fetching stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
