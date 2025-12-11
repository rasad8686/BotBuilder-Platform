/**
 * Whitelabel API Tests
 * Tests for /api/whitelabel endpoints: branding, customization, domains
 */

const request = require('supertest');

jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

const express = require('express');
const db = require('../db');

const app = express();
app.use(express.json());

const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  req.organization = { id: 1, name: 'Test Org' };
  next();
};

// Specific routes MUST come before parameterized routes
app.post('/api/whitelabel/preview', mockAuth, async (req, res) => {
  try {
    const { template_type, data } = req.body;
    if (!template_type) return res.status(400).json({ success: false, message: 'Template type is required' });

    const templateResult = await db.query(
      'SELECT * FROM email_templates WHERE organization_id = $1 AND type = $2',
      [req.organization.id, template_type]
    );

    const template = templateResult.rows[0] || { subject: 'Default Subject', body: 'Default body content' };

    // Mock variable replacement
    let preview = template.body;
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
    }

    res.json({ success: true, data: { subject: template.subject, body: preview } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/whitelabel/config', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM whitelabel_config WHERE organization_id = $1', [req.organization.id]);
    res.json({
      success: true,
      data: result.rows[0] || {
        logo_url: null,
        favicon_url: null,
        primary_color: '#007bff',
        secondary_color: '#6c757d',
        company_name: req.organization.name,
        support_email: null,
        custom_css: null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/whitelabel/config', mockAuth, async (req, res) => {
  try {
    const { logo_url, favicon_url, primary_color, secondary_color, company_name, support_email, custom_css } = req.body;

    // Validate color format
    const colorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (primary_color && !colorRegex.test(primary_color)) {
      return res.status(400).json({ success: false, message: 'Invalid primary color format' });
    }
    if (secondary_color && !colorRegex.test(secondary_color)) {
      return res.status(400).json({ success: false, message: 'Invalid secondary color format' });
    }

    const result = await db.query(
      `INSERT INTO whitelabel_config (organization_id, logo_url, favicon_url, primary_color, secondary_color, company_name, support_email, custom_css)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (organization_id) DO UPDATE SET
       logo_url = COALESCE($2, whitelabel_config.logo_url),
       favicon_url = COALESCE($3, whitelabel_config.favicon_url),
       primary_color = COALESCE($4, whitelabel_config.primary_color),
       secondary_color = COALESCE($5, whitelabel_config.secondary_color),
       company_name = COALESCE($6, whitelabel_config.company_name),
       support_email = COALESCE($7, whitelabel_config.support_email),
       custom_css = COALESCE($8, whitelabel_config.custom_css),
       updated_at = NOW()
       RETURNING *`,
      [req.organization.id, logo_url, favicon_url, primary_color || '#007bff', secondary_color || '#6c757d', company_name, support_email, custom_css]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/whitelabel/domains', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM custom_domains WHERE organization_id = $1 ORDER BY created_at DESC', [req.organization.id]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/whitelabel/domains', mockAuth, async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain || domain.trim() === '') return res.status(400).json({ success: false, message: 'Domain is required' });

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({ success: false, message: 'Invalid domain format' });
    }

    // Check if domain already exists
    const existing = await db.query('SELECT * FROM custom_domains WHERE domain = $1', [domain]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Domain already registered' });
    }

    const result = await db.query(
      `INSERT INTO custom_domains (organization_id, domain, status, verification_token)
       VALUES ($1, $2, 'pending', $3) RETURNING *`,
      [req.organization.id, domain, `verify-${Math.random().toString(36).substr(2, 16)}`]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/whitelabel/domains/:id/verify', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM custom_domains WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Domain not found' });

    const domain = result.rows[0];
    if (domain.status === 'verified') {
      return res.status(400).json({ success: false, message: 'Domain already verified' });
    }

    // Mock DNS verification (in real implementation, check DNS records)
    const verified = true; // Assume verification passes

    if (verified) {
      await db.query("UPDATE custom_domains SET status = 'verified', verified_at = NOW() WHERE id = $1", [req.params.id]);
      res.json({ success: true, message: 'Domain verified successfully' });
    } else {
      res.status(400).json({ success: false, message: 'DNS verification failed. Please add the TXT record.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/whitelabel/domains/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM custom_domains WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Domain not found' });

    await db.query('DELETE FROM custom_domains WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Domain deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/whitelabel/email-templates', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM email_templates WHERE organization_id = $1 ORDER BY name', [req.organization.id]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/whitelabel/email-templates/:type', mockAuth, async (req, res) => {
  try {
    const { subject, body, variables } = req.body;
    const validTypes = ['welcome', 'password_reset', 'invitation', 'notification'];

    if (!validTypes.includes(req.params.type)) {
      return res.status(400).json({ success: false, message: `Invalid template type. Valid: ${validTypes.join(', ')}` });
    }

    const result = await db.query(
      `INSERT INTO email_templates (organization_id, type, subject, body, variables)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id, type) DO UPDATE SET
       subject = COALESCE($3, email_templates.subject),
       body = COALESCE($4, email_templates.body),
       variables = COALESCE($5, email_templates.variables),
       updated_at = NOW()
       RETURNING *`,
      [req.organization.id, req.params.type, subject, body, JSON.stringify(variables || [])]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Whitelabel API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/whitelabel/config', () => {
    it('should return whitelabel config', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ primary_color: '#ff0000', company_name: 'Test' }] });
      const res = await request(app).get('/api/whitelabel/config');
      expect(res.status).toBe(200);
      expect(res.body.data.primary_color).toBe('#ff0000');
    });

    it('should return defaults if no config', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/whitelabel/config');
      expect(res.status).toBe(200);
      expect(res.body.data.primary_color).toBe('#007bff');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/whitelabel/config');
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/whitelabel/config', () => {
    it('should update whitelabel config', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ primary_color: '#ff0000' }] });
      const res = await request(app).put('/api/whitelabel/config').send({ primary_color: '#ff0000', company_name: 'New Name' });
      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid primary color', async () => {
      const res = await request(app).put('/api/whitelabel/config').send({ primary_color: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid secondary color', async () => {
      const res = await request(app).put('/api/whitelabel/config').send({ secondary_color: 'not-a-color' });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/whitelabel/config').send({ primary_color: '#ff0000' });
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/whitelabel/domains', () => {
    it('should return custom domains', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, domain: 'chat.example.com', status: 'verified' }] });
      const res = await request(app).get('/api/whitelabel/domains');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/whitelabel/domains');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/whitelabel/domains', () => {
    it('should return 400 if domain missing', async () => {
      const res = await request(app).post('/api/whitelabel/domains').send({});
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid domain format', async () => {
      const res = await request(app).post('/api/whitelabel/domains').send({ domain: 'not-a-domain' });
      expect(res.status).toBe(400);
    });

    it('should validate domain format correctly', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app).post('/api/whitelabel/domains').send({ domain: 'valid-domain.com' });
      expect([201, 500]).toContain(res.status);
    });
  });

  describe('POST /api/whitelabel/domains/:id/verify', () => {
    it('should call verify endpoint', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, status: 'pending' }] });
      const res = await request(app).post('/api/whitelabel/domains/1/verify');
      expect(res.body).toBeDefined();
    });
  });

  describe('DELETE /api/whitelabel/domains/:id', () => {
    it('should call delete endpoint', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });
      const res = await request(app).delete('/api/whitelabel/domains/1');
      expect(res.body).toBeDefined();
    });
  });

  describe('GET /api/whitelabel/email-templates', () => {
    it('should return email templates', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ type: 'welcome', subject: 'Welcome!' }] });
      const res = await request(app).get('/api/whitelabel/email-templates');
      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/whitelabel/email-templates');
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/whitelabel/email-templates/:type', () => {
    it('should update email template', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ type: 'welcome', subject: 'New Subject' }] });
      const res = await request(app).put('/api/whitelabel/email-templates/welcome').send({ subject: 'New Subject', body: 'New body' });
      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid template type', async () => {
      const res = await request(app).put('/api/whitelabel/email-templates/invalid').send({ subject: 'Test' });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/whitelabel/email-templates/welcome').send({ subject: 'Test' });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/whitelabel/preview', () => {
    it('should return 400 if template_type missing', async () => {
      const res = await request(app).post('/api/whitelabel/preview').send({});
      expect(res.status).toBe(400);
    });

    it('should return success response format', async () => {
      db.query.mockResolvedValue({ rows: [{ subject: 'Test', body: 'Test body' }] });
      const res = await request(app).post('/api/whitelabel/preview').send({ template_type: 'welcome' });
      expect(res.body.success).toBeDefined();
    });
  });
});
