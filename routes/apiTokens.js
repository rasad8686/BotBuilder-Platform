const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Generate API token
function generateApiToken() {
  return `bbot_${uuidv4().replace(/-/g, '')}`;
}

// Hash token for storage
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// GET ALL API TOKENS FOR USER
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id,
        t.token_name,
        t.token_preview,
        t.permissions,
        t.last_used_at,
        t.expires_at,
        t.is_active,
        t.created_at,
        b.name as bot_name,
        b.id as bot_id
      FROM api_tokens t
      LEFT JOIN bots b ON t.bot_id = b.id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
    `, [req.user.userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching API tokens:', error);
    res.status(500).json({ error: 'Failed to fetch API tokens' });
  }
});

// CREATE NEW API TOKEN
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { tokenName, botId, permissions, expiresInDays } = req.body;

    if (!tokenName || tokenName.trim() === '') {
      return res.status(400).json({ error: 'Token name is required' });
    }

    // Check if bot belongs to user
    if (botId) {
      const botCheck = await pool.query(
        'SELECT id FROM bots WHERE id = $1 AND user_id = $2',
        [botId, req.user.userId]
      );

      if (botCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Bot not found' });
      }
    }

    // Generate token
    const token = generateApiToken();
    const tokenHash = hashToken(token);
    const tokenPreview = `${token.substring(0, 15)}...`;

    // Calculate expiration
    let expiresAt = null;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Store token
    const result = await pool.query(`
      INSERT INTO api_tokens (user_id, bot_id, token_name, token_hash, token_preview, permissions, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, token_name, token_preview, permissions, expires_at, created_at
    `, [
      req.user.userId,
      botId || null,
      tokenName.trim(),
      tokenHash,
      tokenPreview,
      permissions || { read: true, write: true, delete: false },
      expiresAt
    ]);

    // Return the full token only once
    res.json({
      token: token, // Full token - show only once!
      tokenInfo: result.rows[0]
    });

    console.log(`✅ API token created: ${tokenName} for user ${req.user.userId}`);
  } catch (error) {
    console.error('Error creating API token:', error);
    res.status(500).json({ error: 'Failed to create API token' });
  }
});

// DELETE API TOKEN
router.delete('/:tokenId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM api_tokens WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.tokenId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json({ message: 'Token deleted successfully' });
  } catch (error) {
    console.error('Error deleting API token:', error);
    res.status(500).json({ error: 'Failed to delete API token' });
  }
});

// TOGGLE TOKEN ACTIVE STATUS
router.patch('/:tokenId/toggle', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE api_tokens SET is_active = NOT is_active WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.tokenId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error toggling token:', error);
    res.status(500).json({ error: 'Failed to toggle token' });
  }
});

// MIDDLEWARE: Verify API token
async function verifyApiToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'API token required' });
    }

    const token = authHeader.substring(7);
    const tokenHash = hashToken(token);

    // Find token
    const result = await pool.query(`
      SELECT t.*, u.id as user_id, u.email
      FROM api_tokens t
      JOIN users u ON t.user_id = u.id
      WHERE t.token_hash = $1 AND t.is_active = true
    `, [tokenHash]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API token' });
    }

    const tokenData = result.rows[0];

    // Check expiration
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return res.status(401).json({ error: 'API token expired' });
    }

    // Update last used
    await pool.query(
      'UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1',
      [tokenData.id]
    );

    // Attach token data to request
    req.apiToken = tokenData;
    req.user = { userId: tokenData.user_id, email: tokenData.email };

    next();
  } catch (error) {
    console.error('Error verifying API token:', error);
    res.status(500).json({ error: 'Token verification failed' });
  }
}

module.exports = router;
module.exports.verifyApiToken = verifyApiToken;
