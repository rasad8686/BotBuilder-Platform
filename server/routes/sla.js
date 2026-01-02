/**
 * @fileoverview SLA Routes
 * @description API endpoints for SLA dashboard and reporting
 * @module routes/sla
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const log = require('../utils/logger');
const slaService = require('../services/slaService');

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/sla/config
 * Get current SLA configuration
 */
router.get('/config', async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID required'
      });
    }

    const config = await slaService.getSLAConfig(organizationId);

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    log.error('[SLA] Error fetching config:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SLA configuration'
    });
  }
});

/**
 * GET /api/sla/dashboard
 * Get SLA dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID required'
      });
    }

    const dashboardData = await slaService.getDashboardData(organizationId);

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    log.error('[SLA] Error fetching dashboard:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SLA dashboard data'
    });
  }
});

/**
 * GET /api/sla/history
 * Get historical SLA metrics
 */
router.get('/history', async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.organizationId;
    const { months = 12 } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID required'
      });
    }

    const history = await slaService.getSLAHistory(organizationId, parseInt(months));

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    log.error('[SLA] Error fetching history:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SLA history'
    });
  }
});

/**
 * GET /api/sla/credits
 * Get SLA credit history
 */
router.get('/credits', async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID required'
      });
    }

    const credits = await slaService.getSLACredits(organizationId);

    // Calculate totals
    const totals = {
      pending: credits.filter(c => c.status === 'pending').reduce((sum, c) => sum + parseFloat(c.credit_amount || 0), 0),
      approved: credits.filter(c => c.status === 'approved').reduce((sum, c) => sum + parseFloat(c.credit_amount || 0), 0),
      applied: credits.filter(c => c.status === 'applied').reduce((sum, c) => sum + parseFloat(c.credit_amount || 0), 0)
    };

    res.json({
      success: true,
      data: {
        credits,
        totals
      }
    });

  } catch (error) {
    log.error('[SLA] Error fetching credits:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SLA credits'
    });
  }
});

/**
 * GET /api/sla/report/:period
 * Get monthly SLA report
 * Period format: YYYY-MM
 */
router.get('/report/:period', async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.organizationId;
    const { period } = req.params;
    const { format = 'json' } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID required'
      });
    }

    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period format. Use YYYY-MM'
      });
    }

    const report = await slaService.generateSLAReport(organizationId, period);

    if (format === 'pdf') {
      // Generate PDF report
      const pdfContent = generatePDFReport(report);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=sla-report-${period}.pdf`);
      res.send(pdfContent);
    } else {
      res.json({
        success: true,
        data: report
      });
    }

  } catch (error) {
    log.error('[SLA] Error generating report:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to generate SLA report'
    });
  }
});

/**
 * GET /api/sla/uptime/:period
 * Get uptime metrics for a specific period
 */
router.get('/uptime/:period', async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.organizationId;
    const { period } = req.params;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID required'
      });
    }

    const [year, month] = period.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    const uptime = await slaService.calculateUptime(organizationId, periodStart, periodEnd);

    res.json({
      success: true,
      data: uptime
    });

  } catch (error) {
    log.error('[SLA] Error fetching uptime:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch uptime metrics'
    });
  }
});

/**
 * GET /api/sla/daily-uptime
 * Get daily uptime for current month
 */
router.get('/daily-uptime', async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.organizationId;
    const { year, month } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID required'
      });
    }

    const now = new Date();
    const targetYear = year ? parseInt(year) : now.getFullYear();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();

    const periodStart = new Date(targetYear, targetMonth, 1);
    const periodEnd = new Date(targetYear, targetMonth + 1, 0);

    const dailyUptime = await slaService.getDailyUptime(organizationId, periodStart, periodEnd);

    res.json({
      success: true,
      data: dailyUptime
    });

  } catch (error) {
    log.error('[SLA] Error fetching daily uptime:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily uptime'
    });
  }
});

/**
 * Generate PDF report (simplified - returns HTML for now)
 * In production, use a proper PDF library like puppeteer or pdfkit
 */
function generatePDFReport(report) {
  // For now, return a simple HTML that could be printed as PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>SLA Report - ${report.period}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { color: #333; }
    .metric { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
    .metric-label { font-weight: bold; color: #666; }
    .metric-value { font-size: 24px; color: #333; }
    .met { color: #22c55e; }
    .not-met { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
  <h1>SLA Report - ${report.period}</h1>
  <p>Generated: ${new Date(report.generated_at).toLocaleString()}</p>

  <div class="metric">
    <div class="metric-label">SLA Tier</div>
    <div class="metric-value">${report.sla_tier.toUpperCase()}</div>
  </div>

  <div class="metric">
    <div class="metric-label">Uptime</div>
    <div class="metric-value ${report.uptime_met ? 'met' : 'not-met'}">
      ${report.uptime_actual.toFixed(4)}% (Target: ${report.uptime_target}%)
    </div>
  </div>

  <div class="metric">
    <div class="metric-label">Response Time</div>
    <div class="metric-value ${report.response_time_met ? 'met' : 'not-met'}">
      ${report.avg_response_time}ms (Target: ${report.response_time_target}ms)
    </div>
  </div>

  <div class="metric">
    <div class="metric-label">Downtime</div>
    <div class="metric-value">${report.downtime_minutes} minutes</div>
  </div>

  <div class="metric">
    <div class="metric-label">Incidents</div>
    <div class="metric-value">${report.incidents_count}</div>
  </div>

  ${report.breaches.length > 0 ? `
  <h2>SLA Breaches</h2>
  <table>
    <tr>
      <th>Type</th>
      <th>Target</th>
      <th>Actual</th>
      <th>Severity</th>
    </tr>
    ${report.breaches.map(b => `
    <tr>
      <td>${b.type}</td>
      <td>${b.target}</td>
      <td>${b.actual}</td>
      <td>${b.severity}</td>
    </tr>
    `).join('')}
  </table>
  ` : '<p>No SLA breaches this period.</p>'}

  ${report.credits.length > 0 ? `
  <h2>Credits</h2>
  <table>
    <tr>
      <th>Type</th>
      <th>Percentage</th>
      <th>Amount</th>
      <th>Status</th>
    </tr>
    ${report.credits.map(c => `
    <tr>
      <td>${c.breach_type}</td>
      <td>${c.credit_percentage}%</td>
      <td>$${c.credit_amount}</td>
      <td>${c.status}</td>
    </tr>
    `).join('')}
  </table>
  <p><strong>Total Credits: $${report.total_credits.toFixed(2)}</strong></p>
  ` : ''}
</body>
</html>
  `;

  return Buffer.from(html);
}

module.exports = router;
