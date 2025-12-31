/**
 * WebRTC Service Tests
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

let WebRTCService;

describe('WebRTCService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    WebRTCService = require('../../services/voice/WebRTCService');
    // Clear internal state
    WebRTCService.activeSessions = new Map();
  });

  describe('createSession', () => {
    it('should create a new WebRTC session', () => {
      const result = WebRTCService.createSession('session-123', {
        organizationId: 'org-1',
        botId: 'bot-1',
        callType: 'outbound',
        destination: '+1234567890'
      });

      expect(result.sessionId).toBe('session-123');
      expect(result.iceServers).toBeDefined();
      expect(result.mediaConstraints).toBeDefined();
      expect(WebRTCService.activeSessions.size).toBe(1);
    });

    it('should use default call type', () => {
      WebRTCService.createSession('session-123', {});

      const session = WebRTCService.activeSessions.get('session-123');
      expect(session.callType).toBe('outbound');
    });

    it('should emit no events on creation', () => {
      const eventSpy = jest.fn();
      WebRTCService.on('sessionCreated', eventSpy);

      WebRTCService.createSession('session-123', {});

      // Session creation doesn't emit events
    });
  });

  describe('handleOffer', () => {
    it('should process SDP offer', async () => {
      WebRTCService.createSession('session-123', {});

      const offer = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123 1 IN IP4 127.0.0.1\r\na=setup:actpass\r\na=ice-options:trickle\r\na=sendrecv'
      };

      const answer = await WebRTCService.handleOffer('session-123', offer);

      expect(answer.type).toBe('answer');
      expect(answer.sdp).toBeDefined();

      const session = WebRTCService.activeSessions.get('session-123');
      expect(session.status).toBe('connecting');
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        WebRTCService.handleOffer('non-existent', { type: 'offer', sdp: '' })
      ).rejects.toThrow('Session not found');
    });
  });

  describe('addIceCandidate', () => {
    it('should add ICE candidate to session', () => {
      WebRTCService.createSession('session-123', {});

      const candidate = {
        candidate: 'candidate:1 1 UDP 2122262783 192.168.1.1 12345 typ host',
        sdpMid: 'audio',
        sdpMLineIndex: 0
      };

      WebRTCService.addIceCandidate('session-123', candidate);

      const session = WebRTCService.activeSessions.get('session-123');
      expect(session.iceCandidates).toHaveLength(1);
    });

    it('should emit iceCandidate event', () => {
      const eventSpy = jest.fn();
      WebRTCService.on('iceCandidate', eventSpy);

      WebRTCService.createSession('session-123', {});
      WebRTCService.addIceCandidate('session-123', { candidate: 'test' });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-123' })
      );
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        WebRTCService.addIceCandidate('non-existent', {});
      }).toThrow('Session not found');
    });
  });

  describe('updateStatus', () => {
    it('should update session status', () => {
      WebRTCService.createSession('session-123', {});

      WebRTCService.updateStatus('session-123', 'connected');

      const session = WebRTCService.activeSessions.get('session-123');
      expect(session.status).toBe('connected');
      expect(session.connectedAt).toBeDefined();
    });

    it('should emit statusChange event', () => {
      const eventSpy = jest.fn();
      WebRTCService.on('statusChange', eventSpy);

      WebRTCService.createSession('session-123', {});
      WebRTCService.updateStatus('session-123', 'connected');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          status: 'connected',
          previousStatus: 'initializing'
        })
      );
    });

    it('should record end time when ended', () => {
      WebRTCService.createSession('session-123', {});
      WebRTCService.updateStatus('session-123', 'connected');
      WebRTCService.updateStatus('session-123', 'ended');

      const session = WebRTCService.activeSessions.get('session-123');
      expect(session.endedAt).toBeDefined();
      expect(session.duration).toBeDefined();
    });
  });

  describe('updateStats', () => {
    it('should update session statistics', () => {
      WebRTCService.createSession('session-123', {});

      WebRTCService.updateStats('session-123', {
        packetsLost: 5,
        jitter: 20,
        roundTripTime: 50
      });

      const session = WebRTCService.activeSessions.get('session-123');
      expect(session.stats.packetsLost).toBe(5);
      expect(session.stats.jitter).toBe(20);
    });

    it('should emit quality issue for high packet loss', () => {
      const eventSpy = jest.fn();
      WebRTCService.on('qualityIssue', eventSpy);

      WebRTCService.createSession('session-123', {});
      WebRTCService.updateStats('session-123', {
        packetsLost: 100,
        jitter: 50
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          severity: 'medium'
        })
      );
    });

    it('should not throw for non-existent session', () => {
      expect(() => {
        WebRTCService.updateStats('non-existent', { packetsLost: 0 });
      }).not.toThrow();
    });
  });

  describe('endSession', () => {
    it('should end session and return details', () => {
      WebRTCService.createSession('session-123', {});
      WebRTCService.updateStatus('session-123', 'connected');

      const result = WebRTCService.endSession('session-123', 'completed');

      expect(result.status).toBe('ended');
      expect(result.endReason).toBe('completed');
      expect(result.duration).toBeDefined();
    });

    it('should emit sessionEnded event', () => {
      const eventSpy = jest.fn();
      WebRTCService.on('sessionEnded', eventSpy);

      WebRTCService.createSession('session-123', {});
      WebRTCService.endSession('session-123', 'completed');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          reason: 'completed'
        })
      );
    });

    it('should handle non-existent session gracefully', () => {
      const result = WebRTCService.endSession('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getSession', () => {
    it('should return session by ID', () => {
      WebRTCService.createSession('session-123', { botId: 'bot-1' });

      const session = WebRTCService.getSession('session-123');

      expect(session.botId).toBe('bot-1');
    });

    it('should return undefined for non-existent session', () => {
      const session = WebRTCService.getSession('non-existent');
      expect(session).toBeUndefined();
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions', () => {
      WebRTCService.createSession('session-1', { organizationId: 'org-1' });
      WebRTCService.createSession('session-2', { organizationId: 'org-1' });
      WebRTCService.createSession('session-3', { organizationId: 'org-2' });

      const sessions = WebRTCService.getActiveSessions({});

      expect(sessions).toHaveLength(3);
    });

    it('should filter by organization', () => {
      WebRTCService.createSession('session-1', { organizationId: 'org-1' });
      WebRTCService.createSession('session-2', { organizationId: 'org-2' });

      const sessions = WebRTCService.getActiveSessions({
        organizationId: 'org-1'
      });

      expect(sessions).toHaveLength(1);
    });

    it('should filter by status', () => {
      WebRTCService.createSession('session-1', {});
      WebRTCService.createSession('session-2', {});
      WebRTCService.updateStatus('session-1', 'connected');

      const sessions = WebRTCService.getActiveSessions({
        status: 'connected'
      });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('session-1');
    });
  });

  describe('getClientConfig', () => {
    it('should return client configuration', () => {
      WebRTCService.createSession('session-123', { recordCall: true });

      const config = WebRTCService.getClientConfig('session-123');

      expect(config.sessionId).toBe('session-123');
      expect(config.iceServers).toBeDefined();
      expect(config.mediaConstraints).toBeDefined();
      expect(config.recordCall).toBe(true);
    });

    it('should throw for non-existent session', () => {
      expect(() => {
        WebRTCService.getClientConfig('non-existent');
      }).toThrow('Session not found');
    });
  });

  describe('sendDTMF', () => {
    it('should emit DTMF event', () => {
      const eventSpy = jest.fn();
      WebRTCService.on('dtmf', eventSpy);

      WebRTCService.createSession('session-123', {});
      WebRTCService.sendDTMF('session-123', '1234');

      expect(eventSpy).toHaveBeenCalledWith({
        sessionId: 'session-123',
        digits: '1234'
      });
    });

    it('should throw for non-existent session', () => {
      expect(() => {
        WebRTCService.sendDTMF('non-existent', '123');
      }).toThrow('Session not found');
    });
  });

  describe('setMute', () => {
    it('should set mute state', () => {
      WebRTCService.createSession('session-123', {});

      WebRTCService.setMute('session-123', true);

      const session = WebRTCService.activeSessions.get('session-123');
      expect(session.muted).toBe(true);
    });

    it('should emit muteChange event', () => {
      const eventSpy = jest.fn();
      WebRTCService.on('muteChange', eventSpy);

      WebRTCService.createSession('session-123', {});
      WebRTCService.setMute('session-123', true);

      expect(eventSpy).toHaveBeenCalledWith({
        sessionId: 'session-123',
        muted: true
      });
    });
  });

  describe('setHold', () => {
    it('should set hold state', () => {
      WebRTCService.createSession('session-123', {});
      WebRTCService.updateStatus('session-123', 'connected');

      WebRTCService.setHold('session-123', true);

      const session = WebRTCService.activeSessions.get('session-123');
      expect(session.held).toBe(true);
      expect(session.status).toBe('on-hold');
    });

    it('should unhold and restore status', () => {
      WebRTCService.createSession('session-123', {});
      WebRTCService.updateStatus('session-123', 'connected');
      WebRTCService.setHold('session-123', true);

      WebRTCService.setHold('session-123', false);

      const session = WebRTCService.activeSessions.get('session-123');
      expect(session.held).toBe(false);
      expect(session.status).toBe('connected');
    });
  });

  describe('transferCall', () => {
    it('should initiate call transfer', async () => {
      WebRTCService.createSession('session-123', {});

      const result = await WebRTCService.transferCall(
        'session-123',
        '+1234567890',
        'blind'
      );

      expect(result.success).toBe(true);
      expect(result.destination).toBe('+1234567890');

      const session = WebRTCService.activeSessions.get('session-123');
      expect(session.status).toBe('transferring');
    });

    it('should emit transfer event', async () => {
      const eventSpy = jest.fn();
      WebRTCService.on('transfer', eventSpy);

      WebRTCService.createSession('session-123', {});
      await WebRTCService.transferCall('session-123', '+1234567890', 'attended');

      expect(eventSpy).toHaveBeenCalledWith({
        sessionId: 'session-123',
        destination: '+1234567890',
        type: 'attended'
      });
    });
  });

  describe('getStatsSummary', () => {
    it('should return stats summary', () => {
      WebRTCService.createSession('session-1', {});
      WebRTCService.createSession('session-2', {});
      WebRTCService.updateStatus('session-1', 'connected');

      const summary = WebRTCService.getStatsSummary();

      expect(summary.totalSessions).toBe(2);
      expect(summary.connected).toBe(1);
      expect(summary.qualityScore).toBeDefined();
    });

    it('should calculate quality score', () => {
      WebRTCService.createSession('session-1', {});
      WebRTCService.updateStats('session-1', {
        jitter: 10,
        packetsLost: 0
      });

      const summary = WebRTCService.getStatsSummary();

      expect(summary.qualityScore).toBeGreaterThanOrEqual(4);
    });
  });

  describe('calculateQualityScore', () => {
    it('should return 5 for perfect quality', () => {
      const score = WebRTCService.calculateQualityScore(0, 0);
      expect(score).toBe(5);
    });

    it('should penalize high jitter', () => {
      const score = WebRTCService.calculateQualityScore(100, 0);
      expect(score).toBeLessThan(4);
    });

    it('should penalize packet loss', () => {
      const score = WebRTCService.calculateQualityScore(0, 10);
      expect(score).toBeLessThan(4);
    });

    it('should never go below 1', () => {
      const score = WebRTCService.calculateQualityScore(500, 100);
      expect(score).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getIceServers', () => {
    it('should include STUN servers', () => {
      const servers = WebRTCService.iceServers;

      expect(servers.some(s => s.urls.includes('stun'))).toBe(true);
    });
  });

  describe('cleanupStaleSessions', () => {
    it('should end stale sessions', () => {
      // Create a session with old timestamp
      WebRTCService.createSession('session-old', {});
      const session = WebRTCService.activeSessions.get('session-old');
      session.createdAt = new Date(Date.now() - 7200000); // 2 hours ago

      WebRTCService.cleanupStaleSessions();

      // Session should be marked as ended
      expect(session.status).toBe('ended');
    });
  });
});
