/**
 * Custom Domains Routes
 * Manage custom domains for widget, API, and portal
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const sslService = require('../services/sslService');
const log = require('../utils/logger');

// Apply authentication and organization context
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

/**
 * GET /api/custom-domains
 * Get all custom domains for the organization
 */
router.get('/', async (req, res) => {
  try {
    const organizationId = req.organization.id;

    const result = await db.query(
      `SELECT id, domain, subdomain, type, status, ssl_status, ssl_expires_at,
              verification_method, verified_at, created_at, updated_at
       FROM custom_domains
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    log.error('Error fetching custom domains:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch custom domains'
    });
  }
});

/**
 * POST /api/custom-domains
 * Add a new custom domain
 */
router.post('/', async (req, res) => {
  try {
    const organizationId = req.organization.id;
    const { domain, type = 'widget', verificationMethod = 'cname' } = req.body;

    // Validation
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required'
      });
    }

    // Validate domain format
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid domain format'
      });
    }

    // Check if domain already exists
    const existingDomain = await db.query(
      'SELECT id FROM custom_domains WHERE domain = $1',
      [domain.toLowerCase()]
    );

    if (existingDomain.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This domain is already registered'
      });
    }

    // Generate verification token
    const verificationToken = sslService.generateVerificationToken();

    // Insert domain
    const result = await db.query(
      `INSERT INTO custom_domains
       (organization_id, domain, type, status, verification_token, verification_method, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, NOW(), NOW())
       RETURNING id, domain, subdomain, type, status, ssl_status, verification_token, verification_method, created_at`,
      [organizationId, domain.toLowerCase(), type, verificationToken, verificationMethod]
    );

    const newDomain = result.rows[0];

    // Get DNS records for setup
    const dnsRecords = sslService.getDNSRecords(newDomain.domain, verificationToken, verificationMethod);

    log.info('Custom domain added', { domain, organizationId });

    res.status(201).json({
      success: true,
      data: {
        ...newDomain,
        dnsRecords
      }
    });
  } catch (error) {
    log.error('Error adding custom domain:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add custom domain'
    });
  }
});

/**
 * GET /api/custom-domains/:id
 * Get domain details
 */
router.get('/:id', async (req, res) => {
  try {
    const domainId = parseInt(req.params.id);
    const organizationId = req.organization.id;

    const result = await db.query(
      `SELECT cd.*,
              (SELECT json_agg(row_to_json(dvl.*) ORDER BY dvl.created_at DESC)
               FROM domain_verification_logs dvl
               WHERE dvl.domain_id = cd.id
               LIMIT 10) as verification_logs
       FROM custom_domains cd
       WHERE cd.id = $1 AND cd.organization_id = $2`,
      [domainId, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    const domain = result.rows[0];

    // Get DNS records
    const dnsRecords = sslService.getDNSRecords(
      domain.domain,
      domain.verification_token,
      domain.verification_method
    );

    // Get SSL status
    const sslStatus = await sslService.getSSLStatus(domainId);

    res.json({
      success: true,
      data: {
        ...domain,
        dnsRecords,
        sslDetails: sslStatus
      }
    });
  } catch (error) {
    log.error('Error fetching domain details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch domain details'
    });
  }
});

/**
 * DELETE /api/custom-domains/:id
 * Remove a custom domain
 */
router.delete('/:id', async (req, res) => {
  try {
    const domainId = parseInt(req.params.id);
    const organizationId = req.organization.id;

    const result = await db.query(
      'DELETE FROM custom_domains WHERE id = $1 AND organization_id = $2 RETURNING domain',
      [domainId, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    log.info('Custom domain removed', { domain: result.rows[0].domain, organizationId });

    res.json({
      success: true,
      message: 'Domain removed successfully'
    });
  } catch (error) {
    log.error('Error removing domain:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove domain'
    });
  }
});

/**
 * POST /api/custom-domains/:id/verify
 * Trigger DNS verification
 */
router.post('/:id/verify', async (req, res) => {
  try {
    const domainId = parseInt(req.params.id);
    const organizationId = req.organization.id;

    // Get domain
    const domainResult = await db.query(
      'SELECT * FROM custom_domains WHERE id = $1 AND organization_id = $2',
      [domainId, organizationId]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    const domain = domainResult.rows[0];

    // Update status to verifying
    await db.query(
      `UPDATE custom_domains SET status = 'verifying', updated_at = NOW() WHERE id = $1`,
      [domainId]
    );

    // Verify DNS
    const verificationResult = await sslService.verifyDNS(
      domain.domain,
      domain.verification_token,
      domain.verification_method
    );

    // Also check domain routing
    const routingResult = await sslService.checkDomainRouting(domain.domain);

    // Log verification attempt
    await db.query(
      `INSERT INTO domain_verification_logs (domain_id, verification_type, success, details, created_at)
       VALUES ($1, 'dns', $2, $3, NOW())`,
      [domainId, verificationResult.success, JSON.stringify(verificationResult)]
    );

    if (verificationResult.success) {
      // Update domain status
      await db.query(
        `UPDATE custom_domains
         SET status = 'active', verified_at = NOW(), verification_error = NULL, updated_at = NOW()
         WHERE id = $1`,
        [domainId]
      );

      log.info('Domain verified successfully', { domain: domain.domain });

      res.json({
        success: true,
        data: {
          verified: true,
          routingConfigured: routingResult.success,
          message: 'Domain verified successfully'
        }
      });
    } else {
      // Update with error
      await db.query(
        `UPDATE custom_domains
         SET status = 'pending', verification_error = $1, updated_at = NOW()
         WHERE id = $2`,
        [verificationResult.error, domainId]
      );

      res.json({
        success: true,
        data: {
          verified: false,
          routingConfigured: routingResult.success,
          error: verificationResult.error,
          routingError: routingResult.error
        }
      });
    }
  } catch (error) {
    log.error('Error verifying domain:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify domain'
    });
  }
});

/**
 * POST /api/custom-domains/:id/ssl
 * Request SSL certificate
 */
router.post('/:id/ssl', async (req, res) => {
  try {
    const domainId = parseInt(req.params.id);
    const organizationId = req.organization.id;

    // Verify domain belongs to organization
    const domainResult = await db.query(
      'SELECT * FROM custom_domains WHERE id = $1 AND organization_id = $2',
      [domainId, organizationId]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    const domain = domainResult.rows[0];

    if (domain.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Domain must be verified before requesting SSL certificate'
      });
    }

    // Request certificate
    const result = await sslService.requestCertificate(domainId);

    log.info('SSL certificate requested', { domain: domain.domain });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    log.error('Error requesting SSL:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to request SSL certificate'
    });
  }
});

/**
 * GET /api/custom-domains/:id/dns-records
 * Get required DNS records for domain setup
 */
router.get('/:id/dns-records', async (req, res) => {
  try {
    const domainId = parseInt(req.params.id);
    const organizationId = req.organization.id;

    const result = await db.query(
      'SELECT domain, verification_token, verification_method FROM custom_domains WHERE id = $1 AND organization_id = $2',
      [domainId, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    const domain = result.rows[0];
    const dnsRecords = sslService.getDNSRecords(
      domain.domain,
      domain.verification_token,
      domain.verification_method
    );

    res.json({
      success: true,
      data: {
        domain: domain.domain,
        records: dnsRecords
      }
    });
  } catch (error) {
    log.error('Error fetching DNS records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch DNS records'
    });
  }
});

/**
 * PUT /api/custom-domains/:id
 * Update domain settings
 */
router.put('/:id', async (req, res) => {
  try {
    const domainId = parseInt(req.params.id);
    const organizationId = req.organization.id;
    const { type, settings } = req.body;

    // Verify domain belongs to organization
    const checkResult = await db.query(
      'SELECT id FROM custom_domains WHERE id = $1 AND organization_id = $2',
      [domainId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    // Build update
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (type) {
      updates.push(`type = $${paramCount++}`);
      values.push(type);
    }

    if (settings) {
      updates.push(`settings = $${paramCount++}`);
      values.push(JSON.stringify(settings));
    }

    updates.push('updated_at = NOW()');
    values.push(domainId);

    const result = await db.query(
      `UPDATE custom_domains SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Error updating domain:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update domain'
    });
  }
});

module.exports = router;
