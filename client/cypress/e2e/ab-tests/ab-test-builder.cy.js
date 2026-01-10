/**
 * A/B Test Builder E2E Tests
 */

describe('A/B Test Builder', () => {
  beforeEach(() => {
    // Login before each test
    cy.login();
    cy.visit('/ab-tests');
  });

  describe('Test List', () => {
    it('should display A/B tests list page', () => {
      cy.url().should('include', '/ab-tests');
      cy.get('[data-testid="ab-tests-page"]').should('exist');
    });

    it('should show empty state when no tests', () => {
      cy.intercept('GET', '/api/ab-tests*', {
        body: { tests: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
      }).as('getTests');

      cy.wait('@getTests');
      cy.get('[data-testid="empty-state"]').should('exist');
      cy.contains('Yeni Test').should('be.visible');
    });

    it('should display tests when available', () => {
      cy.intercept('GET', '/api/ab-tests*', {
        body: {
          tests: [
            { id: 'test-1', name: 'Test 1', status: 'draft', test_type: 'message' },
            { id: 'test-2', name: 'Test 2', status: 'running', test_type: 'flow' }
          ],
          pagination: { page: 1, limit: 20, total: 2, totalPages: 1 }
        }
      }).as('getTests');

      cy.wait('@getTests');
      cy.get('[data-testid="test-card"]').should('have.length', 2);
    });
  });

  describe('Create Test', () => {
    it('should create new test', () => {
      cy.intercept('POST', '/api/ab-tests', {
        statusCode: 201,
        body: {
          id: 'test-new',
          name: 'Test Campaign',
          status: 'draft',
          test_type: 'message'
        }
      }).as('createTest');

      cy.contains('Yeni Test').click();
      cy.get('input[name="name"]').type('Test Campaign');
      cy.get('[data-testid="test-type-message"]').click();
      cy.get('[data-testid="goal-conversion"]').click();
      cy.contains('Yadda Saxla').click();

      cy.wait('@createTest');
      cy.url().should('include', '/ab-tests/');
    });

    it('should validate required fields', () => {
      cy.contains('Yeni Test').click();
      cy.contains('Yadda Saxla').click();

      cy.get('[data-testid="name-error"]').should('be.visible');
    });

    it('should show test type options', () => {
      cy.contains('Yeni Test').click();

      cy.get('[data-testid="test-type-message"]').should('exist');
      cy.get('[data-testid="test-type-flow"]').should('exist');
      cy.get('[data-testid="test-type-widget"]').should('exist');
      cy.get('[data-testid="test-type-welcome"]').should('exist');
    });
  });

  describe('Test Editor', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/ab-tests/test-123', {
        body: {
          id: 'test-123',
          name: 'Test Campaign',
          status: 'draft',
          test_type: 'message',
          traffic_split: { A: 50, B: 50 },
          variants: [
            { id: 'var-a', name: 'A', is_control: true, content: { message: 'Hello A' } },
            { id: 'var-b', name: 'B', is_control: false, content: { message: 'Hello B' } }
          ]
        }
      }).as('getTest');

      cy.visit('/ab-tests/test-123');
      cy.wait('@getTest');
    });

    it('should display test details', () => {
      cy.get('[data-testid="test-name"]').should('contain', 'Test Campaign');
      cy.get('[data-testid="test-status"]').should('contain', 'draft');
    });

    it('should add variant', () => {
      cy.intercept('POST', '/api/ab-tests/test-123/variants', {
        statusCode: 201,
        body: { id: 'var-c', name: 'C', is_control: false }
      }).as('addVariant');

      cy.contains('Variant Əlavə Et').click();
      cy.get('input[name="variantName"]').type('C');
      cy.get('textarea[name="content"]').type('New variant content');
      cy.contains('Əlavə Et').click();

      cy.wait('@addVariant');
      cy.contains('Variant C').should('exist');
    });

    it('should edit traffic split', () => {
      cy.intercept('PUT', '/api/ab-tests/test-123', {
        body: { id: 'test-123', traffic_split: { A: 70, B: 30 } }
      }).as('updateTest');

      cy.get('[data-testid="traffic-split-slider"]').invoke('val', 70).trigger('change');
      cy.contains('70%').should('exist');
      cy.contains('30%').should('exist');
    });

    it('should edit variant content', () => {
      cy.intercept('PUT', '/api/ab-tests/test-123/variants/var-b', {
        body: { id: 'var-b', content: { message: 'Updated message' } }
      }).as('updateVariant');

      cy.get('[data-testid="variant-b-edit"]').click();
      cy.get('textarea[name="message"]').clear().type('Updated message');
      cy.contains('Yadda Saxla').click();

      cy.wait('@updateVariant');
    });

    it('should delete variant', () => {
      // First add a third variant
      cy.intercept('POST', '/api/ab-tests/test-123/variants', {
        statusCode: 201,
        body: { id: 'var-c', name: 'C', is_control: false }
      }).as('addVariant');

      cy.intercept('DELETE', '/api/ab-tests/test-123/variants/var-c', {
        body: { success: true }
      }).as('deleteVariant');

      cy.contains('Variant Əlavə Et').click();
      cy.get('input[name="variantName"]').type('C');
      cy.contains('Əlavə Et').click();
      cy.wait('@addVariant');

      cy.get('[data-testid="variant-c-delete"]').click();
      cy.get('[data-testid="confirm-delete"]').click();

      cy.wait('@deleteVariant');
      cy.contains('Variant C').should('not.exist');
    });
  });

  describe('Test Status Management', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/ab-tests/test-123', {
        body: {
          id: 'test-123',
          name: 'Test Campaign',
          status: 'draft',
          test_type: 'message',
          variants: [
            { id: 'var-a', name: 'A', is_control: true },
            { id: 'var-b', name: 'B', is_control: false }
          ]
        }
      }).as('getTest');

      cy.visit('/ab-tests/test-123');
      cy.wait('@getTest');
    });

    it('should start test', () => {
      cy.intercept('POST', '/api/ab-tests/test-123/start', {
        body: { id: 'test-123', status: 'running', started_at: new Date().toISOString() }
      }).as('startTest');

      cy.contains('Testi Başlat').click();
      cy.get('[data-testid="confirm-start"]').click();

      cy.wait('@startTest');
      cy.contains('Running').should('exist');
    });

    it('should pause and resume test', () => {
      // First start the test
      cy.intercept('GET', '/api/ab-tests/test-running', {
        body: {
          id: 'test-running',
          name: 'Running Test',
          status: 'running',
          variants: [
            { id: 'var-a', name: 'A', is_control: true },
            { id: 'var-b', name: 'B', is_control: false }
          ]
        }
      }).as('getRunningTest');

      cy.intercept('POST', '/api/ab-tests/test-running/pause', {
        body: { id: 'test-running', status: 'paused' }
      }).as('pauseTest');

      cy.intercept('POST', '/api/ab-tests/test-running/resume', {
        body: { id: 'test-running', status: 'running' }
      }).as('resumeTest');

      cy.visit('/ab-tests/test-running');
      cy.wait('@getRunningTest');

      // Pause
      cy.contains('Dayandır').click();
      cy.wait('@pauseTest');
      cy.contains('Paused').should('exist');

      // Resume
      cy.contains('Davam Et').click();
      cy.wait('@resumeTest');
      cy.contains('Running').should('exist');
    });

    it('should complete test', () => {
      cy.intercept('GET', '/api/ab-tests/test-running', {
        body: {
          id: 'test-running',
          name: 'Running Test',
          status: 'running',
          variants: [
            { id: 'var-a', name: 'A', is_control: true },
            { id: 'var-b', name: 'B', is_control: false }
          ]
        }
      }).as('getRunningTest');

      cy.intercept('POST', '/api/ab-tests/test-running/complete', {
        body: { id: 'test-running', status: 'completed', ended_at: new Date().toISOString() }
      }).as('completeTest');

      cy.visit('/ab-tests/test-running');
      cy.wait('@getRunningTest');

      cy.contains('Testi Bitir').click();
      cy.get('[data-testid="confirm-complete"]').click();

      cy.wait('@completeTest');
      cy.contains('Completed').should('exist');
    });
  });

  describe('Duplicate Test', () => {
    it('should duplicate test', () => {
      cy.intercept('GET', '/api/ab-tests/test-123', {
        body: {
          id: 'test-123',
          name: 'Original Test',
          status: 'completed',
          test_type: 'message'
        }
      }).as('getTest');

      cy.intercept('POST', '/api/ab-tests/test-123/duplicate', {
        statusCode: 201,
        body: {
          id: 'test-456',
          name: 'Original Test (Copy)',
          status: 'draft',
          test_type: 'message'
        }
      }).as('duplicateTest');

      cy.visit('/ab-tests/test-123');
      cy.wait('@getTest');

      cy.get('[data-testid="more-actions"]').click();
      cy.contains('Kopyala').click();

      cy.wait('@duplicateTest');
      cy.url().should('include', '/ab-tests/test-456');
    });
  });

  describe('Delete Test', () => {
    it('should delete test with confirmation', () => {
      cy.intercept('GET', '/api/ab-tests/test-123', {
        body: {
          id: 'test-123',
          name: 'Test to Delete',
          status: 'draft'
        }
      }).as('getTest');

      cy.intercept('DELETE', '/api/ab-tests/test-123', {
        body: { success: true }
      }).as('deleteTest');

      cy.visit('/ab-tests/test-123');
      cy.wait('@getTest');

      cy.get('[data-testid="more-actions"]').click();
      cy.contains('Sil').click();
      cy.get('[data-testid="confirm-delete"]').click();

      cy.wait('@deleteTest');
      cy.url().should('include', '/ab-tests');
      cy.url().should('not.include', 'test-123');
    });

    it('should not allow deleting running test', () => {
      cy.intercept('GET', '/api/ab-tests/test-running', {
        body: {
          id: 'test-running',
          name: 'Running Test',
          status: 'running'
        }
      }).as('getRunningTest');

      cy.visit('/ab-tests/test-running');
      cy.wait('@getRunningTest');

      cy.get('[data-testid="more-actions"]').click();
      cy.get('[data-testid="delete-button"]').should('be.disabled');
    });
  });
});
