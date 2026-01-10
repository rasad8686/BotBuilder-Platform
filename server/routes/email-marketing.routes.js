/**
 * Email Marketing API Routes
 * Handles all endpoints for email marketing system
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const emailMarketingService = require('../services/email-marketing.service');
const emailSenderService = require('../services/email-sender.service');
const log = require('../utils/logger');
const multer = require('multer');
const csv = require('csv-parse/sync');

// Configure multer for CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * Middleware to get workspace ID from user
 */
const getWorkspaceId = async (req, res, next) => {
  try {
    const db = require('../config/db');
    let workspaceId = req.query.workspace_id || req.body.workspace_id || req.user?.workspace_id;

    if (!workspaceId && req.user) {
      // Try to get workspace from organization
      const orgId = req.user.organization_id || req.user.org_id || req.user.current_organization_id;
      if (orgId) {
        // Check if workspace exists for this org, if not create one
        let workspace = await db('workspaces').where('organization_id', orgId).first();
        if (!workspace) {
          // Create workspace for organization
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
      // Fallback: get or create default workspace
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
    res.status(500).json({
      success: false,
      message: 'Failed to get workspace'
    });
  }
};

// ==================== CONTACTS ====================

/**
 * GET /api/email/contacts
 * List contacts with filtering and pagination
 */
router.get('/contacts', auth, getWorkspaceId, async (req, res) => {
  try {
    const { page, limit, status, tags, search, source, sortBy, sortOrder } = req.query;

    const result = await emailMarketingService.getContacts(req.workspaceId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      status,
      tags: tags ? tags.split(',') : undefined,
      search,
      source,
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Get contacts error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get contacts'
    });
  }
});

/**
 * POST /api/email/contacts
 * Create a new contact
 */
router.post('/contacts', auth, getWorkspaceId, async (req, res) => {
  try {
    const { email, first_name, last_name, phone, company, job_title, status, source, tags, custom_fields } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if contact already exists
    const existing = await emailMarketingService.getContactByEmail(email, req.workspaceId);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Contact with this email already exists'
      });
    }

    const contact = await emailMarketingService.createContact(req.workspaceId, {
      email,
      first_name,
      last_name,
      phone,
      company,
      job_title,
      status,
      source,
      tags,
      custom_fields
    });

    res.status(201).json({
      success: true,
      contact
    });
  } catch (error) {
    log.error('Create contact error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create contact'
    });
  }
});

/**
 * GET /api/email/contacts/tags
 * Get all unique tags from contacts
 */
router.get('/contacts/tags', auth, getWorkspaceId, async (req, res) => {
  try {
    const db = require('../config/db');
    const result = await db('email_contacts')
      .where('workspace_id', req.workspaceId)
      .select(db.raw('DISTINCT unnest(tags) as tag'))
      .orderBy('tag');

    const tags = result.map(r => r.tag).filter(Boolean);

    res.json({
      success: true,
      tags
    });
  } catch (error) {
    log.error('Get contact tags error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get contact tags'
    });
  }
});

/**
 * GET /api/email/contacts/:id
 * Get contact by ID
 */
router.get('/contacts/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const contact = await emailMarketingService.getContactById(req.params.id, req.workspaceId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.json({
      success: true,
      contact
    });
  } catch (error) {
    log.error('Get contact error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get contact'
    });
  }
});

/**
 * PUT /api/email/contacts/:id
 * Update contact
 */
router.put('/contacts/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const contact = await emailMarketingService.updateContact(req.params.id, req.workspaceId, req.body);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.json({
      success: true,
      contact
    });
  } catch (error) {
    log.error('Update contact error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update contact'
    });
  }
});

/**
 * DELETE /api/email/contacts/:id
 * Delete contact
 */
router.delete('/contacts/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const deleted = await emailMarketingService.deleteContact(req.params.id, req.workspaceId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    log.error('Delete contact error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact'
    });
  }
});

/**
 * POST /api/email/contacts/import
 * Bulk import contacts from CSV
 */
router.post('/contacts/import', auth, getWorkspaceId, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required'
      });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const contacts = records.map(record => ({
      email: record.email || record.Email,
      first_name: record.first_name || record.firstName || record['First Name'],
      last_name: record.last_name || record.lastName || record['Last Name'],
      phone: record.phone || record.Phone,
      company: record.company || record.Company,
      job_title: record.job_title || record.jobTitle || record['Job Title'],
      source: 'import',
      tags: record.tags ? record.tags.split(';') : []
    })).filter(c => c.email);

    const result = await emailMarketingService.bulkCreateContacts(req.workspaceId, contacts);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Import contacts error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to import contacts'
    });
  }
});

/**
 * POST /api/email/contacts/export
 * Export contacts to CSV
 */
router.post('/contacts/export', auth, getWorkspaceId, async (req, res) => {
  try {
    const { status, tags } = req.body;

    const result = await emailMarketingService.getContacts(req.workspaceId, {
      status,
      tags,
      limit: 10000 // Max export
    });

    const csvRows = ['email,first_name,last_name,phone,company,job_title,status,tags'];

    for (const contact of result.contacts) {
      csvRows.push([
        contact.email,
        contact.first_name || '',
        contact.last_name || '',
        contact.phone || '',
        contact.company || '',
        contact.job_title || '',
        contact.status,
        (contact.tags || []).join(';')
      ].map(v => `"${v.replace(/"/g, '""')}"`).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
    res.send(csvRows.join('\n'));
  } catch (error) {
    log.error('Export contacts error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to export contacts'
    });
  }
});

/**
 * POST /api/email/contacts/bulk-update
 * Bulk update contacts
 */
router.post('/contacts/bulk-update', auth, getWorkspaceId, async (req, res) => {
  try {
    const { contactIds, data } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Contact IDs are required'
      });
    }

    const result = await emailMarketingService.bulkUpdateContacts(req.workspaceId, contactIds, data);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Bulk update contacts error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update contacts'
    });
  }
});

/**
 * POST /api/email/contacts/bulk-delete
 * Bulk delete contacts
 */
router.post('/contacts/bulk-delete', auth, getWorkspaceId, async (req, res) => {
  try {
    const { contactIds } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Contact IDs are required'
      });
    }

    const result = await emailMarketingService.bulkDeleteContacts(req.workspaceId, contactIds);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Bulk delete contacts error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete contacts'
    });
  }
});

/**
 * POST /api/email/contacts/bulk-tag
 * Add/remove tags from multiple contacts
 */
router.post('/contacts/bulk-tag', auth, getWorkspaceId, async (req, res) => {
  try {
    const { contactIds, tags, action } = req.body;

    if (!contactIds || !tags || !action) {
      return res.status(400).json({
        success: false,
        message: 'Contact IDs, tags, and action are required'
      });
    }

    let result;
    if (action === 'add') {
      result = await emailMarketingService.addTagsToContacts(req.workspaceId, contactIds, tags);
    } else if (action === 'remove') {
      result = await emailMarketingService.removeTagsFromContacts(req.workspaceId, contactIds, tags);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Action must be "add" or "remove"'
      });
    }

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Bulk tag contacts error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update contact tags'
    });
  }
});

// ==================== LISTS ====================

/**
 * GET /api/email/lists
 * Get all lists
 */
router.get('/lists', auth, getWorkspaceId, async (req, res) => {
  try {
    const lists = await emailMarketingService.getLists(req.workspaceId);

    res.json({
      success: true,
      lists
    });
  } catch (error) {
    log.error('Get lists error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get lists'
    });
  }
});

/**
 * POST /api/email/lists
 * Create a new list
 */
router.post('/lists', auth, getWorkspaceId, async (req, res) => {
  try {
    const { name, description, type, dynamic_rules } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    const list = await emailMarketingService.createList(req.workspaceId, {
      name,
      description,
      type,
      dynamic_rules
    });

    res.status(201).json({
      success: true,
      list
    });
  } catch (error) {
    log.error('Create list error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create list'
    });
  }
});

/**
 * GET /api/email/lists/:id
 * Get list by ID
 */
router.get('/lists/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const list = await emailMarketingService.getListById(req.params.id, req.workspaceId);

    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }

    res.json({
      success: true,
      list
    });
  } catch (error) {
    log.error('Get list error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get list'
    });
  }
});

/**
 * PUT /api/email/lists/:id
 * Update list
 */
router.put('/lists/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const list = await emailMarketingService.updateList(req.params.id, req.workspaceId, req.body);

    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }

    res.json({
      success: true,
      list
    });
  } catch (error) {
    log.error('Update list error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update list'
    });
  }
});

/**
 * DELETE /api/email/lists/:id
 * Delete list
 */
router.delete('/lists/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const deleted = await emailMarketingService.deleteList(req.params.id, req.workspaceId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }

    res.json({
      success: true,
      message: 'List deleted successfully'
    });
  } catch (error) {
    log.error('Delete list error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete list'
    });
  }
});

/**
 * GET /api/email/lists/:id/contacts
 * Get contacts in a list
 */
router.get('/lists/:id/contacts', auth, getWorkspaceId, async (req, res) => {
  try {
    const { page, limit } = req.query;

    const result = await emailMarketingService.getListContacts(req.params.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Get list contacts error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get list contacts'
    });
  }
});

/**
 * POST /api/email/lists/:id/contacts
 * Add contacts to a list
 */
router.post('/lists/:id/contacts', auth, getWorkspaceId, async (req, res) => {
  try {
    const { contactIds } = req.body;

    if (!contactIds || !Array.isArray(contactIds)) {
      return res.status(400).json({
        success: false,
        message: 'Contact IDs are required'
      });
    }

    const result = await emailMarketingService.addContactsToList(req.params.id, contactIds);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Add contacts to list error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to add contacts to list'
    });
  }
});

/**
 * DELETE /api/email/lists/:id/contacts
 * Remove contacts from a list
 */
router.delete('/lists/:id/contacts', auth, getWorkspaceId, async (req, res) => {
  try {
    const { contactIds } = req.body;

    if (!contactIds || !Array.isArray(contactIds)) {
      return res.status(400).json({
        success: false,
        message: 'Contact IDs are required'
      });
    }

    const result = await emailMarketingService.removeContactsFromList(req.params.id, contactIds);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Remove contacts from list error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to remove contacts from list'
    });
  }
});

/**
 * POST /api/email/lists/:id/refresh
 * Refresh dynamic list
 */
router.post('/lists/:id/refresh', auth, getWorkspaceId, async (req, res) => {
  try {
    const result = await emailMarketingService.refreshDynamicList(req.params.id);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Refresh list error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to refresh list'
    });
  }
});

// ==================== TEMPLATES ====================

/**
 * GET /api/email/templates
 * Get all templates
 */
router.get('/templates', auth, getWorkspaceId, async (req, res) => {
  try {
    const { category } = req.query;

    const templates = await emailMarketingService.getTemplates(req.workspaceId, category);

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    log.error('Get templates error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get templates'
    });
  }
});

/**
 * GET /api/email/templates/system
 * Get system (pre-built) templates
 */
router.get('/templates/system', auth, async (req, res) => {
  try {
    const templates = emailMarketingService.getSystemTemplates();

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    log.error('Get system templates error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get system templates'
    });
  }
});

/**
 * POST /api/email/templates
 * Create a new template
 */
router.post('/templates', auth, getWorkspaceId, async (req, res) => {
  try {
    const { name, description, subject, preview_text, content_html, content_json, thumbnail_url, category } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    const template = await emailMarketingService.createTemplate(req.workspaceId, {
      name,
      description,
      subject,
      preview_text,
      content_html,
      content_json,
      thumbnail_url,
      category
    }, req.user.id);

    res.status(201).json({
      success: true,
      template
    });
  } catch (error) {
    log.error('Create template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create template'
    });
  }
});

/**
 * GET /api/email/templates/:id
 * Get template by ID
 */
router.get('/templates/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const template = await emailMarketingService.getTemplateById(req.params.id, req.workspaceId);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    log.error('Get template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get template'
    });
  }
});

/**
 * PUT /api/email/templates/:id
 * Update template
 */
router.put('/templates/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const template = await emailMarketingService.updateTemplate(req.params.id, req.workspaceId, req.body);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    log.error('Update template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update template'
    });
  }
});

/**
 * DELETE /api/email/templates/:id
 * Delete template
 */
router.delete('/templates/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const deleted = await emailMarketingService.deleteTemplate(req.params.id, req.workspaceId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    log.error('Delete template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete template'
    });
  }
});

/**
 * POST /api/email/templates/:id/duplicate
 * Duplicate template
 */
router.post('/templates/:id/duplicate', auth, getWorkspaceId, async (req, res) => {
  try {
    const templateId = req.params.id;

    // Handle system templates (non-UUID IDs)
    if (templateId.startsWith('system-')) {
      // Extract template type and create generic template
      const parts = templateId.replace('system-', '').split('-');
      const category = parts[0] || 'marketing';
      const name = category.charAt(0).toUpperCase() + category.slice(1) + ' Template';

      const newTemplate = await emailMarketingService.createTemplate(req.workspaceId, {
        name: `${name} (Copy)`,
        subject: `${name} Subject`,
        category: category,
        content_html: `<h1>${name}</h1><p>Your content here...</p>`,
        content_json: {}
      });

      return res.status(201).json({
        success: true,
        template: newTemplate
      });
    }

    const template = await emailMarketingService.duplicateTemplate(templateId, req.workspaceId);

    res.status(201).json({
      success: true,
      template
    });
  } catch (error) {
    log.error('Duplicate template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to duplicate template'
    });
  }
});

/**
 * POST /api/email/templates/:id/test-send
 * Send test email with template
 */
router.post('/templates/:id/test-send', auth, getWorkspaceId, async (req, res) => {
  try {
    const { email, blocks, subject, previewText } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }

    // Get template
    let template = await emailMarketingService.getTemplateById(req.params.id, req.workspaceId);

    // If not found, check system templates
    if (!template) {
      template = emailMarketingService.getSystemTemplateById(req.params.id);
    }

    // Build email content
    const templateBlocks = blocks || template?.content_json?.blocks || [];
    const templateSubject = subject || template?.subject || 'Test Email';

    // Render blocks to HTML
    const emailRenderer = require('../services/email-renderer.service');
    const html = emailRenderer.renderToHTML({
      blocks: templateBlocks,
      settings: { subject: templateSubject, previewText: previewText || '' }
    });

    // Replace with test variables
    const testVariables = {
      first_name: 'Test',
      last_name: 'User',
      company_name: 'Test Company',
      company_address: '123 Test Street, Test City',
      logo_url: 'https://via.placeholder.com/150x50',
      app_url: 'https://example.com'
    };

    const finalHtml = emailRenderer.replaceVariables(html, testVariables);

    // Send test email
    await emailSenderService.send({
      to: email,
      subject: `[TEST] ${templateSubject}`,
      html: finalHtml
    });

    res.json({
      success: true,
      message: `Test email sent to ${email}`
    });
  } catch (error) {
    log.error('Test send template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to send test email'
    });
  }
});

/**
 * POST /api/email/templates/:id/render
 * Render template to HTML
 */
router.post('/templates/:id/render', auth, getWorkspaceId, async (req, res) => {
  try {
    const { variables = {}, blocks } = req.body;

    // Get template
    let template = await emailMarketingService.getTemplateById(req.params.id, req.workspaceId);

    // If not found, check system templates
    if (!template) {
      template = emailMarketingService.getSystemTemplateById(req.params.id);
    }

    if (!template && !blocks) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Build email content
    const templateBlocks = blocks || template?.content_json?.blocks || [];

    // Render blocks to HTML
    const emailRenderer = require('../services/email-renderer.service');
    const html = emailRenderer.renderToHTML({
      blocks: templateBlocks,
      settings: { subject: template?.subject || '', previewText: template?.preview_text || '' }
    });
    const plainText = emailRenderer.renderToPlainText({
      blocks: templateBlocks
    });

    // Replace variables
    const finalHtml = emailRenderer.replaceVariables(html, variables);
    const finalPlainText = emailRenderer.replaceVariables(plainText, variables);

    res.json({
      success: true,
      html: finalHtml,
      plainText: finalPlainText
    });
  } catch (error) {
    log.error('Render template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to render template'
    });
  }
});

/**
 * POST /api/email/upload-image
 * Upload image for email
 */
router.post('/upload-image', auth, upload.single('image'), async (req, res) => {
  try {
    // In production, handle file upload to S3 or similar
    // For now, return a placeholder
    res.json({
      success: true,
      url: 'https://via.placeholder.com/600x400',
      message: 'Image upload endpoint - implement with your storage solution'
    });
  } catch (error) {
    log.error('Upload image error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to upload image'
    });
  }
});

// ==================== CAMPAIGNS ====================

/**
 * GET /api/email/campaigns
 * Get all campaigns
 */
router.get('/campaigns', auth, getWorkspaceId, async (req, res) => {
  try {
    const { page, limit, status, type } = req.query;

    const result = await emailMarketingService.getCampaigns(req.workspaceId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status,
      type
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Get campaigns error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get campaigns'
    });
  }
});

/**
 * POST /api/email/campaigns
 * Create a new campaign
 */
router.post('/campaigns', auth, getWorkspaceId, async (req, res) => {
  try {
    const campaign = await emailMarketingService.createCampaign(req.workspaceId, req.body, req.user.id);

    res.status(201).json({
      success: true,
      campaign
    });
  } catch (error) {
    log.error('Create campaign error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create campaign'
    });
  }
});

/**
 * GET /api/email/campaigns/:id
 * Get campaign by ID
 */
router.get('/campaigns/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const campaign = await emailMarketingService.getCampaignById(req.params.id, req.workspaceId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      campaign
    });
  } catch (error) {
    log.error('Get campaign error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get campaign'
    });
  }
});

/**
 * GET /api/email/campaigns/:id/report
 * Get detailed campaign report
 */
router.get('/campaigns/:id/report', auth, getWorkspaceId, async (req, res) => {
  try {
    const campaignId = req.params.id;

    // Handle demo campaigns (both string and numeric IDs)
    const demoData = {
      'demo-campaign-1': { name: 'Welcome Series', sent: 1250, opened: 565, clicked: 156 },
      'demo-campaign-2': { name: 'Newsletter #42', sent: 3400, opened: 1316, clicked: 282 },
      'demo-campaign-3': { name: 'Product Launch', sent: 2100, opened: 1094, clicked: 397 },
      'demo-campaign-4': { name: 'Re-engagement', sent: 890, opened: 253, clicked: 55 },
      'demo-campaign-5': { name: 'Holiday Sale', sent: 4500, opened: 1859, clicked: 707 },
      '1': { name: 'Welcome Series', sent: 1250, opened: 565, clicked: 156 },
      '2': { name: 'Newsletter #42', sent: 3400, opened: 1316, clicked: 282 },
      '3': { name: 'Product Launch', sent: 2100, opened: 1094, clicked: 397 },
      '4': { name: 'Re-engagement', sent: 890, opened: 253, clicked: 55 },
      '5': { name: 'Holiday Sale', sent: 4500, opened: 1859, clicked: 707 },
      '6': { name: 'Weekly Digest', sent: 2800, opened: 1120, clicked: 336 },
      '7': { name: 'Feature Update', sent: 1950, opened: 780, clicked: 195 },
      '8': { name: 'Customer Survey', sent: 1500, opened: 525, clicked: 105 },
      '9': { name: 'Anniversary Sale', sent: 5200, opened: 2340, clicked: 832 },
      '10': { name: 'New Year Promo', sent: 6100, opened: 2684, clicked: 976 }
    };

    const demo = demoData[campaignId];
    if (demo) {
      return res.json({
        success: true,
        report: {
          campaign: { id: campaignId, name: demo.name, subject: `${demo.name} - Check this out!`, status: 'sent', sentAt: new Date().toISOString() },
          metrics: { sent: demo.sent, delivered: Math.floor(demo.sent * 0.98), opened: demo.opened, clicked: demo.clicked, bounced: Math.floor(demo.sent * 0.02), unsubscribed: Math.floor(demo.sent * 0.005), complained: 0, openRate: ((demo.opened / demo.sent) * 100).toFixed(1), clickRate: ((demo.clicked / demo.sent) * 100).toFixed(1), bounceRate: '2.0' },
          timeline: [{ time: '09:00', event: 'Campaign sent', count: demo.sent }],
          devices: { mobile: 54, desktop: 38, tablet: 8 },
          emailClients: [{ name: 'Gmail', percentage: 42 }, { name: 'Apple Mail', percentage: 28 }, { name: 'Outlook', percentage: 18 }, { name: 'Other', percentage: 12 }],
          linkClicks: [{ url: 'https://example.com/cta', clicks: Math.floor(demo.clicked * 0.6), label: 'Main CTA' }]
        }
      });
    }

    // Get campaign details
    const campaign = await emailMarketingService.getCampaignById(campaignId, req.workspaceId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Get campaign analytics
    const analytics = await emailMarketingService.getCampaignAnalytics(campaignId);

    // Generate mock timeline data for now
    const timeline = [
      { time: '2024-01-15 09:00', event: 'Campaign sent', count: analytics?.sent || 0 },
      { time: '2024-01-15 09:15', event: 'First opens', count: Math.floor((analytics?.opened || 0) * 0.1) },
      { time: '2024-01-15 10:00', event: 'Peak engagement', count: Math.floor((analytics?.opened || 0) * 0.4) },
      { time: '2024-01-15 12:00', event: 'Continued opens', count: Math.floor((analytics?.opened || 0) * 0.3) },
      { time: '2024-01-15 18:00', event: 'End of day', count: Math.floor((analytics?.opened || 0) * 0.2) }
    ];

    // Device breakdown
    const devices = {
      mobile: 54,
      desktop: 38,
      tablet: 8
    };

    // Email clients
    const emailClients = [
      { name: 'Gmail', percentage: 42 },
      { name: 'Apple Mail', percentage: 28 },
      { name: 'Outlook', percentage: 18 },
      { name: 'Other', percentage: 12 }
    ];

    // Link clicks
    const linkClicks = [
      { url: campaign.cta_url || 'https://example.com/cta', clicks: Math.floor((analytics?.clicked || 0) * 0.6), label: 'Main CTA' },
      { url: 'https://example.com/learn-more', clicks: Math.floor((analytics?.clicked || 0) * 0.25), label: 'Learn More' },
      { url: 'https://example.com/contact', clicks: Math.floor((analytics?.clicked || 0) * 0.15), label: 'Contact Us' }
    ];

    res.json({
      success: true,
      report: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          status: campaign.status,
          sentAt: campaign.sent_at,
          createdAt: campaign.created_at
        },
        metrics: {
          sent: analytics?.sent || 0,
          delivered: analytics?.delivered || 0,
          opened: analytics?.opened || 0,
          clicked: analytics?.clicked || 0,
          bounced: analytics?.bounced || 0,
          unsubscribed: analytics?.unsubscribed || 0,
          complained: analytics?.complained || 0,
          openRate: analytics?.sent ? ((analytics.opened / analytics.sent) * 100).toFixed(1) : 0,
          clickRate: analytics?.sent ? ((analytics.clicked / analytics.sent) * 100).toFixed(1) : 0,
          bounceRate: analytics?.sent ? ((analytics.bounced / analytics.sent) * 100).toFixed(1) : 0
        },
        timeline,
        devices,
        emailClients,
        linkClicks
      }
    });
  } catch (error) {
    log.error('Get campaign report error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get campaign report'
    });
  }
});

/**
 * PUT /api/email/campaigns/:id
 * Update campaign
 */
router.put('/campaigns/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const campaign = await emailMarketingService.updateCampaign(req.params.id, req.workspaceId, req.body);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      campaign
    });
  } catch (error) {
    log.error('Update campaign error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update campaign'
    });
  }
});

/**
 * DELETE /api/email/campaigns/:id
 * Delete campaign
 */
router.delete('/campaigns/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const deleted = await emailMarketingService.deleteCampaign(req.params.id, req.workspaceId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    log.error('Delete campaign error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete campaign'
    });
  }
});

/**
 * POST /api/email/campaigns/:id/duplicate
 * Duplicate campaign
 */
router.post('/campaigns/:id/duplicate', auth, getWorkspaceId, async (req, res) => {
  try {
    const campaign = await emailMarketingService.duplicateCampaign(req.params.id, req.workspaceId);

    res.status(201).json({
      success: true,
      campaign
    });
  } catch (error) {
    log.error('Duplicate campaign error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to duplicate campaign'
    });
  }
});

/**
 * POST /api/email/campaigns/:id/schedule
 * Schedule campaign
 */
router.post('/campaigns/:id/schedule', auth, getWorkspaceId, async (req, res) => {
  try {
    const { scheduledAt } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled time is required'
      });
    }

    const campaign = await emailMarketingService.scheduleCampaign(req.params.id, req.workspaceId, scheduledAt);

    res.json({
      success: true,
      campaign
    });
  } catch (error) {
    log.error('Schedule campaign error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to schedule campaign'
    });
  }
});

/**
 * POST /api/email/campaigns/:id/send
 * Send campaign immediately
 */
router.post('/campaigns/:id/send', auth, getWorkspaceId, async (req, res) => {
  try {
    const result = await emailMarketingService.sendCampaign(req.params.id, req.workspaceId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Send campaign error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send campaign'
    });
  }
});

/**
 * POST /api/email/campaigns/:id/pause
 * Pause campaign
 */
router.post('/campaigns/:id/pause', auth, getWorkspaceId, async (req, res) => {
  try {
    const campaign = await emailMarketingService.pauseCampaign(req.params.id, req.workspaceId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found or cannot be paused'
      });
    }

    res.json({
      success: true,
      campaign
    });
  } catch (error) {
    log.error('Pause campaign error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to pause campaign'
    });
  }
});

/**
 * POST /api/email/campaigns/:id/cancel
 * Cancel campaign
 */
router.post('/campaigns/:id/cancel', auth, getWorkspaceId, async (req, res) => {
  try {
    const campaign = await emailMarketingService.cancelCampaign(req.params.id, req.workspaceId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found or cannot be cancelled'
      });
    }

    res.json({
      success: true,
      campaign
    });
  } catch (error) {
    log.error('Cancel campaign error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to cancel campaign'
    });
  }
});

/**
 * GET /api/email/campaigns/:id/analytics
 * Get campaign analytics
 */
router.get('/campaigns/:id/analytics', auth, getWorkspaceId, async (req, res) => {
  try {
    const analytics = await emailMarketingService.getCampaignAnalytics(req.params.id);

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    log.error('Get campaign analytics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get campaign analytics'
    });
  }
});

/**
 * GET /api/email/campaigns/:id/recipients
 * Get campaign recipients
 */
router.get('/campaigns/:id/recipients', auth, getWorkspaceId, async (req, res) => {
  try {
    const recipients = await emailMarketingService.getCampaignRecipients(req.params.id, req.workspaceId);

    res.json({
      success: true,
      recipients
    });
  } catch (error) {
    log.error('Get campaign recipients error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get campaign recipients'
    });
  }
});

/**
 * POST /api/email/campaigns/:id/preview
 * Preview campaign with contact data
 */
router.post('/campaigns/:id/preview', auth, getWorkspaceId, async (req, res) => {
  try {
    const { contactId } = req.body;

    const preview = await emailMarketingService.previewCampaign(req.params.id, req.workspaceId, contactId);

    res.json({
      success: true,
      preview
    });
  } catch (error) {
    log.error('Preview campaign error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to preview campaign'
    });
  }
});

/**
 * POST /api/email/campaigns/:id/test-send
 * Send test email
 */
router.post('/campaigns/:id/test-send', auth, getWorkspaceId, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }

    const campaign = await emailMarketingService.getCampaignById(req.params.id, req.workspaceId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Create test contact data
    const testContact = {
      email,
      first_name: 'Test',
      last_name: 'User',
      company: 'Test Company'
    };

    const personalizedHtml = emailMarketingService.personalizeContent(campaign.content_html, testContact);
    const personalizedSubject = emailMarketingService.personalizeContent(campaign.subject, testContact);

    await emailSenderService.send({
      to: email,
      from: `${campaign.from_name} <${campaign.from_email}>`,
      subject: `[TEST] ${personalizedSubject}`,
      html: personalizedHtml,
      replyTo: campaign.reply_to
    });

    res.json({
      success: true,
      message: 'Test email sent successfully'
    });
  } catch (error) {
    log.error('Test send error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to send test email'
    });
  }
});

// ==================== AUTOMATIONS ====================

/**
 * GET /api/email/automations
 * Get all automations
 */
router.get('/automations', auth, getWorkspaceId, async (req, res) => {
  try {
    const automations = await emailMarketingService.getAutomations(req.workspaceId);

    res.json({
      success: true,
      automations
    });
  } catch (error) {
    log.error('Get automations error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get automations'
    });
  }
});

/**
 * POST /api/email/automations
 * Create a new automation
 */
router.post('/automations', auth, getWorkspaceId, async (req, res) => {
  try {
    const automation = await emailMarketingService.createAutomation(req.workspaceId, req.body, req.user.id);

    res.status(201).json({
      success: true,
      automation
    });
  } catch (error) {
    log.error('Create automation error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create automation'
    });
  }
});

/**
 * GET /api/email/automations/:id
 * Get automation by ID
 */
router.get('/automations/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const automation = await emailMarketingService.getAutomationById(req.params.id, req.workspaceId);

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    res.json({
      success: true,
      automation
    });
  } catch (error) {
    log.error('Get automation error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get automation'
    });
  }
});

/**
 * PUT /api/email/automations/:id
 * Update automation
 */
router.put('/automations/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const automation = await emailMarketingService.updateAutomation(req.params.id, req.workspaceId, req.body);

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    res.json({
      success: true,
      automation
    });
  } catch (error) {
    log.error('Update automation error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update automation'
    });
  }
});

/**
 * DELETE /api/email/automations/:id
 * Delete automation
 */
router.delete('/automations/:id', auth, getWorkspaceId, async (req, res) => {
  try {
    const deleted = await emailMarketingService.deleteAutomation(req.params.id, req.workspaceId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    res.json({
      success: true,
      message: 'Automation deleted successfully'
    });
  } catch (error) {
    log.error('Delete automation error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete automation'
    });
  }
});

/**
 * POST /api/email/automations/:id/activate
 * Activate automation
 */
router.post('/automations/:id/activate', auth, getWorkspaceId, async (req, res) => {
  try {
    const automation = await emailMarketingService.activateAutomation(req.params.id, req.workspaceId);

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    res.json({
      success: true,
      automation
    });
  } catch (error) {
    log.error('Activate automation error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to activate automation'
    });
  }
});

/**
 * POST /api/email/automations/:id/pause
 * Pause automation
 */
router.post('/automations/:id/pause', auth, getWorkspaceId, async (req, res) => {
  try {
    const automation = await emailMarketingService.pauseAutomation(req.params.id, req.workspaceId);

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    res.json({
      success: true,
      automation
    });
  } catch (error) {
    log.error('Pause automation error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to pause automation'
    });
  }
});

/**
 * GET /api/email/automations/:id/analytics
 * Get automation analytics
 */
router.get('/automations/:id/analytics', auth, getWorkspaceId, async (req, res) => {
  try {
    const analytics = await emailMarketingService.getAutomationAnalytics(req.params.id);

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    log.error('Get automation analytics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get automation analytics'
    });
  }
});

/**
 * GET /api/email/automations/:id/report
 * Get automation report (alias for analytics)
 */
router.get('/automations/:id/report', auth, getWorkspaceId, async (req, res) => {
  try {
    const analytics = await emailMarketingService.getAutomationAnalytics(req.params.id);

    res.json({
      success: true,
      report: analytics
    });
  } catch (error) {
    log.error('Get automation report error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get automation report'
    });
  }
});

/**
 * GET /api/email/automations/:id/enrollments
 * Get automation enrollments
 */
router.get('/automations/:id/enrollments', auth, getWorkspaceId, async (req, res) => {
  try {
    const db = require('../config/db');
    const enrollments = await db('email_automation_enrollments')
      .where('automation_id', req.params.id)
      .orderBy('enrolled_at', 'desc');

    res.json({
      success: true,
      enrollments
    });
  } catch (error) {
    log.error('Get automation enrollments error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get automation enrollments'
    });
  }
});

// ==================== ANALYTICS ====================

/**
 * GET /api/email/analytics/overview
 * Get workspace email analytics overview
 */
router.get('/analytics/overview', auth, getWorkspaceId, async (req, res) => {
  try {
    const { start, end } = req.query;

    const analytics = await emailMarketingService.getWorkspaceAnalytics(req.workspaceId, {
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined
    });

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    log.error('Get analytics overview error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics'
    });
  }
});

/**
 * GET /api/email/analytics/campaigns
 * Get all campaigns analytics
 */
router.get('/analytics/campaigns', auth, getWorkspaceId, async (req, res) => {
  try {
    const result = await emailMarketingService.getCampaigns(req.workspaceId, { status: 'sent' });

    const analyticsPromises = result.campaigns.map(async (campaign) => {
      const analytics = await emailMarketingService.getCampaignAnalytics(campaign.id);
      return { campaign, analytics };
    });

    const campaignAnalytics = await Promise.all(analyticsPromises);

    res.json({
      success: true,
      campaigns: campaignAnalytics
    });
  } catch (error) {
    log.error('Get campaigns analytics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get campaigns analytics'
    });
  }
});

/**
 * GET /api/email/analytics/contacts
 * Get contact analytics
 */
router.get('/analytics/contacts', auth, getWorkspaceId, async (req, res) => {
  try {
    const db = require('../config/db');

    // Get contact stats
    const statusStats = await db('email_contacts')
      .where('workspace_id', req.workspaceId)
      .select('status')
      .count('* as count')
      .groupBy('status');

    const sourceStats = await db('email_contacts')
      .where('workspace_id', req.workspaceId)
      .select('source')
      .count('* as count')
      .groupBy('source');

    // Growth over time (last 30 days)
    const growth = await db('email_contacts')
      .where('workspace_id', req.workspaceId)
      .where('created_at', '>=', db.raw("NOW() - INTERVAL '30 days'"))
      .select(db.raw("DATE(created_at) as date"))
      .count('* as count')
      .groupBy(db.raw("DATE(created_at)"))
      .orderBy('date');

    res.json({
      success: true,
      analytics: {
        byStatus: statusStats.reduce((acc, s) => {
          acc[s.status] = parseInt(s.count);
          return acc;
        }, {}),
        bySource: sourceStats.reduce((acc, s) => {
          acc[s.source] = parseInt(s.count);
          return acc;
        }, {}),
        growth
      }
    });
  } catch (error) {
    log.error('Get contacts analytics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get contacts analytics'
    });
  }
});

/**
 * GET /api/email/analytics/volume
 * Get email volume analytics
 */
router.get('/analytics/volume', auth, getWorkspaceId, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Return mock data for now
    const data = [];
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let current = new Date(start);
    while (current <= end) {
      data.push({
        date: current.toISOString().split('T')[0],
        sent: Math.floor(Math.random() * 500) + 100,
        delivered: Math.floor(Math.random() * 480) + 90,
        opened: Math.floor(Math.random() * 200) + 50,
        clicked: Math.floor(Math.random() * 100) + 20
      });
      current.setDate(current.getDate() + 1);
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    log.error('Get volume analytics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get volume analytics'
    });
  }
});

/**
 * GET /api/email/analytics/top-campaigns
 * Get top performing campaigns
 */
router.get('/analytics/top-campaigns', auth, getWorkspaceId, async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    // Return mock data for now
    const campaigns = [
      { id: 'demo-campaign-1', name: 'Welcome Series', sent: 1250, openRate: 45.2, clickRate: 12.5 },
      { id: 'demo-campaign-2', name: 'Newsletter #42', sent: 3400, openRate: 38.7, clickRate: 8.3 },
      { id: 'demo-campaign-3', name: 'Product Launch', sent: 2100, openRate: 52.1, clickRate: 18.9 },
      { id: 'demo-campaign-4', name: 'Re-engagement', sent: 890, openRate: 28.4, clickRate: 6.2 },
      { id: 'demo-campaign-5', name: 'Holiday Sale', sent: 4500, openRate: 41.3, clickRate: 15.7 }
    ].slice(0, parseInt(limit));

    res.json({
      success: true,
      campaigns
    });
  } catch (error) {
    log.error('Get top campaigns error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get top campaigns'
    });
  }
});

/**
 * GET /api/email/analytics/engagement-by-hour
 * Get engagement by hour of day
 */
router.get('/analytics/engagement-by-hour', auth, getWorkspaceId, async (req, res) => {
  try {
    // Return mock data for now
    const data = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      opens: Math.floor(Math.random() * 100) + 10,
      clicks: Math.floor(Math.random() * 30) + 5
    }));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    log.error('Get engagement by hour error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get engagement by hour'
    });
  }
});

/**
 * GET /api/email/analytics/contact-growth
 * Get contact growth over time
 */
router.get('/analytics/contact-growth', auth, getWorkspaceId, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Return mock data for now
    const data = [];
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let current = new Date(start);
    let total = 1000;
    while (current <= end) {
      const subscribed = Math.floor(Math.random() * 50) + 10;
      const unsubscribed = Math.floor(Math.random() * 10) + 1;
      total += subscribed - unsubscribed;
      data.push({
        date: current.toISOString().split('T')[0],
        subscribed,
        unsubscribed,
        total
      });
      current.setDate(current.getDate() + 1);
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    log.error('Get contact growth error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get contact growth'
    });
  }
});

/**
 * GET /api/email/analytics/engagement-segments
 * Get engagement segments breakdown
 */
router.get('/analytics/engagement-segments', auth, getWorkspaceId, async (req, res) => {
  try {
    // Return mock data for now
    const segments = {
      highlyEngaged: { count: 3540, percentage: 35 },
      engaged: { count: 4050, percentage: 40 },
      inactive: { count: 2530, percentage: 25 }
    };

    res.json({
      success: true,
      segments
    });
  } catch (error) {
    log.error('Get engagement segments error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get engagement segments'
    });
  }
});

// ==================== SETTINGS ====================

/**
 * GET /api/email/settings
 * Get email settings
 */
router.get('/settings', auth, getWorkspaceId, async (req, res) => {
  try {
    const settings = await emailMarketingService.getSettings(req.workspaceId);

    // Don't expose sensitive provider config
    if (settings.provider_config) {
      settings.provider_config = { configured: true };
    }

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    log.error('Get email settings error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get email settings'
    });
  }
});

/**
 * PUT /api/email/settings
 * Update email settings
 */
router.put('/settings', auth, getWorkspaceId, async (req, res) => {
  try {
    const settings = await emailMarketingService.updateSettings(req.workspaceId, req.body);

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    log.error('Update email settings error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update email settings'
    });
  }
});

/**
 * POST /api/email/settings/verify-domain
 * Verify sending domain
 */
router.post('/settings/verify-domain', auth, getWorkspaceId, async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required'
      });
    }

    const result = await emailSenderService.verifyDomain(domain);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Verify domain error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify domain'
    });
  }
});

/**
 * GET /api/email/settings/domain-status
 * Get domain verification status
 */
router.get('/settings/domain-status', auth, getWorkspaceId, async (req, res) => {
  try {
    const { domain } = req.query;

    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required'
      });
    }

    const status = await emailSenderService.getDomainStatus(domain);

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    log.error('Get domain status error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get domain status'
    });
  }
});

/**
 * GET /api/email/settings/provider-info
 * Get email provider info
 */
router.get('/settings/provider-info', auth, async (req, res) => {
  try {
    const info = emailSenderService.getProviderInfo();

    res.json({
      success: true,
      ...info
    });
  } catch (error) {
    log.error('Get provider info error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get provider info'
    });
  }
});

// ==================== PROVIDER MANAGEMENT ====================

/**
 * POST /api/email/test-connection
 * Test email provider connection
 */
router.post('/test-connection', auth, async (req, res) => {
  try {
    const { provider } = req.body;
    const { manager } = require('../services/email-providers');

    const result = await manager.testConnection(provider);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Test connection error', { error: error.message });
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message
    });
  }
});

/**
 * POST /api/email/send-test
 * Send test email
 */
router.post('/send-test', auth, async (req, res) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        message: 'Recipient email is required'
      });
    }

    const { manager } = require('../services/email-providers');
    const result = await manager.sendTestEmail(to);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('Send test email error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/email/domains
 * List all verified domains
 */
router.get('/domains', auth, async (req, res) => {
  try {
    const { manager } = require('../services/email-providers');
    const domains = await manager.listDomains();

    res.json(domains);
  } catch (error) {
    log.error('List domains error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/email/domains
 * Add domain for verification
 */
router.post('/domains', auth, async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required'
      });
    }

    const { manager } = require('../services/email-providers');
    const result = await manager.addDomain(domain);

    res.status(201).json(result);
  } catch (error) {
    log.error('Add domain error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/email/domains/:id/verify
 * Verify domain DNS records
 */
router.post('/domains/:id/verify', auth, async (req, res) => {
  try {
    const { manager } = require('../services/email-providers');
    const provider = manager.getProvider();

    if (!provider || !provider.verifyDomain) {
      return res.status(400).json({
        success: false,
        message: 'Domain verification not supported'
      });
    }

    const result = await provider.verifyDomain(req.params.id);

    res.json(result);
  } catch (error) {
    log.error('Verify domain error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /api/email/domains/:id
 * Delete domain
 */
router.delete('/domains/:id', auth, async (req, res) => {
  try {
    const { manager } = require('../services/email-providers');
    await manager.deleteDomain(req.params.id);

    res.json({
      success: true,
      message: 'Domain deleted'
    });
  } catch (error) {
    log.error('Delete domain error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/email/provider/stats
 * Get provider statistics
 */
router.get('/provider/stats', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { manager } = require('../services/email-providers');

    const stats = await manager.getStats({
      startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: endDate || new Date().toISOString().split('T')[0]
    });

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    log.error('Get provider stats error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/email/provider/quota
 * Get sending quota (AWS SES)
 */
router.get('/provider/quota', auth, async (req, res) => {
  try {
    const { manager } = require('../services/email-providers');
    const quota = await manager.getSendingQuota();

    if (!quota) {
      return res.json({
        success: true,
        quota: null,
        message: 'Quota info not available for this provider'
      });
    }

    res.json({
      success: true,
      quota
    });
  } catch (error) {
    log.error('Get sending quota error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/email/provider/bounces
 * Get bounced emails
 */
router.get('/provider/bounces', auth, async (req, res) => {
  try {
    const { manager } = require('../services/email-providers');
    const bounces = await manager.getBounces(req.query);

    res.json({
      success: true,
      bounces
    });
  } catch (error) {
    log.error('Get bounces error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/email/provider/unsubscribes
 * Get unsubscribed emails
 */
router.get('/provider/unsubscribes', auth, async (req, res) => {
  try {
    const { manager } = require('../services/email-providers');
    const unsubscribes = await manager.getUnsubscribes(req.query);

    res.json({
      success: true,
      unsubscribes
    });
  } catch (error) {
    log.error('Get unsubscribes error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/email/provider/suppression
 * Add email to suppression list
 */
router.post('/provider/suppression', auth, async (req, res) => {
  try {
    const { email, reason } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const { manager } = require('../services/email-providers');
    await manager.addToSuppressionList(email, reason);

    res.json({
      success: true,
      message: 'Email added to suppression list'
    });
  } catch (error) {
    log.error('Add to suppression list error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /api/email/provider/suppression/:email
 * Remove email from suppression list
 */
router.delete('/provider/suppression/:email', auth, async (req, res) => {
  try {
    const { manager } = require('../services/email-providers');
    await manager.removeFromSuppressionList(req.params.email);

    res.json({
      success: true,
      message: 'Email removed from suppression list'
    });
  } catch (error) {
    log.error('Remove from suppression list error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/email/provider/templates
 * List provider templates (SendGrid/SES)
 */
router.get('/provider/templates', auth, async (req, res) => {
  try {
    const { manager } = require('../services/email-providers');
    const templates = await manager.listTemplates(req.query);

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    log.error('List provider templates error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/email/provider/templates
 * Create provider template
 */
router.post('/provider/templates', auth, async (req, res) => {
  try {
    const { manager } = require('../services/email-providers');
    const template = await manager.createTemplate(req.body);

    res.status(201).json({
      success: true,
      template
    });
  } catch (error) {
    log.error('Create provider template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /api/email/provider/templates/:id
 * Delete provider template
 */
router.delete('/provider/templates/:id', auth, async (req, res) => {
  try {
    const { manager } = require('../services/email-providers');
    await manager.deleteTemplate(req.params.id);

    res.json({
      success: true,
      message: 'Template deleted'
    });
  } catch (error) {
    log.error('Delete provider template error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
