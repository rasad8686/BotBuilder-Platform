/**
 * WebRTC Service
 * Browser-based real-time communication for voice calls
 */

const log = require('../../utils/logger');
const EventEmitter = require('events');

class WebRTCService extends EventEmitter {
  constructor() {
    super();
    this.activeSessions = new Map();
    this.iceServers = this.getIceServers();
    this.mediaConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1
      },
      video: false
    };
  }

  /**
   * Get ICE servers configuration
   */
  getIceServers() {
    const servers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ];

    // Add TURN servers if configured
    if (process.env.TURN_SERVER_URL) {
      servers.push({
        urls: process.env.TURN_SERVER_URL,
        username: process.env.TURN_SERVER_USERNAME,
        credential: process.env.TURN_SERVER_CREDENTIAL
      });
    }

    // Add Twilio TURN servers if available
    if (process.env.TWILIO_ACCOUNT_SID) {
      servers.push({
        urls: `turn:global.turn.twilio.com:3478?transport=udp`,
        username: process.env.TWILIO_API_KEY_SID,
        credential: process.env.TWILIO_API_KEY_SECRET
      });
    }

    return servers;
  }

  /**
   * Create a new WebRTC session
   * @param {string} sessionId - Unique session identifier
   * @param {Object} options - Session options
   * @returns {Object} Session configuration
   */
  createSession(sessionId, options = {}) {
    const {
      organizationId,
      botId,
      userId,
      callType = 'outbound',
      destination,
      recordCall = false
    } = options;

    const session = {
      sessionId,
      organizationId,
      botId,
      userId,
      callType,
      destination,
      recordCall,
      createdAt: new Date(),
      status: 'initializing',
      iceServers: this.iceServers,
      mediaConstraints: this.mediaConstraints,
      offer: null,
      answer: null,
      iceCandidates: [],
      stats: {
        packetsLost: 0,
        jitter: 0,
        roundTripTime: 0
      }
    };

    this.activeSessions.set(sessionId, session);

    log.info('WebRTC session created', { sessionId, callType });

    return {
      sessionId,
      iceServers: this.iceServers,
      mediaConstraints: this.mediaConstraints
    };
  }

  /**
   * Handle SDP offer from client
   * @param {string} sessionId - Session identifier
   * @param {Object} offer - SDP offer
   * @returns {Object} SDP answer
   */
  async handleOffer(sessionId, offer) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.offer = offer;
    session.status = 'connecting';

    // Generate answer (this would typically involve a media server)
    const answer = await this.generateAnswer(session, offer);

    session.answer = answer;

    log.info('WebRTC offer processed', { sessionId });

    return answer;
  }

  /**
   * Generate SDP answer (mock for server-side processing)
   * In production, this would connect to a media server like Janus, Kurento, or mediasoup
   */
  async generateAnswer(session, offer) {
    // For Twilio integration, we'd use Twilio's WebRTC capabilities
    if (process.env.TWILIO_ACCOUNT_SID) {
      return this.generateTwilioAnswer(session, offer);
    }

    // Mock answer for development
    return {
      type: 'answer',
      sdp: this.createMockSdp(offer.sdp)
    };
  }

  /**
   * Generate answer using Twilio
   */
  async generateTwilioAnswer(session, offer) {
    // In production, this would use Twilio's Programmable Voice SDK
    // to establish a connection between WebRTC and PSTN
    const fetch = (await import('node-fetch')).default;

    // Create a Twilio call that bridges to WebRTC
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    // This is a simplified example - actual implementation would use
    // Twilio's WebRTC SDK or twiml for proper bridging
    const callParams = {
      to: session.destination,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${process.env.BASE_URL}/api/voice/twiml/webrtc/${session.sessionId}`
    };

    log.info('Creating Twilio WebRTC bridge', { sessionId: session.sessionId });

    return {
      type: 'answer',
      sdp: offer.sdp.replace('a=sendrecv', 'a=sendrecv'),
      twilioCallId: 'pending'
    };
  }

  /**
   * Create mock SDP for testing
   */
  createMockSdp(offerSdp) {
    // Very basic SDP transformation for testing
    return offerSdp
      .replace('a=setup:actpass', 'a=setup:active')
      .replace('a=ice-options:trickle', 'a=ice-options:trickle');
  }

  /**
   * Add ICE candidate
   * @param {string} sessionId - Session identifier
   * @param {Object} candidate - ICE candidate
   */
  addIceCandidate(sessionId, candidate) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.iceCandidates.push(candidate);

    this.emit('iceCandidate', { sessionId, candidate });

    log.debug('ICE candidate added', { sessionId });
  }

  /**
   * Update session status
   * @param {string} sessionId - Session identifier
   * @param {string} status - New status
   */
  updateStatus(sessionId, status) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const previousStatus = session.status;
    session.status = status;
    session.lastUpdated = new Date();

    this.emit('statusChange', { sessionId, status, previousStatus });

    log.info('WebRTC session status updated', { sessionId, status });

    if (status === 'connected') {
      session.connectedAt = new Date();
    } else if (status === 'ended') {
      session.endedAt = new Date();
      session.duration = session.connectedAt
        ? (session.endedAt - session.connectedAt) / 1000
        : 0;
    }
  }

  /**
   * Update session stats
   * @param {string} sessionId - Session identifier
   * @param {Object} stats - WebRTC stats
   */
  updateStats(sessionId, stats) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return;
    }

    session.stats = {
      ...session.stats,
      ...stats,
      lastUpdated: new Date()
    };

    // Check for quality issues
    if (stats.packetsLost > 50 || stats.jitter > 100) {
      this.emit('qualityIssue', {
        sessionId,
        stats,
        severity: stats.packetsLost > 100 ? 'high' : 'medium'
      });
    }
  }

  /**
   * End session
   * @param {string} sessionId - Session identifier
   * @param {string} reason - End reason
   */
  endSession(sessionId, reason = 'normal') {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return;
    }

    session.status = 'ended';
    session.endReason = reason;
    session.endedAt = new Date();

    if (session.connectedAt) {
      session.duration = (session.endedAt - session.connectedAt) / 1000;
    }

    this.emit('sessionEnded', { sessionId, reason, session });

    log.info('WebRTC session ended', { sessionId, reason, duration: session.duration });

    // Clean up after a delay to allow for final stats collection
    setTimeout(() => {
      this.activeSessions.delete(sessionId);
    }, 30000);

    return session;
  }

  /**
   * Get session info
   * @param {string} sessionId - Session identifier
   * @returns {Object} Session info
   */
  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   * @param {Object} filters - Filter options
   * @returns {Array} Active sessions
   */
  getActiveSessions(filters = {}) {
    let sessions = Array.from(this.activeSessions.values());

    if (filters.organizationId) {
      sessions = sessions.filter(s => s.organizationId === filters.organizationId);
    }

    if (filters.botId) {
      sessions = sessions.filter(s => s.botId === filters.botId);
    }

    if (filters.status) {
      sessions = sessions.filter(s => s.status === filters.status);
    }

    return sessions.map(s => ({
      sessionId: s.sessionId,
      organizationId: s.organizationId,
      botId: s.botId,
      callType: s.callType,
      destination: s.destination,
      status: s.status,
      createdAt: s.createdAt,
      connectedAt: s.connectedAt,
      duration: s.connectedAt ? (Date.now() - s.connectedAt.getTime()) / 1000 : 0,
      stats: s.stats
    }));
  }

  /**
   * Generate client-side configuration
   * @param {string} sessionId - Session identifier
   * @returns {Object} Client configuration
   */
  getClientConfig(sessionId) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return {
      sessionId,
      iceServers: this.iceServers,
      mediaConstraints: this.mediaConstraints,
      signalingUrl: `${process.env.WS_URL || 'ws://localhost:3001'}/webrtc/${sessionId}`,
      recordCall: session.recordCall
    };
  }

  /**
   * Handle DTMF input
   * @param {string} sessionId - Session identifier
   * @param {string} digits - DTMF digits
   */
  sendDTMF(sessionId, digits) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.emit('dtmf', { sessionId, digits });

    log.debug('DTMF sent', { sessionId, digits });
  }

  /**
   * Mute/unmute audio
   * @param {string} sessionId - Session identifier
   * @param {boolean} muted - Mute state
   */
  setMute(sessionId, muted) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.muted = muted;

    this.emit('muteChange', { sessionId, muted });

    log.debug('Mute state changed', { sessionId, muted });
  }

  /**
   * Hold/unhold call
   * @param {string} sessionId - Session identifier
   * @param {boolean} held - Hold state
   */
  setHold(sessionId, held) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.held = held;
    session.status = held ? 'on-hold' : 'connected';

    this.emit('holdChange', { sessionId, held });

    log.info('Hold state changed', { sessionId, held });
  }

  /**
   * Transfer call
   * @param {string} sessionId - Session identifier
   * @param {string} destination - Transfer destination
   * @param {string} type - 'blind' or 'attended'
   */
  async transferCall(sessionId, destination, type = 'blind') {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'transferring';
    session.transferDestination = destination;
    session.transferType = type;

    this.emit('transfer', { sessionId, destination, type });

    log.info('Call transfer initiated', { sessionId, destination, type });

    return {
      success: true,
      sessionId,
      destination,
      type
    };
  }

  /**
   * Get WebRTC stats summary
   * @returns {Object} Stats summary
   */
  getStatsSummary() {
    const sessions = Array.from(this.activeSessions.values());

    const connected = sessions.filter(s => s.status === 'connected').length;
    const initializing = sessions.filter(s => s.status === 'initializing').length;
    const connecting = sessions.filter(s => s.status === 'connecting').length;

    const avgJitter = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.stats.jitter || 0), 0) / sessions.length
      : 0;

    const avgPacketsLost = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.stats.packetsLost || 0), 0) / sessions.length
      : 0;

    return {
      totalSessions: sessions.length,
      connected,
      initializing,
      connecting,
      avgJitter: Math.round(avgJitter * 100) / 100,
      avgPacketsLost: Math.round(avgPacketsLost),
      qualityScore: this.calculateQualityScore(avgJitter, avgPacketsLost)
    };
  }

  /**
   * Calculate overall quality score
   */
  calculateQualityScore(jitter, packetsLost) {
    // MOS-like scoring (1-5)
    let score = 5;

    // Penalize for jitter
    if (jitter > 20) score -= 0.5;
    if (jitter > 50) score -= 0.5;
    if (jitter > 100) score -= 1;

    // Penalize for packet loss
    if (packetsLost > 1) score -= 0.5;
    if (packetsLost > 3) score -= 0.5;
    if (packetsLost > 5) score -= 1;

    return Math.max(1, Math.round(score * 10) / 10);
  }

  /**
   * Generate Twilio Token for client-side WebRTC
   */
  async generateTwilioToken(identity, options = {}) {
    if (!process.env.TWILIO_ACCOUNT_SID) {
      throw new Error('Twilio not configured');
    }

    const twilio = require('twilio');

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: options.allowIncoming !== false
    });

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY_SID,
      process.env.TWILIO_API_KEY_SECRET,
      { identity }
    );

    token.addGrant(voiceGrant);

    return {
      token: token.toJwt(),
      identity,
      expires: new Date(Date.now() + 3600000) // 1 hour
    };
  }

  /**
   * Clean up stale sessions
   */
  cleanupStaleSessions() {
    const timeout = 3600000; // 1 hour
    const now = Date.now();

    for (const [sessionId, session] of this.activeSessions.entries()) {
      const lastActivity = session.lastUpdated || session.createdAt;
      if (now - lastActivity.getTime() > timeout) {
        this.endSession(sessionId, 'timeout');
      }
    }
  }
}

// Export singleton instance
module.exports = new WebRTCService();
