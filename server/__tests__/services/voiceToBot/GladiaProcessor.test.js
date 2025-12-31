/**
 * GladiaProcessor Tests
 * Tests for Gladia real-time speech-to-text processor
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('ws', () => {
  const EventEmitter = require('events');
  class MockWebSocket extends EventEmitter {
    constructor() {
      super();
      this.readyState = 1; // OPEN
      this.OPEN = 1;
      this.CONNECTING = 0;
    }
    send = jest.fn();
    close = jest.fn();
  }
  MockWebSocket.OPEN = 1;
  MockWebSocket.CONNECTING = 0;
  return MockWebSocket;
});

jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

jest.mock('ffmpeg-static', () => '/path/to/ffmpeg');

jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const { spawn } = require('child_process');
const EventEmitter = require('events');
const GladiaProcessor = require('../../../services/voiceToBot/GladiaProcessor');

describe('GladiaProcessor', () => {
  let processor;
  let mockFfmpeg;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock FFmpeg process
    mockFfmpeg = new EventEmitter();
    mockFfmpeg.stdin = new EventEmitter();
    mockFfmpeg.stdin.write = jest.fn();
    mockFfmpeg.stdin.end = jest.fn();
    mockFfmpeg.stdin.destroyed = false;
    mockFfmpeg.stdout = new EventEmitter();
    mockFfmpeg.stdout.on = jest.fn((event, callback) => {
      mockFfmpeg.stdout[`_${event}`] = callback;
      return mockFfmpeg.stdout;
    });
    mockFfmpeg.stderr = new EventEmitter();
    mockFfmpeg.kill = jest.fn();

    spawn.mockReturnValue(mockFfmpeg);

    processor = new GladiaProcessor({ apiKey: 'test-api-key' });
  });

  describe('constructor', () => {
    it('should initialize with config API key', () => {
      const proc = new GladiaProcessor({ apiKey: 'custom-key' });
      expect(proc.apiKey).toBe('custom-key');
    });

    it('should use environment variable if no config key', () => {
      process.env.GLADIA_API_KEY = 'env-key';
      const proc = new GladiaProcessor();
      expect(proc.apiKey).toBe('env-key');
      delete process.env.GLADIA_API_KEY;
    });

    it('should set supported languages', () => {
      expect(processor.supportedLanguages).toContain('az');
      expect(processor.supportedLanguages).toContain('tr');
      expect(processor.supportedLanguages).toContain('en');
    });
  });

  describe('initSession', () => {
    it('should throw error without API key', async () => {
      const noKeyProcessor = new GladiaProcessor();
      delete process.env.GLADIA_API_KEY;

      await expect(noKeyProcessor.initSession())
        .rejects.toThrow('GLADIA_API_KEY not configured');
    });

    it('should initiate session successfully', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'session-123',
          url: 'wss://api.gladia.io/live/session-123'
        })
      });

      const result = await processor.initSession({ language: 'en' });

      expect(result.id).toBe('session-123');
      expect(result.url).toBe('wss://api.gladia.io/live/session-123');
    });

    it('should use default language if not specified', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'test', url: 'wss://test' })
      });

      await processor.initSession();

      expect(fetch).toHaveBeenCalledWith(
        'https://api.gladia.io/v2/live',
        expect.objectContaining({
          body: expect.stringContaining('"az"')
        })
      );
    });

    it('should throw error on API failure', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });

      await expect(processor.initSession())
        .rejects.toThrow('Gladia API error: 401 - Unauthorized');
    });

    it('should include custom vocabulary in request', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'test', url: 'wss://test' })
      });

      await processor.initSession({ language: 'en' });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('custom_vocabulary')
        })
      );
    });
  });

  describe('createStreamingRecognition', () => {
    it('should return null without API key', () => {
      const noKeyProcessor = new GladiaProcessor();
      delete process.env.GLADIA_API_KEY;

      const result = noKeyProcessor.createStreamingRecognition({}, jest.fn(), jest.fn());

      expect(result).toBeNull();
    });

    it('should return stream object with write and end methods', () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'test', url: 'wss://test' })
      });

      const stream = processor.createStreamingRecognition({}, jest.fn(), jest.fn());

      expect(stream).toHaveProperty('write');
      expect(stream).toHaveProperty('end');
      expect(stream).toHaveProperty('isEnded');
      expect(typeof stream.write).toBe('function');
      expect(typeof stream.end).toBe('function');
      expect(typeof stream.isEnded).toBe('function');
    });

    it('should spawn FFmpeg with correct parameters', () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'test', url: 'wss://test' })
      });

      processor.createStreamingRecognition({}, jest.fn(), jest.fn());

      expect(spawn).toHaveBeenCalledWith(
        '/path/to/ffmpeg',
        expect.arrayContaining(['-i', 'pipe:0']),
        expect.any(Object)
      );
    });

    it('should handle FFmpeg spawn error', () => {
      const errorHandler = jest.fn();
      spawn.mockImplementation(() => {
        throw new Error('FFmpeg not found');
      });

      const result = processor.createStreamingRecognition({}, jest.fn(), errorHandler);

      expect(result).toBeNull();
    });

    it('should write audio data to FFmpeg', () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'test', url: 'wss://test' })
      });

      const stream = processor.createStreamingRecognition({}, jest.fn(), jest.fn());
      const audioData = Buffer.from('test audio data');

      stream.write(audioData);

      expect(mockFfmpeg.stdin.write).toHaveBeenCalledWith(audioData);
    });

    it('should handle end correctly', () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'test', url: 'wss://test' })
      });

      const stream = processor.createStreamingRecognition({}, jest.fn(), jest.fn());

      stream.end();

      expect(stream.isEnded()).toBe(true);
      expect(mockFfmpeg.stdin.end).toHaveBeenCalled();
    });

    it('should not write after end', () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'test', url: 'wss://test' })
      });

      const stream = processor.createStreamingRecognition({}, jest.fn(), jest.fn());

      stream.end();
      mockFfmpeg.stdin.write.mockClear();

      stream.write(Buffer.from('test'));

      expect(mockFfmpeg.stdin.write).not.toHaveBeenCalled();
    });

    it('should handle session init error', async () => {
      const errorHandler = jest.fn();
      fetch.mockRejectedValue(new Error('Network error'));

      processor.createStreamingRecognition({}, jest.fn(), errorHandler);

      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should pass language option to initSession', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'test', url: 'wss://test' })
      });

      processor.createStreamingRecognition({ language: 'tr' }, jest.fn(), jest.fn());

      // Wait for async call
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"tr"')
        })
      );
    });
  });

  describe('fixBrandNames', () => {
    it('should fix Eldjo variants', () => {
      expect(processor.fixBrandNames('eljo')).toBe('eldjo');
      expect(processor.fixBrandNames('Eljo')).toBe('Eldjo');
      expect(processor.fixBrandNames('elço')).toBe('eldjo');
      expect(processor.fixBrandNames('Elço')).toBe('Eldjo');
      expect(processor.fixBrandNames('elco')).toBe('eldjo');
      expect(processor.fixBrandNames('Elco')).toBe('Eldjo');
    });

    it('should fix Raci variants', () => {
      expect(processor.fixBrandNames('razı')).toBe('Raci');
      expect(processor.fixBrandNames('Razı')).toBe('Raci');
      expect(processor.fixBrandNames('razi')).toBe('Raci');
    });

    it('should fix Beden to Bana', () => {
      expect(processor.fixBrandNames('Beden')).toBe('Bana');
      expect(processor.fixBrandNames('beden')).toBe('bana');
    });

    it('should return empty string for null input', () => {
      expect(processor.fixBrandNames(null)).toBe('');
      expect(processor.fixBrandNames(undefined)).toBe('');
    });

    it('should not modify unrelated text', () => {
      expect(processor.fixBrandNames('hello world')).toBe('hello world');
    });

    it('should handle multiple corrections in same text', () => {
      const result = processor.fixBrandNames('eljo razı yarat');
      expect(result).toContain('eldjo');
      expect(result).toContain('Raci');
    });

    it('should handle case-insensitive matching', () => {
      expect(processor.fixBrandNames('ELJO')).toBe('Eldjo');
      expect(processor.fixBrandNames('RAZI')).toBe('Raci');
    });

    it('should fix pattern-based variants', () => {
      expect(processor.fixBrandNames('elzur')).toBe('eldjo');
      expect(processor.fixBrandNames('eldju')).toBe('eldjo');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return array of supported languages', () => {
      const languages = processor.getSupportedLanguages();

      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
    });

    it('should include key languages', () => {
      const languages = processor.getSupportedLanguages();

      expect(languages).toContain('az');
      expect(languages).toContain('tr');
      expect(languages).toContain('ru');
      expect(languages).toContain('en');
    });

    it('should return copy of array', () => {
      const languages1 = processor.getSupportedLanguages();
      const languages2 = processor.getSupportedLanguages();

      expect(languages1).not.toBe(languages2);
      expect(languages1).toEqual(languages2);
    });
  });
});
