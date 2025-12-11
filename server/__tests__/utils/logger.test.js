/**
 * Logger Tests
 * Tests for server/utils/logger.js
 * Note: Logger creates file transports, so we test the exported interface
 */

describe('Logger Module', () => {
  let log;

  beforeAll(() => {
    // Import the actual logger
    log = require('../../utils/logger');
  });

  describe('exports', () => {
    it('should export error method', () => {
      expect(typeof log.error).toBe('function');
    });

    it('should export warn method', () => {
      expect(typeof log.warn).toBe('function');
    });

    it('should export info method', () => {
      expect(typeof log.info).toBe('function');
    });

    it('should export debug method', () => {
      expect(typeof log.debug).toBe('function');
    });

    it('should export http method', () => {
      expect(typeof log.http).toBe('function');
    });

    it('should export audit method', () => {
      expect(typeof log.audit).toBe('function');
    });
  });

  describe('method calls', () => {
    it('should not throw on error call', () => {
      expect(() => log.error('Test error', { key: 'value' })).not.toThrow();
    });

    it('should not throw on warn call', () => {
      expect(() => log.warn('Test warning', { key: 'value' })).not.toThrow();
    });

    it('should not throw on info call', () => {
      expect(() => log.info('Test info', { key: 'value' })).not.toThrow();
    });

    it('should not throw on debug call', () => {
      expect(() => log.debug('Test debug', { key: 'value' })).not.toThrow();
    });

    it('should not throw on http call', () => {
      expect(() => log.http('HTTP request', { method: 'GET' })).not.toThrow();
    });

    it('should not throw on audit call', () => {
      expect(() => log.audit('USER_LOGIN', { userId: 1 })).not.toThrow();
    });

    it('should accept calls without metadata', () => {
      expect(() => log.error('Error message')).not.toThrow();
      expect(() => log.warn('Warning message')).not.toThrow();
      expect(() => log.info('Info message')).not.toThrow();
      expect(() => log.debug('Debug message')).not.toThrow();
      expect(() => log.http('HTTP message')).not.toThrow();
      expect(() => log.audit('ACTION')).not.toThrow();
    });
  });
});
