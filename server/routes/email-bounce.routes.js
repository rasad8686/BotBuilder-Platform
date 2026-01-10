/**
 * Email Bounce Management API Routes
 * Handles bounce statistics, blacklist management, and contact reactivation
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const emailBounceService = require('../services/email-bounce.service');
const log = require('../utils/logger');
const db = require('../config/db');

/**
 * Middleware to get workspace ID from user
 */
const getWorkspaceId = async (req, res, next) => {
  try {
    let workspaceId = req.query.workspace_id || req.body.workspace_id || req.user?.workspace_id;

    if (!workspaceId && req.user) {
      const orgId = req.user.organization_id || req.user.org_id || req.user.current_organization_id;
      if (orgId) {
        let workspace = await db('workspaces').where('organization_id', orgId).first();
        if (!workspace) {
          [workspace] = await db('workspaces').insert({
            name: 'Default Workspace',
            organization_id: orgId,
            created_at: new Date()
          }).returning('*');
        }
        workspaceId = workspace.id;
      }
    }

    if (!workspaceId) {
      let workspace = await db('workspaces').first();
      if (!workspace) {
        [workspace] = await db('workspaces').insert({
          name: 'Default Workspace',
          created_at: new Date()
        }).returning('*');
      }
      workspaceId = workspace.id;
    }

    req.workspaceId = workspaceId;
    next();
  } catch (error) {
    log.error('Get workspace ID error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get workspace' });
  }
};

// ==================== BOUNCES ====================

/**
 * GET /api/email/bounces
 * List all bounce events
 */
router.get('/', auth, getWorkspaceId, async (req, res) => {
  try {
    const { page, limit, type, start_date, end_date, search, sort_by, sort_order } = req.query;

    const result = await emailBounceService.getBouncedEmails(req.workspaceId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      type,
      startDate: start_date,
      endDate: end_date,
      search,
      sortBy: sort_by || 'bounced_at',
      sortOrder: sort_order || 'desc'
    });

    res.json({ success: true, ...result });
  } catch (error) {
    log.error('Get bounces error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bounces' });
  }
});

/**
 * GET /api/email/bounces/statistics
 * Get bounce statistics
 */
router.get('/statistics', auth, getWorkspaceId, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const statistics = await emailBounceService.getBounceStatistics(req.workspaceId, {
      startDate: start_date,
      endDate: end_date
    });

    res.json({ success: true, statistics });
  } catch (error) {
    log.error('Get bounce statistics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
});

// ==================== BLACKLIST ====================

/**
 * GET /api/email/bounces/blacklist
 * List blacklisted emails
 */
router.get('/blacklist', auth, getWorkspaceId, async (req, res) => {
  try {
    const { page, limit, reason, search, sort_by, sort_order } = req.query;

    const result = await emailBounceService.getBlacklistedEmails(req.workspaceId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      reason,
      search,
      sortBy: sort_by || 'blacklisted_at',
      sortOrder: sort_order || 'desc'
    });

    res.json({ success: true, ...result });
  } catch (error) {
    log.error('Get blacklist error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blacklist' });
  }
});

/**
 * POST /api/email/bounces/blacklist
 * Add email to blacklist
 */
router.post('/blacklist', auth, getWorkspaceId, async (req, res) => {
  try {
    const { email, reason, details } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const entry = await emailBounceService.addToBlacklist(
      email,
      req.workspaceId,
      reason || 'manual',
      details || 'Manually added',
      req.user?.id
    );

    res.json({ success: true, blacklistEntry: entry });
  } catch (error) {
    log.error('Add to blacklist error:', error);
    res.status(500).json({ success: false, message: 'Failed to add to blacklist' });
  }
});

/**
 * POST /api/email/bounces/blacklist/bulk
 * Add multiple emails to blacklist
 */
router.post('/blacklist/bulk', auth, getWorkspaceId, async (req, res) => {
  try {
    const { emails, reason } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, message: 'Emails array is required' });
    }

    const result = await emailBounceService.bulkAddToBlacklist(
      emails,
      req.workspaceId,
      reason || 'manual',
      req.user?.id
    );

    res.json({
      success: true,
      added: result.added.length,
      skipped: result.skipped.length,
      details: result
    });
  } catch (error) {
    log.error('Bulk add to blacklist error:', error);
    res.status(500).json({ success: false, message: 'Failed to add to blacklist' });
  }
});

/**
 * DELETE /api/email/bounces/blacklist/:email
 * Remove email from blacklist
 */
router.delete('/blacklist/:email', auth, getWorkspaceId, async (req, res) => {
  try {
    const { email } = req.params;

    const result = await emailBounceService.removeFromBlacklist(email, req.workspaceId);

    res.json({ success: true, ...result });
  } catch (error) {
    log.error('Remove from blacklist error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove from blacklist' });
  }
});

/**
 * POST /api/email/bounces/blacklist/check
 * Check if emails are blacklisted
 */
router.post('/blacklist/check', auth, getWorkspaceId, async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({ success: false, message: 'Emails array is required' });
    }

    const result = await emailBounceService.checkBlacklist(emails, req.workspaceId);

    res.json({ success: true, ...result });
  } catch (error) {
    log.error('Check blacklist error:', error);
    res.status(500).json({ success: false, message: 'Failed to check blacklist' });
  }
});

// ==================== COMPLAINTS ====================

/**
 * GET /api/email/bounces/complaints
 * List complaints
 */
router.get('/complaints', auth, getWorkspaceId, async (req, res) => {
  try {
    const { page, limit, start_date, end_date, sort_by, sort_order } = req.query;

    const result = await emailBounceService.getComplaints(req.workspaceId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      startDate: start_date,
      endDate: end_date,
      sortBy: sort_by || 'complained_at',
      sortOrder: sort_order || 'desc'
    });

    res.json({ success: true, ...result });
  } catch (error) {
    log.error('Get complaints error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

// ==================== CONTACT MANAGEMENT ====================

/**
 * POST /api/email/bounces/contacts/:id/reactivate
 * Reactivate a bounced contact
 */
router.post('/contacts/:id/reactivate', auth, getWorkspaceId, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await emailBounceService.reactivateContact(id, req.workspaceId);

    res.json({ success: true, ...result });
  } catch (error) {
    log.error('Reactivate contact error:', error);

    if (error.message === 'Contact not found') {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    res.status(500).json({ success: false, message: 'Failed to reactivate contact' });
  }
});

/**
 * GET /api/email/bounces/contacts/bounced
 * List bounced contacts
 */
router.get('/contacts/bounced', auth, getWorkspaceId, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, sort_by, sort_order } = req.query;

    let query = db('email_contacts')
      .where({
        workspace_id: req.workspaceId,
        status: 'bounced'
      });

    if (search) {
      query = query.where(function() {
        this.where('email', 'ilike', `%${search}%`)
          .orWhere('first_name', 'ilike', `%${search}%`)
          .orWhere('last_name', 'ilike', `%${search}%`);
      });
    }

    const countResult = await query.clone().count('* as total').first();
    const total = parseInt(countResult.total);

    const contacts = await query
      .orderBy(sort_by || 'updated_at', sort_order || 'desc')
      .limit(parseInt(limit))
      .offset((parseInt(page) - 1) * parseInt(limit));

    res.json({
      success: true,
      contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    log.error('Get bounced contacts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bounced contacts' });
  }
});

// ==================== CLEANUP ====================

/**
 * POST /api/email/bounces/cleanup-soft-bounces
 * Clean up old soft bounce records
 */
router.post('/cleanup-soft-bounces', auth, async (req, res) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const result = await emailBounceService.cleanupSoftBounces();

    res.json({ success: true, ...result });
  } catch (error) {
    log.error('Cleanup soft bounces error:', error);
    res.status(500).json({ success: false, message: 'Failed to cleanup soft bounces' });
  }
});

module.exports = router;
