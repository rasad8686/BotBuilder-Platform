/**
 * A/B Test Analytics Dashboard E2E Tests
 */

describe('A/B Test Analytics Dashboard', () => {
  beforeEach(() => {
    cy.login();
  });

  describe('Overview Dashboard', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/ab-tests/analytics/overview*', {
        body: {
          tests: [
            {
              id: 'test-1',
              name: 'Welcome Message Test',
              status: 'running',
              test_type: 'message',
              stats: { impressions: 5000, conversions: 500 }
            },
            {
              id: 'test-2',
              name: 'CTA Button Test',
              status: 'running',
              test_type: 'button',
              stats: { impressions: 3000, conversions: 450 }
            },
            {
              id: 'test-3',
              name: 'Completed Test',
              status: 'completed',
              test_type: 'flow',
              winner_variant: 'B',
              stats: { impressions: 10000, conversions: 1500 }
            }
          ],
          totals: {
            impressions: 18000,
            conversions: 2450,
            activeTests: 2
          }
        }
      }).as('getOverview');

      cy.visit('/ab-tests/overview');
      cy.wait('@getOverview');
    });

    it('should display summary cards', () => {
      cy.get('[data-testid="running-tests-card"]').should('exist');
      cy.get('[data-testid="running-tests-card"]').should('contain', '2');

      cy.get('[data-testid="impressions-card"]').should('exist');
      cy.get('[data-testid="impressions-card"]').should('contain', '18,000');

      cy.get('[data-testid="conversions-card"]').should('exist');
      cy.get('[data-testid="conversions-card"]').should('contain', '2,450');

      cy.get('[data-testid="conversion-rate-card"]').should('exist');
      cy.get('[data-testid="conversion-rate-card"]').should('contain', '13.6%');
    });

    it('should filter by date range', () => {
      cy.intercept('GET', '/api/ab-tests/analytics/overview*', {
        body: {
          tests: [],
          totals: { impressions: 5000, conversions: 600, activeTests: 2 }
        }
      }).as('getFilteredOverview');

      cy.get('[data-testid="date-range-picker"]').click();
      cy.contains('Son 30 gün').click();

      cy.wait('@getFilteredOverview').its('request.url').should('include', 'startDate');
    });

    it('should show top performing tests', () => {
      cy.get('[data-testid="top-tests-table"]').should('exist');
      cy.get('[data-testid="top-tests-table"] tr').should('have.length.greaterThan', 0);
    });

    it('should sort tests by performance', () => {
      cy.get('[data-testid="sort-by-conversions"]').click();
      cy.get('[data-testid="top-tests-table"] tr').first().should('contain', 'Completed Test');
    });

    it('should navigate to test details', () => {
      cy.get('[data-testid="test-row-test-1"]').click();
      cy.url().should('include', '/ab-tests/test-1');
    });
  });

  describe('Test Type Distribution', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/ab-tests/analytics/overview*', {
        body: {
          tests: [
            { id: 'test-1', test_type: 'message', status: 'running' },
            { id: 'test-2', test_type: 'message', status: 'running' },
            { id: 'test-3', test_type: 'flow', status: 'completed' },
            { id: 'test-4', test_type: 'button', status: 'running' }
          ],
          totals: { impressions: 10000, conversions: 1000, activeTests: 3 }
        }
      }).as('getOverview');

      cy.visit('/ab-tests/overview');
      cy.wait('@getOverview');
    });

    it('should display test type distribution chart', () => {
      cy.get('[data-testid="test-type-chart"]').should('be.visible');
    });

    it('should show breakdown by test type', () => {
      cy.get('[data-testid="type-message-count"]').should('contain', '2');
      cy.get('[data-testid="type-flow-count"]').should('contain', '1');
      cy.get('[data-testid="type-button-count"]').should('contain', '1');
    });
  });

  describe('Status Distribution', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/ab-tests/analytics/overview*', {
        body: {
          tests: [
            { id: 'test-1', status: 'draft' },
            { id: 'test-2', status: 'running' },
            { id: 'test-3', status: 'running' },
            { id: 'test-4', status: 'paused' },
            { id: 'test-5', status: 'completed' }
          ],
          totals: { impressions: 10000, conversions: 1000, activeTests: 2 }
        }
      }).as('getOverview');

      cy.visit('/ab-tests/overview');
      cy.wait('@getOverview');
    });

    it('should display status distribution', () => {
      cy.get('[data-testid="status-draft"]').should('contain', '1');
      cy.get('[data-testid="status-running"]').should('contain', '2');
      cy.get('[data-testid="status-paused"]').should('contain', '1');
      cy.get('[data-testid="status-completed"]').should('contain', '1');
    });

    it('should filter by status when clicking status badge', () => {
      cy.get('[data-testid="status-running"]').click();
      cy.url().should('include', 'status=running');
    });
  });

  describe('Trend Charts', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/ab-tests/analytics/overview*', {
        body: {
          tests: [],
          totals: { impressions: 10000, conversions: 1000, activeTests: 2 },
          trends: {
            daily: [
              { date: '2024-01-01', impressions: 1000, conversions: 100 },
              { date: '2024-01-02', impressions: 1200, conversions: 120 },
              { date: '2024-01-03', impressions: 1500, conversions: 150 },
              { date: '2024-01-04', impressions: 1100, conversions: 110 },
              { date: '2024-01-05', impressions: 1300, conversions: 140 }
            ]
          }
        }
      }).as('getOverview');

      cy.visit('/ab-tests/overview');
      cy.wait('@getOverview');
    });

    it('should display impressions trend chart', () => {
      cy.get('[data-testid="impressions-trend-chart"]').should('be.visible');
    });

    it('should display conversions trend chart', () => {
      cy.get('[data-testid="conversions-trend-chart"]').should('be.visible');
    });

    it('should toggle between chart views', () => {
      cy.get('[data-testid="view-impressions"]').click();
      cy.get('[data-testid="impressions-trend-chart"]').should('have.class', 'active');

      cy.get('[data-testid="view-conversions"]').click();
      cy.get('[data-testid="conversions-trend-chart"]').should('have.class', 'active');

      cy.get('[data-testid="view-rate"]').click();
      cy.get('[data-testid="rate-trend-chart"]').should('have.class', 'active');
    });
  });

  describe('Quick Actions', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/ab-tests/analytics/overview*', {
        body: {
          tests: [],
          totals: { impressions: 0, conversions: 0, activeTests: 0 }
        }
      }).as('getOverview');

      cy.visit('/ab-tests/overview');
      cy.wait('@getOverview');
    });

    it('should create new test from overview', () => {
      cy.contains('Yeni Test Yarat').click();
      cy.url().should('include', '/ab-tests/new');
    });

    it('should navigate to all tests', () => {
      cy.contains('Bütün Testlər').click();
      cy.url().should('include', '/ab-tests');
      cy.url().should('not.include', '/overview');
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no tests', () => {
      cy.intercept('GET', '/api/ab-tests/analytics/overview*', {
        body: {
          tests: [],
          totals: { impressions: 0, conversions: 0, activeTests: 0 }
        }
      }).as('getEmptyOverview');

      cy.visit('/ab-tests/overview');
      cy.wait('@getEmptyOverview');

      cy.get('[data-testid="empty-analytics-state"]').should('be.visible');
      cy.contains('Hələ heç bir A/B test yoxdur').should('be.visible');
    });
  });

  describe('Export Analytics', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/ab-tests/analytics/overview*', {
        body: {
          tests: [{ id: 'test-1', name: 'Test 1' }],
          totals: { impressions: 10000, conversions: 1000, activeTests: 1 }
        }
      }).as('getOverview');

      cy.visit('/ab-tests/overview');
      cy.wait('@getOverview');
    });

    it('should export analytics report', () => {
      cy.intercept('GET', '/api/ab-tests/analytics/export*', {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="ab-test-analytics.csv"'
        },
        body: 'test_name,impressions,conversions,conversion_rate\nTest 1,10000,1000,10%'
      }).as('exportReport');

      cy.get('[data-testid="export-analytics"]').click();

      cy.wait('@exportReport');
    });
  });

  describe('Responsive Design', () => {
    it('should display correctly on mobile', () => {
      cy.viewport('iphone-x');

      cy.intercept('GET', '/api/ab-tests/analytics/overview*', {
        body: {
          tests: [],
          totals: { impressions: 10000, conversions: 1000, activeTests: 2 }
        }
      }).as('getOverview');

      cy.visit('/ab-tests/overview');
      cy.wait('@getOverview');

      // Cards should stack vertically
      cy.get('[data-testid="summary-cards"]').should('have.css', 'flex-direction', 'column');

      // Charts should be full width
      cy.get('[data-testid="impressions-trend-chart"]').should('be.visible');
    });

    it('should display correctly on tablet', () => {
      cy.viewport('ipad-2');

      cy.intercept('GET', '/api/ab-tests/analytics/overview*', {
        body: {
          tests: [],
          totals: { impressions: 10000, conversions: 1000, activeTests: 2 }
        }
      }).as('getOverview');

      cy.visit('/ab-tests/overview');
      cy.wait('@getOverview');

      // Cards should be in grid
      cy.get('[data-testid="summary-cards"]').should('be.visible');
    });
  });
});
