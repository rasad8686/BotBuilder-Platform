const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { systemTemplates, getSystemTemplateById } = require('../data/email-templates');
const emailRenderer = require('../services/email-renderer.service');

// In-memory storage for user templates (replace with database in production)
let userTemplates = [];

/**
 * @route GET /api/email/templates
 * @desc Get all templates (user + system)
 */
router.get('/templates', async (req, res) => {
  try {
    const { category } = req.query;
    const userId = req.user?.id || 'anonymous';

    let templates = [
      ...userTemplates.filter(t => t.userId === userId),
      ...systemTemplates
    ];

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * @route GET /api/email/templates/system
 * @desc Get system templates only
 */
router.get('/templates/system', async (req, res) => {
  try {
    const { category } = req.query;

    let templates = [...systemTemplates];

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    res.json(templates);
  } catch (error) {
    console.error('Error fetching system templates:', error);
    res.status(500).json({ error: 'Failed to fetch system templates' });
  }
});

/**
 * @route GET /api/email/templates/:id
 * @desc Get single template by ID
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'anonymous';

    // Check user templates first
    let template = userTemplates.find(t => t.id === id && t.userId === userId);

    // Check system templates
    if (!template) {
      template = getSystemTemplateById(id);
    }

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * @route POST /api/email/templates
 * @desc Create new template
 */
router.post('/templates', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const { name, category, description, subject, previewText, blocks } = req.body;

    const newTemplate = {
      id: uuidv4(),
      userId,
      name: name || 'Untitled Template',
      category: category || 'marketing',
      description: description || '',
      subject: subject || '',
      previewText: previewText || '',
      blocks: blocks || [],
      isSystem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0
    };

    userTemplates.push(newTemplate);

    res.status(201).json(newTemplate);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * @route PUT /api/email/templates/:id
 * @desc Update template
 */
router.put('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'anonymous';
    const updates = req.body;

    const index = userTemplates.findIndex(t => t.id === id && t.userId === userId);

    if (index === -1) {
      return res.status(404).json({ error: 'Template not found or not authorized' });
    }

    userTemplates[index] = {
      ...userTemplates[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    res.json(userTemplates[index]);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * @route DELETE /api/email/templates/:id
 * @desc Delete template
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'anonymous';

    const index = userTemplates.findIndex(t => t.id === id && t.userId === userId);

    if (index === -1) {
      return res.status(404).json({ error: 'Template not found or not authorized' });
    }

    userTemplates.splice(index, 1);

    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * @route POST /api/email/templates/:id/duplicate
 * @desc Duplicate template (user or system)
 */
router.post('/templates/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'anonymous';

    // Find original template
    let original = userTemplates.find(t => t.id === id);
    if (!original) {
      original = getSystemTemplateById(id);
    }

    if (!original) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const duplicated = {
      ...JSON.parse(JSON.stringify(original)),
      id: uuidv4(),
      userId,
      name: `${original.name} (Copy)`,
      isSystem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0
    };

    // Regenerate block IDs
    if (duplicated.blocks) {
      duplicated.blocks = duplicated.blocks.map(block => ({
        ...block,
        id: uuidv4()
      }));
    }

    userTemplates.push(duplicated);

    res.status(201).json(duplicated);
  } catch (error) {
    console.error('Error duplicating template:', error);
    res.status(500).json({ error: 'Failed to duplicate template' });
  }
});

/**
 * @route POST /api/email/templates/:id/test-send
 * @desc Send test email
 */
router.post('/templates/:id/test-send', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, blocks, subject, previewText } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Find template
    let template = userTemplates.find(t => t.id === id);
    if (!template) {
      template = getSystemTemplateById(id);
    }

    // Use provided blocks or template blocks
    const templateData = {
      blocks: blocks || template?.blocks || [],
      settings: {
        subject: subject || template?.subject || 'Test Email',
        previewText: previewText || template?.previewText || ''
      }
    };

    // Render HTML
    const html = emailRenderer.renderToHTML(templateData);
    const plainText = emailRenderer.renderToPlainText(templateData);

    // Replace test variables
    const testVariables = {
      first_name: 'Test',
      company_name: 'Test Company',
      company_address: '123 Test Street, Test City',
      logo_url: 'https://via.placeholder.com/150x50',
      app_url: 'https://example.com'
    };

    const finalHtml = emailRenderer.replaceVariables(html, testVariables);

    // In production, send actual email here using your email service
    // For now, just return success with preview
    console.log(`Test email would be sent to: ${email}`);
    console.log(`Subject: ${templateData.settings.subject}`);

    res.json({
      success: true,
      message: `Test email sent to ${email}`,
      preview: {
        html: finalHtml,
        plainText
      }
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

/**
 * @route POST /api/email/templates/:id/render
 * @desc Render template to HTML
 */
router.post('/templates/:id/render', async (req, res) => {
  try {
    const { id } = req.params;
    const { variables = {} } = req.body;

    // Find template
    let template = userTemplates.find(t => t.id === id);
    if (!template) {
      template = getSystemTemplateById(id);
    }

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Render HTML
    const html = emailRenderer.renderToHTML(template);
    const plainText = emailRenderer.renderToPlainText(template);

    // Replace variables
    const finalHtml = emailRenderer.replaceVariables(html, variables);
    const finalPlainText = emailRenderer.replaceVariables(plainText, variables);

    res.json({
      html: finalHtml,
      plainText: finalPlainText
    });
  } catch (error) {
    console.error('Error rendering template:', error);
    res.status(500).json({ error: 'Failed to render template' });
  }
});

/**
 * @route POST /api/email/upload-image
 * @desc Upload image for email
 */
router.post('/upload-image', async (req, res) => {
  try {
    // In production, handle file upload to S3 or similar
    // For now, return a placeholder
    res.json({
      url: 'https://via.placeholder.com/600x400',
      message: 'Image upload endpoint - implement with your storage solution'
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

module.exports = router;
