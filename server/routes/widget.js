const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/widget');
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});

// Get widget configuration for a bot
router.get('/:botId/config', authenticateToken, async (req, res) => {
  try {
    const { botId } = req.params;

    // Verify bot ownership
    const botResult = await pool.query(
      'SELECT * FROM bots WHERE id = $1',
      [botId]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Get widget config
    const configResult = await pool.query(
      'SELECT config FROM widget_configs WHERE bot_id = $1',
      [botId]
    );

    if (configResult.rows.length === 0) {
      return res.json({ config: {} });
    }

    res.json({ config: configResult.rows[0].config });
  } catch (error) {
    console.error('Error fetching widget config:', error);
    res.status(500).json({ error: 'Failed to fetch widget config' });
  }
});

// Save widget configuration
router.put('/:botId/config', authenticateToken, async (req, res) => {
  try {
    const { botId } = req.params;
    const { config } = req.body;

    // Verify bot ownership
    const botResult = await pool.query(
      'SELECT * FROM bots WHERE id = $1',
      [botId]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Upsert widget config
    const result = await pool.query(`
      INSERT INTO widget_configs (bot_id, config, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (bot_id)
      DO UPDATE SET config = $2, updated_at = NOW()
      RETURNING *
    `, [botId, JSON.stringify(config)]);

    res.json({ success: true, config: result.rows[0].config });
  } catch (error) {
    console.error('Error saving widget config:', error);
    res.status(500).json({ error: 'Failed to save widget config' });
  }
});

// Public endpoint - Get widget config without auth (for embed)
router.get('/:botId/public-config', async (req, res) => {
  try {
    const { botId } = req.params;

    // Get bot info
    const botResult = await pool.query(
      'SELECT id, name, system_prompt FROM bots WHERE id = $1',
      [botId]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Get widget config
    const configResult = await pool.query(
      'SELECT config FROM widget_configs WHERE bot_id = $1',
      [botId]
    );

    const config = configResult.rows.length > 0 ? configResult.rows[0].config : {};

    res.json({
      botId,
      botName: botResult.rows[0].name,
      config: typeof config === 'string' ? JSON.parse(config) : config
    });
  } catch (error) {
    console.error('Error fetching public widget config:', error);
    res.status(500).json({ error: 'Failed to fetch widget config' });
  }
});

// Handle widget messages
router.post('/:botId/message', async (req, res) => {
  try {
    const { botId } = req.params;
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }

    // Get bot info
    const botResult = await pool.query(
      'SELECT * FROM bots WHERE id = $1',
      [botId]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const bot = botResult.rows[0];

    // Store the message
    await pool.query(`
      INSERT INTO widget_messages (bot_id, session_id, role, content, created_at)
      VALUES ($1, $2, 'user', $3, NOW())
    `, [botId, sessionId, message]);

    // Get conversation history for context
    const historyResult = await pool.query(`
      SELECT role, content FROM widget_messages
      WHERE bot_id = $1 AND session_id = $2
      ORDER BY created_at DESC
      LIMIT 10
    `, [botId, sessionId]);

    const conversationHistory = historyResult.rows.reverse();

    // Generate AI response (simplified - in production use AI service)
    let aiResponse = "Thank you for your message. Our team will respond shortly.";

    // If bot has AI config, try to get AI response
    try {
      const aiConfigResult = await pool.query(
        'SELECT * FROM ai_configurations WHERE bot_id = $1',
        [botId]
      );

      if (aiConfigResult.rows.length > 0) {
        const aiConfig = aiConfigResult.rows[0];
        // Here you would call your AI service
        // For now, use a simple response
        aiResponse = `I received your message: "${message}". How can I help you further?`;
      }
    } catch (aiError) {
      console.error('AI response error:', aiError);
    }

    // Store bot response
    await pool.query(`
      INSERT INTO widget_messages (bot_id, session_id, role, content, created_at)
      VALUES ($1, $2, 'assistant', $3, NOW())
    `, [botId, sessionId, aiResponse]);

    res.json({
      success: true,
      message: aiResponse
    });
  } catch (error) {
    console.error('Error handling widget message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Get conversation history
router.get('/:botId/history/:sessionId', async (req, res) => {
  try {
    const { botId, sessionId } = req.params;

    const result = await pool.query(`
      SELECT id, role, content, created_at
      FROM widget_messages
      WHERE bot_id = $1 AND session_id = $2
      ORDER BY created_at ASC
    `, [botId, sessionId]);

    res.json({ messages: result.rows });
  } catch (error) {
    console.error('Error fetching widget history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// File upload for widget
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/widget/${req.file.filename}`;

    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get widget analytics
router.get('/:botId/analytics', authenticateToken, async (req, res) => {
  try {
    const { botId } = req.params;

    // Get message counts
    const messagesResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE role = 'user') as user_messages,
        COUNT(*) FILTER (WHERE role = 'assistant') as bot_messages,
        COUNT(DISTINCT session_id) as sessions
      FROM widget_messages
      WHERE bot_id = $1
    `, [botId]);

    // Get daily message counts
    const dailyResult = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM widget_messages
      WHERE bot_id = $1 AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [botId]);

    res.json({
      totals: messagesResult.rows[0],
      daily: dailyResult.rows
    });
  } catch (error) {
    console.error('Error fetching widget analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
