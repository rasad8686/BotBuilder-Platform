/**
 * SMS Routes - API endpoints for SMS messaging system
 */

const express = require('express');
const router = express.Router();
const smsService = require('../services/smsService');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/db');
const log = require('../utils/logger');

// ============ Webhook Routes (No Auth - Twilio calls these) ============

/**
 * POST /api/sms/webhook/incoming
 * Twilio inbound SMS webhook - receives incoming SMS messages
 */
router.post('/webhook/incoming', async (req, res) => {
  try {
    const { From, To, Body, MessageSid, AccountSid } = req.body;

    log.info('Incoming SMS received:', { from: From, to: To, sid: MessageSid });

    // Find organization by Twilio phone number
    let organizationId = 1; // Default organization

    const settings = await db('sms_settings')
      .where('twilio_phone_number', To)
      .first();

    if (settings) {
      organizationId = settings.organization_id;
    }

    // Save inbound SMS to logs
    await db('sms_logs').insert({
      organization_id: organizationId,
      from_number: From,
      to_number: To,
      direction: 'inbound',
      content: Body,
      status: 'delivered',
      twilio_sid: MessageSid,
      sent_at: new Date(),
      created_at: new Date()
    });

    log.info('Inbound SMS saved:', { from: From, organizationId });

    // Respond to Twilio with TwiML (empty response = no auto-reply)
    res.set('Content-Type', 'text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    log.error('Error processing incoming SMS:', error);
    // Still respond to Twilio to prevent retries
    res.set('Content-Type', 'text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
});

/**
 * POST /api/sms/webhook/status
 * Twilio status callback - receives delivery status updates
 */
router.post('/webhook/status', async (req, res) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

    log.info('SMS status update:', { sid: MessageSid, status: MessageStatus });

    // Map Twilio status to our status
    const statusMap = {
      'queued': 'pending',
      'sending': 'pending',
      'sent': 'sent',
      'delivered': 'delivered',
      'failed': 'failed',
      'undelivered': 'failed'
    };

    const localStatus = statusMap[MessageStatus] || 'pending';

    // Update log entry
    await db('sms_logs')
      .where('twilio_sid', MessageSid)
      .update({
        status: localStatus,
        error_message: ErrorCode ? `${ErrorCode}: ${ErrorMessage}` : null
      });

    res.status(200).send('OK');
  } catch (error) {
    log.error('Error processing SMS status:', error);
    res.status(200).send('OK'); // Still respond OK to prevent retries
  }
});

// All routes below require authentication
router.use(authenticateToken);

// ============ Settings Routes ============

/**
 * GET /api/sms/settings
 * Get SMS settings for current organization
 */
router.get('/settings', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const settings = await smsService.getSettings(organizationId);
    res.json(settings);
  } catch (error) {
    console.error('Error getting SMS settings:', error);
    res.status(500).json({ error: 'Failed to get SMS settings' });
  }
});

/**
 * POST /api/sms/settings
 * Update SMS settings for current organization
 */
router.post('/settings', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const settings = await smsService.updateSettings(organizationId, req.body);
    res.json(settings);
  } catch (error) {
    console.error('Error updating SMS settings:', error);
    res.status(500).json({ error: 'Failed to update SMS settings' });
  }
});

// ============ Templates Routes ============

/**
 * GET /api/sms/templates
 * Get all SMS templates for current organization
 */
router.get('/templates', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const templates = await smsService.getTemplates(organizationId);
    res.json(templates);
  } catch (error) {
    console.error('Error getting SMS templates:', error);
    res.status(500).json({ error: 'Failed to get SMS templates' });
  }
});

/**
 * GET /api/sms/templates/:id
 * Get single SMS template
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const template = await smsService.getTemplate(req.params.id, organizationId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error getting SMS template:', error);
    res.status(500).json({ error: 'Failed to get SMS template' });
  }
});

/**
 * POST /api/sms/templates
 * Create new SMS template
 */
router.post('/templates', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { name, content } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }

    const template = await smsService.createTemplate(organizationId, { name, content });
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating SMS template:', error);
    res.status(500).json({ error: 'Failed to create SMS template' });
  }
});

/**
 * PUT /api/sms/templates/:id
 * Update SMS template
 */
router.put('/templates/:id', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { name, content } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }

    const template = await smsService.updateTemplate(req.params.id, organizationId, { name, content });
    res.json(template);
  } catch (error) {
    console.error('Error updating SMS template:', error);
    if (error.message === 'Template not found') {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.status(500).json({ error: 'Failed to update SMS template' });
  }
});

/**
 * DELETE /api/sms/templates/:id
 * Delete SMS template
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const deleted = await smsService.deleteTemplate(req.params.id, organizationId);

    if (!deleted) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting SMS template:', error);
    res.status(500).json({ error: 'Failed to delete SMS template' });
  }
});

// ============ Logs Routes ============

/**
 * GET /api/sms/logs
 * Get SMS logs for current organization
 */
router.get('/logs', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { page, limit, status, search, direction } = req.query;

    const logs = await smsService.getLogs(organizationId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status,
      search,
      direction
    });

    res.json(logs);
  } catch (error) {
    console.error('Error getting SMS logs:', error);
    res.status(500).json({ error: 'Failed to get SMS logs' });
  }
});

/**
 * GET /api/sms/logs/:id
 * Get single SMS log entry
 */
router.get('/logs/:id', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const log = await smsService.getLog(req.params.id, organizationId);

    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json(log);
  } catch (error) {
    console.error('Error getting SMS log:', error);
    res.status(500).json({ error: 'Failed to get SMS log' });
  }
});

/**
 * GET /api/sms/logs/:id/status
 * Get delivery status for SMS from Twilio
 */
router.get('/logs/:id/status', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const log = await smsService.getLog(req.params.id, organizationId);

    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    if (!log.twilio_sid) {
      return res.status(400).json({ error: 'No Twilio SID for this message' });
    }

    const status = await smsService.getDeliveryStatus(log.twilio_sid, organizationId);
    res.json(status);
  } catch (error) {
    console.error('Error getting SMS delivery status:', error);
    res.status(500).json({ error: 'Failed to get delivery status' });
  }
});

// ============ Send Routes ============

/**
 * POST /api/sms/send
 * Send SMS message
 */
router.post('/send', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }

    // Basic phone number validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to.replace(/[\s\-\(\)]/g, ''))) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const result = await smsService.sendSMS(to, message, organizationId);
    res.json(result);
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: error.message || 'Failed to send SMS' });
  }
});

/**
 * POST /api/sms/send-template
 * Send SMS using template
 */
router.post('/send-template', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { to, templateId, variables } = req.body;

    if (!to || !templateId) {
      return res.status(400).json({ error: 'Phone number and template ID are required' });
    }

    // Basic phone number validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to.replace(/[\s\-\(\)]/g, ''))) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const result = await smsService.sendTemplateSMS(to, templateId, variables || {}, organizationId);
    res.json(result);
  } catch (error) {
    console.error('Error sending template SMS:', error);
    res.status(500).json({ error: error.message || 'Failed to send SMS' });
  }
});

/**
 * POST /api/sms/test
 * Send test SMS (uses default env credentials)
 */
router.post('/test', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const testMessage = 'This is a test SMS from BotBuilder. If you received this, your SMS integration is working correctly!';
    const result = await smsService.sendSMS(to, testMessage, organizationId);
    res.json(result);
  } catch (error) {
    console.error('Error sending test SMS:', error);
    res.status(500).json({ error: error.message || 'Failed to send test SMS' });
  }
});

module.exports = router;
