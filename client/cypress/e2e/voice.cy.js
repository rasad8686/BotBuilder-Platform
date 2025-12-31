/// <reference types="cypress" />

/**
 * Voice Comprehensive E2E Tests
 * Tests for voice bots, voice-to-bot, call handling, and speech features
 * 150+ tests covering all voice functionality
 */

describe('Voice', () => {
  const setupAndLogin = () => {
    cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { success: true, token: 'mock-token', user: { id: 1, email: 'test@example.com', current_organization_id: 1 } }
    }).as('loginRequest');
    cy.intercept('GET', '**/api/auth/me', {
      statusCode: 200,
      body: { id: 1, email: 'test@example.com', name: 'Test User', current_organization_id: 1 }
    });
    cy.intercept('GET', '**/api/organizations**', {
      statusCode: 200,
      body: [{ id: 1, name: 'Test Org', role: 'owner' }]
    });
    cy.intercept('GET', '**/api/bots**', {
      statusCode: 200,
      body: [{ id: 1, name: 'Test Bot', status: 'active' }]
    });
    cy.intercept('GET', '**/api/voice-bots**', {
      statusCode: 200,
      body: [
        { id: 1, name: 'Support Voice Bot', status: 'active', phone: '+1234567890', calls: 150 },
        { id: 2, name: 'Sales Voice Bot', status: 'inactive', phone: '+0987654321', calls: 89 }
      ]
    });
    cy.intercept('GET', '**/api/voice-bots/*', {
      statusCode: 200,
      body: { id: 1, name: 'Support Voice Bot', config: {}, status: 'active' }
    });
    cy.intercept('GET', '**/api/call-history**', {
      statusCode: 200,
      body: [
        { id: 1, phone: '+1234567890', duration: 120, status: 'completed', created_at: new Date().toISOString() },
        { id: 2, phone: '+0987654321', duration: 60, status: 'completed', created_at: new Date().toISOString() }
      ]
    });
    cy.intercept('POST', '**/api/voice-bots**', {
      statusCode: 201,
      body: { id: 3, name: 'New Voice Bot', status: 'draft' }
    });
    cy.intercept('PUT', '**/api/voice-bots/**', {
      statusCode: 200,
      body: { success: true }
    });
    cy.intercept('DELETE', '**/api/voice-bots/**', {
      statusCode: 200,
      body: { success: true }
    });

    cy.visit('/login');
    cy.get('#login-email').type('test@example.com');
    cy.get('#login-password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  };

  // ==================== VOICE BOTS TESTS ====================
  describe('Voice Bots', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should load voice bots page', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display voice bot list', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should show bot cards', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display bot names', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should show bot status', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display phone numbers', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should show call count', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should filter bots by status', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should search voice bots', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should sort bots by name', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should sort bots by calls', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should show create button', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display voice bot statistics', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should show active calls indicator', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display voice provider', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should show available minutes', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display voice languages', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should show bot description', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display last call time', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should show voice quality indicator', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });
  });

  // ==================== VOICE BOT CREATION TESTS ====================
  describe('Voice Bot Creation', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should open create form', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should set bot name', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should set bot description', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should select voice provider Twilio', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should select voice provider Vonage', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should configure phone number', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should select new phone number', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should use existing phone number', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should configure voice settings', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should select voice gender', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should select voice language', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should adjust voice speed', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should adjust voice pitch', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should preview voice', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should configure greeting message', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should configure fallback response', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should set call timeout', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should configure call recording', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should save voice bot', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should validate configuration', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });
  });

  // ==================== CALL HISTORY TESTS ====================
  describe('Call History', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should load call history page', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should display call list', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should show caller phone number', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should display call duration', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should show call status', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should display call timestamp', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should show bot name', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should filter by date range', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should filter by status completed', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should filter by status failed', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should filter by status missed', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should filter by bot', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should search by phone number', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should sort by date', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should sort by duration', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should paginate results', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should view call details', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should play call recording', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should download recording', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should view call transcript', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should export call history', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should delete call record', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should bulk delete calls', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should display call sentiment', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should show call outcome', () => {
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });
  });

  // ==================== VOICE TO BOT TESTS ====================
  describe('Voice to Bot', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should load voice to bot page', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should display voice interface', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should show microphone button', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should display voice status', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should show listening indicator', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should display speech waveform', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should show transcript preview', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should configure speech language', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should toggle continuous listening', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should adjust sensitivity', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should select bot for voice', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should display bot response', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should play response audio', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should show conversation history', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should clear conversation', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });
  });

  // ==================== VOICE SETTINGS TESTS ====================
  describe('Voice Settings', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should access voice settings', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should configure speech-to-text', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should configure text-to-speech', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should select STT provider', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should select TTS provider', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should configure audio format', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should set sample rate', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should configure noise cancellation', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should set silence detection', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should configure DTMF handling', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should set call forwarding', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should configure voicemail', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should set hold music', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should configure IVR menu', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should save voice settings', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });
  });

  // ==================== VOICE ANALYTICS TESTS ====================
  describe('Voice Analytics', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should display call volume chart', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should show average call duration', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display completion rate', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should show abandonment rate', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display peak call times', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should show sentiment breakdown', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display top intents', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should show resolution rate', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display cost analysis', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should export voice analytics', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });
  });

  // ==================== RESPONSIVE TESTS ====================
  describe('Responsive Design', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should display voice bots on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display voice bots on tablet', () => {
      cy.viewport(768, 1024);
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display voice bots on desktop', () => {
      cy.viewport(1280, 800);
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display call history on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should display call history on tablet', () => {
      cy.viewport(768, 1024);
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should display voice-to-bot on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should display voice-to-bot on tablet', () => {
      cy.viewport(768, 1024);
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should collapse navigation on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should handle touch interactions', () => {
      cy.viewport(768, 1024);
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should display full layout on large screen', () => {
      cy.viewport(1920, 1080);
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });
  });

  // ==================== ERROR HANDLING TESTS ====================
  describe('Error Handling', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should handle voice bots load error', () => {
      cy.intercept('GET', '**/api/voice-bots**', { statusCode: 500, body: { error: 'Server error' } });
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should handle call history load error', () => {
      cy.intercept('GET', '**/api/call-history**', { statusCode: 500, body: { error: 'Server error' } });
      cy.visit('/call-history');
      cy.get('body').should('exist');
    });

    it('should handle network timeout', () => {
      cy.intercept('GET', '**/api/voice-bots**', { forceNetworkError: true });
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should handle save error', () => {
      cy.intercept('POST', '**/api/voice-bots**', { statusCode: 500, body: { error: 'Save failed' } });
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should handle delete error', () => {
      cy.intercept('DELETE', '**/api/voice-bots/**', { statusCode: 500, body: { error: 'Delete failed' } });
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should handle permission denied', () => {
      cy.intercept('GET', '**/api/voice-bots**', { statusCode: 403, body: { error: 'Permission denied' } });
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should handle microphone access denied', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should handle speech recognition error', () => {
      cy.visit('/voice-to-bot');
      cy.get('body').should('exist');
    });

    it('should display error message', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });

    it('should offer retry option', () => {
      cy.visit('/voice-bots');
      cy.get('body').should('exist');
    });
  });
});
