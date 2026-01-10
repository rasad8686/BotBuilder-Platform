/**
 * Tour Analytics E2E Tests
 * Tests for analytics dashboard and data visualization
 */

describe('Tour Analytics', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password123');
    cy.visit('/tours');
    cy.intercept('GET', '/api/tours*').as('getTours');
    cy.wait('@getTours');
  });

  // ==================== ANALYTICS PAGE LOADING ====================
  describe('Analytics Page Loading', () => {
    it('should load analytics page', () => {
      cy.intercept('GET', '/api/tours/*/analytics*').as('getAnalytics');

      cy.get('[data-testid="tour-card"]').first().click();
      cy.get('[data-testid="analytics-tab"]').click();

      cy.wait('@getAnalytics');

      cy.get('[data-testid="analytics-dashboard"]').should('be.visible');
    });

    it('should show loading state while fetching data', () => {
      cy.intercept('GET', '/api/tours/*/analytics*', {
        delay: 1000,
        fixture: 'analytics-data.json'
      }).as('getAnalytics');

      cy.get('[data-testid="tour-card"]').first().click();
      cy.get('[data-testid="analytics-tab"]').click();

      cy.get('[data-testid="analytics-loading"]').should('be.visible');
      cy.wait('@getAnalytics');
      cy.get('[data-testid="analytics-loading"]').should('not.exist');
    });

    it('should show error state on failed fetch', () => {
      cy.intercept('GET', '/api/tours/*/analytics*', {
        statusCode: 500,
        body: { success: false, message: 'Server error' }
      }).as('getAnalytics');

      cy.get('[data-testid="tour-card"]').first().click();
      cy.get('[data-testid="analytics-tab"]').click();

      cy.wait('@getAnalytics');

      cy.get('[data-testid="analytics-error"]').should('be.visible');
      cy.get('[data-testid="retry-btn"]').should('be.visible');
    });

    it('should retry on error', () => {
      let attempts = 0;
      cy.intercept('GET', '/api/tours/*/analytics*', (req) => {
        attempts++;
        if (attempts === 1) {
          req.reply({ statusCode: 500 });
        } else {
          req.reply({ fixture: 'analytics-data.json' });
        }
      }).as('getAnalytics');

      cy.get('[data-testid="tour-card"]').first().click();
      cy.get('[data-testid="analytics-tab"]').click();

      cy.wait('@getAnalytics');
      cy.get('[data-testid="retry-btn"]').click();
      cy.wait('@getAnalytics');

      cy.get('[data-testid="analytics-dashboard"]').should('be.visible');
    });
  });

  // ==================== METRICS DISPLAY ====================
  describe('Metrics Display', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/tours/*/analytics*', {
        body: {
          success: true,
          analytics: {
            daily: [
              { date: '2024-01-15', impressions: 150, starts: 120, completions: 80, dismissals: 20 },
              { date: '2024-01-14', impressions: 100, starts: 90, completions: 60, dismissals: 15 }
            ],
            totals: {
              impressions: 250,
              starts: 210,
              completions: 140,
              dismissals: 35,
              completionRate: 66.67,
              avgTimeSeconds: 45
            }
          }
        }
      }).as('getAnalytics');

      cy.get('[data-testid="tour-card"]').first().click();
      cy.get('[data-testid="analytics-tab"]').click();
      cy.wait('@getAnalytics');
    });

    it('should display total impressions', () => {
      cy.get('[data-testid="metric-impressions"]').should('contain', '250');
    });

    it('should display total starts', () => {
      cy.get('[data-testid="metric-starts"]').should('contain', '210');
    });

    it('should display total completions', () => {
      cy.get('[data-testid="metric-completions"]').should('contain', '140');
    });

    it('should display dismissals', () => {
      cy.get('[data-testid="metric-dismissals"]').should('contain', '35');
    });

    it('should display completion rate', () => {
      cy.get('[data-testid="metric-completion-rate"]').should('contain', '66.67%');
    });

    it('should display average time', () => {
      cy.get('[data-testid="metric-avg-time"]').should('contain', '45');
    });
  });

  // ==================== CHARTS RENDERING ====================
  describe('Charts Rendering', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/tours/*/analytics*', {
        fixture: 'analytics-data.json'
      }).as('getAnalytics');

      cy.get('[data-testid="tour-card"]').first().click();
      cy.get('[data-testid="analytics-tab"]').click();
      cy.wait('@getAnalytics');
    });

    it('should render impressions chart', () => {
      cy.get('[data-testid="impressions-chart"]').should('be.visible');
      cy.get('[data-testid="impressions-chart"] canvas').should('exist');
    });

    it('should render completion funnel chart', () => {
      cy.get('[data-testid="funnel-chart"]').should('be.visible');
    });

    it('should render step breakdown chart', () => {
      cy.get('[data-testid="step-breakdown-chart"]').should('be.visible');
    });

    it('should update chart on hover', () => {
      cy.get('[data-testid="impressions-chart"] canvas').trigger('mousemove', 100, 100);
      cy.get('.chart-tooltip').should('be.visible');
    });

    it('should toggle chart type', () => {
      cy.get('[data-testid="chart-type-toggle"]').click();
      cy.get('[data-testid="chart-type-bar"]').click();

      cy.get('[data-testid="impressions-chart"]')
        .should('have.attr', 'data-chart-type', 'bar');
    });
  });

  // ==================== DATE FILTER ====================
  describe('Date Filter', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/tours/*/analytics*').as('getAnalytics');
      cy.get('[data-testid="tour-card"]').first().click();
      cy.get('[data-testid="analytics-tab"]').click();
      cy.wait('@getAnalytics');
    });

    it('should filter by last 7 days', () => {
      cy.get('[data-testid="date-filter"]').click();
      cy.get('[data-testid="filter-7-days"]').click();

      cy.wait('@getAnalytics').its('request.url').should('include', 'startDate');
    });

    it('should filter by last 30 days', () => {
      cy.get('[data-testid="date-filter"]').click();
      cy.get('[data-testid="filter-30-days"]').click();

      cy.wait('@getAnalytics');
    });

    it('should filter by custom date range', () => {
      cy.get('[data-testid="date-filter"]').click();
      cy.get('[data-testid="filter-custom"]').click();

      cy.get('[data-testid="start-date-picker"]').type('2024-01-01');
      cy.get('[data-testid="end-date-picker"]').type('2024-01-31');
      cy.get('[data-testid="apply-date-filter"]').click();

      cy.wait('@getAnalytics').its('request.url')
        .should('include', 'startDate=2024-01-01')
        .and('include', 'endDate=2024-01-31');
    });

    it('should show date range in header', () => {
      cy.get('[data-testid="date-filter"]').click();
      cy.get('[data-testid="filter-7-days"]').click();

      cy.get('[data-testid="date-range-display"]').should('contain', 'Last 7 days');
    });
  });

  // ==================== EXPORT FUNCTIONALITY ====================
  describe('Export Functionality', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/tours/*/analytics*', {
        fixture: 'analytics-data.json'
      }).as('getAnalytics');

      cy.get('[data-testid="tour-card"]').first().click();
      cy.get('[data-testid="analytics-tab"]').click();
      cy.wait('@getAnalytics');
    });

    it('should show export button', () => {
      cy.get('[data-testid="export-btn"]').should('be.visible');
    });

    it('should show export options on click', () => {
      cy.get('[data-testid="export-btn"]').click();

      cy.get('[data-testid="export-menu"]').should('be.visible');
      cy.get('[data-testid="export-csv"]').should('be.visible');
      cy.get('[data-testid="export-pdf"]').should('be.visible');
    });

    it('should download CSV file', () => {
      cy.get('[data-testid="export-btn"]').click();
      cy.get('[data-testid="export-csv"]').click();

      // Verify download initiated (this depends on your implementation)
      cy.get('[data-testid="toast-success"]').should('contain', 'Export started');
    });

    it('should download PDF report', () => {
      cy.get('[data-testid="export-btn"]').click();
      cy.get('[data-testid="export-pdf"]').click();

      cy.get('[data-testid="toast-success"]').should('contain', 'Export started');
    });
  });

  // ==================== ANALYTICS OVERVIEW ====================
  describe('Analytics Overview', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/tours/analytics/overview*', {
        body: {
          success: true,
          overview: {
            tours: [
              { id: 'tour-1', name: 'Onboarding', impressions: 500, completions: 300, completion_rate: 60 },
              { id: 'tour-2', name: 'Feature Tour', impressions: 200, completions: 150, completion_rate: 75 }
            ],
            totals: {
              impressions: 700,
              starts: 600,
              completions: 450,
              dismissals: 100
            }
          }
        }
      }).as('getOverview');
    });

    it('should display overview page', () => {
      cy.get('[data-testid="analytics-overview-link"]').click();
      cy.wait('@getOverview');

      cy.get('[data-testid="analytics-overview"]').should('be.visible');
    });

    it('should show all tours in overview', () => {
      cy.get('[data-testid="analytics-overview-link"]').click();
      cy.wait('@getOverview');

      cy.get('[data-testid="tour-analytics-row"]').should('have.length', 2);
    });

    it('should show total metrics across all tours', () => {
      cy.get('[data-testid="analytics-overview-link"]').click();
      cy.wait('@getOverview');

      cy.get('[data-testid="total-impressions"]').should('contain', '700');
      cy.get('[data-testid="total-completions"]').should('contain', '450');
    });

    it('should sort tours by impressions', () => {
      cy.get('[data-testid="analytics-overview-link"]').click();
      cy.wait('@getOverview');

      cy.get('[data-testid="sort-by-impressions"]').click();

      cy.get('[data-testid="tour-analytics-row"]').first()
        .should('contain', 'Onboarding');
    });

    it('should sort tours by completion rate', () => {
      cy.get('[data-testid="analytics-overview-link"]').click();
      cy.wait('@getOverview');

      cy.get('[data-testid="sort-by-completion-rate"]').click();

      cy.get('[data-testid="tour-analytics-row"]').first()
        .should('contain', 'Feature Tour');
    });
  });

  // ==================== STEP ANALYTICS ====================
  describe('Step Analytics', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/tours/*/analytics*', {
        body: {
          success: true,
          analytics: {
            daily: [],
            totals: { impressions: 100, completions: 50 },
            stepMetrics: [
              { stepId: 'step-1', title: 'Welcome', views: 100, completions: 90, dropoff: 10 },
              { stepId: 'step-2', title: 'Features', views: 90, completions: 70, dropoff: 22 },
              { stepId: 'step-3', title: 'Get Started', views: 70, completions: 50, dropoff: 29 }
            ]
          }
        }
      }).as('getAnalytics');

      cy.get('[data-testid="tour-card"]').first().click();
      cy.get('[data-testid="analytics-tab"]').click();
      cy.wait('@getAnalytics');
    });

    it('should display step-by-step metrics', () => {
      cy.get('[data-testid="step-metrics-section"]').should('be.visible');
      cy.get('[data-testid="step-metric-row"]').should('have.length', 3);
    });

    it('should show drop-off rate per step', () => {
      cy.get('[data-testid="step-metric-row"]').first()
        .should('contain', '10%');
    });

    it('should highlight highest drop-off step', () => {
      cy.get('[data-testid="step-metric-row"]').eq(2)
        .should('have.class', 'high-dropoff');
    });
  });

  // ==================== REAL-TIME UPDATES ====================
  describe('Real-time Updates', () => {
    it('should show live indicator when enabled', () => {
      cy.intercept('GET', '/api/tours/*/analytics*', {
        fixture: 'analytics-data.json'
      }).as('getAnalytics');

      cy.get('[data-testid="tour-card"]').first().click();
      cy.get('[data-testid="analytics-tab"]').click();
      cy.wait('@getAnalytics');

      cy.get('[data-testid="live-toggle"]').click();

      cy.get('[data-testid="live-indicator"]').should('be.visible');
      cy.get('[data-testid="live-indicator"]').should('have.class', 'pulsing');
    });

    it('should auto-refresh data when live mode enabled', () => {
      cy.intercept('GET', '/api/tours/*/analytics*', {
        fixture: 'analytics-data.json'
      }).as('getAnalytics');

      cy.get('[data-testid="tour-card"]').first().click();
      cy.get('[data-testid="analytics-tab"]').click();
      cy.wait('@getAnalytics');

      cy.get('[data-testid="live-toggle"]').click();

      // Wait for auto-refresh (assuming 30 second interval)
      cy.wait('@getAnalytics', { timeout: 35000 });
    });
  });

  // ==================== COMPARISON MODE ====================
  describe('Comparison Mode', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/tours/*/analytics*', {
        fixture: 'analytics-data.json'
      }).as('getAnalytics');

      cy.get('[data-testid="tour-card"]').first().click();
      cy.get('[data-testid="analytics-tab"]').click();
      cy.wait('@getAnalytics');
    });

    it('should enable comparison mode', () => {
      cy.get('[data-testid="compare-toggle"]').click();

      cy.get('[data-testid="comparison-section"]').should('be.visible');
    });

    it('should compare with previous period', () => {
      cy.get('[data-testid="compare-toggle"]').click();
      cy.get('[data-testid="compare-previous-period"]').click();

      cy.get('[data-testid="comparison-metrics"]').should('be.visible');
      cy.get('[data-testid="metric-change"]').should('be.visible');
    });

    it('should show percentage change', () => {
      cy.get('[data-testid="compare-toggle"]').click();
      cy.get('[data-testid="compare-previous-period"]').click();

      cy.get('[data-testid="metric-change"]').first()
        .should('match', /[+-]\d+(\.\d+)?%/);
    });
  });
});

// Fixtures
Cypress.Commands.add('loadAnalyticsFixture', () => {
  cy.fixture('analytics-data.json').as('analyticsData');
});
