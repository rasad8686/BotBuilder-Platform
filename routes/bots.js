const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { checkBotLimit } = require('../middleware/usageLimits');
const crypto = require('crypto');

// CREATE BOT - with usage limit check
router.post('/', authenticateToken, checkBotLimit, async (req, res) => {
  try {
    const { name, description, platform, webhook_url } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Bot name is required' });
    }

    if (!platform) {
      return res.status(400).json({ error: 'Platform is required' });
    }

    // Generate bot token and webhook secret
    const token = `bot-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      `INSERT INTO bots (user_id, name, description, platform, api_token, webhook_url, webhook_secret)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.userId, name.trim(), description?.trim() || '', platform, token, webhook_url || null, webhookSecret]
    );

    console.log(`✅ Bot created: ${result.rows[0].name}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Create bot error:', error);
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

// GET ALL BOTS
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bots WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bots:', error);
    res.status(500).json({ error: 'Failed to fetch bots' });
  }
});

// GET SINGLE BOT
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bots WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching bot:', error);
    res.status(500).json({ error: 'Failed to fetch bot' });
  }
});

// UPDATE BOT
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, status } = req.body;

    const result = await pool.query(
      'UPDATE bots SET name = $1, description = $2, status = $3, updated_at = NOW() WHERE id = $4 AND user_id = $5 RETURNING *',
      [name, description, status, req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating bot:', error);
    res.status(500).json({ error: 'Failed to update bot' });
  }
});

// DELETE BOT
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM bots WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json({ message: 'Bot deleted successfully' });
  } catch (error) {
    console.error('Error deleting bot:', error);
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

module.exports = router;