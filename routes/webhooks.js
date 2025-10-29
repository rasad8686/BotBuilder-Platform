const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const axios = require('axios');
const crypto = require('crypto');

// GET WEBHOOK LOGS FOR BOT
router.get('/:botId/logs', authenticateToken, async (req, res) => {
  try {
    // Verify bot ownership
    const botCheck = await pool.query(
      'SELECT id FROM bots WHERE id = $1 AND user_id = $2',
      [req.params.botId, req.user.userId]
    );

    if (botCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const limit = req.query.limit || 50;
    const result = await pool.query(`
      SELECT * FROM webhook_logs
      WHERE bot_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [req.params.botId, limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({ error: 'Failed to fetch webhook logs' });
  }
});

// TEST WEBHOOK
router.post('/:botId/test', authenticateToken, async (req, res) => {
  try {
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    // Verify bot ownership
    const botResult = await pool.query(
      'SELECT * FROM bots WHERE id = $1 AND user_id = $2',
      [req.params.botId, req.user.userId]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const bot = botResult.rows[0];

    // Create test payload
    const testPayload = {
      type: 'test',
      bot_id: bot.id,
      bot_name: bot.name,
      message: 'This is a test webhook from BotBuilder',
      timestamp: new Date().toISOString()
    };

    // Generate signature
    const signature = crypto
      .createHmac('sha256', bot.webhook_secret || 'test-secret')
      .update(JSON.stringify(testPayload))
      .digest('hex');

    const startTime = Date.now();

    try {
      const response = await axios.post(webhookUrl, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-BotBuilder-Signature': signature
        },
        timeout: 10000
      });

      const responseTime = Date.now() - startTime;

      // Log successful webhook
      await pool.query(`
        INSERT INTO webhook_logs (bot_id, webhook_url, request_method, request_headers, request_body,
                                  response_status, response_body, response_time_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        bot.id,
        webhookUrl,
        'POST',
        { 'X-BotBuilder-Signature': signature },
        testPayload,
        response.status,
        JSON.stringify(response.data).substring(0, 5000),
        responseTime
      ]);

      res.json({
        success: true,
        status: response.status,
        responseTime: responseTime,
        response: response.data
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Log failed webhook
      await pool.query(`
        INSERT INTO webhook_logs (bot_id, webhook_url, request_method, request_headers, request_body,
                                  response_status, error_message, response_time_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        bot.id,
        webhookUrl,
        'POST',
        { 'X-BotBuilder-Signature': signature },
        testPayload,
        error.response?.status || 0,
        error.message,
        responseTime
      ]);

      res.status(400).json({
        success: false,
        error: error.message,
        status: error.response?.status,
        responseTime: responseTime
      });
    }
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

// RECEIVE WEBHOOK FROM EXTERNAL PLATFORMS (Telegram, WhatsApp, Discord)
router.post('/receive/:botId', async (req, res) => {
  try {
    const botResult = await pool.query(
      'SELECT * FROM bots WHERE id = $1',
      [req.params.botId]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const bot = botResult.rows[0];
    const payload = req.body;

    // Track message received
    await pool.query(`
      INSERT INTO usage_tracking (user_id, bot_id, metric_type, count)
      VALUES ($1, $2, 'message_received', 1)
    `, [bot.user_id, bot.id]);

    // Update bot stats
    await pool.query(`
      UPDATE bots
      SET total_messages_received = total_messages_received + 1,
          monthly_message_count = monthly_message_count + 1,
          last_webhook_call = NOW()
      WHERE id = $1
    `, [bot.id]);

    // TODO: Process message based on platform
    // For now, just acknowledge receipt
    res.json({ success: true, botId: bot.id });

    console.log(`📨 Webhook received for bot ${bot.name}`);
  } catch (error) {
    console.error('Error receiving webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// SEND WEBHOOK (Outgoing from bot)
async function sendWebhook(botId, webhookUrl, payload) {
  try {
    const botResult = await pool.query(
      'SELECT * FROM bots WHERE id = $1',
      [botId]
    );

    if (botResult.rows.length === 0) {
      throw new Error('Bot not found');
    }

    const bot = botResult.rows[0];

    // Generate signature
    const signature = crypto
      .createHmac('sha256', bot.webhook_secret || '')
      .update(JSON.stringify(payload))
      .digest('hex');

    const startTime = Date.now();

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-BotBuilder-Signature': signature
      },
      timeout: 10000
    });

    const responseTime = Date.now() - startTime;

    // Log webhook
    await pool.query(`
      INSERT INTO webhook_logs (bot_id, webhook_url, request_method, request_headers, request_body,
                                response_status, response_body, response_time_ms)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      bot.id,
      webhookUrl,
      'POST',
      { 'X-BotBuilder-Signature': signature },
      payload,
      response.status,
      JSON.stringify(response.data).substring(0, 5000),
      responseTime
    ]);

    // Track usage
    await pool.query(`
      INSERT INTO usage_tracking (user_id, bot_id, metric_type, count)
      VALUES ($1, $2, 'webhook_call', 1)
    `, [bot.user_id, bot.id]);

    return { success: true, response: response.data };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Log error
    await pool.query(`
      INSERT INTO webhook_logs (bot_id, webhook_url, request_method, request_headers, request_body,
                                response_status, error_message, response_time_ms)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      botId,
      webhookUrl,
      'POST',
      {},
      payload,
      error.response?.status || 0,
      error.message,
      responseTime
    ]);

    throw error;
  }
}

module.exports = router;
module.exports.sendWebhook = sendWebhook;
