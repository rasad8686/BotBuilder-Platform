/**
 * Voice to Bot API Routes
 * Handles voice-based bot creation
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const log = require('../utils/logger');
const { VoiceProcessor, IntentExtractor, BotGenerator } = require('../services/voiceToBot');
const { v4: uuidv4 } = require('uuid');

// All routes require authentication
router.use(authMiddleware);

// Configure multer for audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav',
      'audio/ogg', 'audio/m4a', 'audio/flac', 'audio/x-m4a'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'));
    }
  }
});

// Initialize services
const voiceProcessor = new VoiceProcessor();
const intentExtractor = new IntentExtractor();
const botGenerator = new BotGenerator();

// ==========================================
// SESSION MANAGEMENT
// ==========================================

/**
 * POST /api/voice-to-bot/start
 * Start a new voice-to-bot session
 */
router.post('/start', async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.organization_id;
    const { language = 'en' } = req.body;

    const sessionId = uuidv4();

    const result = await db.query(
      `INSERT INTO voice_bot_creations (
        organization_id, user_id, session_id, status, language
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [orgId, userId, sessionId, 'recording', language]
    );

    res.status(201).json({
      success: true,
      session: result.rows[0],
      supportedFormats: voiceProcessor.getSupportedFormats(),
      supportedLanguages: voiceProcessor.getSupportedLanguages()
    });
  } catch (error) {
    log.error('Error starting voice session', { error: error.message });
    res.status(500).json({ error: 'Failed to start session' });
  }
});

/**
 * GET /api/voice-to-bot/sessions
 * Get user's voice-to-bot sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, status } = req.query;

    let query = `
      SELECT vbc.*, b.name as bot_name
      FROM voice_bot_creations vbc
      LEFT JOIN bots b ON vbc.generated_bot_id = b.id
      WHERE vbc.user_id = $1
    `;
    const params = [userId];

    if (status) {
      query += ` AND vbc.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY vbc.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({ success: true, sessions: result.rows });
  } catch (error) {
    log.error('Error fetching sessions', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * GET /api/voice-to-bot/sessions/:sessionId
 * Get session details
 */
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT vbc.*, b.name as bot_name
       FROM voice_bot_creations vbc
       LEFT JOIN bots b ON vbc.generated_bot_id = b.id
       WHERE vbc.session_id = $1 AND vbc.user_id = $2`,
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true, session: result.rows[0] });
  } catch (error) {
    log.error('Error fetching session', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// ==========================================
// AUDIO PROCESSING
// ==========================================

/**
 * POST /api/voice-to-bot/transcribe
 * Transcribe audio to text
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, language } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Verify session
    const sessionCheck = await db.query(
      'SELECT * FROM voice_bot_creations WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update status
    await db.query(
      "UPDATE voice_bot_creations SET status = 'transcribing' WHERE session_id = $1",
      [sessionId]
    );

    // Process audio
    const preprocessResult = await voiceProcessor.preprocessAudio(req.file.buffer, {
      format: req.file.mimetype.split('/')[1]
    });

    if (!preprocessResult.success) {
      return res.status(400).json({ error: preprocessResult.error });
    }

    // Transcribe
    const transcribeResult = await voiceProcessor.transcribe(preprocessResult.buffer, {
      language: language || sessionCheck.rows[0].language,
      format: preprocessResult.format
    });

    if (!transcribeResult.success) {
      await db.query(
        "UPDATE voice_bot_creations SET status = 'error', error_message = $1 WHERE session_id = $2",
        [transcribeResult.error, sessionId]
      );
      return res.status(500).json({ error: transcribeResult.error });
    }

    // Clean transcription
    const cleanedText = voiceProcessor.cleanTranscription(transcribeResult.text);

    // Update session with transcription
    await db.query(
      `UPDATE voice_bot_creations SET
        status = 'transcribed',
        transcription = $1,
        transcription_confidence = $2,
        audio_duration = $3,
        language = $4,
        processing_time_ms = processing_time_ms + $5
      WHERE session_id = $6`,
      [
        cleanedText,
        transcribeResult.confidence,
        Math.round(transcribeResult.duration || 0),
        transcribeResult.language,
        transcribeResult.processingTimeMs,
        sessionId
      ]
    );

    res.json({
      success: true,
      transcription: cleanedText,
      language: transcribeResult.language,
      confidence: transcribeResult.confidence,
      duration: transcribeResult.duration,
      words: transcribeResult.words,
      keyPhrases: voiceProcessor.extractKeyPhrases(cleanedText)
    });
  } catch (error) {
    log.error('Error transcribing audio', { error: error.message });
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

/**
 * POST /api/voice-to-bot/transcribe-chunk
 * Transcribe audio chunk for real-time streaming
 */
router.post('/transcribe-chunk', upload.single('audio'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, chunkNumber, isFinal, previousText } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio chunk provided' });
    }

    // Verify session
    const sessionCheck = await db.query(
      'SELECT * FROM voice_bot_creations WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Transcribe chunk
    const result = await voiceProcessor.transcribeChunk(req.file.buffer, {
      language: sessionCheck.rows[0].language,
      format: req.file.mimetype.split('/')[1],
      previousText,
      chunkNumber: parseInt(chunkNumber) || 0,
      isFinal: isFinal === 'true'
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Save chunk
    await db.query(
      `INSERT INTO voice_bot_sessions (
        creation_id, chunk_number, chunk_transcription, chunk_confidence, is_final
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        sessionCheck.rows[0].id,
        parseInt(chunkNumber) || 0,
        result.text,
        result.confidence,
        isFinal === 'true'
      ]
    );

    res.json({
      success: true,
      text: result.text,
      confidence: result.confidence,
      isFinal: result.isFinal,
      chunkNumber: result.chunkNumber
    });
  } catch (error) {
    log.error('Error transcribing chunk', { error: error.message });
    res.status(500).json({ error: 'Failed to transcribe chunk' });
  }
});

// ==========================================
// INTENT EXTRACTION
// ==========================================

/**
 * POST /api/voice-to-bot/extract
 * Extract intents and entities from transcription
 */
router.post('/extract', async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, text } = req.body;

    // Get session
    const sessionCheck = await db.query(
      'SELECT * FROM voice_bot_creations WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionCheck.rows[0];
    const textToProcess = text || session.transcription;

    if (!textToProcess) {
      return res.status(400).json({ error: 'No text to process' });
    }

    // Update status
    await db.query(
      "UPDATE voice_bot_creations SET status = 'extracting' WHERE session_id = $1",
      [sessionId]
    );

    // Extract intents
    const extractResult = await intentExtractor.extractFromText(textToProcess, {
      language: session.language
    });

    if (!extractResult.success) {
      await db.query(
        "UPDATE voice_bot_creations SET status = 'error', error_message = $1 WHERE session_id = $2",
        [extractResult.error, sessionId]
      );
      return res.status(500).json({ error: extractResult.error });
    }

    // Update session with extracted data
    await db.query(
      `UPDATE voice_bot_creations SET
        status = 'extracted',
        extracted_name = $1,
        extracted_description = $2,
        extracted_intents = $3,
        extracted_entities = $4,
        extracted_flows = $5,
        ai_analysis = $6,
        processing_time_ms = processing_time_ms + $7
      WHERE session_id = $8`,
      [
        extractResult.name,
        extractResult.description,
        JSON.stringify(extractResult.intents),
        JSON.stringify(extractResult.entities),
        JSON.stringify(extractResult.flows),
        JSON.stringify({ suggestedFeatures: extractResult.suggestedFeatures }),
        extractResult.processingTimeMs,
        sessionId
      ]
    );

    // Generate preview
    const preview = botGenerator.previewBot(extractResult);

    res.json({
      success: true,
      extracted: extractResult,
      preview
    });
  } catch (error) {
    log.error('Error extracting intents', { error: error.message });
    res.status(500).json({ error: 'Failed to extract intents' });
  }
});

// ==========================================
// BOT GENERATION
// ==========================================

/**
 * POST /api/voice-to-bot/generate
 * Generate bot from extracted data (supports both session and direct mode)
 */
router.post('/generate', async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.organization_id;
    const { sessionId, customizations, extractedData: directData } = req.body;

    let extractedData;
    let session = null;

    // Try to get session if sessionId provided
    if (sessionId) {
      const sessionCheck = await db.query(
        'SELECT * FROM voice_bot_creations WHERE session_id = $1 AND user_id = $2',
        [sessionId, userId]
      );
      if (sessionCheck.rows.length > 0) {
        session = sessionCheck.rows[0];
      }
    }

    // Use session data or direct data (template mode)
    if (session && session.extracted_intents) {
      // Session mode - use data from database
      await db.query(
        "UPDATE voice_bot_creations SET status = 'generating' WHERE session_id = $1",
        [sessionId]
      );

      extractedData = {
        name: customizations?.name || session.extracted_name,
        description: customizations?.description || session.extracted_description,
        category: session.ai_analysis?.category || 'custom',
        language: session.language,
        intents: typeof session.extracted_intents === 'string'
          ? JSON.parse(session.extracted_intents)
          : session.extracted_intents,
        entities: typeof session.extracted_entities === 'string'
          ? JSON.parse(session.extracted_entities)
          : session.extracted_entities,
        flows: typeof session.extracted_flows === 'string'
          ? JSON.parse(session.extracted_flows)
          : session.extracted_flows,
        suggestedFeatures: session.ai_analysis?.suggestedFeatures || []
      };
    } else if (directData) {
      // Direct mode (template) - use data from request
      extractedData = {
        name: customizations?.name || directData.name,
        description: customizations?.description || directData.description,
        category: directData.category || 'custom',
        language: directData.language || 'en',
        intents: directData.intents || [],
        entities: directData.entities || [],
        flows: directData.flows || [],
        suggestedFeatures: directData.suggestedFeatures || []
      };
    } else {
      return res.status(400).json({ error: 'No extracted data available' });
    }

    // Generate bot
    const generateResult = await botGenerator.generateBot(extractedData, userId, orgId);

    if (!generateResult.success) {
      if (session) {
        await db.query(
          "UPDATE voice_bot_creations SET status = 'error', error_message = $1 WHERE session_id = $2",
          [generateResult.error, sessionId]
        );
      }
      return res.status(500).json({ error: generateResult.error });
    }

    // Update session if exists
    if (session) {
      await db.query(
        `UPDATE voice_bot_creations SET
          status = 'completed',
          generated_bot_id = $1,
          generation_config = $2,
          processing_time_ms = processing_time_ms + $3,
          completed_at = NOW()
        WHERE session_id = $4`,
        [
          generateResult.bot.id,
          JSON.stringify(customizations || {}),
          generateResult.processingTimeMs,
          sessionId
        ]
      );
    }

    res.json({
      success: true,
      bot: generateResult.bot,
      intents: generateResult.intents,
      entities: generateResult.entities,
      flow: generateResult.flow,
      message: 'Bot created successfully!'
    });
  } catch (error) {
    log.error('Error generating bot', { error: error.message });
    res.status(500).json({ error: 'Failed to generate bot' });
  }
});

/**
 * POST /api/voice-to-bot/preview
 * Preview bot without saving
 */
router.post('/preview', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    const sessionCheck = await db.query(
      'SELECT * FROM voice_bot_creations WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionCheck.rows[0];

    const extractedData = {
      name: session.extracted_name,
      description: session.extracted_description,
      category: session.ai_analysis?.category || 'custom',
      intents: typeof session.extracted_intents === 'string'
        ? JSON.parse(session.extracted_intents)
        : session.extracted_intents,
      entities: typeof session.extracted_entities === 'string'
        ? JSON.parse(session.extracted_entities)
        : session.extracted_entities
    };

    const preview = botGenerator.previewBot(extractedData);

    res.json({ success: true, preview });
  } catch (error) {
    log.error('Error generating preview', { error: error.message });
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// ==========================================
// TEMPLATES
// ==========================================

/**
 * GET /api/voice-to-bot/templates
 * Get available bot templates
 */
router.get('/templates', async (req, res) => {
  try {
    const result = await botGenerator.getTemplates();

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, templates: result.templates });
  } catch (error) {
    log.error('Error fetching templates', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/voice-to-bot/templates/:id
 * Get template details
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await botGenerator.getTemplate(id);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({ success: true, template: result.template });
  } catch (error) {
    log.error('Error fetching template', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// ==========================================
// UTILITIES
// ==========================================

/**
 * DELETE /api/voice-to-bot/sessions/:sessionId
 * Delete a session
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM voice_bot_creations WHERE session_id = $1 AND user_id = $2 RETURNING id',
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    log.error('Error deleting session', { error: error.message });
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

/**
 * GET /api/voice-to-bot/supported
 * Get supported formats and languages
 */
router.get('/supported', (req, res) => {
  res.json({
    success: true,
    formats: voiceProcessor.getSupportedFormats(),
    languages: voiceProcessor.getSupportedLanguages()
  });
});

module.exports = router;
