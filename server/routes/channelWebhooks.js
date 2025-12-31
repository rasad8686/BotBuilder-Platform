/**
 * Channel Webhook Routes
 * Handles incoming webhooks from WhatsApp, Instagram, Telegram, Discord messaging platforms
 */

const express = require('express');
const router = express.Router();
const channelManager = require('../channels/core/ChannelManager');
const WhatsAppProvider = require('../channels/providers/WhatsAppProvider');
const InstagramProvider = require('../channels/providers/InstagramProvider');
const DiscordProvider = require('../channels/providers/DiscordProvider');
const Channel = require('../models/Channel');
const log = require('../utils/logger');

// Initialize providers
const whatsappProvider = new WhatsAppProvider();
const instagramProvider = new InstagramProvider();
const discordProvider = new DiscordProvider();

// Register providers with channel manager
channelManager.registerHandler('whatsapp', whatsappProvider);
channelManager.registerHandler('instagram', instagramProvider);
channelManager.registerHandler('discord', discordProvider);

// Webhook verification tokens from environment (no insecure defaults)
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const INSTAGRAM_VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN;
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;

// Log warning if tokens are not configured
if (!WHATSAPP_VERIFY_TOKEN) {
  log.warn('WHATSAPP_VERIFY_TOKEN not configured - WhatsApp webhooks will fail verification');
}
if (!INSTAGRAM_VERIFY_TOKEN) {
  log.warn('INSTAGRAM_VERIFY_TOKEN not configured - Instagram webhooks will fail verification');
}

// =============================================
// WHATSAPP WEBHOOKS
// =============================================

/**
 * GET /webhooks/whatsapp
 * WhatsApp webhook verification
 */
router.get('/whatsapp', (req, res) => {
  try {
    const challenge = whatsappProvider.handleChallenge(req.query, WHATSAPP_VERIFY_TOKEN);

    if (challenge) {
      log.info('WhatsApp webhook verified successfully');
      return res.status(200).send(challenge);
    }

    log.warn('WhatsApp webhook verification failed');
    return res.status(403).send('Verification failed');
  } catch (error) {
    log.error('WhatsApp webhook verification error', { error: error.message });
    res.status(500).send('Error');
  }
});

/**
 * POST /webhooks/whatsapp
 * WhatsApp incoming messages and status updates
 */
router.post('/whatsapp', async (req, res) => {
  try {
    // Verify signature if app secret is configured
    if (WHATSAPP_APP_SECRET) {
      const isValid = whatsappProvider.verify(req, WHATSAPP_APP_SECRET);
      if (!isValid) {
        log.warn('WhatsApp webhook signature verification failed');
        return res.status(401).send('Invalid signature');
      }
    }

    // Always respond quickly to webhook
    res.status(200).send('EVENT_RECEIVED');

    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        const results = await channelManager.processWebhook('whatsapp', req.body, req.headers);
        log.info('WhatsApp webhook processed', { eventCount: results.length });
      } catch (error) {
        log.error('Error processing WhatsApp webhook', { error: error.message });
      }
    });

  } catch (error) {
    log.error('WhatsApp webhook error', { error: error.message });
    res.status(500).send('Error');
  }
});

// =============================================
// INSTAGRAM WEBHOOKS
// =============================================

/**
 * GET /webhooks/instagram
 * Instagram webhook verification
 */
router.get('/instagram', (req, res) => {
  try {
    const challenge = instagramProvider.handleChallenge(req.query, INSTAGRAM_VERIFY_TOKEN);

    if (challenge) {
      log.info('Instagram webhook verified successfully');
      return res.status(200).send(challenge);
    }

    log.warn('Instagram webhook verification failed');
    return res.status(403).send('Verification failed');
  } catch (error) {
    log.error('Instagram webhook verification error', { error: error.message });
    res.status(500).send('Error');
  }
});

/**
 * POST /webhooks/instagram
 * Instagram incoming messages, reactions, story mentions
 */
router.post('/instagram', async (req, res) => {
  try {
    // Verify signature if app secret is configured
    if (INSTAGRAM_APP_SECRET) {
      const isValid = instagramProvider.verify(req, INSTAGRAM_APP_SECRET);
      if (!isValid) {
        log.warn('Instagram webhook signature verification failed');
        return res.status(401).send('Invalid signature');
      }
    }

    // Always respond quickly to webhook
    res.status(200).send('EVENT_RECEIVED');

    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        const results = await channelManager.processWebhook('instagram', req.body, req.headers);
        log.info('Instagram webhook processed', { eventCount: results.length });
      } catch (error) {
        log.error('Error processing Instagram webhook', { error: error.message });
      }
    });

  } catch (error) {
    log.error('Instagram webhook error', { error: error.message });
    res.status(500).send('Error');
  }
});

// =============================================
// TELEGRAM WEBHOOKS
// =============================================

/**
 * POST /webhooks/telegram/:botToken
 * Telegram incoming updates
 */
router.post('/telegram/:botToken', async (req, res) => {
  try {
    const { botToken } = req.params;

    // Find channel by bot token
    const result = await require('../db').query(
      `SELECT * FROM channels WHERE type = 'telegram' AND credentials->>'bot_token' = $1`,
      [botToken]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Bot not found');
    }

    // Respond quickly
    res.status(200).send('OK');

    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        // Telegram processing will be implemented with TelegramProvider
        log.debug('Telegram webhook received', { body: req.body });
      } catch (error) {
        log.error('Error processing Telegram webhook', { error: error.message });
      }
    });

  } catch (error) {
    log.error('Telegram webhook error', { error: error.message });
    res.status(500).send('Error');
  }
});

// =============================================
// GENERIC/CUSTOM WEBHOOKS
// =============================================

/**
 * POST /webhooks/channel/:channelId
 * Generic webhook for any channel by ID
 */
router.post('/channel/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;

    const channel = await Channel.findById(parseInt(channelId));
    if (!channel) {
      return res.status(404).send('Channel not found');
    }

    // Verify webhook secret
    const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;
    if (channel.webhook_secret && providedSecret !== channel.webhook_secret) {
      return res.status(401).send('Invalid webhook secret');
    }

    // Respond quickly
    res.status(200).send('OK');

    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        await channelManager.processWebhook(channel.type, req.body, req.headers);
      } catch (error) {
        log.error('Error processing webhook for channel', { channelId, error: error.message });
      }
    });

  } catch (error) {
    log.error('Generic webhook error', { error: error.message });
    res.status(500).send('Error');
  }
});

// =============================================
// WEBHOOK STATUS & TESTING
// =============================================

/**
 * GET /webhooks/status
 * Get webhook configuration status
 */
router.get('/status', (req, res) => {
  res.json({
    whatsapp: {
      enabled: true,
      verifyToken: WHATSAPP_VERIFY_TOKEN ? 'configured' : 'not configured',
      appSecret: WHATSAPP_APP_SECRET ? 'configured' : 'not configured',
      endpoint: '/webhooks/whatsapp'
    },
    instagram: {
      enabled: true,
      verifyToken: INSTAGRAM_VERIFY_TOKEN ? 'configured' : 'not configured',
      appSecret: INSTAGRAM_APP_SECRET ? 'configured' : 'not configured',
      endpoint: '/webhooks/instagram'
    },
    telegram: {
      enabled: true,
      endpoint: '/webhooks/telegram/:botToken'
    },
    discord: {
      enabled: true,
      endpoint: '/webhooks/discord/:botId/interactions',
      gatewayEndpoint: '/webhooks/discord/:botId/gateway'
    }
  });
});

/**
 * POST /webhooks/test
 * Test webhook endpoint (for development)
 */
router.post('/test', (req, res) => {
  log.debug('Test webhook received', {
    headers: req.headers,
    body: req.body
  });

  res.json({
    success: true,
    message: 'Webhook received',
    received: {
      timestamp: new Date().toISOString(),
      body: req.body
    }
  });
});

module.exports = router;
