/**
 * Language Support Service Tests
 * Tests for server/services/voice/LanguageSupport.js
 */

const LanguageSupport = require('../../../services/voice/LanguageSupport');

describe('LanguageSupport Service', () => {
  describe('getSupportedLanguages()', () => {
    it('should return array of supported languages', () => {
      const languages = LanguageSupport.getSupportedLanguages();

      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
    });

    it('should include required languages (az, tr, ru, en)', () => {
      const languages = LanguageSupport.getSupportedLanguages();
      const codes = languages.map(l => l.code);

      expect(codes).toContain('en');
      expect(codes).toContain('az');
      expect(codes).toContain('tr');
      expect(codes).toContain('ru');
    });

    it('should return languages with proper structure', () => {
      const languages = LanguageSupport.getSupportedLanguages();
      const first = languages[0];

      expect(first).toHaveProperty('code');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('nativeName');
    });
  });

  describe('getLanguageInfo()', () => {
    it('should return info for valid language code', () => {
      const info = LanguageSupport.getLanguageInfo('en');

      expect(info).toBeDefined();
      expect(info.code).toBe('en');
      expect(info.name).toBe('English');
    });

    it('should return null for invalid language code', () => {
      const info = LanguageSupport.getLanguageInfo('invalid');

      expect(info).toBeNull();
    });

    it('should return Azerbaijani info', () => {
      const info = LanguageSupport.getLanguageInfo('az');

      expect(info).toBeDefined();
      expect(info.code).toBe('az');
      expect(info.nativeName).toBe('Azərbaycan dili');
    });

    it('should return Turkish info', () => {
      const info = LanguageSupport.getLanguageInfo('tr');

      expect(info).toBeDefined();
      expect(info.code).toBe('tr');
      expect(info.nativeName).toBe('Türkçe');
    });

    it('should return Russian info', () => {
      const info = LanguageSupport.getLanguageInfo('ru');

      expect(info).toBeDefined();
      expect(info.code).toBe('ru');
      expect(info.nativeName).toBe('Русский');
    });
  });

  describe('getSTTCode()', () => {
    it('should return provider-specific STT code for Whisper', () => {
      const code = LanguageSupport.getSTTCode('en', 'whisper');

      expect(code).toBeDefined();
      expect(code).toBe('en');
    });

    it('should return provider-specific STT code for Google', () => {
      const code = LanguageSupport.getSTTCode('en', 'google');

      expect(code).toBeDefined();
      expect(code).toMatch(/^en-/);
    });

    it('should return provider-specific code for Azure', () => {
      const code = LanguageSupport.getSTTCode('en', 'azure');

      expect(code).toBeDefined();
    });

    it('should return null for unsupported language', () => {
      const code = LanguageSupport.getSTTCode('xyz', 'whisper');

      expect(code).toBeNull();
    });

    it('should handle Azerbaijani for different providers', () => {
      const whisperCode = LanguageSupport.getSTTCode('az', 'whisper');
      const azureCode = LanguageSupport.getSTTCode('az', 'azure');

      expect(whisperCode).toBe('az');
      expect(azureCode).toBeDefined();
    });
  });

  describe('getTTSCode()', () => {
    it('should return provider-specific TTS code', () => {
      const code = LanguageSupport.getTTSCode('en', 'azure');

      expect(code).toBeDefined();
    });

    it('should return null for unsupported language', () => {
      const code = LanguageSupport.getTTSCode('xyz', 'azure');

      expect(code).toBeNull();
    });
  });

  describe('getTTSVoices()', () => {
    it('should return array of voices for language', () => {
      const voices = LanguageSupport.getTTSVoices('en', 'azure');

      expect(Array.isArray(voices)).toBe(true);
    });

    it('should return voices for Azerbaijani', () => {
      const voices = LanguageSupport.getTTSVoices('az', 'azure');

      expect(Array.isArray(voices)).toBe(true);
    });

    it('should return voices for Turkish', () => {
      const voices = LanguageSupport.getTTSVoices('tr', 'azure');

      expect(Array.isArray(voices)).toBe(true);
    });

    it('should return empty array for unsupported', () => {
      const voices = LanguageSupport.getTTSVoices('xyz', 'unknown');

      expect(voices).toEqual([]);
    });
  });

  describe('isLanguageSupported()', () => {
    it('should return true for supported language', () => {
      expect(LanguageSupport.isLanguageSupported('en')).toBe(true);
      expect(LanguageSupport.isLanguageSupported('az')).toBe(true);
      expect(LanguageSupport.isLanguageSupported('tr')).toBe(true);
      expect(LanguageSupport.isLanguageSupported('ru')).toBe(true);
    });

    it('should return false for unsupported language', () => {
      expect(LanguageSupport.isLanguageSupported('xyz')).toBe(false);
      expect(LanguageSupport.isLanguageSupported('')).toBe(false);
      expect(LanguageSupport.isLanguageSupported(null)).toBe(false);
    });
  });

  describe('detectLanguage()', () => {
    it('should detect English text', () => {
      const result = LanguageSupport.detectLanguage('Hello, how are you?');

      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('confidence');
    });

    it('should detect Azerbaijani text', () => {
      const result = LanguageSupport.detectLanguage('Salam, necəsən?');

      expect(result).toHaveProperty('language');
    });

    it('should detect Turkish text', () => {
      const result = LanguageSupport.detectLanguage('Merhaba, nasılsın?');

      expect(result).toHaveProperty('language');
    });

    it('should detect Russian text', () => {
      const result = LanguageSupport.detectLanguage('Привет, как дела?');

      expect(result).toHaveProperty('language');
    });

    it('should handle empty text', () => {
      const result = LanguageSupport.detectLanguage('');

      expect(result).toHaveProperty('language');
      expect(result.confidence).toBe(0);
    });
  });

  describe('getSamplePhrases()', () => {
    it('should return sample phrases for language', () => {
      const phrases = LanguageSupport.getSamplePhrases('en');

      expect(Array.isArray(phrases)).toBe(true);
    });

    it('should return sample phrases for Azerbaijani', () => {
      const phrases = LanguageSupport.getSamplePhrases('az');

      expect(Array.isArray(phrases)).toBe(true);
    });

    it('should return empty array for unsupported language', () => {
      const phrases = LanguageSupport.getSamplePhrases('xyz');

      expect(phrases).toEqual([]);
    });
  });

  describe('getBCP47Code()', () => {
    it('should return BCP47 code for language', () => {
      const code = LanguageSupport.getBCP47Code('en');

      expect(code).toMatch(/^en-/);
    });

    it('should return BCP47 code for Azerbaijani', () => {
      const code = LanguageSupport.getBCP47Code('az');

      expect(code).toBe('az-AZ');
    });

    it('should return null for unsupported language', () => {
      const code = LanguageSupport.getBCP47Code('xyz');

      expect(code).toBeNull();
    });
  });
});
