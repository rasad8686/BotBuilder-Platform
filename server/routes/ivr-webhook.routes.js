/**
 * IVR Webhook Routes
 * Twilio webhook endpoints for IVR system
 *
 * Note: These routes should be excluded from CSRF protection
 */

const express = require('express');
const router = express.Router();
const { validateTwilioSignature, validateTwilioSignatureFlexible } = require('../middleware/twilioSignature');
const ivrWebhookService = require('../services/ivr-webhook.service');
const logger = require('../utils/logger');

// Use flexible validation that tries multiple URL patterns
const twilioValidation = validateTwilioSignatureFlexible();

/**
 * @route POST /api/voice/ivr/webhook/incoming
 * @desc Handle incoming voice call
 * @access Public (Twilio only)
 */
router.post('/incoming', twilioValidation, async (req, res) => {
  try {
    logger.info('IVR Webhook: Incoming call', {
      CallSid: req.body.CallSid,
      From: req.body.From,
      To: req.body.To
    });

    const twiml = await ivrWebhookService.handleIncomingCall(req.body);

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('IVR Webhook: Error handling incoming call:', error);

    res.type('text/xml');
    res.send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">An error occurred. Please try again later.</Say>
        <Hangup/>
      </Response>
    `);
  }
});

/**
 * @route POST /api/voice/ivr/webhook/gather
 * @desc Handle DTMF/speech gather input
 * @access Public (Twilio only)
 */
router.post('/gather', twilioValidation, async (req, res) => {
  try {
    logger.info('IVR Webhook: Gather input', {
      CallSid: req.body.CallSid,
      Digits: req.body.Digits,
      SpeechResult: req.body.SpeechResult,
      SessionId: req.query.SessionId
    });

    const params = {
      ...req.body,
      SessionId: req.query.SessionId,
      NoInput: req.query.NoInput === 'true'
    };

    const twiml = await ivrWebhookService.handleGatherInput(params);

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('IVR Webhook: Error handling gather:', error);

    res.type('text/xml');
    res.send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">An error occurred processing your input.</Say>
        <Hangup/>
      </Response>
    `);
  }
});

/**
 * @route POST /api/voice/ivr/webhook/record
 * @desc Handle recording status callback
 * @access Public (Twilio only)
 */
router.post('/record', twilioValidation, async (req, res) => {
  try {
    logger.info('IVR Webhook: Recording callback', {
      CallSid: req.body.CallSid,
      RecordingSid: req.body.RecordingSid,
      RecordingStatus: req.body.RecordingStatus,
      RecordingDuration: req.body.RecordingDuration
    });

    const params = {
      ...req.body,
      SessionId: req.query.SessionId
    };

    const result = await ivrWebhookService.handleRecording(params);

    res.json(result);
  } catch (error) {
    logger.error('IVR Webhook: Error handling recording:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/webhook/transcription
 * @desc Handle transcription callback
 * @access Public (Twilio only)
 */
router.post('/transcription', twilioValidation, async (req, res) => {
  try {
    logger.info('IVR Webhook: Transcription callback', {
      CallSid: req.body.CallSid,
      TranscriptionSid: req.body.TranscriptionSid,
      TranscriptionStatus: req.body.TranscriptionStatus
    });

    const params = {
      ...req.body,
      SessionId: req.query.SessionId
    };

    const result = await ivrWebhookService.handleTranscription(params);

    res.json(result);
  } catch (error) {
    logger.error('IVR Webhook: Error handling transcription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/webhook/status
 * @desc Handle call status callback
 * @access Public (Twilio only)
 */
router.post('/status', twilioValidation, async (req, res) => {
  try {
    logger.info('IVR Webhook: Call status', {
      CallSid: req.body.CallSid,
      CallStatus: req.body.CallStatus,
      CallDuration: req.body.CallDuration
    });

    const result = await ivrWebhookService.handleCallStatus(req.body);

    res.json(result);
  } catch (error) {
    logger.error('IVR Webhook: Error handling call status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/voice/ivr/webhook/dial-status
 * @desc Handle dial action result callback
 * @access Public (Twilio only)
 */
router.post('/dial-status', twilioValidation, async (req, res) => {
  try {
    logger.info('IVR Webhook: Dial status', {
      CallSid: req.body.CallSid,
      DialCallStatus: req.body.DialCallStatus,
      DialBridged: req.body.DialBridged
    });

    const params = {
      ...req.body,
      SessionId: req.query.SessionId
    };

    const twiml = await ivrWebhookService.handleDialStatus(params);

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('IVR Webhook: Error handling dial status:', error);

    res.type('text/xml');
    res.send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">The call could not be completed.</Say>
        <Hangup/>
      </Response>
    `);
  }
});

/**
 * @route POST /api/voice/ivr/webhook/fallback
 * @desc Fallback handler for failed webhooks
 * @access Public (Twilio only)
 */
router.post('/fallback', twilioValidation, async (req, res) => {
  logger.warn('IVR Webhook: Fallback triggered', {
    CallSid: req.body.CallSid,
    ErrorCode: req.body.ErrorCode,
    ErrorUrl: req.body.ErrorUrl
  });

  res.type('text/xml');
  res.send(`
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="alice">We're sorry, but we're experiencing technical difficulties. Please try your call again later.</Say>
      <Hangup/>
    </Response>
  `);
});

/**
 * @route POST /api/voice/ivr/hold-music
 * @desc Serve hold music TwiML
 * @access Public (Twilio only)
 */
router.post('/hold-music', (req, res) => {
  const holdMusicUrl = process.env.HOLD_MUSIC_URL || 'http://com.twilio.music.classical.s3.amazonaws.com/BusssyBusyNothing_v04.mp3';

  res.type('text/xml');
  res.send(`
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Play loop="0">${holdMusicUrl}</Play>
    </Response>
  `);
});

/**
 * @route GET /api/voice/ivr/webhook/health
 * @desc Health check for webhook endpoints
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ivr-webhook',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
