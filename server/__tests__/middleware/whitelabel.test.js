/**
 * Whitelabel Middleware Tests
 * Tests for server/middleware/whitelabel.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const log = require('../../utils/logger');
const { detectCustomDomain } = require('../../middleware/whitelabel');

describe('Whitelabel Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      hostname: 'example.com',
      get: jest.fn()
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  describe('detectCustomDomain', () => {
    it('should skip localhost and set whitelabel to null', async () => {
      mockReq.hostname = 'localhost';

      await detectCustomDomain(mockReq, mockRes, mockNext);

      expect(mockReq.whitelabel).toBeNull();
      expect(mockNext).toHaveBeenCalled();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should skip 127.0.0.1 and set whitelabel to null', async () => {
      mockReq.hostname = '127.0.0.1';

      await detectCustomDomain(mockReq, mockRes, mockNext);

      expect(mockReq.whitelabel).toBeNull();
      expect(mockNext).toHaveBeenCalled();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should use req.get("host") when hostname is null', async () => {
      mockReq.hostname = null;
      mockReq.get.mockReturnValue('localhost:3000');

      await detectCustomDomain(mockReq, mockRes, mockNext);

      expect(mockReq.whitelabel).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect verified custom domain', async () => {
      const whitelabelSettings = {
        id: 1,
        organization_id: 1,
        org_id: 1,
        org_name: 'Test Organization',
        custom_domain: 'custom.example.com',
        primary_color: '#007bff'
      };

      db.query.mockResolvedValue({ rows: [whitelabelSettings] });

      mockReq.hostname = 'custom.example.com';

      await detectCustomDomain(mockReq, mockRes, mockNext);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('whitelabel_settings'),
        ['custom.example.com']
      );
      expect(mockReq.whitelabel).toEqual(whitelabelSettings);
      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Custom domain detected')
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set whitelabel to null when domain not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      mockReq.hostname = 'unknown.example.com';

      await detectCustomDomain(mockReq, mockRes, mockNext);

      expect(mockReq.whitelabel).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle database error gracefully', async () => {
      db.query.mockRejectedValue(new Error('Database connection failed'));

      mockReq.hostname = 'custom.example.com';

      await detectCustomDomain(mockReq, mockRes, mockNext);

      expect(log.error).toHaveBeenCalledWith(
        'Domain detection error:',
        expect.any(Error)
      );
      expect(mockReq.whitelabel).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should query with correct SQL and hostname', async () => {
      db.query.mockResolvedValue({ rows: [] });

      mockReq.hostname = 'test.myapp.com';

      await detectCustomDomain(mockReq, mockRes, mockNext);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('custom_domain_verified = true'),
        ['test.myapp.com']
      );
    });

    it('should handle localhost with port', async () => {
      mockReq.hostname = 'localhost:3000';

      await detectCustomDomain(mockReq, mockRes, mockNext);

      expect(mockReq.whitelabel).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle 127.0.0.1 with port', async () => {
      mockReq.hostname = null;
      mockReq.get.mockReturnValue('127.0.0.1:8080');

      await detectCustomDomain(mockReq, mockRes, mockNext);

      expect(mockReq.whitelabel).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
