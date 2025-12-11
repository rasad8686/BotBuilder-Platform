/**
 * Whitelabel Controller Tests
 * Tests for server/controllers/whitelabelController.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/upload', () => ({
  deleteOldFile: jest.fn().mockResolvedValue(true),
  getPublicUrl: jest.fn((req, filename) => `http://localhost/uploads/${filename}`)
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const {
  getSettings,
  updateSettings,
  uploadLogo,
  uploadFavicon,
  getPublicSettings
} = require('../../controllers/whitelabelController');

describe('Whitelabel Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      organization: { id: 1 },
      user: { id: 1 },
      params: {},
      body: {},
      file: null
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('getSettings', () => {
    it('should return existing settings', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          organization_id: 1,
          brand_name: 'My Brand',
          primary_color: '#007bff',
          show_powered_by: true
        }]
      });

      await getSettings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        settings: expect.any(Object)
      }));
    });

    it('should create default settings if none exist', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // No existing settings
        .mockResolvedValueOnce({ rows: [{
          id: 1,
          brand_name: 'BotBuilder',
          show_powered_by: true
        }] }); // Create default

      await getSettings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should reject missing organization context', async () => {
      mockReq.organization = null;

      await getSettings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await getSettings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateSettings', () => {
    beforeEach(() => {
      db.query.mockReset();
    });

    it('should update settings', async () => {
      mockReq.body = {
        brand_name: 'New Brand',
        primary_color: '#ff0000'
      };

      db.query.mockResolvedValueOnce({ rows: [{
        id: 1,
        brand_name: 'New Brand',
        primary_color: '#ff0000'
      }] });

      await updateSettings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should reject invalid color format', async () => {
      mockReq.body = {
        primary_color: 'invalid'
      };

      await updateSettings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Invalid color format')
      }));
    });

    it('should reject invalid email format', async () => {
      mockReq.body = {
        support_email: 'invalid-email'
      };

      await updateSettings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle errors', async () => {
      mockReq.body = { brand_name: 'Test' };
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await updateSettings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('uploadLogo', () => {
    beforeEach(() => {
      db.query.mockReset();
    });

    it('should upload logo successfully', async () => {
      mockReq.file = {
        filename: 'logo.png'
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ logo_url: '/old-logo.png' }] }) // Get old
        .mockResolvedValueOnce({ rows: [{ logo_url: 'http://localhost/uploads/logo.png' }] }); // Update

      await uploadLogo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should reject if no file uploaded', async () => {
      mockReq.file = null;

      await uploadLogo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle errors', async () => {
      mockReq.file = { filename: 'logo.png' };
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await uploadLogo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('uploadFavicon', () => {
    beforeEach(() => {
      db.query.mockReset();
    });

    it('should upload favicon successfully', async () => {
      mockReq.file = {
        filename: 'favicon.ico'
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ favicon_url: null }] })
        .mockResolvedValueOnce({ rows: [{ favicon_url: 'http://localhost/uploads/favicon.ico' }] });

      await uploadFavicon(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should reject if no file uploaded', async () => {
      mockReq.file = null;

      await uploadFavicon(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getPublicSettings', () => {
    beforeEach(() => {
      // Ensure clean mock state for this describe block
      db.query.mockReset();
    });

    it('should return public settings by domain', async () => {
      mockReq.params = { domain: 'example.com' };

      db.query.mockResolvedValueOnce({
        rows: [{
          brand_name: 'Example Brand',
          primary_color: '#007bff',
          logo_url: '/logo.png'
        }]
      });

      await getPublicSettings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        settings: expect.any(Object)
      }));
    });

    it('should return default settings if domain not found', async () => {
      mockReq.params = { domain: 'unknown.com' };
      db.query.mockResolvedValueOnce({ rows: [] });

      await getPublicSettings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        settings: expect.objectContaining({
          brand_name: 'BotBuilder',
          show_powered_by: true
        })
      }));
    });

    it('should handle errors', async () => {
      mockReq.params = { domain: 'example.com' };
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await getPublicSettings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
