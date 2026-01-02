/**
 * Contract Service
 * Handles enterprise contract generation, pricing, invoicing, and renewals
 */

const db = require('../db');
const log = require('../utils/logger');

// Pricing tiers for enterprise
const PRICING_TIERS = {
  starter: {
    name: 'Enterprise Starter',
    annualBase: 12000,
    monthlyBase: 1200,
    includedRequests: 1000000,
    includedStorageGb: 50,
    includedSeats: 10,
    overageRates: {
      requests: 0.001, // per request
      storage: 5, // per GB
      seats: 50 // per seat
    }
  },
  professional: {
    name: 'Enterprise Professional',
    annualBase: 36000,
    monthlyBase: 3500,
    includedRequests: 5000000,
    includedStorageGb: 200,
    includedSeats: 50,
    overageRates: {
      requests: 0.0008,
      storage: 4,
      seats: 40
    }
  },
  enterprise: {
    name: 'Enterprise Ultimate',
    annualBase: 100000,
    monthlyBase: 9500,
    includedRequests: 20000000,
    includedStorageGb: 1000,
    includedSeats: 200,
    overageRates: {
      requests: 0.0005,
      storage: 3,
      seats: 30
    }
  }
};

/**
 * Generate unique contract number
 * @returns {string} Contract number
 */
function generateContractNumber() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ENT-${year}-${random}`;
}

/**
 * Generate unique invoice number
 * @param {number} contractId - Contract ID
 * @returns {string} Invoice number
 */
function generateInvoiceNumber(contractId) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${year}${month}-${contractId}-${random}`;
}

/**
 * Calculate pricing based on terms
 * @param {object} terms - Contract terms
 * @returns {object} Calculated pricing
 */
function calculatePricing(terms) {
  const tier = PRICING_TIERS[terms.tier] || PRICING_TIERS.starter;

  // Base pricing
  let annualValue = tier.annualBase;
  let monthlyValue = tier.monthlyBase;

  // Apply custom adjustments
  if (terms.customSeats && terms.customSeats > tier.includedSeats) {
    const extraSeats = terms.customSeats - tier.includedSeats;
    annualValue += extraSeats * tier.overageRates.seats * 12;
  }

  if (terms.customRequests && terms.customRequests > tier.includedRequests) {
    const extraRequests = terms.customRequests - tier.includedRequests;
    annualValue += extraRequests * tier.overageRates.requests * 12;
  }

  if (terms.customStorage && terms.customStorage > tier.includedStorageGb) {
    const extraStorage = terms.customStorage - tier.includedStorageGb;
    annualValue += extraStorage * tier.overageRates.storage * 12;
  }

  // Apply discount
  const discountPercentage = terms.discountPercentage || 0;
  const discountAmount = annualValue * (discountPercentage / 100);
  annualValue -= discountAmount;
  monthlyValue = annualValue / 12;

  // Multi-year discount
  const contractYears = terms.contractYears || 1;
  if (contractYears >= 3) {
    annualValue *= 0.85; // 15% discount for 3+ years
  } else if (contractYears >= 2) {
    annualValue *= 0.92; // 8% discount for 2 years
  }

  return {
    tier: tier.name,
    annualValue: Math.round(annualValue * 100) / 100,
    monthlyValue: Math.round(monthlyValue * 100) / 100,
    discountPercentage,
    discountAmount: Math.round(discountAmount * 100) / 100,
    includedRequests: terms.customRequests || tier.includedRequests,
    includedStorageGb: terms.customStorage || tier.includedStorageGb,
    includedSeats: terms.customSeats || tier.includedSeats,
    overageRates: tier.overageRates
  };
}

/**
 * Generate a new contract
 * @param {number} organizationId - Organization ID
 * @param {object} terms - Contract terms
 * @returns {object} Created contract
 */
async function generateContract(organizationId, terms) {
  try {
    const pricing = calculatePricing(terms);
    const contractNumber = generateContractNumber();

    const startDate = terms.startDate || new Date();
    const contractYears = terms.contractYears || 1;
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + contractYears);

    const result = await db.query(
      `INSERT INTO enterprise_contracts
       (organization_id, contract_number, start_date, end_date, auto_renew, payment_terms,
        annual_value, monthly_value, discount_percentage, custom_pricing,
        included_requests, included_storage_gb, included_seats, overage_rates,
        status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
       RETURNING *`,
      [
        organizationId,
        contractNumber,
        startDate,
        endDate,
        terms.autoRenew || false,
        terms.paymentTerms || 30,
        pricing.annualValue,
        pricing.monthlyValue,
        pricing.discountPercentage,
        JSON.stringify(terms.customPricing || {}),
        pricing.includedRequests,
        pricing.includedStorageGb,
        pricing.includedSeats,
        JSON.stringify(pricing.overageRates),
        'draft',
        terms.notes || null
      ]
    );

    log.info('Contract generated', { contractNumber, organizationId });

    return result.rows[0];
  } catch (error) {
    log.error('Error generating contract:', error);
    throw error;
  }
}

/**
 * Generate invoice for a contract period
 * @param {number} contractId - Contract ID
 * @param {Date} periodStart - Period start date
 * @param {Date} periodEnd - Period end date
 * @returns {object} Created invoice
 */
async function generateInvoice(contractId, periodStart, periodEnd) {
  try {
    // Get contract details
    const contractResult = await db.query(
      'SELECT * FROM enterprise_contracts WHERE id = $1',
      [contractId]
    );

    if (contractResult.rows.length === 0) {
      throw new Error('Contract not found');
    }

    const contract = contractResult.rows[0];
    const invoiceNumber = generateInvoiceNumber(contractId);

    // Calculate period months
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;

    // Calculate subtotal
    const subtotal = contract.monthly_value * months;
    const taxRate = 0; // Can be configured per organization
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    // Calculate due date based on payment terms
    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDate.getDate() + (contract.payment_terms || 30));

    // Create line items
    const lineItems = [
      {
        description: `${contract.contract_number} - Monthly Service (${months} months)`,
        quantity: months,
        unitPrice: contract.monthly_value,
        amount: subtotal
      }
    ];

    const result = await db.query(
      `INSERT INTO enterprise_invoices
       (contract_id, invoice_number, period_start, period_end, subtotal, tax, total, status, due_date, line_items, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        contractId,
        invoiceNumber,
        periodStart,
        periodEnd,
        subtotal,
        tax,
        total,
        dueDate,
        JSON.stringify(lineItems)
      ]
    );

    log.info('Invoice generated', { invoiceNumber, contractId, total });

    return result.rows[0];
  } catch (error) {
    log.error('Error generating invoice:', error);
    throw error;
  }
}

/**
 * Check contracts due for renewal
 * @returns {object[]} Contracts due for renewal
 */
async function checkRenewal() {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const result = await db.query(
      `SELECT ec.*, o.name as organization_name, o.slug as organization_slug
       FROM enterprise_contracts ec
       JOIN organizations o ON ec.organization_id = o.id
       WHERE ec.status = 'active'
         AND ec.end_date <= $1
         AND ec.end_date > NOW()
       ORDER BY ec.end_date ASC`,
      [thirtyDaysFromNow]
    );

    log.info(`Found ${result.rows.length} contracts due for renewal`);

    return result.rows;
  } catch (error) {
    log.error('Error checking renewals:', error);
    throw error;
  }
}

/**
 * Auto-renew eligible contracts
 * @returns {object} Renewal results
 */
async function processAutoRenewals() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await db.query(
      `SELECT * FROM enterprise_contracts
       WHERE status = 'active'
         AND auto_renew = true
         AND end_date = $1::date`,
      [today]
    );

    const renewed = [];
    for (const contract of result.rows) {
      try {
        // Extend end date by 1 year
        const newEndDate = new Date(contract.end_date);
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);

        await db.query(
          `UPDATE enterprise_contracts
           SET end_date = $1, updated_at = NOW()
           WHERE id = $2`,
          [newEndDate, contract.id]
        );

        // Create amendment record
        await db.query(
          `INSERT INTO contract_amendments
           (contract_id, amendment_type, description, old_value, new_value, effective_date, created_at)
           VALUES ($1, 'auto_renewal', 'Automatic contract renewal', $2, $3, $4, NOW())`,
          [
            contract.id,
            JSON.stringify({ end_date: contract.end_date }),
            JSON.stringify({ end_date: newEndDate }),
            today
          ]
        );

        renewed.push(contract.contract_number);
        log.info('Contract auto-renewed', { contractNumber: contract.contract_number });
      } catch (err) {
        log.error('Failed to auto-renew contract:', { contractNumber: contract.contract_number, error: err.message });
      }
    }

    return { renewed, count: renewed.length };
  } catch (error) {
    log.error('Error processing auto-renewals:', error);
    throw error;
  }
}

/**
 * Check for overdue invoices and update status
 * @returns {object[]} Overdue invoices
 */
async function checkOverdueInvoices() {
  try {
    const today = new Date();

    // Update invoices that are past due date
    await db.query(
      `UPDATE enterprise_invoices
       SET status = 'overdue', updated_at = NOW()
       WHERE status = 'sent'
         AND due_date < $1`,
      [today]
    );

    // Get all overdue invoices
    const result = await db.query(
      `SELECT ei.*, ec.contract_number, o.name as organization_name
       FROM enterprise_invoices ei
       JOIN enterprise_contracts ec ON ei.contract_id = ec.id
       JOIN organizations o ON ec.organization_id = o.id
       WHERE ei.status = 'overdue'
       ORDER BY ei.due_date ASC`
    );

    return result.rows;
  } catch (error) {
    log.error('Error checking overdue invoices:', error);
    throw error;
  }
}

/**
 * Get contract summary for an organization
 * @param {number} organizationId - Organization ID
 * @returns {object} Contract summary
 */
async function getContractSummary(organizationId) {
  try {
    const contractResult = await db.query(
      `SELECT * FROM enterprise_contracts
       WHERE organization_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [organizationId]
    );

    if (contractResult.rows.length === 0) {
      return null;
    }

    const contract = contractResult.rows[0];

    // Get invoice summary
    const invoiceResult = await db.query(
      `SELECT
         COUNT(*) as total_invoices,
         SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as total_paid,
         SUM(CASE WHEN status = 'overdue' THEN total ELSE 0 END) as total_overdue,
         COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
       FROM enterprise_invoices
       WHERE contract_id = $1`,
      [contract.id]
    );

    const invoiceSummary = invoiceResult.rows[0];

    // Calculate days until renewal
    const endDate = new Date(contract.end_date);
    const today = new Date();
    const daysUntilRenewal = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    return {
      contract,
      invoiceSummary: {
        totalInvoices: parseInt(invoiceSummary.total_invoices) || 0,
        totalPaid: parseFloat(invoiceSummary.total_paid) || 0,
        totalOverdue: parseFloat(invoiceSummary.total_overdue) || 0,
        overdueCount: parseInt(invoiceSummary.overdue_count) || 0
      },
      daysUntilRenewal,
      needsRenewal: daysUntilRenewal <= 30
    };
  } catch (error) {
    log.error('Error getting contract summary:', error);
    throw error;
  }
}

module.exports = {
  generateContract,
  calculatePricing,
  generateInvoice,
  checkRenewal,
  processAutoRenewals,
  checkOverdueInvoices,
  getContractSummary,
  generateContractNumber,
  generateInvoiceNumber,
  PRICING_TIERS
};
