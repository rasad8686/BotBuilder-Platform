/**
 * Enterprise Contracts Routes
 * Manage enterprise contracts, invoices, and amendments
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const contractService = require('../services/contractService');
const log = require('../utils/logger');

// Apply authentication and organization context
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

// =====================
// CONTRACT ENDPOINTS
// =====================

/**
 * GET /api/enterprise/contracts
 * Get all contracts for the organization
 */
router.get('/contracts', async (req, res) => {
  try {
    const organizationId = req.organization.id;

    const result = await db.query(
      `SELECT ec.*,
              (SELECT COUNT(*) FROM enterprise_invoices ei WHERE ei.contract_id = ec.id) as invoice_count,
              (SELECT COUNT(*) FROM contract_amendments ca WHERE ca.contract_id = ec.id) as amendment_count
       FROM enterprise_contracts ec
       WHERE ec.organization_id = $1
       ORDER BY ec.created_at DESC`,
      [organizationId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    log.error('Error fetching contracts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contracts'
    });
  }
});

/**
 * POST /api/enterprise/contracts
 * Create a new contract
 */
router.post('/contracts', async (req, res) => {
  try {
    const organizationId = req.organization.id;
    const terms = req.body;

    const contract = await contractService.generateContract(organizationId, terms);

    log.info('Contract created', { contractId: contract.id, organizationId });

    res.status(201).json({
      success: true,
      data: contract
    });
  } catch (error) {
    log.error('Error creating contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create contract'
    });
  }
});

/**
 * GET /api/enterprise/contracts/:id
 * Get contract details
 */
router.get('/contracts/:id', async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const organizationId = req.organization.id;

    const result = await db.query(
      `SELECT ec.*,
              o.name as organization_name,
              o.slug as organization_slug
       FROM enterprise_contracts ec
       JOIN organizations o ON ec.organization_id = o.id
       WHERE ec.id = $1 AND ec.organization_id = $2`,
      [contractId, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Get invoices
    const invoices = await db.query(
      `SELECT * FROM enterprise_invoices WHERE contract_id = $1 ORDER BY period_start DESC`,
      [contractId]
    );

    // Get amendments
    const amendments = await db.query(
      `SELECT * FROM contract_amendments WHERE contract_id = $1 ORDER BY created_at DESC`,
      [contractId]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        invoices: invoices.rows,
        amendments: amendments.rows
      }
    });
  } catch (error) {
    log.error('Error fetching contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contract'
    });
  }
});

/**
 * PUT /api/enterprise/contracts/:id
 * Update contract
 */
router.put('/contracts/:id', async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const organizationId = req.organization.id;
    const updates = req.body;

    // Verify ownership
    const checkResult = await db.query(
      'SELECT id, status FROM enterprise_contracts WHERE id = $1 AND organization_id = $2',
      [contractId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Only allow updates to draft contracts
    if (checkResult.rows[0].status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft contracts can be updated. Use amendments for active contracts.'
      });
    }

    // Build update query
    const allowedFields = ['start_date', 'end_date', 'auto_renew', 'payment_terms', 'notes'];
    const updateParts = [];
    const values = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateParts.push(`${field} = $${paramCount++}`);
        values.push(updates[field]);
      }
    }

    if (updateParts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updateParts.push('updated_at = NOW()');
    values.push(contractId);

    const result = await db.query(
      `UPDATE enterprise_contracts SET ${updateParts.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Error updating contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contract'
    });
  }
});

/**
 * POST /api/enterprise/contracts/:id/sign
 * Sign contract
 */
router.post('/contracts/:id/sign', async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const organizationId = req.organization.id;
    const { signedBy } = req.body;

    // Verify ownership and status
    const checkResult = await db.query(
      'SELECT * FROM enterprise_contracts WHERE id = $1 AND organization_id = $2',
      [contractId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const contract = checkResult.rows[0];

    if (contract.status !== 'draft' && contract.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Contract cannot be signed in current status'
      });
    }

    // Sign the contract
    const result = await db.query(
      `UPDATE enterprise_contracts
       SET status = 'active', signed_at = NOW(), signed_by = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [signedBy || req.user.email, contractId]
    );

    // Update organization plan tier to enterprise
    await db.query(
      `UPDATE organizations SET plan_tier = 'enterprise', updated_at = NOW() WHERE id = $1`,
      [organizationId]
    );

    log.info('Contract signed', { contractId, signedBy: signedBy || req.user.email });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Contract signed successfully'
    });
  } catch (error) {
    log.error('Error signing contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sign contract'
    });
  }
});

/**
 * GET /api/enterprise/contracts/:id/pdf
 * Download contract PDF
 */
router.get('/contracts/:id/pdf', async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const organizationId = req.organization.id;

    const result = await db.query(
      'SELECT contract_pdf_url FROM enterprise_contracts WHERE id = $1 AND organization_id = $2',
      [contractId, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const pdfUrl = result.rows[0].contract_pdf_url;

    if (!pdfUrl) {
      // Generate PDF on the fly (simplified - in production use a PDF library)
      return res.json({
        success: true,
        message: 'PDF generation requested. URL will be available shortly.',
        data: { status: 'generating' }
      });
    }

    res.json({
      success: true,
      data: { pdfUrl }
    });
  } catch (error) {
    log.error('Error fetching contract PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contract PDF'
    });
  }
});

/**
 * POST /api/enterprise/contracts/:id/amend
 * Create contract amendment
 */
router.post('/contracts/:id/amend', async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const organizationId = req.organization.id;
    const { amendmentType, description, newValue, effectiveDate } = req.body;

    // Verify ownership
    const contractResult = await db.query(
      'SELECT * FROM enterprise_contracts WHERE id = $1 AND organization_id = $2',
      [contractId, organizationId]
    );

    if (contractResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const contract = contractResult.rows[0];

    // Determine old value based on amendment type
    let oldValue = {};
    switch (amendmentType) {
      case 'price_change':
        oldValue = { annual_value: contract.annual_value, monthly_value: contract.monthly_value };
        break;
      case 'term_extension':
        oldValue = { end_date: contract.end_date };
        break;
      case 'seats_change':
        oldValue = { included_seats: contract.included_seats };
        break;
      case 'limit_change':
        oldValue = { included_requests: contract.included_requests, included_storage_gb: contract.included_storage_gb };
        break;
      default:
        oldValue = {};
    }

    // Create amendment
    const amendmentResult = await db.query(
      `INSERT INTO contract_amendments
       (contract_id, amendment_type, description, old_value, new_value, effective_date, approved_by, approved_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        contractId,
        amendmentType,
        description,
        JSON.stringify(oldValue),
        JSON.stringify(newValue),
        effectiveDate || new Date(),
        req.user.email
      ]
    );

    // Apply amendment if effective immediately
    const effectiveDateParsed = new Date(effectiveDate || new Date());
    if (effectiveDateParsed <= new Date()) {
      // Apply the new values to the contract
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(newValue)) {
        updateFields.push(`${key} = $${paramCount++}`);
        updateValues.push(value);
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateValues.push(contractId);

        await db.query(
          `UPDATE enterprise_contracts SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
          updateValues
        );
      }
    }

    log.info('Contract amendment created', { contractId, amendmentType });

    res.status(201).json({
      success: true,
      data: amendmentResult.rows[0]
    });
  } catch (error) {
    log.error('Error creating amendment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create amendment'
    });
  }
});

// =====================
// INVOICE ENDPOINTS
// =====================

/**
 * GET /api/enterprise/invoices
 * Get all invoices for the organization
 */
router.get('/invoices', async (req, res) => {
  try {
    const organizationId = req.organization.id;

    const result = await db.query(
      `SELECT ei.*, ec.contract_number
       FROM enterprise_invoices ei
       JOIN enterprise_contracts ec ON ei.contract_id = ec.id
       WHERE ec.organization_id = $1
       ORDER BY ei.created_at DESC`,
      [organizationId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    log.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices'
    });
  }
});

/**
 * POST /api/enterprise/invoices
 * Generate a new invoice
 */
router.post('/invoices', async (req, res) => {
  try {
    const organizationId = req.organization.id;
    const { contractId, periodStart, periodEnd } = req.body;

    // Verify contract ownership
    const contractCheck = await db.query(
      'SELECT id FROM enterprise_contracts WHERE id = $1 AND organization_id = $2',
      [contractId, organizationId]
    );

    if (contractCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const invoice = await contractService.generateInvoice(contractId, periodStart, periodEnd);

    res.status(201).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    log.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice'
    });
  }
});

/**
 * GET /api/enterprise/invoices/:id
 * Get invoice details
 */
router.get('/invoices/:id', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const organizationId = req.organization.id;

    const result = await db.query(
      `SELECT ei.*, ec.contract_number, ec.organization_id
       FROM enterprise_invoices ei
       JOIN enterprise_contracts ec ON ei.contract_id = ec.id
       WHERE ei.id = $1 AND ec.organization_id = $2`,
      [invoiceId, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice'
    });
  }
});

/**
 * GET /api/enterprise/invoices/:id/pdf
 * Download invoice PDF
 */
router.get('/invoices/:id/pdf', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const organizationId = req.organization.id;

    const result = await db.query(
      `SELECT ei.pdf_url
       FROM enterprise_invoices ei
       JOIN enterprise_contracts ec ON ei.contract_id = ec.id
       WHERE ei.id = $1 AND ec.organization_id = $2`,
      [invoiceId, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const pdfUrl = result.rows[0].pdf_url;

    if (!pdfUrl) {
      return res.json({
        success: true,
        message: 'PDF generation requested',
        data: { status: 'generating' }
      });
    }

    res.json({
      success: true,
      data: { pdfUrl }
    });
  } catch (error) {
    log.error('Error fetching invoice PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice PDF'
    });
  }
});

/**
 * POST /api/enterprise/invoices/:id/pay
 * Mark invoice as paid
 */
router.post('/invoices/:id/pay', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const organizationId = req.organization.id;

    // Verify ownership
    const checkResult = await db.query(
      `SELECT ei.id, ei.status
       FROM enterprise_invoices ei
       JOIN enterprise_contracts ec ON ei.contract_id = ec.id
       WHERE ei.id = $1 AND ec.organization_id = $2`,
      [invoiceId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (checkResult.rows[0].status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already paid'
      });
    }

    const result = await db.query(
      `UPDATE enterprise_invoices
       SET status = 'paid', paid_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [invoiceId]
    );

    log.info('Invoice marked as paid', { invoiceId });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Error marking invoice as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark invoice as paid'
    });
  }
});

/**
 * POST /api/enterprise/invoices/:id/send
 * Send invoice to customer
 */
router.post('/invoices/:id/send', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const organizationId = req.organization.id;

    // Verify ownership
    const checkResult = await db.query(
      `SELECT ei.id
       FROM enterprise_invoices ei
       JOIN enterprise_contracts ec ON ei.contract_id = ec.id
       WHERE ei.id = $1 AND ec.organization_id = $2`,
      [invoiceId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Update status to sent
    const result = await db.query(
      `UPDATE enterprise_invoices
       SET status = 'sent', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [invoiceId]
    );

    // In production, send email notification here

    log.info('Invoice sent', { invoiceId });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Invoice sent successfully'
    });
  } catch (error) {
    log.error('Error sending invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invoice'
    });
  }
});

/**
 * GET /api/enterprise/pricing
 * Get available pricing tiers
 */
router.get('/pricing', async (req, res) => {
  res.json({
    success: true,
    data: contractService.PRICING_TIERS
  });
});

/**
 * POST /api/enterprise/pricing/calculate
 * Calculate custom pricing
 */
router.post('/pricing/calculate', async (req, res) => {
  try {
    const terms = req.body;
    const pricing = contractService.calculatePricing(terms);

    res.json({
      success: true,
      data: pricing
    });
  } catch (error) {
    log.error('Error calculating pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate pricing'
    });
  }
});

/**
 * GET /api/enterprise/summary
 * Get contract summary for organization
 */
router.get('/summary', async (req, res) => {
  try {
    const organizationId = req.organization.id;
    const summary = await contractService.getContractSummary(organizationId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    log.error('Error fetching summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch summary'
    });
  }
});

module.exports = router;
