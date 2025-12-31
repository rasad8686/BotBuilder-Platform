/**
 * VoiceProcessor Tests
 * Tests for voice-to-text processing service with 3-stage pipeline
 */

// Keep reference to original log mock
const mockLog = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Mock dependencies before requiring anything
jest.mock('../../../utils/logger', () => mockLog);

const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);

jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => ({
    append: jest.fn(),
    getHeaders: jest.fn(() => ({ 'content-type': 'multipart/form-data' }))
  }));
});

jest.mock('@google-cloud/speech', () => ({
  SpeechClient: jest.fn().mockImplementation(() => ({
    recognize: jest.fn(),
    streamingRecognize: jest.fn()
  }))
}));

describe('VoiceProcessor', () => {
  let VoiceProcessor;
  let processor;

  beforeEach(() => {
    // Clear mocks but keep them configured
    Object.values(mockLog).forEach(fn => fn.mockClear());
    mockFetch.mockClear();

    // Reset environment
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    // Re-require after clearing mocks
    jest.resetModules();
    VoiceProcessor = require('../../../services/voiceToBot/VoiceProcessor');
    processor = new VoiceProcessor();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(processor.config).toEqual({});
      expect(processor.supportedFormats).toEqual(['webm', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus']);
      expect(processor._metrics.totalRequests).toBe(0);
    });

    it('should accept custom config', () => {
      const customProcessor = new VoiceProcessor({
        openaiApiKey: 'test-openai-key',
        geminiApiKey: 'test-gemini-key'
      });

      expect(customProcessor._openaiApiKey).toBe('test-openai-key');
      expect(customProcessor._geminiApiKey).toBe('test-gemini-key');
    });

    it('should initialize metrics', () => {
      expect(processor._metrics).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        pipelineAccuracy: 0
      });
    });

    it('should initialize request counts', () => {
      expect(processor._requestCounts).toEqual({ google: 0, whisper: 0, gemini: 0 });
    });
  });

  describe('API key getters', () => {
    it('should return config API key if set', () => {
      const customProcessor = new VoiceProcessor({
        openaiApiKey: 'config-openai-key',
        geminiApiKey: 'config-gemini-key'
      });

      expect(customProcessor.openaiApiKey).toBe('config-openai-key');
      expect(customProcessor.geminiApiKey).toBe('config-gemini-key');
    });

    it('should fall back to environment variables', () => {
      process.env.OPENAI_API_KEY = 'env-openai-key';
      process.env.GEMINI_API_KEY = 'env-gemini-key';

      expect(processor.openaiApiKey).toBe('env-openai-key');
      expect(processor.geminiApiKey).toBe('env-gemini-key');
    });

    it('should return null/undefined if no API keys configured', () => {
      expect(processor._openaiApiKey).toBeNull();
      expect(processor._geminiApiKey).toBeNull();
    });
  });

  describe('googleSpeechClient getter', () => {
    it('should return null if GOOGLE_APPLICATION_CREDENTIALS not set', () => {
      expect(processor.googleSpeechClient).toBeNull();
    });
  });

  describe('rate limiting (_checkRateLimit)', () => {
    it('should allow requests within rate limit', () => {
      expect(processor._checkRateLimit('google')).toBe(true);
      expect(processor._requestCounts.google).toBe(1);
    });

    it('should increment request count', () => {
      processor._checkRateLimit('google');
      processor._checkRateLimit('google');
      processor._checkRateLimit('google');

      expect(processor._requestCounts.google).toBe(3);
    });

    it('should reject requests at rate limit', () => {
      // Set count to just at rate limit (300 for google)
      processor._requestCounts.google = 300;

      const result = processor._checkRateLimit('google');
      expect(result).toBe(false);
    });

    it('should reset counts after 60 seconds', () => {
      processor._requestCounts.google = 100;
      processor._lastResetTime = Date.now() - 61000;

      expect(processor._checkRateLimit('google')).toBe(true);
      expect(processor._requestCounts.google).toBe(1);
    });

    it('should handle different providers', () => {
      processor._checkRateLimit('google');
      processor._checkRateLimit('whisper');
      processor._checkRateLimit('gemini');

      expect(processor._requestCounts.google).toBe(1);
      expect(processor._requestCounts.whisper).toBe(1);
      expect(processor._requestCounts.gemini).toBe(1);
    });
  });

  describe('retry logic (_isRetryableError)', () => {
    it('should identify retryable status codes', () => {
      expect(processor._isRetryableError({ status: 429 })).toBe(true);
      expect(processor._isRetryableError({ status: 500 })).toBe(true);
      expect(processor._isRetryableError({ status: 502 })).toBe(true);
      expect(processor._isRetryableError({ status: 503 })).toBe(true);
      expect(processor._isRetryableError({ status: 504 })).toBe(true);
    });

    it('should identify non-retryable status codes', () => {
      expect(processor._isRetryableError({ status: 400 })).toBe(false);
      expect(processor._isRetryableError({ status: 401 })).toBe(false);
      expect(processor._isRetryableError({ status: 403 })).toBe(false);
      expect(processor._isRetryableError({ status: 404 })).toBe(false);
    });

    it('should identify retryable error codes', () => {
      expect(processor._isRetryableError({ code: 429 })).toBe(true);
      expect(processor._isRetryableError({ code: 503 })).toBe(true);
    });

    it('should identify retryable error messages', () => {
      expect(processor._isRetryableError({ message: 'ECONNRESET' })).toBe(true);
      expect(processor._isRetryableError({ message: 'ETIMEDOUT' })).toBe(true);
      expect(processor._isRetryableError({ message: 'ENOTFOUND' })).toBe(true);
      expect(processor._isRetryableError({ message: 'rate limit exceeded' })).toBe(true);
      expect(processor._isRetryableError({ message: 'quota exceeded' })).toBe(true);
    });

    it('should return false for non-retryable messages', () => {
      expect(processor._isRetryableError({ message: 'Invalid API key' })).toBe(false);
      expect(processor._isRetryableError({ message: 'Bad request' })).toBe(false);
    });

    it('should handle errors without message', () => {
      expect(processor._isRetryableError({})).toBe(false);
      expect(processor._isRetryableError({ message: null })).toBe(false);
    });
  });

  describe('_retryWithBackoff', () => {
    beforeEach(() => {
      processor._sleep = jest.fn().mockResolvedValue(undefined);
    });

    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await processor._retryWithBackoff(fn, 'google', 'test');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce({ status: 503, message: 'Service unavailable' })
        .mockResolvedValueOnce('success');

      const result = await processor._retryWithBackoff(fn, 'google', 'test');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const error = { status: 503, message: 'Service unavailable' };
      const fn = jest.fn().mockRejectedValue(error);

      await expect(processor._retryWithBackoff(fn, 'google', 'test')).rejects.toEqual(error);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const error = { status: 400, message: 'Bad request' };
      const fn = jest.fn().mockRejectedValue(error);

      await expect(processor._retryWithBackoff(fn, 'google', 'test')).rejects.toEqual(error);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('language utilities', () => {
    describe('getLanguageConfig', () => {
      it('should return config for supported language', () => {
        const config = processor.getLanguageConfig('en');

        expect(config.google).toBe('en-US');
        expect(config.name).toBe('English');
        expect(config.whisper).toBe('en');
        expect(config.tier).toBe(1);
      });

      it('should return config for regional variants', () => {
        // These are exact matches to the SUPPORTED_LANGUAGES keys
        const enGB = processor.getLanguageConfig('en-GB');
        expect(enGB).toBeDefined();
        expect(enGB.name).toContain('English');
      });

      it('should return English config for unknown language', () => {
        const config = processor.getLanguageConfig('xyz');

        expect(config.google).toBe('en-US');
        expect(config.name).toBe('English');
      });

      it('should handle null/undefined language', () => {
        expect(processor.getLanguageConfig(null).name).toBe('English');
        expect(processor.getLanguageConfig(undefined).name).toBe('English');
      });

      it('should be case-insensitive', () => {
        expect(processor.getLanguageConfig('EN').name).toBe('English');
        expect(processor.getLanguageConfig('TR').name).toBe('Turkish');
      });
    });

    describe('getSupportedLanguages', () => {
      it('should return array of supported languages', () => {
        const languages = processor.getSupportedLanguages();

        expect(Array.isArray(languages)).toBe(true);
        expect(languages.length).toBeGreaterThan(50);
      });

      it('should include code, name, and tier for each language', () => {
        const languages = processor.getSupportedLanguages();
        const english = languages.find(l => l.code === 'en');

        expect(english).toBeDefined();
        expect(english.name).toBe('English');
        expect(english.tier).toBe(1);
      });

      it('should include tier 1, 2, and 3 languages', () => {
        const languages = processor.getSupportedLanguages();

        expect(languages.some(l => l.tier === 1)).toBe(true);
        expect(languages.some(l => l.tier === 2)).toBe(true);
        expect(languages.some(l => l.tier === 3)).toBe(true);
      });
    });
  });

  describe('format validation', () => {
    describe('getSupportedFormats', () => {
      it('should return array of supported formats', () => {
        const formats = processor.getSupportedFormats();

        expect(formats).toContain('webm');
        expect(formats).toContain('mp3');
        expect(formats).toContain('wav');
        expect(formats).toContain('ogg');
        expect(formats).toContain('m4a');
        expect(formats).toContain('flac');
        expect(formats).toContain('opus');
      });

      it('should return a copy of the array', () => {
        const formats1 = processor.getSupportedFormats();
        const formats2 = processor.getSupportedFormats();

        expect(formats1).not.toBe(formats2);
        expect(formats1).toEqual(formats2);
      });
    });

    describe('validateFormat', () => {
      it('should return true for supported formats', () => {
        expect(processor.validateFormat('webm')).toBe(true);
        expect(processor.validateFormat('mp3')).toBe(true);
        expect(processor.validateFormat('wav')).toBe(true);
      });

      it('should return false for unsupported formats', () => {
        expect(processor.validateFormat('mp4')).toBe(false);
        expect(processor.validateFormat('avi')).toBe(false);
        expect(processor.validateFormat('unknown')).toBe(false);
      });

      it('should be case-insensitive', () => {
        expect(processor.validateFormat('WEBM')).toBe(true);
        expect(processor.validateFormat('MP3')).toBe(true);
        expect(processor.validateFormat('Wav')).toBe(true);
      });

      it('should handle null/undefined', () => {
        expect(processor.validateFormat(null)).toBe(false);
        expect(processor.validateFormat(undefined)).toBe(false);
      });
    });

    describe('validateLanguage', () => {
      it('should return true for supported languages', () => {
        expect(processor.validateLanguage('en')).toBe(true);
        expect(processor.validateLanguage('tr')).toBe(true);
        expect(processor.validateLanguage('az')).toBe(true);
      });

      it('should return false for unsupported languages', () => {
        expect(processor.validateLanguage('xyz')).toBe(false);
        expect(processor.validateLanguage('invalid')).toBe(false);
      });

      it('should be case-insensitive', () => {
        expect(processor.validateLanguage('EN')).toBe(true);
        expect(processor.validateLanguage('TR')).toBe(true);
      });

      it('should handle null/undefined', () => {
        expect(processor.validateLanguage(null)).toBe(false);
        expect(processor.validateLanguage(undefined)).toBe(false);
      });
    });
  });

  describe('transcribe (main method)', () => {
    beforeEach(() => {
      processor._sleep = jest.fn().mockResolvedValue(undefined);
    });

    it('should return error when all stages fail', async () => {
      const result = await processor.transcribe(Buffer.from('audio'), { language: 'en' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('All transcription stages failed');
      expect(processor._metrics.failedRequests).toBe(1);
    });

    it('should increment total requests', async () => {
      await processor.transcribe(Buffer.from('audio'), {});

      expect(processor._metrics.totalRequests).toBe(1);
    });

    it('should include requestId in result', async () => {
      const result = await processor.transcribe(Buffer.from('audio'), {});

      // requestId is always defined even on failure
      expect(result).toHaveProperty('requestId');
    });
  });

  describe('brand name fixes (_fixBrandNames)', () => {
    it('should fix common Eldjo misspellings', () => {
      expect(processor._fixBrandNames('Hello eljo')).toBe('Hello eldjo');
      expect(processor._fixBrandNames('Hello Eljo')).toBe('Hello Eldjo');
    });

    it('should preserve case of first letter', () => {
      expect(processor._fixBrandNames('eljo company')).toBe('eldjo company');
      expect(processor._fixBrandNames('ELJO company')).toBe('Eldjo company');
    });

    it('should handle multiple occurrences', () => {
      const result = processor._fixBrandNames('eljo is great, contact eljo today');
      expect(result).toBe('eldjo is great, contact eldjo today');
    });

    it('should return empty string for null/undefined', () => {
      expect(processor._fixBrandNames(null)).toBe('');
      expect(processor._fixBrandNames(undefined)).toBe('');
    });

    it('should not modify text without brand names', () => {
      expect(processor._fixBrandNames('Hello world')).toBe('Hello world');
    });
  });

  describe('_getBusinessPhrases', () => {
    it('should return array of business phrases', () => {
      const phrases = processor._getBusinessPhrases();

      expect(Array.isArray(phrases)).toBe(true);
      expect(phrases).toContain('Eldjo');
      expect(phrases).toContain('BotBuilder');
      expect(phrases).toContain('WhatsApp');
      expect(phrases).toContain('Telegram');
    });
  });

  describe('_getGoogleEncoding', () => {
    it('should return correct encoding for webm', () => {
      expect(processor._getGoogleEncoding('webm')).toBe('WEBM_OPUS');
    });

    it('should return correct encoding for opus', () => {
      expect(processor._getGoogleEncoding('opus')).toBe('WEBM_OPUS');
    });

    it('should return correct encoding for ogg', () => {
      expect(processor._getGoogleEncoding('ogg')).toBe('OGG_OPUS');
    });

    it('should return correct encoding for flac', () => {
      expect(processor._getGoogleEncoding('flac')).toBe('FLAC');
    });

    it('should return correct encoding for wav', () => {
      expect(processor._getGoogleEncoding('wav')).toBe('LINEAR16');
    });

    it('should return correct encoding for mp3', () => {
      expect(processor._getGoogleEncoding('mp3')).toBe('MP3');
    });

    it('should return default encoding for unknown format', () => {
      expect(processor._getGoogleEncoding('unknown')).toBe('WEBM_OPUS');
    });
  });

  describe('_getRelatedLanguages', () => {
    it('should return related languages for Azerbaijani', () => {
      const related = processor._getRelatedLanguages('az-AZ');
      expect(related).toContain('tr-TR');
      expect(related).toContain('ru-RU');
    });

    it('should return related languages for Turkish', () => {
      const related = processor._getRelatedLanguages('tr-TR');
      expect(related).toContain('az-AZ');
    });

    it('should return empty array for unknown language', () => {
      expect(processor._getRelatedLanguages('unknown')).toEqual([]);
    });
  });

  describe('confidence calculation', () => {
    describe('_calculateFinalConfidence', () => {
      it('should return base confidence when no stages succeed', () => {
        const confidence = processor._calculateFinalConfidence(null, null, null);
        expect(confidence).toBeGreaterThanOrEqual(0.7);
      });

      it('should increase confidence for stage1 success', () => {
        const stage1 = { success: true, text: 'Hello' };
        const confidenceWithStage = processor._calculateFinalConfidence(stage1, null, null);
        const confidenceWithoutStage = processor._calculateFinalConfidence(null, null, null);
        expect(confidenceWithStage).toBeGreaterThan(confidenceWithoutStage);
      });

      it('should add confidence for each successful stage', () => {
        const stage1 = { success: true, text: 'Hello' };
        const stage2 = { success: true, text: 'Hi' };
        const stage3 = 'Hello';

        const confidence = processor._calculateFinalConfidence(stage1, stage2, stage3);
        expect(confidence).toBe(0.95);
      });

      it('should add bonus for stage agreement', () => {
        const stage1 = { success: true, text: 'Same text' };
        const stage2 = { success: true, text: 'Same text' };

        const confidence = processor._calculateFinalConfidence(stage1, stage2, null);
        expect(confidence).toBe(0.95);
      });

      it('should cap confidence at 0.99', () => {
        const stage1 = { success: true, text: 'Same' };
        const stage2 = { success: true, text: 'Same' };
        const stage3 = 'Same';

        const confidence = processor._calculateFinalConfidence(stage1, stage2, stage3);
        expect(confidence).toBeLessThanOrEqual(0.99);
      });
    });

    describe('_updateAverageLatency', () => {
      it('should calculate average latency', () => {
        processor._metrics.successfulRequests = 2;
        processor._metrics.averageLatency = 100;

        processor._updateAverageLatency(200);

        expect(processor._metrics.averageLatency).toBe(150);
      });
    });
  });

  describe('metrics', () => {
    describe('getMetrics', () => {
      it('should return current metrics', () => {
        processor._metrics.totalRequests = 10;
        processor._metrics.successfulRequests = 8;
        processor._metrics.failedRequests = 2;
        processor._metrics.averageLatency = 150;

        const metrics = processor.getMetrics();

        expect(metrics.totalRequests).toBe(10);
        expect(metrics.successfulRequests).toBe(8);
        expect(metrics.failedRequests).toBe(2);
        expect(metrics.averageLatency).toBe(150);
        expect(metrics.successRate).toBe('80.00%');
      });

      it('should return 0% success rate for no requests', () => {
        const metrics = processor.getMetrics();
        expect(metrics.successRate).toBe('0%');
      });
    });
  });

  describe('preprocessAudio', () => {
    it('should return error for empty audio', async () => {
      const result = await processor.preprocessAudio(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No audio data provided');
    });

    it('should return error for unsupported format', async () => {
      const result = await processor.preprocessAudio(Buffer.from('audio'), { format: 'mp4' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported format');
    });

    it('should pass through valid audio', async () => {
      const audio = Buffer.from('test audio data');
      const result = await processor.preprocessAudio(audio, { format: 'webm' });

      expect(result.success).toBe(true);
      expect(result.buffer).toBe(audio);
      expect(result.format).toBe('webm');
    });

    it('should default to webm format', async () => {
      const audio = Buffer.from('test');
      const result = await processor.preprocessAudio(audio);

      expect(result.format).toBe('webm');
    });
  });

  describe('cleanTranscription', () => {
    it('should remove multiple spaces', () => {
      expect(processor.cleanTranscription('Hello   world')).toBe('Hello world');
    });

    it('should trim whitespace', () => {
      expect(processor.cleanTranscription('  Hello world  ')).toBe('Hello world');
    });

    it('should fix punctuation spacing', () => {
      expect(processor.cleanTranscription('Hello , world')).toBe('Hello, world');
      expect(processor.cleanTranscription('Hello .World')).toBe('Hello. World');
    });

    it('should return empty string for null/undefined', () => {
      expect(processor.cleanTranscription(null)).toBe('');
      expect(processor.cleanTranscription(undefined)).toBe('');
    });
  });

  describe('correctTranscription', () => {
    it('should return original text without API key', async () => {
      const result = await processor.correctTranscription('Hello world', 'en');

      expect(result.text).toBe('Hello world');
      expect(result.corrected).toBe(false);
    });

    it('should return empty string for empty input', async () => {
      const result = await processor.correctTranscription('', 'en');

      expect(result.text).toBe('');
      expect(result.corrected).toBe(false);
    });
  });

  describe('extractKeyPhrases', () => {
    it('should extract quoted phrases', () => {
      const phrases = processor.extractKeyPhrases('He said "Hello world" and "Goodbye"');

      expect(phrases).toContain('Hello world');
      expect(phrases).toContain('Goodbye');
    });

    it('should extract business keywords', () => {
      const phrases = processor.extractKeyPhrases('Contact Eldjo support for WhatsApp help');

      expect(phrases).toContain('Eldjo');
      expect(phrases).toContain('support');
      expect(phrases).toContain('WhatsApp');
    });

    it('should return empty array for empty input', () => {
      expect(processor.extractKeyPhrases('')).toEqual([]);
      expect(processor.extractKeyPhrases(null)).toEqual([]);
    });

    it('should limit to 10 phrases', () => {
      const longText = 'Customer support sales order product Eldjo WhatsApp Telegram Facebook bot chatbot destek musteri sifaris satis mehsul';
      const phrases = processor.extractKeyPhrases(longText);

      expect(phrases.length).toBeLessThanOrEqual(10);
    });
  });

  describe('transcribeChunk', () => {
    it('should call transcribe with isChunk option', async () => {
      processor._sleep = jest.fn().mockResolvedValue(undefined);
      const spy = jest.spyOn(processor, 'transcribe');

      await processor.transcribeChunk(Buffer.from('audio'), { language: 'en' });

      expect(spy).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ isChunk: true })
      );
    });
  });

  describe('streaming recognition', () => {
    describe('createStreamingRecognition', () => {
      it('should return null without Google client', () => {
        const result = processor.createStreamingRecognition({}, jest.fn(), jest.fn());

        expect(result).toBeNull();
      });
    });

    describe('_refineTranscript', () => {
      it('should return null for small audio buffer', async () => {
        const result = await processor._refineTranscript(Buffer.from('tiny'), 'text', 'en', {});

        expect(result).toBeNull();
      });

      it('should return null for null buffer', async () => {
        const result = await processor._refineTranscript(null, 'text', 'en', {});

        expect(result).toBeNull();
      });
    });
  });

  describe('_getCorrectionPrompt', () => {
    it('should return English prompt by default', () => {
      const prompt = processor._getCorrectionPrompt('en', 'test', '');

      expect(prompt).toContain('professional transcription correction');
      expect(prompt).toContain('test');
    });

    it('should return Turkish prompt for tr', () => {
      const prompt = processor._getCorrectionPrompt('tr', 'test', '');

      expect(prompt).toContain('Profesyonel transkripsiyon');
    });

    it('should return Azerbaijani prompt for az', () => {
      const prompt = processor._getCorrectionPrompt('az', 'test', '');

      expect(prompt).toContain('professional transkripsiya');
    });

    it('should include comparison text when provided', () => {
      const comparison = 'Source 1: "Hello"';
      const prompt = processor._getCorrectionPrompt('en', 'test', comparison);

      expect(prompt).toContain(comparison);
    });

    it('should fall back to English for unknown language', () => {
      const prompt = processor._getCorrectionPrompt('xyz', 'test', '');

      expect(prompt).toContain('professional transcription correction');
    });
  });

  describe('_buildWhisperPrompt', () => {
    it('should include business phrases', () => {
      const prompt = processor._buildWhisperPrompt(null, 'en');

      expect(prompt).toContain('Eldjo');
      expect(prompt).toContain('BotBuilder');
    });

    it('should include Google text as context', () => {
      const prompt = processor._buildWhisperPrompt('Hello from Google', 'en');

      expect(prompt).toContain('Context:');
      expect(prompt).toContain('Hello from Google');
    });

    it('should truncate long Google text', () => {
      const longText = 'a'.repeat(300);
      const prompt = processor._buildWhisperPrompt(longText, 'en');

      expect(prompt.length).toBeLessThan(longText.length + 100);
    });
  });

  describe('_sleep', () => {
    it('should return a promise', () => {
      const result = processor._sleep(1);
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
