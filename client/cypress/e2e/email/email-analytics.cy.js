describe('Email Analytics Dashboard', () => {
  beforeEach(() => {
    cy.login();
    cy.intercept('GET', '/api/email/analytics/overview*', { fixture: 'email/analytics-overview.json' }).as('getOverview');
    cy.intercept('GET', '/api/email/analytics/volume*', { fixture: 'email/analytics-volume.json' }).as('getVolume');
    cy.intercept('GET', '/api/email/analytics/top-campaigns*', { fixture: 'email/analytics-top-campaigns.json' }).as('getTopCampaigns');
    cy.intercept('GET', '/api/email/analytics/engagement-by-hour*', { fixture: 'email/analytics-engagement-hour.json' }).as('getEngagementByHour');
    cy.intercept('GET', '/api/email/analytics/contact-growth*', { fixture: 'email/analytics-contact-growth.json' }).as('getContactGrowth');
    cy.intercept('GET', '/api/email/analytics/engagement-segments*', { fixture: 'email/analytics-segments.json' }).as('getSegments');
  });

  describe('Dashboard Overview', () => {
    beforeEach(() => {
      cy.visit('/email/analytics');
      cy.wait(['@getOverview', '@getVolume', '@getTopCampaigns', '@getEngagementByHour', '@getContactGrowth', '@getSegments']);
    });

    it('should display page header', () => {
      cy.get('[data-testid="page-title"]').should('contain', 'Email Analytics');
    });

    it('should display date range picker', () => {
      cy.get('[data-testid="date-range-picker"]').should('exist');
    });

    it('should display summary cards', () => {
      cy.get('[data-testid="summary-cards"]').should('exist');
      cy.get('[data-testid="stat-card"]').should('have.length', 8);
    });

    it('should display all key metrics', () => {
      cy.get('[data-testid="stat-sent"]').should('exist');
      cy.get('[data-testid="stat-delivered"]').should('exist');
      cy.get('[data-testid="stat-opened"]').should('exist');
      cy.get('[data-testid="stat-clicked"]').should('exist');
      cy.get('[data-testid="stat-bounced"]').should('exist');
      cy.get('[data-testid="stat-unsubscribed"]').should('exist');
      cy.get('[data-testid="stat-open-rate"]').should('exist');
      cy.get('[data-testid="stat-click-rate"]').should('exist');
    });

    it('should display change indicators', () => {
      cy.get('[data-testid="stat-card"]').first()
        .find('[data-testid="change-indicator"]').should('exist');
    });
  });

  describe('Date Range Selection', () => {
    beforeEach(() => {
      cy.visit('/email/analytics');
      cy.wait('@getOverview');
    });

    it('should select preset date ranges', () => {
      cy.get('[data-testid="date-range-picker"]').click();
      cy.get('[data-testid="preset-last-7-days"]').click();
      cy.wait('@getOverview');
    });

    it('should select custom date range', () => {
      cy.get('[data-testid="date-range-picker"]').click();
      cy.get('[data-testid="preset-custom"]').click();
      cy.get('[data-testid="start-date-input"]').type('2024-01-01');
      cy.get('[data-testid="end-date-input"]').type('2024-01-31');
      cy.get('[data-testid="apply-date-range"]').click();
      cy.wait('@getOverview');
    });

    it('should display available presets', () => {
      cy.get('[data-testid="date-range-picker"]').click();
      cy.get('[data-testid="preset-today"]').should('exist');
      cy.get('[data-testid="preset-last-7-days"]').should('exist');
      cy.get('[data-testid="preset-last-30-days"]').should('exist');
      cy.get('[data-testid="preset-this-month"]').should('exist');
      cy.get('[data-testid="preset-last-month"]').should('exist');
    });
  });

  describe('Email Volume Chart', () => {
    beforeEach(() => {
      cy.visit('/email/analytics');
      cy.wait('@getVolume');
    });

    it('should display volume chart', () => {
      cy.get('[data-testid="volume-chart"]').should('exist');
    });

    it('should show chart legend', () => {
      cy.get('[data-testid="volume-chart-legend"]').should('exist');
      cy.get('[data-testid="legend-sent"]').should('exist');
      cy.get('[data-testid="legend-delivered"]').should('exist');
      cy.get('[data-testid="legend-opened"]').should('exist');
    });

    it('should toggle data series', () => {
      cy.get('[data-testid="legend-sent"]').click();
      // Series should be hidden
      cy.get('[data-testid="volume-chart"]')
        .find('[data-testid="series-sent"]')
        .should('have.class', 'hidden');
    });

    it('should change grouping', () => {
      cy.get('[data-testid="groupby-select"]').select('week');
      cy.wait('@getVolume');
    });

    it('should show tooltip on hover', () => {
      cy.get('[data-testid="volume-chart"]')
        .find('[data-testid="chart-bar"]').first()
        .trigger('mouseover');
      cy.get('[data-testid="chart-tooltip"]').should('be.visible');
    });
  });

  describe('Top Campaigns Widget', () => {
    beforeEach(() => {
      cy.visit('/email/analytics');
      cy.wait('@getTopCampaigns');
    });

    it('should display top campaigns', () => {
      cy.get('[data-testid="top-campaigns-widget"]').should('exist');
      cy.get('[data-testid="campaign-row"]').should('have.length.at.least', 1);
    });

    it('should show campaign metrics', () => {
      cy.get('[data-testid="campaign-row"]').first().within(() => {
        cy.get('[data-testid="campaign-name"]').should('exist');
        cy.get('[data-testid="campaign-sent"]').should('exist');
        cy.get('[data-testid="campaign-open-rate"]').should('exist');
        cy.get('[data-testid="campaign-click-rate"]').should('exist');
      });
    });

    it('should navigate to campaign report', () => {
      cy.get('[data-testid="campaign-row"]').first().click();
      cy.url().should('include', '/email/campaigns/');
      cy.url().should('include', '/report');
    });

    it('should show performance bars', () => {
      cy.get('[data-testid="campaign-row"]').first()
        .find('[data-testid="performance-bar"]').should('exist');
    });
  });

  describe('Engagement By Hour Chart', () => {
    beforeEach(() => {
      cy.visit('/email/analytics');
      cy.wait('@getEngagementByHour');
    });

    it('should display engagement by hour chart', () => {
      cy.get('[data-testid="engagement-hour-chart"]').should('exist');
    });

    it('should show all 24 hours', () => {
      cy.get('[data-testid="engagement-hour-chart"]')
        .find('[data-testid="hour-bar"]').should('have.length', 24);
    });

    it('should highlight peak hours', () => {
      cy.get('[data-testid="engagement-hour-chart"]')
        .find('[data-testid="peak-hour"]').should('exist');
    });

    it('should toggle between opens and clicks', () => {
      cy.get('[data-testid="metric-toggle-clicks"]').click();
      cy.get('[data-testid="engagement-hour-chart"]')
        .should('have.attr', 'data-metric', 'clicks');
    });
  });

  describe('Contact Growth Chart', () => {
    beforeEach(() => {
      cy.visit('/email/analytics');
      cy.wait('@getContactGrowth');
    });

    it('should display contact growth chart', () => {
      cy.get('[data-testid="contact-growth-chart"]').should('exist');
    });

    it('should show subscribed and unsubscribed areas', () => {
      cy.get('[data-testid="area-subscribed"]').should('exist');
      cy.get('[data-testid="area-unsubscribed"]').should('exist');
    });

    it('should display net growth line', () => {
      cy.get('[data-testid="line-net-growth"]').should('exist');
    });
  });

  describe('Engagement Segments Chart', () => {
    beforeEach(() => {
      cy.visit('/email/analytics');
      cy.wait('@getSegments');
    });

    it('should display engagement segments donut chart', () => {
      cy.get('[data-testid="segments-chart"]').should('exist');
    });

    it('should show segment legend', () => {
      cy.get('[data-testid="segment-highly-engaged"]').should('exist');
      cy.get('[data-testid="segment-engaged"]').should('exist');
      cy.get('[data-testid="segment-somewhat-engaged"]').should('exist');
      cy.get('[data-testid="segment-inactive"]').should('exist');
    });

    it('should display segment counts and percentages', () => {
      cy.get('[data-testid="segment-item"]').first().within(() => {
        cy.get('[data-testid="segment-count"]').should('exist');
        cy.get('[data-testid="segment-percentage"]').should('contain', '%');
      });
    });

    it('should navigate to segment on click', () => {
      cy.get('[data-testid="segment-highly-engaged"]').click();
      cy.url().should('include', '/email/contacts');
      cy.url().should('include', 'segment=highly_engaged');
    });
  });

  describe('Campaign Performance Table', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/email/campaigns*', { fixture: 'email/campaigns-list.json' }).as('getCampaigns');
      cy.visit('/email/analytics');
      cy.get('[data-testid="tab-campaigns"]').click();
      cy.wait('@getCampaigns');
    });

    it('should display campaigns table', () => {
      cy.get('[data-testid="campaigns-table"]').should('exist');
    });

    it('should show sortable columns', () => {
      cy.get('[data-testid="column-name"]').should('exist');
      cy.get('[data-testid="column-sent"]').should('exist');
      cy.get('[data-testid="column-delivered"]').should('exist');
      cy.get('[data-testid="column-opened"]').should('exist');
      cy.get('[data-testid="column-clicked"]').should('exist');
    });

    it('should sort by column', () => {
      cy.get('[data-testid="column-open-rate"]').click();
      cy.get('[data-testid="sort-indicator"]').should('be.visible');
    });

    it('should support pagination', () => {
      cy.get('[data-testid="pagination"]').should('exist');
      cy.get('[data-testid="page-2"]').click();
      cy.wait('@getCampaigns');
    });
  });

  describe('Email Health Score', () => {
    beforeEach(() => {
      cy.visit('/email/analytics');
      cy.wait('@getOverview');
    });

    it('should display health score', () => {
      cy.get('[data-testid="health-score"]').should('exist');
    });

    it('should show score value', () => {
      cy.get('[data-testid="health-score-value"]').should('exist');
    });

    it('should display health factors', () => {
      cy.get('[data-testid="health-factors"]').should('exist');
      cy.get('[data-testid="factor-deliverability"]').should('exist');
      cy.get('[data-testid="factor-engagement"]').should('exist');
      cy.get('[data-testid="factor-list-health"]').should('exist');
    });

    it('should show recommendations', () => {
      cy.get('[data-testid="health-recommendations"]').should('exist');
    });
  });

  describe('Export Report', () => {
    beforeEach(() => {
      cy.visit('/email/analytics');
      cy.wait('@getOverview');
    });

    it('should show export button', () => {
      cy.get('[data-testid="export-btn"]').should('exist');
    });

    it('should open export modal', () => {
      cy.get('[data-testid="export-btn"]').click();
      cy.get('[data-testid="export-modal"]').should('be.visible');
    });

    it('should select export format', () => {
      cy.get('[data-testid="export-btn"]').click();
      cy.get('[data-testid="format-csv"]').should('exist');
      cy.get('[data-testid="format-json"]').should('exist');
      cy.get('[data-testid="format-pdf"]').should('exist');
    });

    it('should export as CSV', () => {
      cy.intercept('GET', '/api/email/analytics/export*', {
        headers: {
          'content-type': 'text/csv',
          'content-disposition': 'attachment; filename=report.csv'
        },
        body: 'name,sent,opened\nCampaign 1,1000,400'
      }).as('exportCsv');

      cy.get('[data-testid="export-btn"]').click();
      cy.get('[data-testid="format-csv"]').click();
      cy.get('[data-testid="export-download-btn"]').click();
      cy.wait('@exportCsv');
    });
  });

  describe('Compare Periods', () => {
    beforeEach(() => {
      cy.visit('/email/analytics');
      cy.wait('@getOverview');
    });

    it('should enable compare mode', () => {
      cy.get('[data-testid="compare-toggle"]').click();
      cy.get('[data-testid="compare-period-select"]').should('be.visible');
    });

    it('should select comparison period', () => {
      cy.get('[data-testid="compare-toggle"]').click();
      cy.get('[data-testid="compare-previous-period"]').click();
      cy.wait('@getOverview');
    });

    it('should display comparison metrics', () => {
      cy.get('[data-testid="compare-toggle"]').click();
      cy.get('[data-testid="compare-previous-period"]').click();
      cy.get('[data-testid="comparison-chart"]').should('exist');
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', () => {
      cy.viewport('iphone-6');
      cy.visit('/email/analytics');
      cy.wait('@getOverview');

      cy.get('[data-testid="summary-cards"]').should('be.visible');
      cy.get('[data-testid="stat-card"]').should('have.css', 'width').and('match', /100%|auto/);
    });

    it('should show mobile-optimized charts', () => {
      cy.viewport('iphone-6');
      cy.visit('/email/analytics');
      cy.wait('@getVolume');

      cy.get('[data-testid="volume-chart"]').should('be.visible');
    });

    it('should collapse widgets on mobile', () => {
      cy.viewport('iphone-6');
      cy.visit('/email/analytics');

      cy.get('[data-testid="widget-collapse-btn"]').should('be.visible');
    });
  });

  describe('Real-time Updates', () => {
    it('should show refresh button', () => {
      cy.visit('/email/analytics');
      cy.get('[data-testid="refresh-btn"]').should('exist');
    });

    it('should refresh data on button click', () => {
      cy.visit('/email/analytics');
      cy.wait('@getOverview');

      cy.get('[data-testid="refresh-btn"]').click();
      cy.wait('@getOverview');
    });

    it('should show last updated timestamp', () => {
      cy.visit('/email/analytics');
      cy.wait('@getOverview');

      cy.get('[data-testid="last-updated"]').should('exist');
    });
  });

  describe('Error Handling', () => {
    it('should display error state on API failure', () => {
      cy.intercept('GET', '/api/email/analytics/overview*', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('getOverviewError');

      cy.visit('/email/analytics');
      cy.wait('@getOverviewError');

      cy.get('[data-testid="error-message"]').should('be.visible');
      cy.get('[data-testid="retry-btn"]').should('exist');
    });

    it('should retry on error', () => {
      cy.intercept('GET', '/api/email/analytics/overview*', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('getOverviewError');

      cy.visit('/email/analytics');
      cy.wait('@getOverviewError');

      cy.intercept('GET', '/api/email/analytics/overview*', { fixture: 'email/analytics-overview.json' }).as('getOverviewRetry');

      cy.get('[data-testid="retry-btn"]').click();
      cy.wait('@getOverviewRetry');

      cy.get('[data-testid="summary-cards"]').should('be.visible');
    });

    it('should show loading state', () => {
      cy.intercept('GET', '/api/email/analytics/overview*', {
        delay: 1000,
        fixture: 'email/analytics-overview.json'
      }).as('getOverviewSlow');

      cy.visit('/email/analytics');
      cy.get('[data-testid="loading-skeleton"]').should('be.visible');
      cy.wait('@getOverviewSlow');
      cy.get('[data-testid="loading-skeleton"]').should('not.exist');
    });
  });
});
