/**
 * Call Center API Routes
 * Endpoints for call center dashboard, metrics, and real-time monitoring
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const {
  TwilioService,
  RecordingService,
  TranscriptionService,
  SentimentAnalysis,
  WebRTCService,
  VoiceAnalytics
} = require('../services/voice');
const log = require('../utils/logger');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/call-center/dashboard
 * Get call center dashboard metrics
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { timeRange = '24h' } = req.query;

    // Calculate time range
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case '1h':
        startDate = new Date(now - 3600000);
        break;
      case '24h':
        startDate = new Date(now - 86400000);
        break;
      case '7d':
        startDate = new Date(now - 604800000);
        break;
      case '30d':
        startDate = new Date(now - 2592000000);
        break;
      default:
        startDate = new Date(now - 86400000);
    }

    // Get metrics from various services
    const [
      callMetrics,
      recordingStats,
      webrtcStats
    ] = await Promise.all([
      VoiceAnalytics.getCallMetrics({ organizationId, startDate, endDate: now }),
      RecordingService.getRecordingStats({ organizationId, startDate, endDate: now }),
      WebRTCService.getStatsSummary()
    ]);

    // Get active calls
    const activeCalls = WebRTCService.getActiveSessions({ organizationId });

    res.json({
      success: true,
      data: {
        metrics: {
          totalCalls: callMetrics?.totalCalls || 0,
          activeCalls: activeCalls.length,
          inboundCalls: callMetrics?.inboundCalls || 0,
          outboundCalls: callMetrics?.outboundCalls || 0,
          missedCalls: callMetrics?.missedCalls || 0,
          avgWaitTime: callMetrics?.avgWaitTime || 0,
          avgCallDuration: callMetrics?.avgCallDuration || 0,
          successRate: callMetrics?.successRate || 0
        },
        activeCalls,
        recordings: recordingStats,
        webrtc: webrtcStats,
        timeRange,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    log.error('Failed to get call center dashboard', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard metrics'
    });
  }
});

/**
 * GET /api/call-center/active-calls
 * Get list of active calls
 */
router.get('/active-calls', async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { botId, status } = req.query;

    const filters = { organizationId };
    if (botId) filters.botId = botId;
    if (status) filters.status = status;

    const activeCalls = WebRTCService.getActiveSessions(filters);

    res.json({
      success: true,
      data: {
        calls: activeCalls,
        total: activeCalls.length
      }
    });
  } catch (error) {
    log.error('Failed to get active calls', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active calls'
    });
  }
});

/**
 * GET /api/call-center/queue
 * Get call queue status
 */
router.get('/queue', async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { botId } = req.query;

    // Get queue statistics
    const queueStats = {
      waitingCalls: 0,
      avgWaitTime: 0,
      longestWait: 0,
      agentsAvailable: 0,
      estimatedWaitTime: 0
    };

    // Get calls in queue (waiting status)
    const waitingCalls = WebRTCService.getActiveSessions({
      organizationId,
      status: 'waiting'
    });

    queueStats.waitingCalls = waitingCalls.length;

    if (waitingCalls.length > 0) {
      const waitTimes = waitingCalls.map(c =>
        (Date.now() - new Date(c.createdAt).getTime()) / 1000
      );
      queueStats.avgWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
      queueStats.longestWait = Math.max(...waitTimes);
    }

    res.json({
      success: true,
      data: {
        queue: queueStats,
        waitingCalls
      }
    });
  } catch (error) {
    log.error('Failed to get queue status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve queue status'
    });
  }
});

/**
 * POST /api/call-center/calls/:callId/transfer
 * Transfer an active call
 */
router.post('/calls/:callId/transfer', async (req, res) => {
  try {
    const { callId } = req.params;
    const { destination, type = 'blind' } = req.body;

    if (!destination) {
      return res.status(400).json({
        success: false,
        error: 'Destination is required'
      });
    }

    const result = await WebRTCService.transferCall(callId, destination, type);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    log.error('Failed to transfer call', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to transfer call'
    });
  }
});

/**
 * POST /api/call-center/calls/:callId/hold
 * Put call on hold
 */
router.post('/calls/:callId/hold', async (req, res) => {
  try {
    const { callId } = req.params;
    const { held = true } = req.body;

    WebRTCService.setHold(callId, held);

    res.json({
      success: true,
      data: { callId, held }
    });
  } catch (error) {
    log.error('Failed to set hold', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set hold status'
    });
  }
});

/**
 * POST /api/call-center/calls/:callId/mute
 * Mute/unmute call
 */
router.post('/calls/:callId/mute', async (req, res) => {
  try {
    const { callId } = req.params;
    const { muted = true } = req.body;

    WebRTCService.setMute(callId, muted);

    res.json({
      success: true,
      data: { callId, muted }
    });
  } catch (error) {
    log.error('Failed to set mute', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set mute status'
    });
  }
});

/**
 * POST /api/call-center/calls/:callId/end
 * End an active call
 */
router.post('/calls/:callId/end', async (req, res) => {
  try {
    const { callId } = req.params;
    const { reason = 'normal' } = req.body;

    const session = WebRTCService.endSession(callId, reason);

    res.json({
      success: true,
      data: {
        callId,
        reason,
        duration: session?.duration || 0
      }
    });
  } catch (error) {
    log.error('Failed to end call', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to end call'
    });
  }
});

/**
 * GET /api/call-center/recordings
 * List call recordings
 */
router.get('/recordings', async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { botId, callId, startDate, endDate, limit = 50, offset = 0 } = req.query;

    const recordings = await RecordingService.listRecordings({
      organizationId,
      botId,
      callId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: recordings
    });
  } catch (error) {
    log.error('Failed to list recordings', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recordings'
    });
  }
});

/**
 * GET /api/call-center/recordings/:recordingId
 * Get recording details
 */
router.get('/recordings/:recordingId', async (req, res) => {
  try {
    const { recordingId } = req.params;

    const recording = await RecordingService.getRecording(recordingId);

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }

    res.json({
      success: true,
      data: recording
    });
  } catch (error) {
    log.error('Failed to get recording', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recording'
    });
  }
});

/**
 * POST /api/call-center/recordings/:recordingId/transcribe
 * Transcribe a recording
 */
router.post('/recordings/:recordingId/transcribe', async (req, res) => {
  try {
    const { recordingId } = req.params;
    const { language = 'en', speakerDiarization = true } = req.body;

    const transcription = await RecordingService.transcribeRecording(recordingId, {
      language,
      speakerDiarization
    });

    res.json({
      success: true,
      data: transcription
    });
  } catch (error) {
    log.error('Failed to transcribe recording', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe recording'
    });
  }
});

/**
 * POST /api/call-center/recordings/:recordingId/analyze
 * Analyze recording sentiment
 */
router.post('/recordings/:recordingId/analyze', async (req, res) => {
  try {
    const { recordingId } = req.params;

    // Get recording with transcription
    const recording = await RecordingService.getRecording(recordingId);

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }

    // Ensure transcription exists
    if (!recording.transcription) {
      recording.transcription = await RecordingService.transcribeRecording(recordingId);
    }

    // Analyze sentiment
    const analysis = await SentimentAnalysis.analyzeCallSentiment(
      recording.transcription.segments || [],
      { includeEmotions: true, detailed: true }
    );

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    log.error('Failed to analyze recording', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze recording'
    });
  }
});

/**
 * GET /api/call-center/recordings/:recordingId/export
 * Export recording with transcription
 */
router.get('/recordings/:recordingId/export', async (req, res) => {
  try {
    const { recordingId } = req.params;
    const { format = 'json' } = req.query;

    const exported = await RecordingService.exportRecording(recordingId, format);

    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.send(exported.data);
  } catch (error) {
    log.error('Failed to export recording', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export recording'
    });
  }
});

/**
 * DELETE /api/call-center/recordings/:recordingId
 * Delete a recording
 */
router.delete('/recordings/:recordingId', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const { recordingId } = req.params;

    await RecordingService.deleteRecording(recordingId);

    res.json({
      success: true,
      message: 'Recording deleted successfully'
    });
  } catch (error) {
    log.error('Failed to delete recording', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete recording'
    });
  }
});

/**
 * POST /api/call-center/webrtc/session
 * Create a new WebRTC session
 */
router.post('/webrtc/session', async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const { botId, callType = 'outbound', destination, recordCall = false } = req.body;

    const sessionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session = WebRTCService.createSession(sessionId, {
      organizationId,
      botId,
      userId,
      callType,
      destination,
      recordCall
    });

    // Start recording if requested
    if (recordCall) {
      RecordingService.startRecording(sessionId, {
        organizationId,
        botId,
        userId
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    log.error('Failed to create WebRTC session', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create WebRTC session'
    });
  }
});

/**
 * POST /api/call-center/webrtc/session/:sessionId/offer
 * Handle WebRTC offer
 */
router.post('/webrtc/session/:sessionId/offer', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { offer } = req.body;

    const answer = await WebRTCService.handleOffer(sessionId, offer);

    res.json({
      success: true,
      data: { answer }
    });
  } catch (error) {
    log.error('Failed to handle WebRTC offer', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to handle offer'
    });
  }
});

/**
 * POST /api/call-center/webrtc/session/:sessionId/ice
 * Add ICE candidate
 */
router.post('/webrtc/session/:sessionId/ice', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { candidate } = req.body;

    WebRTCService.addIceCandidate(sessionId, candidate);

    res.json({
      success: true
    });
  } catch (error) {
    log.error('Failed to add ICE candidate', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add ICE candidate'
    });
  }
});

/**
 * GET /api/call-center/webrtc/token
 * Get Twilio WebRTC token
 */
router.get('/webrtc/token', async (req, res) => {
  try {
    const { id: userId } = req.user;

    const tokenData = await WebRTCService.generateTwilioToken(userId);

    res.json({
      success: true,
      data: tokenData
    });
  } catch (error) {
    log.error('Failed to generate WebRTC token', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate token'
    });
  }
});

/**
 * GET /api/call-center/sentiment/analyze
 * Analyze text sentiment
 */
router.post('/sentiment/analyze', async (req, res) => {
  try {
    const { text, detailed = false, includeEmotions = true } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const analysis = await SentimentAnalysis.analyzeSentiment(text, {
      detailed,
      includeEmotions
    });

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    log.error('Failed to analyze sentiment', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to analyze sentiment'
    });
  }
});

/**
 * GET /api/call-center/transcription/providers
 * Get available transcription providers
 */
router.get('/transcription/providers', async (req, res) => {
  try {
    const providers = TranscriptionService.getAvailableProviders();
    const languages = TranscriptionService.getSupportedLanguages();

    res.json({
      success: true,
      data: {
        providers,
        languages
      }
    });
  } catch (error) {
    log.error('Failed to get providers', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve providers'
    });
  }
});

/**
 * GET /api/call-center/stats
 * Get call center statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const stats = await VoiceAnalytics.getDetailedStats({
      organizationId,
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 604800000),
      endDate: endDate ? new Date(endDate) : new Date(),
      groupBy
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    log.error('Failed to get stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

/**
 * GET /api/call-center/agents
 * Get agent/bot status
 */
router.get('/agents', async (req, res) => {
  try {
    const { organizationId } = req.user;

    // Get all bots with voice capability
    const Bot = require('../models/Bot');
    const bots = await Bot.findAll({
      where: { organizationId, voiceEnabled: true }
    });

    // Get active calls per bot
    const activeCalls = WebRTCService.getActiveSessions({ organizationId });

    const agents = bots.map(bot => {
      const botCalls = activeCalls.filter(c => c.botId === bot.id);
      return {
        id: bot.id,
        name: bot.name,
        type: 'bot',
        status: botCalls.length > 0 ? 'busy' : 'available',
        activeCalls: botCalls.length,
        currentCall: botCalls[0] || null
      };
    });

    res.json({
      success: true,
      data: {
        agents,
        total: agents.length,
        available: agents.filter(a => a.status === 'available').length,
        busy: agents.filter(a => a.status === 'busy').length
      }
    });
  } catch (error) {
    log.error('Failed to get agents', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve agent status'
    });
  }
});

module.exports = router;
