/**
 * Voice API Routes
 * Handles voice bots, calls, and phone numbers
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const log = require('../utils/logger');
const { TwilioService, SpeechToText, TextToSpeech } = require('../services/voice');

// All routes require authentication except webhooks
router.use((req, res, next) => {
  // Skip auth for Twilio webhooks
  if (req.path.includes('/webhook')) {
    return next();
  }
  return authMiddleware(req, res, next);
});

// ==========================================
// VOICE BOTS CRUD
// ==========================================

/**
 * GET /api/voice/bots
 * Get user's voice bots
 */
router.get('/bots', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT vb.*, pn.phone_number, pn.friendly_name as phone_friendly_name
       FROM voice_bots vb
       LEFT JOIN phone_numbers pn ON vb.phone_number_id = pn.id
       WHERE vb.user_id = $1
       ORDER BY vb.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      bots: result.rows.map(row => ({
        ...row,
        voice_settings: typeof row.voice_settings === 'string' ? JSON.parse(row.voice_settings) : row.voice_settings,
        stt_settings: typeof row.stt_settings === 'string' ? JSON.parse(row.stt_settings) : row.stt_settings,
        tts_settings: typeof row.tts_settings === 'string' ? JSON.parse(row.tts_settings) : row.tts_settings,
        settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings
      }))
    });
  } catch (error) {
    log.error('Error fetching voice bots', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch voice bots' });
  }
});

/**
 * GET /api/voice/bots/:id
 * Get single voice bot
 */
router.get('/bots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT vb.*, pn.phone_number, pn.friendly_name as phone_friendly_name
       FROM voice_bots vb
       LEFT JOIN phone_numbers pn ON vb.phone_number_id = pn.id
       WHERE vb.id = $1 AND vb.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voice bot not found' });
    }

    res.json({ success: true, bot: result.rows[0] });
  } catch (error) {
    log.error('Error fetching voice bot', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch voice bot' });
  }
});

/**
 * POST /api/voice/bots
 * Create new voice bot
 */
router.post('/bots', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name, description, voice_provider, voice_id, voice_settings,
      stt_provider, stt_settings, tts_provider, tts_settings,
      ai_model, system_prompt, greeting_message, fallback_message,
      max_call_duration, language, settings
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await db.query(
      `INSERT INTO voice_bots (
        user_id, name, description, voice_provider, voice_id, voice_settings,
        stt_provider, stt_settings, tts_provider, tts_settings,
        ai_model, system_prompt, greeting_message, fallback_message,
        max_call_duration, language, settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        userId, name, description || null,
        voice_provider || 'elevenlabs', voice_id || null, JSON.stringify(voice_settings || {}),
        stt_provider || 'whisper', JSON.stringify(stt_settings || {}),
        tts_provider || 'elevenlabs', JSON.stringify(tts_settings || {}),
        ai_model || 'gpt-4', system_prompt || null,
        greeting_message || 'Hello! How can I help you today?',
        fallback_message || "I'm sorry, I didn't understand that. Could you please repeat?",
        max_call_duration || 600, language || 'en-US',
        JSON.stringify(settings || {})
      ]
    );

    log.info('Voice bot created', { botId: result.rows[0].id, userId });

    res.status(201).json({ success: true, bot: result.rows[0] });
  } catch (error) {
    log.error('Error creating voice bot', { error: error.message });
    res.status(500).json({ error: 'Failed to create voice bot' });
  }
});

/**
 * PUT /api/voice/bots/:id
 * Update voice bot
 */
router.put('/bots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    // Verify ownership
    const check = await db.query(
      'SELECT id FROM voice_bots WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Voice bot not found' });
    }

    const allowedFields = [
      'name', 'description', 'phone_number_id', 'voice_provider', 'voice_id',
      'voice_settings', 'stt_provider', 'stt_settings', 'tts_provider', 'tts_settings',
      'ai_model', 'system_prompt', 'greeting_message', 'fallback_message',
      'max_call_duration', 'language', 'status', 'settings'
    ];

    const setClauses = [];
    const values = [id];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbValue = typeof value === 'object' ? JSON.stringify(value) : value;
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(dbValue);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const result = await db.query(
      `UPDATE voice_bots SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    res.json({ success: true, bot: result.rows[0] });
  } catch (error) {
    log.error('Error updating voice bot', { error: error.message });
    res.status(500).json({ error: 'Failed to update voice bot' });
  }
});

/**
 * DELETE /api/voice/bots/:id
 * Delete voice bot
 */
router.delete('/bots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM voice_bots WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Voice bot not found' });
    }

    log.info('Voice bot deleted', { botId: id, userId });

    res.json({ success: true, message: 'Voice bot deleted' });
  } catch (error) {
    log.error('Error deleting voice bot', { error: error.message });
    res.status(500).json({ error: 'Failed to delete voice bot' });
  }
});

// ==========================================
// PHONE NUMBERS
// ==========================================

/**
 * GET /api/voice/phone-numbers
 * Get user's phone numbers
 */
router.get('/phone-numbers', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT pn.*, vb.name as assigned_bot_name
       FROM phone_numbers pn
       LEFT JOIN voice_bots vb ON pn.assigned_bot_id = vb.id
       WHERE pn.user_id = $1
       ORDER BY pn.created_at DESC`,
      [userId]
    );

    res.json({ success: true, phoneNumbers: result.rows });
  } catch (error) {
    log.error('Error fetching phone numbers', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch phone numbers' });
  }
});

/**
 * GET /api/voice/phone-numbers/available
 * Search available phone numbers
 */
router.get('/phone-numbers/available', async (req, res) => {
  try {
    const { country = 'US', areaCode, contains } = req.query;

    const twilio = new TwilioService();

    if (!twilio.isConfigured()) {
      return res.status(400).json({ error: 'Twilio not configured' });
    }

    const result = await twilio.searchAvailableNumbers(country, { areaCode, contains });

    res.json(result);
  } catch (error) {
    log.error('Error searching phone numbers', { error: error.message });
    res.status(500).json({ error: 'Failed to search phone numbers' });
  }
});

/**
 * POST /api/voice/phone-numbers/purchase
 * Purchase a phone number
 */
router.post('/phone-numbers/purchase', async (req, res) => {
  try {
    const userId = req.user.id;
    const { phoneNumber, friendlyName } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const twilio = new TwilioService();

    if (!twilio.isConfigured()) {
      return res.status(400).json({ error: 'Twilio not configured' });
    }

    const baseUrl = process.env.BASE_URL || 'https://your-domain.com';
    const webhookUrl = `${baseUrl}/api/voice/webhook`;

    const result = await twilio.purchaseNumber(phoneNumber, webhookUrl);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Save to database
    const dbResult = await db.query(
      `INSERT INTO phone_numbers (user_id, provider, phone_number, friendly_name, provider_sid, capabilities)
       VALUES ($1, 'twilio', $2, $3, $4, $5)
       RETURNING *`,
      [userId, result.number.phoneNumber, friendlyName || result.number.friendlyName, result.number.sid, JSON.stringify(result.number.capabilities)]
    );

    log.info('Phone number purchased', { phoneNumber, userId });

    res.status(201).json({ success: true, phoneNumber: dbResult.rows[0] });
  } catch (error) {
    log.error('Error purchasing phone number', { error: error.message });
    res.status(500).json({ error: 'Failed to purchase phone number' });
  }
});

/**
 * DELETE /api/voice/phone-numbers/:id
 * Release a phone number
 */
router.delete('/phone-numbers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const check = await db.query(
      'SELECT * FROM phone_numbers WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    const phoneNumber = check.rows[0];

    if (phoneNumber.provider_sid) {
      const twilio = new TwilioService();
      if (twilio.isConfigured()) {
        await twilio.releaseNumber(phoneNumber.provider_sid);
      }
    }

    await db.query('DELETE FROM phone_numbers WHERE id = $1', [id]);

    log.info('Phone number released', { phoneNumber: phoneNumber.phone_number, userId });

    res.json({ success: true, message: 'Phone number released' });
  } catch (error) {
    log.error('Error releasing phone number', { error: error.message });
    res.status(500).json({ error: 'Failed to release phone number' });
  }
});

// ==========================================
// CALLS
// ==========================================

/**
 * GET /api/voice/calls
 * Get call history
 */
router.get('/calls', async (req, res) => {
  try {
    const userId = req.user.id;
    const { botId, status, direction, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT c.*, vb.name as bot_name
      FROM calls c
      JOIN voice_bots vb ON c.voice_bot_id = vb.id
      WHERE vb.user_id = $1
    `;
    const values = [userId];
    let paramIndex = 2;

    if (botId) {
      query += ` AND c.voice_bot_id = $${paramIndex}`;
      values.push(botId);
      paramIndex++;
    }

    if (status) {
      query += ` AND c.status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    if (direction) {
      query += ` AND c.direction = $${paramIndex}`;
      values.push(direction);
      paramIndex++;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const result = await db.query(query, values);

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM calls c
       JOIN voice_bots vb ON c.voice_bot_id = vb.id
       WHERE vb.user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      calls: result.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    log.error('Error fetching calls', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

/**
 * GET /api/voice/calls/:id
 * Get call details with segments
 */
router.get('/calls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT c.*, vb.name as bot_name
       FROM calls c
       JOIN voice_bots vb ON c.voice_bot_id = vb.id
       WHERE c.id = $1 AND vb.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Get call segments
    const segments = await db.query(
      'SELECT * FROM call_segments WHERE call_id = $1 ORDER BY segment_number',
      [id]
    );

    res.json({
      success: true,
      call: result.rows[0],
      segments: segments.rows
    });
  } catch (error) {
    log.error('Error fetching call', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch call' });
  }
});

/**
 * POST /api/voice/calls/outbound
 * Make an outbound call
 */
router.post('/calls/outbound', async (req, res) => {
  try {
    const userId = req.user.id;
    const { botId, toNumber } = req.body;

    if (!botId || !toNumber) {
      return res.status(400).json({ error: 'Bot ID and phone number are required' });
    }

    // Get bot and phone number
    const botResult = await db.query(
      `SELECT vb.*, pn.phone_number as from_number
       FROM voice_bots vb
       JOIN phone_numbers pn ON vb.phone_number_id = pn.id
       WHERE vb.id = $1 AND vb.user_id = $2`,
      [botId, userId]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found or no phone number assigned' });
    }

    const bot = botResult.rows[0];

    const twilio = new TwilioService();

    if (!twilio.isConfigured()) {
      return res.status(400).json({ error: 'Twilio not configured' });
    }

    const baseUrl = process.env.BASE_URL || 'https://your-domain.com';
    const webhookUrl = `${baseUrl}/api/voice/webhook/${botId}`;

    const result = await twilio.makeCall(bot.from_number, toNumber, webhookUrl, { record: true });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Create call record
    const callResult = await db.query(
      `INSERT INTO calls (voice_bot_id, phone_number_id, provider_call_sid, direction, from_number, to_number, status)
       VALUES ($1, $2, $3, 'outbound', $4, $5, 'initiated')
       RETURNING *`,
      [botId, bot.phone_number_id, result.call.sid, bot.from_number, toNumber]
    );

    log.info('Outbound call initiated', { callId: callResult.rows[0].id, botId });

    res.json({ success: true, call: callResult.rows[0] });
  } catch (error) {
    log.error('Error making outbound call', { error: error.message });
    res.status(500).json({ error: 'Failed to make call' });
  }
});

// ==========================================
// TWILIO WEBHOOKS
// ==========================================

/**
 * POST /api/voice/webhook/:botId
 * Handle incoming calls
 */
router.post('/webhook/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const { CallSid, From, To, CallStatus } = req.body;

    // Get bot
    const botResult = await db.query('SELECT * FROM voice_bots WHERE id = $1', [botId]);

    if (botResult.rows.length === 0) {
      return res.status(404).send('Bot not found');
    }

    const bot = botResult.rows[0];

    // Create or update call record
    await db.query(
      `INSERT INTO calls (voice_bot_id, provider_call_sid, direction, from_number, to_number, status, start_time)
       VALUES ($1, $2, 'inbound', $3, $4, $5, NOW())
       ON CONFLICT (provider_call_sid) DO UPDATE SET status = $5`,
      [botId, CallSid, From, To, CallStatus]
    );

    // Generate TwiML response
    const twilio = new TwilioService();
    const twiml = twilio.generateTwiML({
      gather: {
        input: 'speech',
        action: `/api/voice/webhook/${botId}/gather`,
        speechTimeout: 'auto',
        language: bot.language || 'en-US',
        say: bot.greeting_message
      },
      voice: 'Polly.Amy',
      language: bot.language || 'en-US'
    });

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    log.error('Webhook error', { error: error.message });
    res.status(500).send('Error');
  }
});

/**
 * POST /api/voice/webhook/:botId/gather
 * Handle speech input
 */
router.post('/webhook/:botId/gather', async (req, res) => {
  try {
    const { botId } = req.params;
    const { CallSid, SpeechResult, Confidence } = req.body;

    log.info('Speech received', { botId, CallSid, SpeechResult, Confidence });

    // Get bot
    const botResult = await db.query('SELECT * FROM voice_bots WHERE id = $1', [botId]);
    const bot = botResult.rows[0];

    // Here you would integrate with AI to generate response
    // For now, return a simple acknowledgment
    const responseText = bot.fallback_message || "I understand. Is there anything else I can help you with?";

    const twilio = new TwilioService();
    const twiml = twilio.generateTwiML({
      gather: {
        input: 'speech',
        action: `/api/voice/webhook/${botId}/gather`,
        speechTimeout: 'auto',
        language: bot.language || 'en-US',
        say: responseText
      },
      voice: 'Polly.Amy'
    });

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    log.error('Gather webhook error', { error: error.message });
    res.status(500).send('Error');
  }
});

/**
 * POST /api/voice/webhook/:botId/status
 * Handle call status updates
 */
router.post('/webhook/:botId/status', async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;

    await db.query(
      `UPDATE calls SET status = $1, duration = $2, end_time = NOW() WHERE provider_call_sid = $3`,
      [CallStatus, CallDuration || 0, CallSid]
    );

    // Update bot statistics
    if (CallStatus === 'completed') {
      const { botId } = req.params;
      await db.query(
        `UPDATE voice_bots SET total_calls = total_calls + 1, total_duration = total_duration + $1 WHERE id = $2`,
        [CallDuration || 0, botId]
      );
    }

    res.sendStatus(200);
  } catch (error) {
    log.error('Status webhook error', { error: error.message });
    res.status(500).send('Error');
  }
});

// ==========================================
// TTS/STT
// ==========================================

/**
 * GET /api/voice/voices
 * Get available TTS voices
 */
router.get('/voices', async (req, res) => {
  try {
    const { provider = 'elevenlabs' } = req.query;

    const tts = new TextToSpeech(provider);
    const result = await tts.getVoices();

    res.json(result);
  } catch (error) {
    log.error('Error getting voices', { error: error.message });
    res.status(500).json({ error: 'Failed to get voices' });
  }
});

/**
 * POST /api/voice/synthesize
 * Test TTS synthesis
 */
router.post('/synthesize', async (req, res) => {
  try {
    const { text, provider = 'elevenlabs', voiceId, options = {} } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const tts = new TextToSpeech(provider);
    const result = await tts.synthesize(text, { voiceId, ...options });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.set('Content-Type', result.contentType);
    res.send(result.audio);
  } catch (error) {
    log.error('Error synthesizing speech', { error: error.message });
    res.status(500).json({ error: 'Failed to synthesize speech' });
  }
});

module.exports = router;
