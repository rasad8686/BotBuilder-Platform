const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

router.post('/:botId/messages', authenticateToken, async (req, res) => {
  try {
    const { botId } = req.params;
    const { message_type, content, trigger_keywords } = req.body;
    
    const keywordsArray = Array.isArray(trigger_keywords) ? trigger_keywords : [];
    const keywordsString = `{${keywordsArray.join(',')}}`;
    
    const result = await pool.query(
      'INSERT INTO bot_messages (bot_id, message_type, content, trigger_keywords) VALUES ($1, $2, $3, $4) RETURNING *',
      [botId, message_type, content, keywordsString]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

router.get('/:botId/messages', authenticateToken, async (req, res) => {
  try {
    const { botId } = req.params;
    const result = await pool.query(
      'SELECT * FROM bot_messages WHERE bot_id = $1 ORDER BY created_at DESC',
      [botId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.delete('/:botId/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    await pool.query('DELETE FROM bot_messages WHERE id = $1', [messageId]);
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;