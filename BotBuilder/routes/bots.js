const express = require('express');
const { Pool } = require('pg');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create bot
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Bot name is required' });
    }

    const token = `bot-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    const newBot = {
      id: bots.length + 1,
      userId: req.user.userId,
      name: name.trim(),
      description: description?.trim() || '',
      token: token,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    bots.push(newBot);
    console.log(`✅ Bot created: ${newBot.name}`);
    res.status(201).json(newBot);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

// Get all bots for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT * FROM bots WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      bots: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Get bots error:', error);
    res.status(500).json({ error: 'Failed to fetch bots' });
  }
});

// Get single bot
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT * FROM bots WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json({ bot: result.rows[0] });

  } catch (error) {
    console.error('Get bot error:', error);
    res.status(500).json({ error: 'Failed to fetch bot' });
  }
});

// Update bot
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { name, description, platform, api_token, webhook_url, is_active } = req.body;

    const result = await pool.query(
      'UPDATE bots SET name = COALESCE($1, name), description = COALESCE($2, description), platform = COALESCE($3, platform), api_token = COALESCE($4, api_token), webhook_url = COALESCE($5, webhook_url), is_active = COALESCE($6, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = $7 AND user_id = $8 RETURNING *',
      [name, description, platform, api_token, webhook_url, is_active, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json({
      message: 'Bot updated successfully',
      bot: result.rows[0]
    });

  } catch (error) {
    console.error('Update bot error:', error);
    res.status(500).json({ error: 'Failed to update bot' });
  }
});

// Delete bot
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      'DELETE FROM bots WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json({
      message: 'Bot deleted successfully',
      bot: result.rows[0]
    });

  } catch (error) {
    console.error('Delete bot error:', error);
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

module.exports = router;