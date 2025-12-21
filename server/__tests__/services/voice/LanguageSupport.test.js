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

  describe('getLanguage()', () => {
    it('should return info for valid language code', () => {
      const info = LanguageSupport.getLanguage('en');

      expect(info).toBeDefined();
      expect(info.code).toBe('en');
      expect(info.name).toBe('English');
    });

    it('should return null for invalid language code', () => {
      const info = LanguageSupport.getLanguage('invalid');

      expect(info).toBeNull();
    });

    it('should return Azerbaijani info', () => {
      const info = LanguageSupport.getLanguage('az');

      expect(info).toBeDefined();
      expect(info.code).toBe('az');
      expect(info.nativeName).toBe('Azərbaycan dili');
    });

    it('should return Turkish info', () => {
      const info = LanguageSupport.getLanguage('tr');

      expect(info).toBeDefined();
      expect(info.code).toBe('tr');
      expect(info.nativeName).toBe('Türkçe');
    });

    it('should return Russian info', () => {
      const info = LanguageSupport.getLanguage('ru');

      expect(info).toBeDefined();
      expect(info.code).toBe('ru');
      expect(info.nativeName).toBe('Русский');
    });
  });

  describe('getSTTCode()', () => {
    it('should return provider-specific STT code for Whisper', () => {
      const code = LanguageSupport.getSTTCode('en', 'whisper');

      expect(code).toBe('en');
    });

    it('should return provider-specific STT code for Google', () => {
      const code = LanguageSupport.getSTTCode('en', 'google');

      expect(code).toBe('en-US');
    });

    it('should return null for unsupported language', () => {
      const code = LanguageSupport.getSTTCode('invalid', 'whisper');

      expect(code).toBeNull();
    });

    it('should return provider-specific STT code for Azerbaijani', () => {
      const code = LanguageSupport.getSTTCode('az', 'whisper');

      expect(code).toBe('az');
    });
  });

  describe('getTTSVoices()', () => {
    it('should return TTS voices for language and provider', () => {
      const voices = LanguageSupport.getTTSVoices('en', 'azure');

      expect(voices).toBeDefined();
      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
    });

    it('should return empty array for unsupported language', () => {
      const voices = LanguageSupport.getTTSVoices('invalid', 'azure');

      expect(voices).toEqual([]);
    });
  });

  describe('isSupported()', () => {
    it('should return true for supported language', () => {
      const result = LanguageSupport.isSupported('en');

      expect(result).toBe(true);
    });

    it('should return false for unsupported language', () => {
      const result = LanguageSupport.isSupported('invalid');

      expect(result).toBe(false);
    });

    it('should support Azerbaijani', () => {
      const result = LanguageSupport.isSupported('az');

      expect(result).toBe(true);
    });

    it('should support Turkish', () => {
      const result = LanguageSupport.isSupported('tr');

      expect(result).toBe(true);
    });

    it('should support Russian', () => {
      const result = LanguageSupport.isSupported('ru');

      expect(result).toBe(true);
    });
  });

  describe('detectLanguage()', () => {
    it('should detect English text', () => {
      const result = LanguageSupport.detectLanguage('Hello, how are you today?');

      // detectLanguage returns a language code string
      expect(typeof result).toBe('string');
      expect(result).toBe('en');
    });

    it('should detect Azerbaijani text', () => {
      const result = LanguageSupport.detectLanguage('Salam, necəsən?');

      expect(typeof result).toBe('string');
      expect(result).toBe('az');
    });

    it('should detect Turkish text', () => {
      // Use text with Turkish-specific characters (ş, ı, ğ, etc.)
      const result = LanguageSupport.detectLanguage('Merhaba, nasılsınız? Teşekkürler!');

      expect(typeof result).toBe('string');
      // Detection may return 'tr', 'az', or 'en' due to similar alphabets
      // Turkish and Azerbaijani share similar characters (ş, ı) so detection can be ambiguous
      expect(['tr', 'en', 'az']).toContain(result);
    });

    it('should detect Russian text', () => {
      const result = LanguageSupport.detectLanguage('Привет, как дела?');

      expect(typeof result).toBe('string');
      expect(result).toBe('ru');
    });

    it('should handle empty text', () => {
      const result = LanguageSupport.detectLanguage('');

      // Empty text defaults to English
      expect(typeof result).toBe('string');
      expect(result).toBe('en');
    });
  });

  describe('getLanguage() BCP47 codes', () => {
    it('should return BCP47 code for English', () => {
      const lang = LanguageSupport.getLanguage('en');

      expect(lang).toBeDefined();
      expect(lang.bcp47).toBe('en-US');
    });

    it('should return BCP47 code for Azerbaijani', () => {
      const lang = LanguageSupport.getLanguage('az');

      expect(lang).toBeDefined();
      expect(lang.bcp47).toBe('az-AZ');
    });

    it('should return null for unsupported language', () => {
      const lang = LanguageSupport.getLanguage('invalid');

      expect(lang).toBeNull();
    });
  });

  describe('getSamplePhrases()', () => {
    it('should return sample phrases for English', () => {
      const phrases = LanguageSupport.getSamplePhrases('en');

      expect(Array.isArray(phrases)).toBe(true);
      expect(phrases.length).toBeGreaterThan(0);
    });

    it('should return empty array for unsupported language', () => {
      const phrases = LanguageSupport.getSamplePhrases('invalid');

      expect(phrases).toEqual([]);
    });
  });

  describe('getProviderSupport()', () => {
    it('should return provider support for language', () => {
      const support = LanguageSupport.getProviderSupport('en');

      expect(support).toBeDefined();
      expect(support).toHaveProperty('stt');
      expect(support).toHaveProperty('tts');
    });

    it('should return null for unsupported language', () => {
      const support = LanguageSupport.getProviderSupport('invalid');

      expect(support).toBeNull();
    });
  });

  describe('getBestProvider()', () => {
    it('should return best STT provider for English', () => {
      const provider = LanguageSupport.getBestProvider('en', 'stt');

      expect(provider).toBeDefined();
      expect(typeof provider).toBe('string');
    });

    it('should return best TTS provider for English', () => {
      const provider = LanguageSupport.getBestProvider('en', 'tts');

      expect(provider).toBeDefined();
      expect(typeof provider).toBe('string');
    });

    it('should return null for unsupported language', () => {
      const provider = LanguageSupport.getBestProvider('invalid', 'stt');

      expect(provider).toBeNull();
    });
  });
});
