/**
 * Whitelabel Routes Tests
 * Tests for server/routes/whitelabel.js
 */

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'admin@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../middleware/upload', () => ({
  uploadLogo: jest.fn((req, res, cb) => cb(null)),
  uploadFavicon: jest.fn((req, res, cb) => cb(null))
}));

jest.mock('../../controllers/whitelabelController', () => ({
  getSettings: jest.fn((req, res) => res.json({
    success: true,
    settings: {
      brand_name: 'Test Brand',
      primary_color: '#007bff',
      logo_url: null,
      favicon_url: null
    }
  })),
  updateSettings: jest.fn((req, res) => res.json({
    success: true,
    message: 'Settings updated'
  })),
  uploadLogo: jest.fn((req, res) => res.json({
    success: true,
    logoUrl: '/uploads/logos/test.png'
  })),
  uploadFavicon: jest.fn((req, res) => res.json({
    success: true,
    faviconUrl: '/uploads/favicons/test.ico'
  })),
  getPublicSettings: jest.fn((req, res) => res.json({
    success: true,
    settings: { brand_name: 'Public Brand' }
  }))
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const whitelabelController = require('../../controllers/whitelabelController');
const { uploadLogo, uploadFavicon } = require('../../middleware/upload');
const whitelabelRouter = require('../../routes/whitelabel');

const app = express();
app.use(express.json());
app.use('/api/whitelabel', whitelabelRouter);

describe('Whitelabel Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/whitelabel/public/:domain', () => {
    it('should return public settings for domain', async () => {
      const response = await request(app).get('/api/whitelabel/public/example.com');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(whitelabelController.getPublicSettings).toHaveBeenCalled();
    });
  });

  describe('GET /api/whitelabel/settings', () => {
    it('should return whitelabel settings', async () => {
      const response = await request(app).get('/api/whitelabel/settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.settings).toBeDefined();
      expect(whitelabelController.getSettings).toHaveBeenCalled();
    });
  });

  describe('PUT /api/whitelabel/settings', () => {
    it('should update whitelabel settings', async () => {
      const response = await request(app)
        .put('/api/whitelabel/settings')
        .send({
          brand_name: 'New Brand',
          primary_color: '#ff0000',
          secondary_color: '#00ff00'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(whitelabelController.updateSettings).toHaveBeenCalled();
    });
  });

  describe('POST /api/whitelabel/upload-logo', () => {
    it('should upload logo successfully', async () => {
      const response = await request(app)
        .post('/api/whitelabel/upload-logo')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.logoUrl).toBeDefined();
    });

    it('should handle upload error', async () => {
      uploadLogo.mockImplementationOnce((req, res, cb) => cb(new Error('File too large')));

      const response = await request(app)
        .post('/api/whitelabel/upload-logo')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('File too large');
    });
  });

  describe('POST /api/whitelabel/upload-favicon', () => {
    it('should upload favicon successfully', async () => {
      const response = await request(app)
        .post('/api/whitelabel/upload-favicon')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.faviconUrl).toBeDefined();
    });

    it('should handle upload error', async () => {
      uploadFavicon.mockImplementationOnce((req, res, cb) => cb(new Error('Invalid file type')));

      const response = await request(app)
        .post('/api/whitelabel/upload-favicon')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid file type');
    });
  });
});
