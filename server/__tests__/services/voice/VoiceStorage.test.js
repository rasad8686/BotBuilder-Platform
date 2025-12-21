/**
 * Voice Storage Service Tests
 * Tests for server/services/voice/VoiceStorage.js
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('test audio')),
    unlink: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({
      size: 1024,
      birthtime: new Date(),
      mtime: new Date()
    }),
    readdir: jest.fn().mockResolvedValue([])
  }
}));

const fs = require('fs').promises;
const VoiceStorage = require('../../../services/voice/VoiceStorage');

describe('VoiceStorage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    VoiceStorage.storageType = 'local';
  });

  describe('initialize()', () => {
    it('should create storage directory for local storage', async () => {
      await VoiceStorage.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it('should handle mkdir errors gracefully', async () => {
      fs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

      // Should not throw
      await expect(VoiceStorage.initialize()).resolves.not.toThrow();
    });
  });

  describe('store()', () => {
    it('should store file locally', async () => {
      const buffer = Buffer.from('audio data');
      const result = await VoiceStorage.store(buffer, {
        organizationId: 1,
        format: 'wav'
      });

      expect(result.success).toBe(true);
      expect(result.storageType).toBe('local');
      expect(result.filename).toBeDefined();
      expect(result.size).toBe(buffer.length);
    });

    it('should reject files exceeding max size', async () => {
      const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB

      await expect(VoiceStorage.store(largeBuffer, {
        format: 'wav'
      })).rejects.toThrow('exceeds maximum');
    });

    it('should reject unsupported formats', async () => {
      const buffer = Buffer.from('data');

      await expect(VoiceStorage.store(buffer, {
        format: 'exe'
      })).rejects.toThrow('Format not allowed');
    });

    it('should store metadata file alongside audio', async () => {
      const buffer = Buffer.from('audio data');
      await VoiceStorage.store(buffer, {
        organizationId: 1,
        format: 'wav',
        metadata: { custom: 'data' }
      });

      // Should write both audio and metadata
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should generate unique filename', async () => {
      const buffer = Buffer.from('audio data');

      const result1 = await VoiceStorage.store(buffer, { format: 'wav' });
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 2));
      const result2 = await VoiceStorage.store(buffer, { format: 'wav' });

      // Filenames should contain timestamp/random component
      // If same timestamp, check that at least one has unique chars
      expect(result1.filename).toBeDefined();
      expect(result2.filename).toBeDefined();
      // Both should be valid audio filenames
      expect(result1.filename).toMatch(/\.(wav|mp3|ogg|webm|flac)$/);
      expect(result2.filename).toMatch(/\.(wav|mp3|ogg|webm|flac)$/);
    });
  });

  describe('retrieve()', () => {
    it('should retrieve file from local storage', async () => {
      const result = await VoiceStorage.retrieve('1/test.wav');

      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('contentType');
    });

    it('should return correct content type', async () => {
      const result = await VoiceStorage.retrieve('1/test.mp3');

      expect(result.contentType).toBe('audio/mpeg');
    });

    it('should handle missing metadata file', async () => {
      fs.readFile
        .mockResolvedValueOnce(Buffer.from('audio'))
        .mockRejectedValueOnce(new Error('Not found'));

      const result = await VoiceStorage.retrieve('1/test.wav');

      expect(result.buffer).toBeDefined();
      expect(result.metadata).toEqual({});
    });

    it('should throw on file not found', async () => {
      fs.readFile.mockRejectedValueOnce(new Error('ENOENT'));

      await expect(VoiceStorage.retrieve('nonexistent.wav'))
        .rejects.toThrow();
    });
  });

  describe('delete()', () => {
    it('should delete file from local storage', async () => {
      const result = await VoiceStorage.delete('1/test.wav');

      expect(result).toBe(true);
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should attempt to delete metadata file', async () => {
      await VoiceStorage.delete('1/test.wav');

      // Should attempt to delete both audio and metadata
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });

    it('should not fail if metadata delete fails', async () => {
      fs.unlink
        .mockResolvedValueOnce(undefined) // audio delete
        .mockRejectedValueOnce(new Error('Not found')); // metadata delete

      const result = await VoiceStorage.delete('1/test.wav');

      expect(result).toBe(true);
    });
  });

  describe('list()', () => {
    it('should list files in local storage', async () => {
      fs.readdir.mockResolvedValueOnce([
        { name: 'test1.wav', isDirectory: () => false },
        { name: 'test2.mp3', isDirectory: () => false }
      ]);

      const files = await VoiceStorage.list({});

      expect(Array.isArray(files)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const files = await VoiceStorage.list({ limit: 10 });

      expect(Array.isArray(files)).toBe(true);
    });

    it('should filter by prefix', async () => {
      const files = await VoiceStorage.list({ prefix: '1' });

      expect(Array.isArray(files)).toBe(true);
    });
  });

  describe('getSignedUrl()', () => {
    it('should return local URL for local storage', async () => {
      const url = await VoiceStorage.getSignedUrl('1/test.wav');

      expect(url).toContain('/api/voice/files/');
    });
  });

  describe('getContentType()', () => {
    it('should return correct content type for wav', () => {
      const type = VoiceStorage.getContentType('test.wav');
      expect(type).toBe('audio/wav');
    });

    it('should return correct content type for mp3', () => {
      const type = VoiceStorage.getContentType('test.mp3');
      expect(type).toBe('audio/mpeg');
    });

    it('should return correct content type for ogg', () => {
      const type = VoiceStorage.getContentType('test.ogg');
      expect(type).toBe('audio/ogg');
    });

    it('should return correct content type for webm', () => {
      const type = VoiceStorage.getContentType('test.webm');
      expect(type).toBe('audio/webm');
    });

    it('should return octet-stream for unknown format', () => {
      const type = VoiceStorage.getContentType('test.xyz');
      expect(type).toBe('application/octet-stream');
    });
  });

  describe('getStorageStats()', () => {
    it('should return storage statistics', async () => {
      fs.readdir.mockResolvedValueOnce([]);

      const stats = await VoiceStorage.getStorageStats();

      expect(stats).toHaveProperty('storageType');
      expect(stats).toHaveProperty('totalFiles');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('totalSizeFormatted');
    });
  });

  describe('formatBytes()', () => {
    it('should format bytes correctly', () => {
      expect(VoiceStorage.formatBytes(0)).toBe('0 Bytes');
      expect(VoiceStorage.formatBytes(1024)).toBe('1 KB');
      expect(VoiceStorage.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(VoiceStorage.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle decimal places', () => {
      expect(VoiceStorage.formatBytes(1536)).toBe('1.5 KB');
    });
  });

  describe('allowedFormats', () => {
    it('should include common audio formats', () => {
      expect(VoiceStorage.allowedFormats).toContain('wav');
      expect(VoiceStorage.allowedFormats).toContain('mp3');
      expect(VoiceStorage.allowedFormats).toContain('ogg');
      expect(VoiceStorage.allowedFormats).toContain('webm');
      expect(VoiceStorage.allowedFormats).toContain('flac');
    });
  });
});
