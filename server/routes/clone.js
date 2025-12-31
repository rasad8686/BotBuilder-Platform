/**
 * Clone API Routes
 * Handles work clones, training data, and response generation
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const log = require('../utils/logger');
const { CloneEngine, TrainingService, StyleAnalyzer, CloneService } = require('../services/clone');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/clone-samples');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/webm',
      'text/plain', 'application/json', 'text/csv',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// All routes require authentication
router.use(authMiddleware);

// Initialize services
const cloneEngine = new CloneEngine();
const trainingService = new TrainingService();
const styleAnalyzer = new StyleAnalyzer();
const cloneService = new CloneService();

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

// ==========================================
// CLONE JOBS API (NEW SYSTEM)
// ==========================================

/**
 * POST /api/clones/jobs
 * Create new clone job
 */
router.post('/jobs', async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.organization_id;
    const { name, description, type, botId, config } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    if (!['voice', 'style', 'personality', 'full'].includes(type)) {
      return res.status(400).json({ error: 'Invalid clone type' });
    }

    const result = await cloneService.createCloneJob({
      organizationId: orgId,
      userId,
      botId,
      name,
      description,
      type,
      config
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json({ success: true, job: result.job });
  } catch (error) {
    log.error('Error creating clone job', { error: error.message });
    res.status(500).json({ error: 'Failed to create clone job' });
  }
});

/**
 * GET /api/clones/jobs
 * Get all clone jobs for organization
 */
router.get('/jobs', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { type, status, limit, offset } = req.query;

    const result = await cloneService.getCloneJobs(orgId, {
      type,
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, jobs: result.jobs });
  } catch (error) {
    log.error('Error fetching clone jobs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch clone jobs' });
  }
});

/**
 * GET /api/clones/jobs/:id
 * Get single clone job
 */
router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await cloneService.getCloneJob(id, userId);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({ success: true, job: result.job });
  } catch (error) {
    log.error('Error fetching clone job', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch clone job' });
  }
});

/**
 * DELETE /api/clones/jobs/:id
 * Delete clone job
 */
router.delete('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await cloneService.deleteCloneJob(id, userId);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({ success: true, message: 'Clone job deleted' });
  } catch (error) {
    log.error('Error deleting clone job', { error: error.message });
    res.status(500).json({ error: 'Failed to delete clone job' });
  }
});

// ==========================================
// SAMPLE MANAGEMENT
// ==========================================

/**
 * POST /api/clones/jobs/:id/samples
 * Upload sample for clone job
 */
router.post('/jobs/:id/samples', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { type, content, metadata } = req.body;

    // Verify job ownership
    const jobResult = await cloneService.getCloneJob(id, userId);
    if (!jobResult.success) {
      return res.status(404).json({ error: 'Clone job not found' });
    }

    let sampleData = {
      cloneJobId: id,
      type: type || (req.file ? 'audio' : 'text'),
      metadata: metadata ? JSON.parse(metadata) : {}
    };

    if (req.file) {
      sampleData.filePath = req.file.path;
      sampleData.fileName = req.file.originalname;
      sampleData.fileSize = req.file.size;
      sampleData.mimeType = req.file.mimetype;
    } else if (content) {
      sampleData.content = content;
    } else {
      return res.status(400).json({ error: 'File or content is required' });
    }

    const result = await cloneService.addSample(sampleData);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json({ success: true, sample: result.sample });
  } catch (error) {
    log.error('Error adding sample', { error: error.message });
    res.status(500).json({ error: 'Failed to add sample' });
  }
});

/**
 * GET /api/clones/jobs/:id/samples
 * Get samples for clone job
 */
router.get('/jobs/:id/samples', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { type } = req.query;

    // Verify job ownership
    const jobResult = await cloneService.getCloneJob(id, userId);
    if (!jobResult.success) {
      return res.status(404).json({ error: 'Clone job not found' });
    }

    const result = await cloneService.getSamples(id, type);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, samples: result.samples });
  } catch (error) {
    log.error('Error fetching samples', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch samples' });
  }
});

/**
 * DELETE /api/clones/jobs/:id/samples/:sampleId
 * Delete sample
 */
router.delete('/jobs/:id/samples/:sampleId', async (req, res) => {
  try {
    const { id, sampleId } = req.params;
    const userId = req.user.id;

    // Verify job ownership
    const jobResult = await cloneService.getCloneJob(id, userId);
    if (!jobResult.success) {
      return res.status(404).json({ error: 'Clone job not found' });
    }

    const result = await cloneService.deleteSample(sampleId, id);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({ success: true, message: 'Sample deleted' });
  } catch (error) {
    log.error('Error deleting sample', { error: error.message });
    res.status(500).json({ error: 'Failed to delete sample' });
  }
});

// ==========================================
// VOICE CLONING
// ==========================================

/**
 * POST /api/clones/voice
 * Create voice clone job
 */
router.post('/voice', async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.organization_id;
    const { name, description, botId, language, voiceProvider } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await cloneService.createCloneJob({
      organizationId: orgId,
      userId,
      botId,
      name,
      description,
      type: 'voice',
      config: { language, voiceProvider }
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json({ success: true, job: result.job });
  } catch (error) {
    log.error('Error creating voice clone', { error: error.message });
    res.status(500).json({ error: 'Failed to create voice clone' });
  }
});

/**
 * POST /api/clones/voice/:id/train
 * Train voice clone
 */
router.post('/voice/:id/train', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await cloneService.trainVoiceClone(id, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, voiceId: result.voiceId });
  } catch (error) {
    log.error('Error training voice clone', { error: error.message });
    res.status(500).json({ error: 'Failed to train voice clone' });
  }
});

/**
 * POST /api/clones/voice/:id/synthesize
 * Synthesize speech using voice clone
 */
router.post('/voice/:id/synthesize', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, format, speed, pitch } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await cloneService.synthesizeVoice(id, text, {
      format: format || 'mp3',
      speed,
      pitch
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Return audio file or URL
    if (result.audioBuffer) {
      res.set('Content-Type', 'audio/mpeg');
      res.send(result.audioBuffer);
    } else {
      res.json({ success: true, audioUrl: result.audioUrl });
    }
  } catch (error) {
    log.error('Error synthesizing voice', { error: error.message });
    res.status(500).json({ error: 'Failed to synthesize voice' });
  }
});

// ==========================================
// STYLE CLONING
// ==========================================

/**
 * POST /api/clones/style
 * Create style clone job
 */
router.post('/style', async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.organization_id;
    const { name, description, botId, formalityLevel, tone } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await cloneService.createCloneJob({
      organizationId: orgId,
      userId,
      botId,
      name,
      description,
      type: 'style',
      config: { formalityLevel, tone }
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json({ success: true, job: result.job });
  } catch (error) {
    log.error('Error creating style clone', { error: error.message });
    res.status(500).json({ error: 'Failed to create style clone' });
  }
});

/**
 * POST /api/clones/style/:id/train
 * Train style clone
 */
router.post('/style/:id/train', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await cloneService.trainStyleClone(id, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, styleProfile: result.styleProfile });
  } catch (error) {
    log.error('Error training style clone', { error: error.message });
    res.status(500).json({ error: 'Failed to train style clone' });
  }
});

/**
 * POST /api/clones/style/:id/generate
 * Generate text using style clone
 */
router.post('/style/:id/generate', async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt, maxLength, temperature } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await cloneService.generateWithStyle(id, prompt, {
      maxLength,
      temperature
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      text: result.text,
      tokensUsed: result.tokensUsed
    });
  } catch (error) {
    log.error('Error generating with style', { error: error.message });
    res.status(500).json({ error: 'Failed to generate text' });
  }
});

// ==========================================
// PERSONALITY CLONING
// ==========================================

/**
 * POST /api/clones/personality
 * Create personality clone job
 */
router.post('/personality', async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.organization_id;
    const { name, description, botId, personalityName } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await cloneService.createCloneJob({
      organizationId: orgId,
      userId,
      botId,
      name,
      description,
      type: 'personality',
      config: { personalityName: personalityName || name }
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json({ success: true, job: result.job });
  } catch (error) {
    log.error('Error creating personality clone', { error: error.message });
    res.status(500).json({ error: 'Failed to create personality clone' });
  }
});

/**
 * POST /api/clones/personality/:id/train
 * Train personality clone
 */
router.post('/personality/:id/train', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await cloneService.trainPersonalityClone(id, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, profile: result.profile });
  } catch (error) {
    log.error('Error training personality clone', { error: error.message });
    res.status(500).json({ error: 'Failed to train personality clone' });
  }
});

/**
 * POST /api/clones/personality/:id/chat
 * Chat using personality clone
 */
router.post('/personality/:id/chat', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await cloneService.generateWithPersonality(
      id,
      message,
      conversationHistory || []
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      response: result.response,
      tokensUsed: result.tokensUsed
    });
  } catch (error) {
    log.error('Error chatting with personality', { error: error.message });
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// ==========================================
// VERSION MANAGEMENT
// ==========================================

/**
 * GET /api/clones/jobs/:id/versions
 * Get versions for clone job
 */
router.get('/jobs/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify job ownership
    const jobResult = await cloneService.getCloneJob(id, userId);
    if (!jobResult.success) {
      return res.status(404).json({ error: 'Clone job not found' });
    }

    const result = await cloneService.getVersions(id);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, versions: result.versions });
  } catch (error) {
    log.error('Error fetching versions', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

/**
 * POST /api/clones/jobs/:id/versions/:versionId/activate
 * Activate a version
 */
router.post('/jobs/:id/versions/:versionId/activate', async (req, res) => {
  try {
    const { id, versionId } = req.params;
    const userId = req.user.id;

    // Verify job ownership
    const jobResult = await cloneService.getCloneJob(id, userId);
    if (!jobResult.success) {
      return res.status(404).json({ error: 'Clone job not found' });
    }

    const result = await cloneService.activateVersion(id, versionId);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({ success: true, version: result.version });
  } catch (error) {
    log.error('Error activating version', { error: error.message });
    res.status(500).json({ error: 'Failed to activate version' });
  }
});

// ==========================================
// BOT APPLICATION
// ==========================================

/**
 * POST /api/clones/jobs/:id/apply/:botId
 * Apply clone to bot
 */
router.post('/jobs/:id/apply/:botId', async (req, res) => {
  try {
    const { id, botId } = req.params;
    const userId = req.user.id;

    const result = await cloneService.applyToBot(id, botId, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, application: result.application });
  } catch (error) {
    log.error('Error applying clone to bot', { error: error.message });
    res.status(500).json({ error: 'Failed to apply clone to bot' });
  }
});

/**
 * DELETE /api/clones/applications/:applicationId
 * Remove clone from bot
 */
router.delete('/applications/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user.id;

    const result = await cloneService.removeFromBot(applicationId, userId);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({ success: true, message: 'Clone removed from bot' });
  } catch (error) {
    log.error('Error removing clone from bot', { error: error.message });
    res.status(500).json({ error: 'Failed to remove clone from bot' });
  }
});

// ==========================================
// USAGE & ANALYTICS
// ==========================================

/**
 * GET /api/clones/jobs/:id/usage
 * Get usage statistics for clone job
 */
router.get('/jobs/:id/usage', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    // Verify job ownership
    const jobResult = await cloneService.getCloneJob(id, userId);
    if (!jobResult.success) {
      return res.status(404).json({ error: 'Clone job not found' });
    }

    const result = await cloneService.getUsageStats(id, {
      startDate,
      endDate
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, stats: result.stats });
  } catch (error) {
    log.error('Error fetching usage stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
});

// ==========================================
// A/B TESTING
// ==========================================

/**
 * POST /api/clones/ab-tests
 * Create A/B test
 */
router.post('/ab-tests', async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.organization_id;
    const {
      name, description, botId,
      variantACloneId, variantBCloneId,
      trafficSplit, startDate, endDate
    } = req.body;

    if (!name || !botId || !variantACloneId || !variantBCloneId) {
      return res.status(400).json({
        error: 'Name, botId, variantACloneId, and variantBCloneId are required'
      });
    }

    const result = await cloneService.createABTest({
      organizationId: orgId,
      name,
      description,
      botId,
      variantACloneId,
      variantBCloneId,
      trafficSplit,
      startDate,
      endDate,
      createdBy: userId
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json({ success: true, test: result.test });
  } catch (error) {
    log.error('Error creating A/B test', { error: error.message });
    res.status(500).json({ error: 'Failed to create A/B test' });
  }
});

/**
 * GET /api/clones/ab-tests/:id/results
 * Get A/B test results
 */
router.get('/ab-tests/:id/results', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await cloneService.getABTestResults(id);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({
      success: true,
      test: result.test,
      results: result.results
    });
  } catch (error) {
    log.error('Error fetching A/B test results', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch A/B test results' });
  }
});

/**
 * GET /api/clones/status/:id
 * Get clone job status (polling endpoint)
 */
router.get('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await cloneService.getCloneJob(id, userId);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    const job = result.job;

    res.json({
      success: true,
      status: job.status,
      progress: job.training_progress || 0,
      error: job.error_message,
      isReady: job.status === 'ready'
    });
  } catch (error) {
    log.error('Error fetching clone status', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch clone status' });
  }
});

// ==========================================
// TEMPLATES API
// ==========================================

const { CloneTemplates, CloneExport, CloneImport, CloneSharing, CloneAnalytics, CloneBackup } = require('../services/clone');
const cloneTemplates = new CloneTemplates();
const cloneExport = new CloneExport();
const cloneImport = new CloneImport();
const cloneSharing = new CloneSharing();
const cloneAnalytics = new CloneAnalytics();
const cloneBackup = new CloneBackup();

/**
 * GET /api/clones/templates
 * Get available templates
 */
router.get('/templates', async (req, res) => {
  try {
    const { category, type, search } = req.query;
    const orgId = req.user.organization_id;

    const result = await cloneTemplates.getTemplates({
      category,
      type,
      search,
      orgId
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error fetching templates', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/clones/templates/:id
 * Get single template
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await cloneTemplates.getTemplate(id);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error fetching template', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * POST /api/clones/templates/:id/create
 * Create clone from template
 */
router.post('/templates/:id/create', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const orgId = req.user.organization_id;
    const { name, description } = req.body;

    const result = await cloneTemplates.createFromTemplate(id, userId, orgId, {
      name,
      description
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json(result);
  } catch (error) {
    log.error('Error creating from template', { error: error.message });
    res.status(500).json({ error: 'Failed to create clone from template' });
  }
});

/**
 * POST /api/clones/templates
 * Create custom template from clone
 */
router.post('/templates', async (req, res) => {
  try {
    const userId = req.user.id;
    const { cloneId, name, description, category, isPublic, tags } = req.body;

    if (!cloneId) {
      return res.status(400).json({ error: 'Clone ID is required' });
    }

    const result = await cloneTemplates.createTemplate(cloneId, userId, {
      name,
      description,
      category,
      isPublic,
      tags
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json(result);
  } catch (error) {
    log.error('Error creating template', { error: error.message });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// ==========================================
// EXPORT/IMPORT API
// ==========================================

/**
 * POST /api/clones/:id/export
 * Export clone data
 */
router.post('/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { format, includeTrainingData, includeResponses, responseLimit } = req.body;

    let result;
    if (format === 'zip') {
      result = await cloneExport.exportToZip(id, userId, {
        includeTrainingData,
        includeResponses
      });
    } else {
      result = await cloneExport.exportToJson(id, userId, {
        includeTrainingData,
        includeResponses,
        responseLimit
      });
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error exporting clone', { error: error.message });
    res.status(500).json({ error: 'Failed to export clone' });
  }
});

/**
 * POST /api/clones/import/preview
 * Preview import data
 */
router.post('/import/preview', async (req, res) => {
  try {
    const result = await cloneImport.previewImport(req.body);
    res.json(result);
  } catch (error) {
    log.error('Error previewing import', { error: error.message });
    res.status(500).json({ error: 'Failed to preview import' });
  }
});

/**
 * POST /api/clones/import
 * Import clone from data
 */
router.post('/import', async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.organization_id;
    const { data, options } = req.body;

    const result = await cloneImport.importFromJson(data, userId, orgId, options);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json(result);
  } catch (error) {
    log.error('Error importing clone', { error: error.message });
    res.status(500).json({ error: 'Failed to import clone' });
  }
});

// ==========================================
// SHARING API
// ==========================================

/**
 * GET /api/clones/:id/shares
 * Get shares for clone
 */
router.get('/:id/shares', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await cloneSharing.getCloneShares(id, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error fetching shares', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch shares' });
  }
});

/**
 * POST /api/clones/:id/share/user
 * Share clone with user
 */
router.post('/:id/share/user', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { email, permissionLevel, canTrain, canExport, expiresAt } = req.body;

    // Find target user by email
    const userResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await cloneSharing.shareWithUser(id, userId, userResult.rows[0].id, {
      permissionLevel,
      canTrain,
      canExport,
      expiresAt
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error sharing clone', { error: error.message });
    res.status(500).json({ error: 'Failed to share clone' });
  }
});

/**
 * POST /api/clones/:id/share/link
 * Generate share link
 */
router.post('/:id/share/link', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { permissionLevel, maxUses, password, requireEmail, expiresIn } = req.body;

    const expiresAt = expiresIn
      ? new Date(Date.now() + parseInt(expiresIn) * 24 * 60 * 60 * 1000)
      : undefined;

    const result = await cloneSharing.generateShareLink(id, userId, {
      permissionLevel,
      maxUses,
      password,
      requireEmail,
      expiresAt
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error generating share link', { error: error.message });
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

/**
 * DELETE /api/clones/:id/shares/:shareId
 * Revoke share
 */
router.delete('/:id/shares/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    const userId = req.user.id;

    const result = await cloneSharing.revokeShare(shareId, userId);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error revoking share', { error: error.message });
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

/**
 * DELETE /api/clones/:id/share/links/:linkId
 * Revoke share link
 */
router.delete('/:id/share/links/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;
    const userId = req.user.id;

    const result = await cloneSharing.revokeShareLink(linkId, userId);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error revoking share link', { error: error.message });
    res.status(500).json({ error: 'Failed to revoke share link' });
  }
});

/**
 * GET /api/clones/shared-with-me
 * Get clones shared with current user
 */
router.get('/shared-with-me', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await cloneSharing.getSharedWithMe(userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error fetching shared clones', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch shared clones' });
  }
});

// ==========================================
// ANALYTICS API
// ==========================================

/**
 * GET /api/clones/:id/analytics
 * Get clone analytics
 */
router.get('/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { startDate, endDate, granularity } = req.query;

    const result = await cloneAnalytics.getCloneAnalytics(id, userId, {
      startDate,
      endDate,
      granularity
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error fetching analytics', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/clones/:id/compare/:otherId
 * Compare two clones
 */
router.get('/:id/compare/:otherId', async (req, res) => {
  try {
    const { id, otherId } = req.params;
    const userId = req.user.id;

    const result = await cloneAnalytics.compareClones(id, otherId, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error comparing clones', { error: error.message });
    res.status(500).json({ error: 'Failed to compare clones' });
  }
});

/**
 * GET /api/clones/dashboard
 * Get analytics dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    const result = await cloneAnalytics.getDashboard(userId, { startDate, endDate });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error fetching dashboard', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ==========================================
// BACKUP API
// ==========================================

/**
 * POST /api/clones/:id/backup
 * Create backup
 */
router.post('/:id/backup', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, description, includeResponses } = req.body;

    const result = await cloneBackup.createBackup(id, userId, {
      name,
      description,
      includeResponses
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json(result);
  } catch (error) {
    log.error('Error creating backup', { error: error.message });
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

/**
 * GET /api/clones/:id/backups
 * Get backups for clone
 */
router.get('/:id/backups', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await cloneBackup.getBackups(id, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error fetching backups', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch backups' });
  }
});

/**
 * POST /api/clones/:id/restore
 * Restore from backup
 */
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { backupId, createNew, newName, includeTrainingData } = req.body;

    const result = await cloneBackup.restoreFromBackup(backupId, userId, {
      createNew,
      newName,
      includeTrainingData
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error restoring backup', { error: error.message });
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

/**
 * DELETE /api/clones/backups/:backupId
 * Delete backup
 */
router.delete('/backups/:backupId', async (req, res) => {
  try {
    const { backupId } = req.params;
    const userId = req.user.id;

    const result = await cloneBackup.deleteBackup(backupId, userId);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error('Error deleting backup', { error: error.message });
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

module.exports = router;
