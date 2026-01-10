/**
 * A/B Test Results E2E Tests
 */

describe('A/B Test Results', () => {
  beforeEach(() => {
    cy.login();
  });

  describe('Results Dashboard', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/ab-tests/test-123', {
        body: {
          id: 'test-123',
          name: 'Test Campaign',
          status: 'running',
          test_type: 'message',
          started_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          variants: [
            {
              id: 'var-a',
              name: 'A',
              is_control: true,
              stats: { impressions: 1000, conversions: 100, totalValue: 500 }
            },
            {
              id: 'var-b',
              name: 'B',
              is_control: false,
              stats: { impressions: 1000, conversions: 150, totalValue: 750 }
            }
          ]
        }
      }).as('getTest');

      cy.intercept('GET', '/api/ab-tests/test-123/analytics', {
        body: [
          {
            variantId: 'var-a',
            variantName: 'A',
            isControl: true,
            impressions: 1000,
            conversions: 100,
            conversionRate: 10,
            totalValue: 500,
            significance: null
          },
          {
            variantId: 'var-b',
            variantName: 'B',
            isControl: false,
            impressions: 1000,
            conversions: 150,
            conversionRate: 15,
            totalValue: 750,
            significance: {
              significant: true,
              confidence: 98.5,
              lift: 50,
              zScore: 3.2
            }
          }
        ]
      }).as('getAnalytics');

      cy.visit('/ab-tests/test-123/results');
      cy.wait('@getTest');
      cy.wait('@getAnalytics');
    });

    it('should display variant comparison', () => {
      cy.get('[data-testid="variant-a-stats"]').should('exist');
      cy.get('[data-testid="variant-b-stats"]').should('exist');
      cy.get('[data-testid="confidence-indicator"]').should('exist');
    });

    it('should show conversion rates', () => {
      cy.get('[data-testid="variant-a-stats"]').should('contain', '10%');
      cy.get('[data-testid="variant-b-stats"]').should('contain', '15%');
    });

    it('should display lift percentage', () => {
      cy.get('[data-testid="lift-indicator"]').should('contain', '+50%');
    });

    it('should show significance badge', () => {
      cy.get('[data-testid="significance-badge"]').should('contain', '98.5%');
      cy.get('[data-testid="significance-badge"]').should('have.class', 'significant');
    });

    it('should show charts', () => {
      cy.get('[data-testid="comparison-chart"]').should('be.visible');
      cy.get('[data-testid="timeline-chart"]').should('be.visible');
    });

    it('should toggle between chart types', () => {
      cy.get('[data-testid="chart-type-bar"]').click();
      cy.get('[data-testid="bar-chart"]').should('be.visible');

      cy.get('[data-testid="chart-type-line"]').click();
      cy.get('[data-testid="line-chart"]').should('be.visible');
    });
  });

  describe('Declare Winner', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/ab-tests/test-123', {
        body: {
          id: 'test-123',
          name: 'Test Campaign',
          status: 'running',
          variants: [
            { id: 'var-a', name: 'A', is_control: true, stats: { impressions: 1000, conversions: 100 } },
            { id: 'var-b', name: 'B', is_control: false, stats: { impressions: 1000, conversions: 150 } }
          ]
        }
      }).as('getTest');

      cy.visit('/ab-tests/test-123/results');
      cy.wait('@getTest');
    });

    it('should declare winner', () => {
      cy.intercept('POST', '/api/ab-tests/test-123/declare-winner', {
        body: {
          id: 'test-123',
          status: 'completed',
          winner_variant: 'B',
          winner_confidence: 98.5
        }
      }).as('declareWinner');

      cy.contains('Qalib Elan Et').click();
      cy.get('[data-testid="select-winner-b"]').click();
      cy.get('[data-testid="confirm-winner"]').click();

      cy.wait('@declareWinner');
      cy.contains('Winner: Variant B').should('exist');
    });

    it('should show winner celebration', () => {
      cy.intercept('POST', '/api/ab-tests/test-123/declare-winner', {
        body: {
          id: 'test-123',
          status: 'completed',
          winner_variant: 'B',
          winner_confidence: 98.5
        }
      }).as('declareWinner');

      cy.contains('Qalib Elan Et').click();
      cy.get('[data-testid="select-winner-b"]').click();
      cy.get('[data-testid="confirm-winner"]').click();

      cy.wait('@declareWinner');
      cy.get('[data-testid="winner-celebration"]').should('be.visible');
    });

    it('should show winner badge on variant card', () => {
      cy.intercept('GET', '/api/ab-tests/test-completed', {
        body: {
          id: 'test-completed',
          name: 'Completed Test',
          status: 'completed',
          winner_variant: 'B',
          winner_confidence: 98.5,
          variants: [
            { id: 'var-a', name: 'A', is_control: true },
            { id: 'var-b', name: 'B', is_control: false }
          ]
        }
      }).as('getCompletedTest');

      cy.visit('/ab-tests/test-completed/results');
      cy.wait('@getCompletedTest');

      cy.get('[data-testid="variant-b-card"]').should('have.class', 'winner');
      cy.get('[data-testid="winner-badge"]').should('be.visible');
    });
  });

  describe('Export Data', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/ab-tests/test-123', {
        body: {
          id: 'test-123',
          name: 'Test Campaign',
          status: 'completed',
          variants: []
        }
      }).as('getTest');

      cy.visit('/ab-tests/test-123/results');
      cy.wait('@getTest');
    });

    it('should export as CSV', () => {
      cy.intercept('GET', '/api/ab-tests/test-123/export?format=csv', {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="ab-test-results.csv"'
        },
        body: 'variant,impressions,conversions,conversion_rate\nA,1000,100,10%\nB,1000,150,15%'
      }).as('exportCSV');

      cy.contains('Export').click();
      cy.contains('CSV').click();

      cy.wait('@exportCSV');
      // Verify download triggered
    });

    it('should export as JSON', () => {
      cy.intercept('GET', '/api/ab-tests/test-123/export?format=json', {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="ab-test-results.json"'
        },
        body: {
          test: { id: 'test-123', name: 'Test Campaign' },
          results: []
        }
      }).as('exportJSON');

      cy.contains('Export').click();
      cy.contains('JSON').click();

      cy.wait('@exportJSON');
    });
  });

  describe('Date Range Filter', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/ab-tests/test-123', {
        body: {
          id: 'test-123',
          name: 'Test Campaign',
          status: 'running',
          variants: []
        }
      }).as('getTest');

      cy.visit('/ab-tests/test-123/results');
      cy.wait('@getTest');
    });

    it('should filter by date range', () => {
      cy.intercept('GET', '/api/ab-tests/test-123/analytics*', {
        body: []
      }).as('getFilteredAnalytics');

      cy.get('[data-testid="date-range-picker"]').click();
      cy.contains('Son 7 gün').click();

      cy.wait('@getFilteredAnalytics').its('request.url').should('include', 'startDate');
    });

    it('should show custom date range picker', () => {
      cy.get('[data-testid="date-range-picker"]').click();
      cy.contains('Xüsusi tarix').click();

      cy.get('[data-testid="start-date-input"]').should('be.visible');
      cy.get('[data-testid="end-date-input"]').should('be.visible');
    });
  });

  describe('Real-time Updates', () => {
    it('should update stats in real-time for running test', () => {
      cy.intercept('GET', '/api/ab-tests/test-123', {
        body: {
          id: 'test-123',
          name: 'Running Test',
          status: 'running',
          variants: [
            { id: 'var-a', name: 'A', stats: { impressions: 100, conversions: 10 } },
            { id: 'var-b', name: 'B', stats: { impressions: 100, conversions: 15 } }
          ]
        }
      }).as('getTest');

      cy.visit('/ab-tests/test-123/results');
      cy.wait('@getTest');

      // Check for live indicator
      cy.get('[data-testid="live-indicator"]').should('be.visible');

      // Simulate WebSocket update
      cy.window().then((win) => {
        win.dispatchEvent(new CustomEvent('ab-test-update', {
          detail: {
            testId: 'test-123',
            variants: [
              { id: 'var-a', stats: { impressions: 110, conversions: 11 } },
              { id: 'var-b', stats: { impressions: 110, conversions: 17 } }
            ]
          }
        }));
      });

      // Stats should update
      cy.get('[data-testid="variant-a-impressions"]').should('contain', '110');
    });
  });
});
