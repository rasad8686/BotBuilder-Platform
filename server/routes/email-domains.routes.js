/**
 * @fileoverview Email Domain Verification API Routes
 * @description Handles domain verification with DKIM/SPF/DMARC
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const emailDomainService = require('../services/email-domain.service');
const log = require('../utils/logger');

/**
 * Middleware to get organization ID from user
 */
const getOrganizationId = async (req, res, next) => {
  try {
    const orgId = req.user?.organization_id || req.user?.org_id || req.user?.current_organization_id;

    if (!orgId) {
      // Try to get from default organization
      const db = require('../config/db');
      const org = await db('organizations').first();
      if (org) {
        req.organizationId = org.id;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Organization not found'
        });
      }
    } else {
      req.organizationId = orgId;
    }

    next();
  } catch (error) {
    log.error('Get organization ID error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get organization'
    });
  }
};

// ==========================================
// DOMAIN MANAGEMENT
// ==========================================

/**
 * GET /api/email-domains
 * List all domains for organization
 */
router.get('/', auth, getOrganizationId, async (req, res) => {
  try {
    const domains = await emailDomainService.getDomains(req.organizationId);

    res.json({
      success: true,
      domains
    });
  } catch (error) {
    log.error('Get domains error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get domains'
    });
  }
});

/**
 * POST /api/email-domains
 * Add a new domain for verification
 */
router.post('/', auth, getOrganizationId, async (req, res) => {
  try {
    const { domain, subdomain, provider, isDefault } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required'
      });
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid domain format'
      });
    }

    const result = await emailDomainService.addDomain(req.organizationId, domain, {
      subdomain,
      provider,
      isDefault,
      workspaceId: req.body.workspaceId
    });

    res.status(201).json({
      success: true,
      domain: result,
      message: 'Domain added. Please add the DNS records to verify.'
    });
  } catch (error) {
    log.error('Add domain error', { error: error.message });

    if (error.message === 'Domain already exists') {
      return res.status(409).json({
        success: false,
        message: 'Domain already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add domain'
    });
  }
});

/**
 * GET /api/email-domains/:id
 * Get domain by ID
 */
router.get('/:id', auth, getOrganizationId, async (req, res) => {
  try {
    const domain = await emailDomainService.getDomain(req.params.id, req.organizationId);

    if (!domain) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    res.json({
      success: true,
      domain
    });
  } catch (error) {
    log.error('Get domain error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get domain'
    });
  }
});

/**
 * DELETE /api/email-domains/:id
 * Delete domain
 */
router.delete('/:id', auth, getOrganizationId, async (req, res) => {
  try {
    const deleted = await emailDomainService.deleteDomain(req.params.id, req.organizationId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    res.json({
      success: true,
      message: 'Domain deleted successfully'
    });
  } catch (error) {
    log.error('Delete domain error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete domain'
    });
  }
});

// ==========================================
// VERIFICATION
// ==========================================

/**
 * POST /api/email-domains/:id/verify
 * Verify domain DNS records
 */
router.post('/:id/verify', auth, getOrganizationId, async (req, res) => {
  try {
    const result = await emailDomainService.verifyDomain(req.params.id);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Verify domain error', { error: error.message });

    if (error.message === 'Domain not found') {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify domain'
    });
  }
});

/**
 * GET /api/email-domains/:id/dns-records
 * Get DNS records required for verification
 */
router.get('/:id/dns-records', auth, getOrganizationId, async (req, res) => {
  try {
    const records = await emailDomainService.getDNSRecords(req.params.id, req.organizationId);

    res.json({
      success: true,
      records
    });
  } catch (error) {
    log.error('Get DNS records error', { error: error.message });

    if (error.message === 'Domain not found') {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to get DNS records'
    });
  }
});

/**
 * POST /api/email-domains/:id/check-dns
 * Check specific DNS record
 */
router.post('/:id/check-dns', auth, getOrganizationId, async (req, res) => {
  try {
    const { type } = req.body; // dkim, spf, dmarc, mx

    const domain = await emailDomainService.getDomain(req.params.id, req.organizationId);
    if (!domain) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    let result;
    switch (type) {
      case 'dkim':
        result = await emailDomainService.checkDKIM(domain.domain, domain.dkim_selector, domain.dkim_public_key);
        break;
      case 'spf':
        result = await emailDomainService.checkSPF(domain.domain);
        break;
      case 'dmarc':
        result = await emailDomainService.checkDMARC(domain.domain);
        break;
      case 'mx':
        result = await emailDomainService.checkMX(domain.domain);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid DNS type. Use: dkim, spf, dmarc, or mx'
        });
    }

    res.json({
      success: true,
      type,
      ...result
    });
  } catch (error) {
    log.error('Check DNS error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check DNS'
    });
  }
});

// ==========================================
// DEFAULT DOMAIN
// ==========================================

/**
 * POST /api/email-domains/:id/set-default
 * Set domain as default
 */
router.post('/:id/set-default', auth, getOrganizationId, async (req, res) => {
  try {
    const domain = await emailDomainService.setDefaultDomain(req.params.id, req.organizationId);

    if (!domain) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    res.json({
      success: true,
      domain,
      message: 'Default domain updated'
    });
  } catch (error) {
    log.error('Set default domain error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to set default domain'
    });
  }
});

/**
 * GET /api/email-domains/default
 * Get default domain
 */
router.get('/default/current', auth, getOrganizationId, async (req, res) => {
  try {
    const domain = await emailDomainService.getDefaultDomain(req.organizationId);

    res.json({
      success: true,
      domain
    });
  } catch (error) {
    log.error('Get default domain error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get default domain'
    });
  }
});

// ==========================================
// VALIDATION
// ==========================================

/**
 * POST /api/email-domains/validate-sender
 * Validate sender email against verified domains
 */
router.post('/validate-sender', auth, getOrganizationId, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const result = await emailDomainService.validateSenderEmail(email, req.organizationId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Validate sender error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to validate sender'
    });
  }
});

// ==========================================
// PROVIDER SYNC
// ==========================================

/**
 * POST /api/email-domains/:id/sync-provider
 * Sync domain with email provider
 */
router.post('/:id/sync-provider', auth, getOrganizationId, async (req, res) => {
  try {
    const domain = await emailDomainService.getDomain(req.params.id, req.organizationId);

    if (!domain) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    if (domain.provider === 'smtp') {
      return res.json({
        success: true,
        message: 'SMTP provider does not require sync'
      });
    }

    // Re-register with provider
    await emailDomainService.registerWithProvider(domain);

    // Refresh domain data
    const updatedDomain = await emailDomainService.getDomain(req.params.id, req.organizationId);

    res.json({
      success: true,
      domain: updatedDomain,
      message: 'Domain synced with provider'
    });
  } catch (error) {
    log.error('Sync provider error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync with provider'
    });
  }
});

/**
 * GET /api/email-domains/:id/provider-status
 * Get domain status from provider
 */
router.get('/:id/provider-status', auth, getOrganizationId, async (req, res) => {
  try {
    const domain = await emailDomainService.getDomain(req.params.id, req.organizationId);

    if (!domain) {
      return res.status(404).json({
        success: false,
        message: 'Domain not found'
      });
    }

    if (domain.provider === 'smtp') {
      return res.json({
        success: true,
        provider: 'smtp',
        status: domain.status,
        message: 'SMTP provider - local verification only'
      });
    }

    const status = await emailDomainService.verifyWithProvider(domain);

    res.json({
      success: true,
      provider: domain.provider,
      providerStatus: status
    });
  } catch (error) {
    log.error('Get provider status error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get provider status'
    });
  }
});

// ==========================================
// BULK OPERATIONS
// ==========================================

/**
 * POST /api/email-domains/verify-all
 * Verify all pending domains
 */
router.post('/verify-all', auth, getOrganizationId, async (req, res) => {
  try {
    const domains = await emailDomainService.getDomains(req.organizationId);
    const pendingDomains = domains.filter(d => d.status !== 'verified');

    const results = [];
    for (const domain of pendingDomains) {
      try {
        const result = await emailDomainService.verifyDomain(domain.id);
        results.push({ domain: domain.domain, ...result });
      } catch (error) {
        results.push({ domain: domain.domain, error: error.message });
      }
    }

    res.json({
      success: true,
      total: pendingDomains.length,
      results
    });
  } catch (error) {
    log.error('Verify all domains error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to verify domains'
    });
  }
});

module.exports = router;
