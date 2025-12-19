/**
 * Multi-Language Support Service for Voice
 * Supports Azerbaijani (az), Turkish (tr), Russian (ru), English (en) and more
 */

const log = require('../../utils/logger');

class LanguageSupport {
  constructor() {
    this.languages = this.initializeLanguages();
  }

  /**
   * Initialize supported languages
   */
  initializeLanguages() {
    return {
      // Primary supported languages
      'en': {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        bcp47: 'en-US',
        whisperCode: 'en',
        googleCode: 'en-US',
        deepgramCode: 'en',
        gladiaCode: 'en',
        ttsVoices: {
          elevenlabs: ['rachel', 'adam', 'josh', 'sam'],
          azure: ['en-US-JennyNeural', 'en-US-GuyNeural'],
          google: ['en-US-Wavenet-A', 'en-US-Wavenet-B'],
          polly: ['Joanna', 'Matthew', 'Amy', 'Brian']
        },
        samplePhrases: ['Hello, how can I help you?', 'Thank you for calling.']
      },
      'az': {
        code: 'az',
        name: 'Azerbaijani',
        nativeName: 'Azərbaycan dili',
        bcp47: 'az-AZ',
        whisperCode: 'az',
        googleCode: 'az-AZ',
        deepgramCode: null, // Not supported
        gladiaCode: 'az',
        ttsVoices: {
          azure: ['az-AZ-BabekNeural', 'az-AZ-BanuNeural'],
          google: ['az-AZ-Standard-A']
        },
        samplePhrases: ['Salam, sizə necə kömək edə bilərəm?', 'Zəng etdiyiniz üçün təşəkkür edirik.']
      },
      'tr': {
        code: 'tr',
        name: 'Turkish',
        nativeName: 'Türkçe',
        bcp47: 'tr-TR',
        whisperCode: 'tr',
        googleCode: 'tr-TR',
        deepgramCode: 'tr',
        gladiaCode: 'tr',
        ttsVoices: {
          azure: ['tr-TR-AhmetNeural', 'tr-TR-EmelNeural'],
          google: ['tr-TR-Wavenet-A', 'tr-TR-Wavenet-B'],
          polly: ['Filiz']
        },
        samplePhrases: ['Merhaba, size nasıl yardımcı olabilirim?', 'Aradığınız için teşekkürler.']
      },
      'ru': {
        code: 'ru',
        name: 'Russian',
        nativeName: 'Русский',
        bcp47: 'ru-RU',
        whisperCode: 'ru',
        googleCode: 'ru-RU',
        deepgramCode: 'ru',
        gladiaCode: 'ru',
        ttsVoices: {
          azure: ['ru-RU-DmitryNeural', 'ru-RU-SvetlanaNeural'],
          google: ['ru-RU-Wavenet-A', 'ru-RU-Wavenet-B'],
          polly: ['Tatyana', 'Maxim']
        },
        samplePhrases: ['Здравствуйте, чем могу помочь?', 'Спасибо за звонок.']
      },
      // Additional languages
      'de': {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        bcp47: 'de-DE',
        whisperCode: 'de',
        googleCode: 'de-DE',
        deepgramCode: 'de',
        gladiaCode: 'de',
        ttsVoices: {
          azure: ['de-DE-ConradNeural', 'de-DE-KatjaNeural'],
          google: ['de-DE-Wavenet-A', 'de-DE-Wavenet-B'],
          polly: ['Marlene', 'Hans', 'Vicki']
        },
        samplePhrases: ['Hallo, wie kann ich Ihnen helfen?', 'Danke für Ihren Anruf.']
      },
      'fr': {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        bcp47: 'fr-FR',
        whisperCode: 'fr',
        googleCode: 'fr-FR',
        deepgramCode: 'fr',
        gladiaCode: 'fr',
        ttsVoices: {
          azure: ['fr-FR-DeniseNeural', 'fr-FR-HenriNeural'],
          google: ['fr-FR-Wavenet-A', 'fr-FR-Wavenet-B'],
          polly: ['Celine', 'Mathieu', 'Lea']
        },
        samplePhrases: ['Bonjour, comment puis-je vous aider?', 'Merci pour votre appel.']
      },
      'es': {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        bcp47: 'es-ES',
        whisperCode: 'es',
        googleCode: 'es-ES',
        deepgramCode: 'es',
        gladiaCode: 'es',
        ttsVoices: {
          azure: ['es-ES-ElviraNeural', 'es-ES-AlvaroNeural'],
          google: ['es-ES-Wavenet-A', 'es-ES-Wavenet-B'],
          polly: ['Conchita', 'Enrique', 'Lucia']
        },
        samplePhrases: ['Hola, ¿cómo puedo ayudarle?', 'Gracias por llamar.']
      },
      'ar': {
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        bcp47: 'ar-SA',
        whisperCode: 'ar',
        googleCode: 'ar-SA',
        deepgramCode: null,
        gladiaCode: 'ar',
        ttsVoices: {
          azure: ['ar-SA-HamedNeural', 'ar-SA-ZariyahNeural'],
          google: ['ar-XA-Wavenet-A', 'ar-XA-Wavenet-B']
        },
        samplePhrases: ['مرحباً، كيف يمكنني مساعدتك؟', 'شكراً لاتصالك.'],
        rtl: true
      },
      'zh': {
        code: 'zh',
        name: 'Chinese',
        nativeName: '中文',
        bcp47: 'zh-CN',
        whisperCode: 'zh',
        googleCode: 'zh-CN',
        deepgramCode: 'zh',
        gladiaCode: 'zh',
        ttsVoices: {
          azure: ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'],
          google: ['cmn-CN-Wavenet-A', 'cmn-CN-Wavenet-B'],
          polly: ['Zhiyu']
        },
        samplePhrases: ['你好，有什么可以帮助您的？', '感谢您的来电。']
      },
      'ja': {
        code: 'ja',
        name: 'Japanese',
        nativeName: '日本語',
        bcp47: 'ja-JP',
        whisperCode: 'ja',
        googleCode: 'ja-JP',
        deepgramCode: 'ja',
        gladiaCode: 'ja',
        ttsVoices: {
          azure: ['ja-JP-NanamiNeural', 'ja-JP-KeitaNeural'],
          google: ['ja-JP-Wavenet-A', 'ja-JP-Wavenet-B'],
          polly: ['Mizuki', 'Takumi']
        },
        samplePhrases: ['こんにちは、どのようなご用件でしょうか？', 'お電話ありがとうございます。']
      },
      'ko': {
        code: 'ko',
        name: 'Korean',
        nativeName: '한국어',
        bcp47: 'ko-KR',
        whisperCode: 'ko',
        googleCode: 'ko-KR',
        deepgramCode: 'ko',
        gladiaCode: 'ko',
        ttsVoices: {
          azure: ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural'],
          google: ['ko-KR-Wavenet-A', 'ko-KR-Wavenet-B'],
          polly: ['Seoyeon']
        },
        samplePhrases: ['안녕하세요, 무엇을 도와드릴까요?', '전화 감사합니다.']
      },
      'pt': {
        code: 'pt',
        name: 'Portuguese',
        nativeName: 'Português',
        bcp47: 'pt-BR',
        whisperCode: 'pt',
        googleCode: 'pt-BR',
        deepgramCode: 'pt',
        gladiaCode: 'pt',
        ttsVoices: {
          azure: ['pt-BR-FranciscaNeural', 'pt-BR-AntonioNeural'],
          google: ['pt-BR-Wavenet-A', 'pt-BR-Wavenet-B'],
          polly: ['Camila', 'Ricardo', 'Vitoria']
        },
        samplePhrases: ['Olá, como posso ajudá-lo?', 'Obrigado por ligar.']
      },
      'it': {
        code: 'it',
        name: 'Italian',
        nativeName: 'Italiano',
        bcp47: 'it-IT',
        whisperCode: 'it',
        googleCode: 'it-IT',
        deepgramCode: 'it',
        gladiaCode: 'it',
        ttsVoices: {
          azure: ['it-IT-ElsaNeural', 'it-IT-DiegoNeural'],
          google: ['it-IT-Wavenet-A', 'it-IT-Wavenet-B'],
          polly: ['Carla', 'Giorgio', 'Bianca']
        },
        samplePhrases: ['Ciao, come posso aiutarti?', 'Grazie per aver chiamato.']
      },
      'uk': {
        code: 'uk',
        name: 'Ukrainian',
        nativeName: 'Українська',
        bcp47: 'uk-UA',
        whisperCode: 'uk',
        googleCode: 'uk-UA',
        deepgramCode: null,
        gladiaCode: 'uk',
        ttsVoices: {
          azure: ['uk-UA-OstapNeural', 'uk-UA-PolinaNeural'],
          google: ['uk-UA-Standard-A']
        },
        samplePhrases: ['Привіт, чим можу допомогти?', 'Дякуємо за дзвінок.']
      }
    };
  }

  /**
   * Get all supported languages
   * @returns {Array} Language list
   */
  getSupportedLanguages() {
    return Object.values(this.languages).map(lang => ({
      code: lang.code,
      name: lang.name,
      nativeName: lang.nativeName,
      bcp47: lang.bcp47
    }));
  }

  /**
   * Get language by code
   * @param {string} code - Language code
   * @returns {Object|null} Language details
   */
  getLanguage(code) {
    // Handle various code formats
    const normalizedCode = code.split('-')[0].toLowerCase();
    return this.languages[normalizedCode] || null;
  }

  /**
   * Check if language is supported
   * @param {string} code - Language code
   * @returns {boolean} Is supported
   */
  isSupported(code) {
    return !!this.getLanguage(code);
  }

  /**
   * Get STT provider code for language
   * @param {string} langCode - Language code
   * @param {string} provider - STT provider
   * @returns {string|null} Provider-specific code
   */
  getSTTCode(langCode, provider) {
    const lang = this.getLanguage(langCode);
    if (!lang) return null;

    switch (provider) {
      case 'whisper':
        return lang.whisperCode;
      case 'google':
        return lang.googleCode;
      case 'deepgram':
        return lang.deepgramCode;
      case 'gladia':
        return lang.gladiaCode;
      default:
        return lang.bcp47;
    }
  }

  /**
   * Get TTS voices for language
   * @param {string} langCode - Language code
   * @param {string} provider - TTS provider
   * @returns {Array} Available voices
   */
  getTTSVoices(langCode, provider) {
    const lang = this.getLanguage(langCode);
    if (!lang || !lang.ttsVoices) return [];

    return lang.ttsVoices[provider] || [];
  }

  /**
   * Get default TTS voice for language
   * @param {string} langCode - Language code
   * @param {string} provider - TTS provider
   * @returns {string|null} Default voice ID
   */
  getDefaultVoice(langCode, provider) {
    const voices = this.getTTSVoices(langCode, provider);
    return voices.length > 0 ? voices[0] : null;
  }

  /**
   * Get sample phrases for language
   * @param {string} langCode - Language code
   * @returns {Array} Sample phrases
   */
  getSamplePhrases(langCode) {
    const lang = this.getLanguage(langCode);
    return lang?.samplePhrases || [];
  }

  /**
   * Detect language from text (simple heuristic)
   * @param {string} text - Text to analyze
   * @returns {string} Detected language code
   */
  detectLanguage(text) {
    // Simple character-based detection
    const charPatterns = {
      'az': /[əğıöüçş]/i,
      'ru': /[а-яА-ЯёЁ]/,
      'uk': /[іїєґ]/i,
      'ar': /[\u0600-\u06FF]/,
      'zh': /[\u4E00-\u9FFF]/,
      'ja': /[\u3040-\u309F\u30A0-\u30FF]/,
      'ko': /[\uAC00-\uD7AF]/,
      'tr': /[İıŞşĞğÜüÖöÇç]/
    };

    for (const [lang, pattern] of Object.entries(charPatterns)) {
      if (pattern.test(text)) {
        return lang;
      }
    }

    // Default to English
    return 'en';
  }

  /**
   * Get providers that support a language
   * @param {string} langCode - Language code
   * @returns {Object} Provider support status
   */
  getProviderSupport(langCode) {
    const lang = this.getLanguage(langCode);
    if (!lang) return null;

    return {
      stt: {
        whisper: !!lang.whisperCode,
        google: !!lang.googleCode,
        deepgram: !!lang.deepgramCode,
        gladia: !!lang.gladiaCode
      },
      tts: {
        elevenlabs: !!(lang.ttsVoices?.elevenlabs?.length),
        azure: !!(lang.ttsVoices?.azure?.length),
        google: !!(lang.ttsVoices?.google?.length),
        polly: !!(lang.ttsVoices?.polly?.length)
      }
    };
  }

  /**
   * Get best provider for language
   * @param {string} langCode - Language code
   * @param {string} type - 'stt' or 'tts'
   * @returns {string|null} Best provider
   */
  getBestProvider(langCode, type = 'stt') {
    const support = this.getProviderSupport(langCode);
    if (!support) return null;

    const providers = support[type];
    const preferredOrder = type === 'stt'
      ? ['whisper', 'google', 'deepgram', 'gladia']
      : ['elevenlabs', 'azure', 'google', 'polly'];

    for (const provider of preferredOrder) {
      if (providers[provider]) {
        return provider;
      }
    }

    return null;
  }
}

// Export singleton instance
module.exports = new LanguageSupport();
