/**
 * Upload Middleware Tests
 * Tests for server/middleware/upload.js
 */

let storageDestination, storageFilename, logoFilterFn, faviconFilterFn;

// Mock fs before any imports
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn()
}));

// Mock multer to capture callback functions
jest.mock('multer', () => {
  const mockSingle = jest.fn(() => jest.fn());
  const mockMulter = jest.fn((config) => {
    // Capture file filters
    if (config.fileFilter) {
      if (!logoFilterFn) {
        logoFilterFn = config.fileFilter;
      } else if (!faviconFilterFn) {
        faviconFilterFn = config.fileFilter;
      }
    }
    return {
      single: mockSingle
    };
  });
  mockMulter.diskStorage = jest.fn((config) => {
    storageDestination = config.destination;
    storageFilename = config.filename;
    return {};
  });
  return mockMulter;
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const fs = require('fs');
const upload = require('../../middleware/upload');

describe('Upload Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
  });

  describe('module exports', () => {
    it('should export upload middleware', () => {
      expect(upload).toBeDefined();
    });

    it('should export uploadLogo', () => {
      expect(upload.uploadLogo).toBeDefined();
    });

    it('should export uploadFavicon', () => {
      expect(upload.uploadFavicon).toBeDefined();
    });

    it('should export uploadDir', () => {
      expect(upload.uploadDir).toBeDefined();
      expect(upload.uploadDir).toContain('uploads');
    });

    it('should export deleteOldFile function', () => {
      expect(typeof upload.deleteOldFile).toBe('function');
    });

    it('should export getPublicUrl function', () => {
      expect(typeof upload.getPublicUrl).toBe('function');
    });
  });

  describe('deleteOldFile', () => {
    it('should delete file if it exists', () => {
      fs.existsSync.mockReturnValue(true);

      upload.deleteOldFile('/path/to/file.png');

      expect(fs.unlinkSync).toHaveBeenCalledWith('/path/to/file.png');
    });

    it('should not delete if file path is null', () => {
      upload.deleteOldFile(null);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should not delete if file path is undefined', () => {
      upload.deleteOldFile(undefined);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should not delete if file path is empty string', () => {
      upload.deleteOldFile('');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should not delete if file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      upload.deleteOldFile('/path/to/nonexistent.png');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should handle delete errors gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => upload.deleteOldFile('/path/to/file.png')).not.toThrow();
    });
  });

  describe('getPublicUrl', () => {
    it('should return null for null filename', () => {
      const req = { get: jest.fn(() => 'localhost:3000') };
      const result = upload.getPublicUrl(req, null);
      expect(result).toBeNull();
    });

    it('should return null for undefined filename', () => {
      const req = { get: jest.fn(() => 'localhost:3000') };
      const result = upload.getPublicUrl(req, undefined);
      expect(result).toBeNull();
    });

    it('should return http URL in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const req = { get: jest.fn(() => 'localhost:3000') };
      const result = upload.getPublicUrl(req, 'test.png');

      expect(result).toBe('http://localhost:3000/uploads/whitelabel/test.png');
      process.env.NODE_ENV = originalEnv;
    });

    it('should return https URL in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const req = { get: jest.fn(() => 'example.com') };
      const result = upload.getPublicUrl(req, 'test.png');

      expect(result).toBe('https://example.com/uploads/whitelabel/test.png');
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle filenames with special characters', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const req = { get: jest.fn(() => 'localhost:3000') };
      const result = upload.getPublicUrl(req, 'test-file_123.png');

      expect(result).toContain('test-file_123.png');
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('uploadDir', () => {
    it('should contain whitelabel subdirectory', () => {
      expect(upload.uploadDir).toContain('whitelabel');
    });

    it('should be a string path', () => {
      expect(typeof upload.uploadDir).toBe('string');
    });
  });

  describe('storage configuration', () => {
    it('should have destination callback', () => {
      expect(storageDestination).toBeDefined();
      expect(typeof storageDestination).toBe('function');
    });

    it('should have filename callback', () => {
      expect(storageFilename).toBeDefined();
      expect(typeof storageFilename).toBe('function');
    });

    it('destination callback should return upload dir', () => {
      const cb = jest.fn();
      const req = {};
      const file = {};

      storageDestination(req, file, cb);

      expect(cb).toHaveBeenCalledWith(null, expect.stringContaining('whitelabel'));
    });

    it('filename callback should generate unique filename', () => {
      const cb = jest.fn();
      const req = { organization: { id: 123 } };
      const file = { originalname: 'test-file.png' };

      storageFilename(req, file, cb);

      expect(cb).toHaveBeenCalledWith(null, expect.stringMatching(/^123_\d+_test_file\.png$/));
    });

    it('filename callback should use default for missing organization', () => {
      const cb = jest.fn();
      const req = {};
      const file = { originalname: 'logo.jpg' };

      storageFilename(req, file, cb);

      expect(cb).toHaveBeenCalledWith(null, expect.stringMatching(/^default_\d+_logo\.jpg$/));
    });

    it('filename callback should sanitize basename', () => {
      const cb = jest.fn();
      const req = { organization: { id: 1 } };
      const file = { originalname: 'my file (1).png' };

      storageFilename(req, file, cb);

      expect(cb).toHaveBeenCalledWith(null, expect.stringMatching(/^1_\d+_my_file__1_\.png$/));
    });
  });

  describe('logoFilter', () => {
    it('should be captured by mock', () => {
      expect(logoFilterFn).toBeDefined();
      expect(typeof logoFilterFn).toBe('function');
    });

    it('should accept PNG files', () => {
      const cb = jest.fn();
      const req = {};
      const file = { originalname: 'logo.png', mimetype: 'image/png' };

      logoFilterFn(req, file, cb);

      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('should accept JPG files', () => {
      const cb = jest.fn();
      const req = {};
      const file = { originalname: 'logo.jpg', mimetype: 'image/jpeg' };

      logoFilterFn(req, file, cb);

      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('should accept JPEG files', () => {
      const cb = jest.fn();
      const req = {};
      const file = { originalname: 'logo.jpeg', mimetype: 'image/jpeg' };

      logoFilterFn(req, file, cb);

      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('should accept SVG files', () => {
      const cb = jest.fn();
      const req = {};
      const file = { originalname: 'logo.svg', mimetype: 'image/svg+xml' };

      logoFilterFn(req, file, cb);

      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('should reject non-image files', () => {
      const cb = jest.fn();
      const req = {};
      const file = { originalname: 'document.pdf', mimetype: 'application/pdf' };

      logoFilterFn(req, file, cb);

      expect(cb).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject GIF files', () => {
      const cb = jest.fn();
      const req = {};
      const file = { originalname: 'animation.gif', mimetype: 'image/gif' };

      logoFilterFn(req, file, cb);

      expect(cb).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('faviconFilter', () => {
    it('should be captured by mock', () => {
      expect(faviconFilterFn).toBeDefined();
      expect(typeof faviconFilterFn).toBe('function');
    });

    it('should accept ICO files', () => {
      const cb = jest.fn();
      const req = {};
      const file = { originalname: 'favicon.ico', mimetype: 'image/x-icon' };

      faviconFilterFn(req, file, cb);

      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('should accept PNG files', () => {
      const cb = jest.fn();
      const req = {};
      const file = { originalname: 'favicon.png', mimetype: 'image/png' };

      faviconFilterFn(req, file, cb);

      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('should reject JPG files for favicon', () => {
      const cb = jest.fn();
      const req = {};
      const file = { originalname: 'favicon.jpg', mimetype: 'image/jpeg' };

      faviconFilterFn(req, file, cb);

      expect(cb).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject SVG files for favicon', () => {
      const cb = jest.fn();
      const req = {};
      const file = { originalname: 'favicon.svg', mimetype: 'image/svg+xml' };

      faviconFilterFn(req, file, cb);

      expect(cb).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('directory creation', () => {
    it('should have uploadDir path containing whitelabel', () => {
      // Verify the upload directory path is configured correctly
      expect(upload.uploadDir).toBeDefined();
      expect(upload.uploadDir).toContain('whitelabel');
      expect(upload.uploadDir).toContain('uploads');
    });

    it('should have uploadLogo middleware defined', () => {
      expect(upload.uploadLogo).toBeDefined();
      expect(typeof upload.uploadLogo).toBe('function');
    });

    it('should have uploadFavicon middleware defined', () => {
      expect(upload.uploadFavicon).toBeDefined();
      expect(typeof upload.uploadFavicon).toBe('function');
    });
  });
});
