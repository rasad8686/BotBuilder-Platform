/**
 * Voice Processor Service
 * Handles audio processing and transcription for voice-to-bot feature
 */

const log = require('../../utils/logger');

class VoiceProcessor {
  constructor(config = {}) {
    this.config = config;
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    this.supportedFormats = ['webm', 'mp3', 'wav', 'ogg', 'm4a', 'flac'];
    this.supportedLanguages = ['en', 'ru', 'tr', 'az', 'es', 'de', 'fr', 'zh', 'ja', 'ko', 'ar', 'pt'];
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  async transcribe(audioData, options = {}) {
    try {
      const startTime = Date.now();

      // Demo mode: return mock transcription if no API key
      if (!this.openaiApiKey) {
        return this.getMockTranscription(options.language, startTime);
      }

      const FormData = require('form-data');
      const fetch = require('node-fetch');

      const formData = new FormData();

      // Handle different audio input types
      if (Buffer.isBuffer(audioData)) {
        formData.append('file', audioData, {
          filename: `audio.${options.format || 'webm'}`,
          contentType: `audio/${options.format || 'webm'}`
        });
      } else if (typeof audioData === 'string') {
        // Base64 encoded audio
        const buffer = Buffer.from(audioData, 'base64');
        formData.append('file', buffer, {
          filename: `audio.${options.format || 'webm'}`,
          contentType: `audio/${options.format || 'webm'}`
        });
      }

      formData.append('model', 'whisper-1');

      if (options.language) {
        formData.append('language', options.language);
      }

      if (options.prompt) {
        formData.append('prompt', options.prompt);
      }

      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'word');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        text: result.text,
        language: result.language,
        duration: result.duration,
        words: result.words || [],
        segments: result.segments || [],
        confidence: this.calculateConfidence(result),
        processingTimeMs: processingTime
      };
    } catch (error) {
      log.error('Transcription error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Transcribe audio stream in real-time chunks
   */
  async transcribeChunk(audioChunk, options = {}) {
    try {
      // For real-time transcription, use smaller model or streaming API
      const result = await this.transcribe(audioChunk, {
        ...options,
        prompt: options.previousText || '' // Use previous text for context
      });

      return {
        ...result,
        isFinal: options.isFinal || false,
        chunkNumber: options.chunkNumber || 0
      };
    } catch (error) {
      log.error('Chunk transcription error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate confidence score from transcription result
   */
  calculateConfidence(result) {
    if (!result.segments || result.segments.length === 0) {
      return 0.8; // Default confidence
    }

    const avgConfidence = result.segments.reduce((sum, seg) => {
      return sum + (seg.no_speech_prob ? 1 - seg.no_speech_prob : 0.8);
    }, 0) / result.segments.length;

    return Math.round(avgConfidence * 10000) / 10000;
  }

  /**
   * Validate audio format
   */
  validateFormat(format) {
    return this.supportedFormats.includes(format.toLowerCase());
  }

  /**
   * Validate language code
   */
  validateLanguage(language) {
    return this.supportedLanguages.includes(language.toLowerCase());
  }

  /**
   * Process audio for optimal transcription
   */
  async preprocessAudio(audioData, options = {}) {
    try {
      // Basic validation
      if (!audioData) {
        return { success: false, error: 'No audio data provided' };
      }

      const buffer = Buffer.isBuffer(audioData)
        ? audioData
        : Buffer.from(audioData, 'base64');

      // Check file size (max 25MB for Whisper)
      const maxSize = 25 * 1024 * 1024;
      if (buffer.length > maxSize) {
        return { success: false, error: 'Audio file too large (max 25MB)' };
      }

      // Check minimum size
      if (buffer.length < 1000) {
        return { success: false, error: 'Audio file too small' };
      }

      return {
        success: true,
        buffer,
        size: buffer.length,
        format: options.format || 'webm'
      };
    } catch (error) {
      log.error('Audio preprocessing error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Detect language from audio
   */
  async detectLanguage(audioData, options = {}) {
    try {
      // Transcribe without specifying language to detect it
      const result = await this.transcribe(audioData, {
        ...options,
        language: undefined
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        detectedLanguage: result.language,
        confidence: result.confidence
      };
    } catch (error) {
      log.error('Language detection error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract key phrases from transcription
   */
  extractKeyPhrases(text) {
    if (!text) return [];

    // Simple keyword extraction
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      'i', 'want', 'to', 'a', 'an', 'the', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must',
      'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'as', 'of', 'at',
      'by', 'with', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'from', 'up', 'down', 'in', 'out',
      'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
      'that', 'this', 'these', 'those', 'my', 'your', 'his', 'her',
      'its', 'our', 'their', 'what', 'which', 'who', 'whom', 'when',
      'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
      'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only',
      'same', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
      'there', 'can', 'need', 'like', 'make', 'create', 'build', 'me'
    ]);

    const keyPhrases = [];
    const nGrams = [];

    // Extract single keywords
    const keywords = words.filter(word =>
      word.length > 2 &&
      !stopWords.has(word) &&
      !/^\d+$/.test(word)
    );

    // Extract 2-grams and 3-grams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (!stopWords.has(words[i]) || !stopWords.has(words[i + 1])) {
        nGrams.push(bigram);
      }

      if (i < words.length - 2) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        nGrams.push(trigram);
      }
    }

    // Count frequency
    const frequency = {};
    [...keywords, ...nGrams].forEach(phrase => {
      frequency[phrase] = (frequency[phrase] || 0) + 1;
    });

    // Sort by frequency
    const sorted = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([phrase]) => phrase);

    return sorted;
  }

  /**
   * Clean transcription text
   */
  cleanTranscription(text) {
    if (!text) return '';

    return text
      // Remove filler words
      .replace(/\b(um|uh|hmm|ah|er|like)\b/gi, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Trim
      .trim()
      // Capitalize first letter
      .replace(/^./, str => str.toUpperCase());
  }

  /**
   * Get supported formats
   */
  getSupportedFormats() {
    return [...this.supportedFormats];
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return [...this.supportedLanguages];
  }

  /**
   * Get mock transcription for demo mode
   */
  getMockTranscription(language, startTime) {
    const mockTexts = {
      en: "I want to create a customer support bot that can answer frequently asked questions about our products, handle returns and refunds, and track order status. It should be friendly and helpful.",
      ru: "Я хочу создать бота для поддержки клиентов, который сможет отвечать на часто задаваемые вопросы о наших продуктах, обрабатывать возвраты и отслеживать статус заказов.",
      tr: "Ürünlerimiz hakkında sıkça sorulan soruları yanıtlayabilen, iade ve geri ödemeleri işleyebilen ve sipariş durumunu takip edebilen bir müşteri destek botu oluşturmak istiyorum.",
      az: "Məhsullarımız haqqında tez-tez verilən suallara cavab verə bilən, geri qaytarma və geri ödəmələri idarə edə bilən və sifariş statusunu izləyə bilən müştəri dəstəyi botu yaratmaq istəyirəm."
    };

    const text = mockTexts[language] || mockTexts.en;
    const processingTime = Date.now() - startTime;

    log.info('Using mock transcription (demo mode)', { language });

    return {
      success: true,
      text,
      language: language || 'en',
      duration: 8.5,
      words: [],
      segments: [],
      confidence: 0.95,
      processingTimeMs: processingTime,
      isDemo: true
    };
  }
}

module.exports = VoiceProcessor;
