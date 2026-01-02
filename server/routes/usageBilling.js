/**
 * Usage-based Billing Routes
 * API endpoints for usage tracking, billing, and invoices
 */

const express = require('express');
const router = express.Router();
const usageBillingEngine = require('../services/usageBillingEngine');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/billing/usage/current
 * Get current billing period usage
 */
router.get('/usage/current', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const currentUsage = await usageBillingEngine.getCurrentUsage(organizationId);

    res.json({
      success: true,
      data: currentUsage
    });
  } catch (error) {
    console.error('Get current usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current usage'
    });
  }
});

/**
 * GET /api/billing/usage/history
 * Get usage history
 */
router.get('/usage/history', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { limit = 12 } = req.query;

    const history = await usageBillingEngine.getUsageHistory(organizationId, parseInt(limit));

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get usage history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage history'
    });
  }
});

/**
 * GET /api/billing/usage/estimate
 * Get end of month usage estimate
 */
router.get('/usage/estimate', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const estimate = await usageBillingEngine.estimateMonthEnd(organizationId);

    res.json({
      success: true,
      data: estimate
    });
  } catch (error) {
    console.error('Get usage estimate error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage estimate'
    });
  }
});

/**
 * GET /api/billing/usage/breakdown
 * Get detailed usage breakdown
 */
router.get('/usage/breakdown', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { startDate, endDate } = req.query;

    const { startDate: defaultStart, endDate: defaultEnd } = usageBillingEngine.getCurrentBillingPeriod();

    const breakdown = await usageBillingEngine.getUsageBreakdown(
      organizationId,
      startDate || defaultStart,
      endDate || defaultEnd
    );

    res.json({
      success: true,
      data: breakdown
    });
  } catch (error) {
    console.error('Get usage breakdown error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage breakdown'
    });
  }
});

/**
 * POST /api/billing/usage/alert
 * Set usage alert threshold
 */
router.post('/usage/alert', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { alertType, threshold, enabled = true } = req.body;

    if (!alertType || threshold === undefined) {
      return res.status(400).json({
        success: false,
        error: 'alertType and threshold are required'
      });
    }

    const validAlertTypes = ['api_requests', 'ai_tokens', 'storage_gb', 'bandwidth_gb', 'total_cost'];
    if (!validAlertTypes.includes(alertType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid alertType. Must be one of: ${validAlertTypes.join(', ')}`
      });
    }

    // Check if alert already exists
    const existingAlert = await db('usage_alerts')
      .where('organization_id', organizationId)
      .where('alert_type', alertType)
      .first();

    let alert;
    if (existingAlert) {
      await db('usage_alerts')
        .where('id', existingAlert.id)
        .update({
          threshold,
          enabled,
          updated_at: db.fn.now()
        });
      alert = await db('usage_alerts').where('id', existingAlert.id).first();
    } else {
      // Create alerts table if it doesn't exist
      const tableExists = await db.schema.hasTable('usage_alerts');
      if (!tableExists) {
        await db.schema.createTable('usage_alerts', (table) => {
          table.increments('id').primary();
          table.integer('organization_id').unsigned();
          table.string('alert_type', 50).notNullable();
          table.decimal('threshold', 15, 4).notNullable();
          table.boolean('enabled').defaultTo(true);
          table.timestamp('last_triggered_at');
          table.timestamp('created_at').defaultTo(db.fn.now());
          table.timestamp('updated_at').defaultTo(db.fn.now());
        });
      }

      [alert] = await db('usage_alerts').insert({
        organization_id: organizationId,
        alert_type: alertType,
        threshold,
        enabled
      }).returning('*');
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    console.error('Set usage alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set usage alert'
    });
  }
});

/**
 * GET /api/billing/usage/alerts
 * Get all usage alerts for organization
 */
router.get('/usage/alerts', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const tableExists = await db.schema.hasTable('usage_alerts');
    if (!tableExists) {
      return res.json({
        success: true,
        data: []
      });
    }

    const alerts = await db('usage_alerts')
      .where('organization_id', organizationId)
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Get usage alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage alerts'
    });
  }
});

/**
 * DELETE /api/billing/usage/alert/:id
 * Delete a usage alert
 */
router.delete('/usage/alert/:id', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { id } = req.params;

    const alert = await db('usage_alerts')
      .where('id', id)
      .where('organization_id', organizationId)
      .first();

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    await db('usage_alerts').where('id', id).delete();

    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    console.error('Delete usage alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete usage alert'
    });
  }
});

/**
 * GET /api/billing/tiers
 * Get pricing tiers
 */
router.get('/tiers', async (req, res) => {
  try {
    const { unitType } = req.query;

    let tiers;
    if (unitType) {
      tiers = await usageBillingEngine.getTiers(unitType);
    } else {
      tiers = await usageBillingEngine.getAllTiers();
    }

    // Group by unit type
    const grouped = tiers.reduce((acc, tier) => {
      if (!acc[tier.unit_type]) {
        acc[tier.unit_type] = [];
      }
      acc[tier.unit_type].push({
        name: tier.name,
        minUnits: tier.min_units,
        maxUnits: tier.max_units,
        pricePerUnit: parseFloat(tier.price_per_unit)
      });
      return acc;
    }, {});

    res.json({
      success: true,
      data: grouped
    });
  } catch (error) {
    console.error('Get tiers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pricing tiers'
    });
  }
});

/**
 * GET /api/billing/invoices
 * Get invoice list
 */
router.get('/invoices', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { limit = 12 } = req.query;

    const invoices = await usageBillingEngine.getInvoices(organizationId, parseInt(limit));

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invoices'
    });
  }
});

/**
 * GET /api/billing/invoices/:id
 * Get specific invoice
 */
router.get('/invoices/:id', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { id } = req.params;

    const invoice = await usageBillingEngine.generateInvoicePDF(organizationId, id);

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get invoice'
    });
  }
});

/**
 * GET /api/billing/invoices/:id/pdf
 * Get invoice as PDF
 */
router.get('/invoices/:id/pdf', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { id } = req.params;

    const pdfData = await usageBillingEngine.generateInvoicePDF(organizationId, id);

    // Generate HTML for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Invoice ${pdfData.invoiceNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 28px; font-weight: bold; color: #2563eb; }
    .invoice-info { text-align: right; }
    .invoice-number { font-size: 24px; font-weight: bold; color: #333; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 16px; font-weight: bold; color: #666; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background-color: #f8f9fa; font-weight: 600; }
    .total-row { font-weight: bold; font-size: 18px; background-color: #f0f9ff; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .status-paid { background-color: #dcfce7; color: #16a34a; }
    .status-invoiced { background-color: #dbeafe; color: #2563eb; }
    .status-pending { background-color: #fef3c7; color: #d97706; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">BotBuilder</div>
    <div class="invoice-info">
      <div class="invoice-number">${pdfData.invoiceNumber}</div>
      <div>Generated: ${new Date(pdfData.generatedAt).toLocaleDateString()}</div>
      <div class="status status-${pdfData.status}">${pdfData.status.toUpperCase()}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Bill To</div>
    <div><strong>${pdfData.organization}</strong></div>
    <div>Billing Period: ${pdfData.billingPeriod}</div>
  </div>

  <div class="section">
    <div class="section-title">Usage Summary</div>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Usage</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(pdfData.usage).map(([key, value]) => `
          <tr>
            <td>${key}</td>
            <td>${value}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Charges</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(pdfData.costs).map(([key, value]) => `
          <tr class="${key === 'Total' ? 'total-row' : ''}">
            <td>${key}</td>
            <td>${value}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Thank you for your business!</p>
    <p>Questions? Contact support@botbuilder.com</p>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_${pdfData.invoiceNumber}.html"`);
    res.send(html);
  } catch (error) {
    console.error('Get invoice PDF error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate invoice PDF'
    });
  }
});

/**
 * POST /api/billing/usage/track
 * Track a usage event (internal use or API)
 */
router.post('/usage/track', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { eventType, quantity, metadata = {} } = req.body;

    if (!eventType || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'eventType and quantity are required'
      });
    }

    const event = await usageBillingEngine.trackUsage(organizationId, eventType, quantity, metadata);

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Track usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track usage'
    });
  }
});

/**
 * POST /api/billing/invoices/generate
 * Generate invoice for current period
 */
router.post('/invoices/generate', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { startDate, endDate } = req.body;

    const period = startDate && endDate ? { startDate, endDate } : null;
    const invoice = await usageBillingEngine.generateInvoice(organizationId, period);

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate invoice'
    });
  }
});

/**
 * POST /api/billing/invoices/:id/sync
 * Sync invoice to Stripe
 */
router.post('/invoices/:id/sync', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { id } = req.params;

    const invoice = await usageBillingEngine.generateInvoice(organizationId);
    const result = await usageBillingEngine.syncToStripe(invoice);

    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('Sync invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync invoice to Stripe'
    });
  }
});

module.exports = router;
