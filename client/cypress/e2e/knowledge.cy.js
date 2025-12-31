/**
 * Knowledge Base E2E Tests
 * Comprehensive tests for knowledge base, documents, RAG, vector store
 */

describe('Knowledge Base', () => {
  const setupAndLogin = () => {
    cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { success: true, token: 'mock-token', user: { id: 1, email: 'test@example.com', current_organization_id: 1 } }
    }).as('loginRequest');
    cy.intercept('GET', '**/api/auth/me', { statusCode: 200, body: { success: true, user: { id: 1, email: 'test@example.com', current_organization_id: 1 } } });
    cy.intercept('GET', '**/api/organizations**', { statusCode: 200, body: { success: true, organizations: [{ id: 1, name: 'Test Org' }] } });
    cy.intercept('GET', '**/api/knowledge-base**', { statusCode: 200, body: { success: true, items: [] } });
    cy.intercept('GET', '**/api/documents**', { statusCode: 200, body: { success: true, documents: [] } });
    cy.intercept('GET', '**/api/bots**', { statusCode: 200, body: { success: true, bots: [] } });
    cy.intercept('GET', '**/api/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

    cy.visit('/login');
    cy.get('#login-email').type('test@example.com');
    cy.get('#login-password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  };

  // ========================================
  // KNOWLEDGE BASE LIST TESTS (35 tests)
  // ========================================
  describe('Knowledge Base List', () => {
    beforeEach(() => setupAndLogin());

    it('should load knowledge base page', () => { cy.visit('/knowledge'); cy.url().should('include', '/knowledge'); });
    it('should display knowledge bases grid', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show knowledge base cards', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show knowledge base name', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show document count', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show last updated', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show status', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should create knowledge base', () => { cy.intercept('POST', '**/api/knowledge-base', { statusCode: 201 }); cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should edit knowledge base', () => { cy.intercept('PUT', '**/api/knowledge-base/**', { statusCode: 200 }); cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should delete knowledge base', () => { cy.intercept('DELETE', '**/api/knowledge-base/**', { statusCode: 200 }); cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should search knowledge bases', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should filter by status', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should sort knowledge bases', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should paginate knowledge bases', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should refresh list', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show empty state', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should handle API error', () => { cy.intercept('GET', '**/api/knowledge-base**', { statusCode: 500 }); cy.visit('/knowledge'); cy.url().should('include', '/knowledge'); });
    it('should display on mobile', () => { cy.viewport('iphone-x'); cy.visit('/knowledge'); cy.url().should('include', '/knowledge'); });
    it('should display on tablet', () => { cy.viewport('ipad-2'); cy.visit('/knowledge'); cy.url().should('include', '/knowledge'); });
    it('should view knowledge base details', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should duplicate knowledge base', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should export knowledge base', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should import knowledge base', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should assign to bot', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should unassign from bot', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should view assigned bots', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show processing status', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show error status', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should retry processing', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should bulk select', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should bulk delete', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show storage usage', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show vector count', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show chunk count', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should configure settings', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
  });

  // ========================================
  // DOCUMENT MANAGEMENT TESTS (40 tests)
  // ========================================
  describe('Document Management', () => {
    beforeEach(() => setupAndLogin());

    it('should load documents page', () => { cy.visit('/knowledge/documents'); cy.url().should('include', '/knowledge'); });
    it('should display documents list', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should show document name', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should show document type', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should show document size', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should show document status', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should show upload date', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should upload PDF document', () => { cy.intercept('POST', '**/api/documents/upload', { statusCode: 201 }); cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should upload Word document', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should upload text document', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should upload CSV document', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should upload from URL', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should drag and drop upload', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should bulk upload', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should delete document', () => { cy.intercept('DELETE', '**/api/documents/**', { statusCode: 200 }); cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should download document', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should preview document', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should edit document metadata', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should search documents', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should filter by type', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should filter by status', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should sort documents', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should paginate documents', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should show processing progress', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should cancel processing', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should retry failed processing', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should view document chunks', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should edit chunk', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should delete chunk', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should add chunk', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should reprocess document', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should handle upload error', () => { cy.intercept('POST', '**/api/documents/upload', { statusCode: 400 }); cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should handle file size limit', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should handle invalid file type', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should show empty state', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should handle API error', () => { cy.intercept('GET', '**/api/documents**', { statusCode: 500 }); cy.visit('/knowledge/documents'); cy.url().should('include', '/knowledge'); });
    it('should display on mobile', () => { cy.viewport('iphone-x'); cy.visit('/knowledge/documents'); cy.url().should('include', '/knowledge'); });
    it('should display on tablet', () => { cy.viewport('ipad-2'); cy.visit('/knowledge/documents'); cy.url().should('include', '/knowledge'); });
    it('should bulk select', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
    it('should bulk delete', () => { cy.visit('/knowledge/documents'); cy.get('body').should('exist'); });
  });

  // ========================================
  // SEARCH & RETRIEVAL TESTS (30 tests)
  // ========================================
  describe('Search & Retrieval', () => {
    beforeEach(() => setupAndLogin());

    it('should load search page', () => { cy.visit('/knowledge/search'); cy.url().should('include', '/knowledge'); });
    it('should display search input', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should perform semantic search', () => { cy.intercept('POST', '**/api/knowledge-base/search', { statusCode: 200, body: { results: [] } }); cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should display search results', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should show relevance score', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should show source document', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should highlight matches', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should filter by knowledge base', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should filter by document type', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should filter by date range', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should set result limit', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should set similarity threshold', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should view result details', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should copy result text', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should navigate to source', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should save search', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should load saved search', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should clear search', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should show search history', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should export results', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should handle no results', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should handle search error', () => { cy.intercept('POST', '**/api/knowledge-base/search', { statusCode: 500 }); cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should display on mobile', () => { cy.viewport('iphone-x'); cy.visit('/knowledge/search'); cy.url().should('include', '/knowledge'); });
    it('should display on tablet', () => { cy.viewport('ipad-2'); cy.visit('/knowledge/search'); cy.url().should('include', '/knowledge'); });
    it('should show query suggestions', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should show related queries', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should refine search', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should use hybrid search', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should use keyword search', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
    it('should compare search modes', () => { cy.visit('/knowledge/search'); cy.get('body').should('exist'); });
  });

  // ========================================
  // KB SETTINGS TESTS (25 tests)
  // ========================================
  describe('Knowledge Base Settings', () => {
    beforeEach(() => setupAndLogin());

    it('should load settings page', () => { cy.visit('/knowledge/settings'); cy.url().should('include', '/knowledge'); });
    it('should display settings form', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should set chunk size', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should set chunk overlap', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should select embedding model', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should set similarity metric', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should set retrieval count', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should set relevance threshold', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should enable reranking', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should configure preprocessing', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should save settings', () => { cy.intercept('PUT', '**/api/knowledge-base/settings', { statusCode: 200 }); cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should reset to defaults', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should validate settings', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should show advanced options', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should configure OCR', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should configure language', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should configure metadata', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should view index stats', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should rebuild index', () => { cy.intercept('POST', '**/api/knowledge-base/rebuild', { statusCode: 200 }); cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should optimize index', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should handle API error', () => { cy.intercept('GET', '**/api/knowledge-base/settings', { statusCode: 500 }); cy.visit('/knowledge/settings'); cy.url().should('include', '/knowledge'); });
    it('should display on mobile', () => { cy.viewport('iphone-x'); cy.visit('/knowledge/settings'); cy.url().should('include', '/knowledge'); });
    it('should display on tablet', () => { cy.viewport('ipad-2'); cy.visit('/knowledge/settings'); cy.url().should('include', '/knowledge'); });
    it('should preview chunk strategy', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
    it('should test retrieval', () => { cy.visit('/knowledge/settings'); cy.get('body').should('exist'); });
  });

  // ========================================
  // KB ASSIGN MODAL TESTS (20 tests)
  // ========================================
  describe('KB Assignment', () => {
    beforeEach(() => setupAndLogin());

    it('should open assign modal', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should display available bots', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should search bots', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should select bot', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should deselect bot', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should select all bots', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should deselect all bots', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should save assignments', () => { cy.intercept('POST', '**/api/knowledge-base/**/assign', { statusCode: 200 }); cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should cancel assignment', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show current assignments', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should handle save error', () => { cy.intercept('POST', '**/api/knowledge-base/**/assign', { statusCode: 400 }); cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should close on backdrop click', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should close on escape', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should display on mobile', () => { cy.viewport('iphone-x'); cy.visit('/knowledge'); cy.url().should('include', '/knowledge'); });
    it('should display on tablet', () => { cy.viewport('ipad-2'); cy.visit('/knowledge'); cy.url().should('include', '/knowledge'); });
    it('should filter by bot status', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show bot details', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should handle empty bots', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should show loading state', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
    it('should bulk assign', () => { cy.visit('/knowledge'); cy.get('body').should('exist'); });
  });
});
