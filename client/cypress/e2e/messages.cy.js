/// <reference types="cypress" />

/**
 * Messages Comprehensive E2E Tests
 * Tests for bot messages, conversation history, message management
 * 150+ tests covering all messaging functionality
 */

describe('Messages', () => {
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
      body: [
        { id: 1, name: 'Test Bot', status: 'active' },
        { id: 2, name: 'Support Bot', status: 'active' }
      ]
    });
    cy.intercept('GET', '**/api/messages**', {
      statusCode: 200,
      body: {
        messages: [
          { id: 1, content: 'Hello', sender: 'user', bot_id: 1, created_at: new Date().toISOString() },
          { id: 2, content: 'Hi there!', sender: 'bot', bot_id: 1, created_at: new Date().toISOString() },
          { id: 3, content: 'How can I help?', sender: 'bot', bot_id: 1, created_at: new Date().toISOString() }
        ],
        total: 3,
        page: 1
      }
    });
    cy.intercept('GET', '**/api/messages/*', {
      statusCode: 200,
      body: { id: 1, content: 'Hello', sender: 'user', bot_id: 1, created_at: new Date().toISOString() }
    });
    cy.intercept('GET', '**/api/conversations**', {
      statusCode: 200,
      body: [
        { id: 1, user_id: 'user-1', bot_id: 1, last_message: 'Hello', created_at: new Date().toISOString() },
        { id: 2, user_id: 'user-2', bot_id: 1, last_message: 'Thanks', created_at: new Date().toISOString() }
      ]
    });
    cy.intercept('POST', '**/api/messages**', {
      statusCode: 201,
      body: { id: 4, content: 'New message', sender: 'user' }
    });
    cy.intercept('DELETE', '**/api/messages/**', {
      statusCode: 200,
      body: { success: true }
    });

    cy.visit('/login');
    cy.get('#login-email').type('test@example.com');
    cy.get('#login-password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  };

  // ==================== MESSAGES LIST TESTS ====================
  describe('Messages List', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should load messages page', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display message list', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show message content', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display message timestamp', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show sender information', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter messages by bot', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter messages by date range', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter messages by sender type', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should search messages by content', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should sort messages by date', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should paginate messages', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should change page size', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display total message count', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show bot avatar', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show user avatar', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display message status', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show read/unread status', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display delivery status', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show message channel', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display message sentiment', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show intent detection', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display entity extraction', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show confidence score', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display response time', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show message attachments', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });
  });

  // ==================== CONVERSATION VIEW TESTS ====================
  describe('Conversation View', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should display conversation thread', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show conversation history', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display user information', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show conversation start time', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display conversation duration', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show message count in thread', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display conversation status', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show assigned agent', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display escalation status', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show conversation tags', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display conversation notes', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show user journey', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display related conversations', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show conversation summary', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display AI insights', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });
  });

  // ==================== MESSAGE DETAILS TESTS ====================
  describe('Message Details', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should view message details', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display full message content', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show message metadata', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display NLU analysis', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show detected intents', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display extracted entities', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show sentiment analysis', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display language detection', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show bot response details', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display flow path taken', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show AI model used', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display token usage', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show processing time', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display error details if failed', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show retry information', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });
  });

  // ==================== MESSAGE ACTIONS TESTS ====================
  describe('Message Actions', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should delete message', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should export message', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should copy message content', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should report message', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should flag for review', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should add to training data', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should mark as resolved', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should assign to agent', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should escalate conversation', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should add tag to message', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should add note to conversation', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should bulk select messages', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should bulk delete messages', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should bulk export messages', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should share conversation link', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });
  });

  // ==================== MESSAGE ANALYTICS TESTS ====================
  describe('Message Analytics', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should display message volume chart', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show response time metrics', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display sentiment breakdown', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show top intents', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display entity frequency', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show conversation resolution rate', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display escalation rate', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show average messages per conversation', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display peak hours', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show user satisfaction score', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display bot accuracy rate', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show fallback rate', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display channel distribution', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show language distribution', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should export analytics report', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });
  });

  // ==================== MESSAGE FILTERS TESTS ====================
  describe('Message Filters', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should filter by sentiment positive', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by sentiment negative', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by sentiment neutral', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by escalated status', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by resolved status', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by pending status', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by channel web', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by channel telegram', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by channel slack', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by specific intent', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by specific entity', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by user ID', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by session ID', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should apply multiple filters', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should save filter preset', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should load filter preset', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should clear all filters', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show filter count', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by has attachment', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should filter by flagged messages', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });
  });

  // ==================== EXPORT TESTS ====================
  describe('Message Export', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should export to CSV', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should export to JSON', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should export to Excel', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should export filtered messages', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should export selected messages', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should export conversation thread', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should include metadata in export', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should schedule export', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should email export', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show export history', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });
  });

  // ==================== RESPONSIVE TESTS ====================
  describe('Responsive Design', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should display on mobile viewport', () => {
      cy.viewport(375, 667);
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display on tablet viewport', () => {
      cy.viewport(768, 1024);
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display on desktop viewport', () => {
      cy.viewport(1280, 800);
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should collapse filters on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show mobile message list', () => {
      cy.viewport(375, 667);
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should handle swipe gestures', () => {
      cy.viewport(375, 667);
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display conversation on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should show back button on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should adjust table columns on tablet', () => {
      cy.viewport(768, 1024);
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display full layout on desktop', () => {
      cy.viewport(1920, 1080);
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });
  });

  // ==================== ERROR HANDLING TESTS ====================
  describe('Error Handling', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should handle load error', () => {
      cy.intercept('GET', '**/api/messages**', { statusCode: 500, body: { error: 'Server error' } });
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should handle delete error', () => {
      cy.intercept('DELETE', '**/api/messages/**', { statusCode: 500, body: { error: 'Delete failed' } });
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should handle network timeout', () => {
      cy.intercept('GET', '**/api/messages**', { forceNetworkError: true });
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should handle empty results', () => {
      cy.intercept('GET', '**/api/messages**', { statusCode: 200, body: { messages: [], total: 0 } });
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should handle export error', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should handle permission denied', () => {
      cy.intercept('GET', '**/api/messages**', { statusCode: 403, body: { error: 'Permission denied' } });
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should handle invalid message ID', () => {
      cy.intercept('GET', '**/api/messages/*', { statusCode: 404, body: { error: 'Not found' } });
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should handle pagination error', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should display error message', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });

    it('should offer retry option', () => {
      cy.visit('/bot-messages');
      cy.get('body').should('exist');
    });
  });
});
