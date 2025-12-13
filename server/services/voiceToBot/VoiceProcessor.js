/**
 * Voice Processor Service
 * Handles audio processing and transcription for voice-to-bot feature
 * Supports: Google Cloud STT (primary), Whisper (fallback), Gemini (correction)
 */

const log = require('../../utils/logger');

class VoiceProcessor {
  constructor(config = {}) {
    this.config = config;
    // Note: API keys are read lazily to ensure dotenv is loaded
    this._openaiApiKey = config.openaiApiKey || null;
    this._geminiApiKey = config.geminiApiKey || null;
    this._googleSpeechClient = null;
    this.supportedFormats = ['webm', 'mp3', 'wav', 'ogg', 'm4a', 'flac'];
    this.supportedLanguages = ['en', 'ru', 'tr', 'az', 'es', 'de', 'fr', 'zh', 'ja', 'ko', 'ar', 'pt'];
  }

  // Lazy getters for API keys - ensures dotenv is loaded before reading
  get openaiApiKey() {
    return this._openaiApiKey || process.env.OPENAI_API_KEY;
  }

  get geminiApiKey() {
    return this._geminiApiKey || process.env.GEMINI_API_KEY;
  }

  // Lazy getter for Google Cloud Speech client
  get googleSpeechClient() {
    if (!this._googleSpeechClient && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const speech = require('@google-cloud/speech');
        this._googleSpeechClient = new speech.SpeechClient();
        log.info('Google Cloud Speech client initialized');
      } catch (error) {
        log.warn('Google Cloud Speech client failed to initialize', { error: error.message });
        this._googleSpeechClient = null;
      }
    }
    return this._googleSpeechClient;
  }

  /**
   * Transcribe audio - Google Cloud STT (primary) + Whisper (fallback) + Gemini (correction)
   * Pipeline: Google STT → Gemini AI Correction → Post-processing
   */
  async transcribe(audioData, options = {}) {
    try {
      const startTime = Date.now();
      let result = null;
      let baseText = null;

      // STEP 1: Try Google Cloud STT FIRST (best quality for Az/Tr)
      if (this.googleSpeechClient) {
        result = await this.transcribeWithGoogleCloud(audioData, options, startTime);
        if (result.success) {
          baseText = result.text;
          log.info('Google Cloud STT transcription', { text: baseText.substring(0, 100), provider: 'google' });
        } else {
          log.warn('Google Cloud STT failed, trying Whisper', { error: result.error });
        }
      }

      // STEP 2: Fallback to Whisper if Google failed
      if (!baseText && this.openaiApiKey) {
        const customPrompt = 'Eldjo bot, Eldjo chatbot, Eldjo müştəri botu, Eldjo satış botu, Eldjo şirkəti, Eldjo platforması. Eldjo Eldjo Eldjo.';
        const lang = options.language;
        const whisperLang = (lang === 'az' || lang === 'tr') ? 'az' : lang;

        result = await this.transcribeWithWhisper(audioData, {
          ...options,
          language: whisperLang,
          prompt: customPrompt
        }, startTime);

        if (result.success) {
          baseText = result.text;
          log.info('Whisper transcription', { text: baseText.substring(0, 100), provider: 'whisper' });
        } else {
          log.warn('Whisper transcription failed, trying Gemini only', { error: result.error });
        }
      }

      // STEP 3: Use Gemini to CORRECT the transcription (or transcribe if all failed)
      if (this.geminiApiKey) {
        if (baseText) {
          // Gemini CORRECTION mode - fix mistakes
          const correctedText = await this.correctWithGemini(baseText, options.language || 'az');
          if (correctedText) {
            result.text = correctedText;
            result.correctedByGemini = true;
            log.info('Gemini correction applied', { original: baseText.substring(0, 50), corrected: correctedText.substring(0, 50) });
          }
        } else {
          // Gemini TRANSCRIPTION mode - no other result available
          result = await this.transcribeWithGemini(audioData, options, startTime);
          if (result.success) {
            baseText = result.text;
          }
        }
      }

      // STEP 4: Apply post-processing to fix brand names
      if (result && result.success) {
        result.text = this.fixBrandNames(result.text);
        result.processingTimeMs = Date.now() - startTime;
        return result;
      }

      // Demo mode: return mock transcription if no API key
      return this.getMockTranscription(options.language, startTime);
    } catch (error) {
      log.error('Transcription error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Transcribe audio using Google Cloud Speech-to-Text
   * Best quality for Azerbaijani and Turkish
   */
  async transcribeWithGoogleCloud(audioData, options, startTime) {
    try {
      const client = this.googleSpeechClient;
      if (!client) {
        return { success: false, error: 'Google Cloud Speech client not available' };
      }

      // Convert audio to base64
      let audioBase64;
      if (Buffer.isBuffer(audioData)) {
        audioBase64 = audioData.toString('base64');
      } else if (typeof audioData === 'string') {
        audioBase64 = audioData;
      }

      // Map language codes to Google format
      const langMap = {
        'az': 'az-AZ',
        'tr': 'tr-TR',
        'en': 'en-US',
        'ru': 'ru-RU',
        'de': 'de-DE',
        'fr': 'fr-FR',
        'es': 'es-ES'
      };
      const languageCode = langMap[options.language] || 'az-AZ';

      // Get encoding based on format
      const encodingMap = {
        'webm': 'WEBM_OPUS',
        'ogg': 'OGG_OPUS',
        'flac': 'FLAC',
        'wav': 'LINEAR16',
        'mp3': 'MP3'
      };
      const encoding = encodingMap[options.format] || 'WEBM_OPUS';

      const request = {
        audio: {
          content: audioBase64
        },
        config: {
          encoding: encoding,
          sampleRateHertz: options.format === 'wav' ? 16000 : undefined,
          languageCode: languageCode,
          // Alternative languages for better recognition
          alternativeLanguageCodes: languageCode === 'az-AZ' ? ['tr-TR', 'ru-RU'] : undefined,
          // Enable automatic punctuation
          enableAutomaticPunctuation: true,
          // Speech adaptation for brand names
          speechContexts: [{
            phrases: ['Eldjo', 'Eldjo bot', 'Eldjo chatbot', 'Eldjo müştəri', 'Eldjo satış'],
            boost: 20
          }],
          // Model selection
          model: 'latest_long',
          useEnhanced: true
        }
      };

      const [response] = await client.recognize(request);
      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join(' ');

      if (!transcription || transcription.trim() === '') {
        return { success: false, error: 'No transcription returned from Google Cloud' };
      }

      const processingTime = Date.now() - startTime;

      // Get confidence
      const confidence = response.results[0]?.alternatives[0]?.confidence || 0.9;

      return {
        success: true,
        text: transcription,
        language: options.language,
        duration: 0,
        words: [],
        segments: [],
        confidence: confidence,
        processingTimeMs: processingTime,
        provider: 'google-cloud'
      };
    } catch (error) {
      log.error('Google Cloud STT error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Use Gemini to correct Whisper transcription errors
   * Especially effective for brand names like "Eldjo"
   */
  async correctWithGemini(text, language = 'az') {
    try {
      const fetch = require('node-fetch');

      const correctionPrompts = {
        az: `Aşağıdakı transkripsiyanı düzəlt.
DİQQƏT: "Eldjo" brend adıdır və MÜTLƏQ "Eldjo" kimi yazılmalıdır.
Səhv variantlar: eldju, elçu, elcü, el-djo, bildru, elzur, ildur, əl çoğu, elçin, elçi və s.
Hamısını "Eldjo" ilə əvəz et.
Yalnız düzəldilmiş mətni qaytar, başqa heç nə yazma.

Transkripsiya: "${text}"`,
        tr: `Aşağıdaki transkripsiyonu düzelt.
DİKKAT: "Eldjo" marka adıdır ve MUTLAKA "Eldjo" olarak yazılmalıdır.
Yanlış varyantlar: eldju, elçu, elcü, el-djo, bildru, elzur, ildur ve benzerleri.
Hepsini "Eldjo" ile değiştir.
Sadece düzeltilmiş metni döndür, başka bir şey yazma.

Transkripsiyon: "${text}"`,
        en: `Correct the following transcription.
IMPORTANT: "Eldjo" is a brand name and MUST be spelled exactly as "Eldjo".
Wrong variants: eldju, el-djo, bildru, elzur, ildur, etc.
Replace all of them with "Eldjo".
Return ONLY the corrected text, nothing else.

Transcription: "${text}"`,
        ru: `Исправьте следующую транскрипцию.
ВАЖНО: "Eldjo" - это название бренда и ДОЛЖНО быть написано именно как "Eldjo".
Неправильные варианты: eldju, el-djo, bildru, elzur, ildur и т.д.
Замените все на "Eldjo".
Верните ТОЛЬКО исправленный текст.

Транскрипция: "${text}"`
      };

      const prompt = correctionPrompts[language] || correctionPrompts.en;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 500
            }
          })
        }
      );

      if (!response.ok) {
        log.warn('Gemini correction failed', { status: response.status });
        return null;
      }

      const result = await response.json();
      const correctedText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      return correctedText || null;
    } catch (error) {
      log.error('Gemini correction error', { error: error.message });
      return null;
    }
  }

  /**
   * Transcribe audio using Google Gemini API
   */
  async transcribeWithGemini(audioData, options, startTime) {
    try {
      const fetch = require('node-fetch');

      // Convert audio to base64
      let audioBase64;
      if (Buffer.isBuffer(audioData)) {
        audioBase64 = audioData.toString('base64');
      } else if (typeof audioData === 'string') {
        audioBase64 = audioData;
      }

      const mimeType = `audio/${options.format || 'webm'}`;
      const language = options.language || 'en';

      // Language-specific prompt for better transcription
      // IMPORTANT: "Eldjo" is a brand name - must be spelled exactly as "Eldjo"
      const languagePrompts = {
        en: 'Transcribe this audio word-for-word. CRITICAL: The brand name "Eldjo" must be spelled exactly as "Eldjo" (not Eldju, El-djo, or any other variation). Return ONLY the transcribed text, nothing else.',
        az: 'Bu audionu sözbəsöz transkripsiya edin. KRİTİK: "Eldjo" brend adı dəqiq "Eldjo" kimi yazılmalıdır (Eldju, El-djo və ya başqa variant yox). YALNIZ transkripsiya edilmiş mətni qaytarın.',
        ru: 'Транскрибируйте это аудио дословно. ВАЖНО: Название бренда "Eldjo" должно быть написано именно как "Eldjo" (не Eldju, El-djo или другие варианты). Верните ТОЛЬКО транскрибированный текст.',
        tr: 'Bu sesi kelimesi kelimesine yazıya dökün. KRİTİK: "Eldjo" marka adı tam olarak "Eldjo" şeklinde yazılmalıdır (Eldju, El-djo veya başka bir varyasyon değil). SADECE yazıya dökülmüş metni döndürün.'
      };

      const prompt = languagePrompts[language] || languagePrompts.en;

      // Use Gemini 2.5 Flash for best audio transcription
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: audioBase64
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1000
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${error}`);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!text) {
        throw new Error('No transcription returned from Gemini');
      }

      // Post-process: Fix common misrecognitions of "Eldjo"
      const correctedText = this.fixBrandNames(text);

      const processingTime = Date.now() - startTime;

      log.info('Gemini transcription successful', { language, textLength: correctedText.length });

      return {
        success: true,
        text: correctedText,
        language: language,
        duration: 0,
        words: [],
        segments: [],
        confidence: 0.95,
        processingTimeMs: processingTime,
        provider: 'gemini'
      };
    } catch (error) {
      log.error('Gemini transcription error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper (fallback)
   */
  async transcribeWithWhisper(audioData, options, startTime) {
    try {
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
        processingTimeMs: processingTime,
        provider: 'whisper'
      };
    } catch (error) {
      log.error('Whisper transcription error', { error: error.message });
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
   * Create a streaming recognition session for real-time transcription
   * Uses Google Cloud Speech-to-Text Streaming API
   * @param {Object} options - Streaming options
   * @param {Function} onResult - Callback for transcription results
   * @param {Function} onError - Callback for errors
   * @returns {Object} - { write, end, stream }
   */
  createStreamingRecognition(options = {}, onResult, onError) {
    const client = this.googleSpeechClient;
    if (!client) {
      log.warn('Google Cloud Speech client not available for streaming');
      return null;
    }

    const language = options.language || 'az';
    const langMap = {
      'az': 'az-AZ',
      'tr': 'tr-TR',
      'en': 'en-US',
      'ru': 'ru-RU',
      'de': 'de-DE',
      'fr': 'fr-FR',
      'es': 'es-ES'
    };
    const languageCode = langMap[language] || 'az-AZ';

    // Configure streaming request - optimized for FAST interim results with accuracy
    const request = {
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        audioChannelCount: 1,
        languageCode: languageCode,
        // Use 'default' model for fast interim results
        model: 'default',
        useEnhanced: false,
        enableAutomaticPunctuation: false,
        profanityFilter: false,
        // STRONG speech adaptation - repeat Eldjo many times for maximum recognition
        speechContexts: [{
          phrases: [
            // BRAND NAME - MAXIMUM PRIORITY - repeat multiple times
            'Eldjo', 'Eldjo', 'Eldjo', 'Eldjo', 'Eldjo',
            'eldjo', 'ELDJO',
            // Common full phrases with Eldjo
            'Eldjo bot', 'Eldjo botu', 'Eldjo chatbot',
            'mənə Eldjo', 'bana Eldjo', 'bir Eldjo',
            'mənə Eldjo bot', 'bana Eldjo bot',
            'mənə Eldjo bot yarat', 'bana Eldjo bot yarat',
            'Eldjo bot yarat', 'Eldjo botu yarat',
            // Possible misrecognitions to boost correct form
            'Elco bot', 'Elço bot', 'Eljo bot',
            // Common Turkish/Azerbaijani phrases
            'bot yarat', 'botu yarat', 'chatbot yarat',
            'mənə bot', 'bana bot', 'bir bot',
            'mənə', 'bana', 'yarat', 'bot', 'botu',
            // Related business words
            'müştəri', 'satış', 'dəstək', 'chatbot', 'müşteri'
          ],
          boost: 20
        }],
        singleUtterance: false
      },
      interimResults: true
    };

    log.info('Creating streaming recognition', { languageCode, model: 'default' });

    try {
      let isStreamEnded = false;
      let lastTranscript = '';

      const recognizeStream = client
        .streamingRecognize(request)
        .on('error', (error) => {
          log.error('Streaming recognition error', { error: error.message, code: error.code });

          // Don't report errors if stream was intentionally ended
          if (isStreamEnded && error.code === 1) {
            return; // Cancelled error after end() is expected
          }

          if (onError) onError(error);
        })
        .on('data', (data) => {
          if (isStreamEnded) return;

          if (data.results && data.results[0]) {
            const result = data.results[0];
            const transcript = result.alternatives[0]?.transcript || '';
            const isFinal = result.isFinal;
            const confidence = result.alternatives[0]?.confidence || 0;

            // Skip duplicate interim results
            if (!isFinal && transcript === lastTranscript) {
              return;
            }
            lastTranscript = transcript;

            // Log RAW transcript BEFORE fix (for debugging misrecognitions)
            log.info('[STT RAW]', {
              isFinal,
              raw: transcript,
              stability: result.stability || 0
            });

            // Apply brand name fixes
            const correctedTranscript = this.fixBrandNames(transcript);

            // Log if correction was made
            if (correctedTranscript !== transcript) {
              log.info('[STT CORRECTED]', {
                from: transcript,
                to: correctedTranscript
              });
            }

            if (onResult) {
              onResult({
                transcript: correctedTranscript,
                isFinal,
                confidence,
                raw: transcript,
                stability: result.stability || 0
              });
            }

            if (isFinal) {
              log.debug('Streaming final result', {
                transcript: correctedTranscript.substring(0, 50),
                confidence
              });
            }
          }
        })
        .on('end', () => {
          log.debug('Streaming recognition ended');
          isStreamEnded = true;
        });

      log.info('Streaming recognition session created', { languageCode });

      return {
        stream: recognizeStream,
        write: (audioData) => {
          if (recognizeStream && !recognizeStream.destroyed && !isStreamEnded) {
            try {
              recognizeStream.write(audioData);
            } catch (e) {
              log.warn('Error writing to stream', { error: e.message });
            }
          }
        },
        end: () => {
          if (recognizeStream && !recognizeStream.destroyed && !isStreamEnded) {
            isStreamEnded = true;
            try {
              recognizeStream.end();
            } catch (e) {
              log.warn('Error ending stream', { error: e.message });
            }
          }
        },
        isEnded: () => isStreamEnded
      };
    } catch (error) {
      log.error('Failed to create streaming recognition', { error: error.message });
      if (onError) onError(error);
      return null;
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
   * Fix common misrecognitions of brand names (post-processing)
   * This runs AFTER transcription to catch ALL variations including Azerbaijani/Turkish
   */
  fixBrandNames(text) {
    if (!text) return '';

    let result = text;

    // EXACT string replacements (case-insensitive) - highest priority
    const exactReplacements = [
      // Turkish misrecognitions (MOST COMMON) - from real logs
      'Ebru', 'ebru', 'EBRU',
      'yılsu', 'Yılsu', 'yilsu', 'Yilsu',
      'yıldız', 'Yıldız', 'yildiz', 'Yildiz',
      'yılsı', 'Yılsı', 'yilsi', 'Yilsi',
      'vallahi', 'Vallahi',
      'elcio', 'Elcio', 'eljio', 'Eljio',
      // Two-word splits (VERY COMMON in interim results)
      'el jo', 'El Jo', 'el co', 'El Co', 'el cu', 'El Cu',
      'el çu', 'El Çu', 'el ço', 'El Ço', 'el ce', 'El Ce',
      'eld jo', 'Eld Jo', 'eld co', 'Eld Co',
      'el yo', 'El Yo', 'el go', 'El Go',
      'el do', 'El Do', 'eld o', 'Eld O',
      // Azerbaijani/Turkish misrecognitions
      'əl çoğu', 'əl çogu', 'əl coğu', 'əl cogu', 'el çoğu', 'el çogu',
      'el coğu', 'el cogu', 'əlçoğu', 'əlçogu', 'elçoğu', 'elçogu',
      'al chogu', 'al çogu', 'al cogu', 'alchogu',
      'elçin', 'elçi', 'elçü', 'elcü', 'elcu', 'elçu',
      'elçin borcu', 'elçin borcu ölçüsü',
      // Single word Turkish variations
      'eldo', 'Eldo', 'ello', 'Ello', 'elyo', 'Elyo',
      'elce', 'Elce', 'elge', 'Elge',
      // Common speech recognition errors
      'elzur', 'el-zur', 'el zur', 'ilzur', 'il-zur', 'elzür', 'ilzür',
      'elzu', 'ilzu', 'elsu', 'ilsu', 'elzü', 'ilzü',
      // English misrecognitions
      'el-dru', 'el dru', 'eldru', 'ildru', 'il-dru', 'il dru',
      'eudru', 'eu-dru', 'eu dru', 'udru', 'edru',
      'bildru', 'bild-ru', 'bildşu', 'bildsu', 'bildshu',
      // German/Slavic misrecognitions
      'eldzü', 'eldzu', 'eldzju', 'eldžu', 'eldjü', 'eldju',
      'ildzü', 'ildzu', 'ildzju', 'ildžu', 'ildjü', 'ildju',
      // Close variations
      'eltju', 'el-dju', 'el-djo', 'elcjo', 'elcju', 'eld-ju',
      // Other variations
      'eljo', 'elljo', 'eltjo', 'eltjo', 'eldyo', 'elidjo',
      'el-jo', 'eld-jo',
      // More edge cases
      'elgeo', 'elgio', 'elgyo', 'eljio', 'elzho', 'eljou',
      'eldio', 'eltio', 'elchio', 'elcio', 'elsio',
      'ildur', 'İldur', 'eldur', 'Eldur',
      'elco', 'elço', 'elso', 'elşo',
      // Additional Turkish/Azerbaijani sounds
      'əlco', 'Əlco', 'əlço', 'Əlço', 'əlyo', 'Əlyo',
      'elcə', 'Elcə', 'elcö', 'Elcö'
    ];

    for (const wrong of exactReplacements) {
      // Case-insensitive replacement
      const regex = new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      result = result.replace(regex, (match) => {
        // Preserve capitalization of first letter
        if (match[0] === match[0].toUpperCase()) {
          return 'Eldjo';
        }
        return 'eldjo';
      });
    }

    // Pattern-based replacements for remaining edge cases
    const patterns = [
      /\b[Ee]l[dt]?[jžzs][oauüi]+\b/g,           // Eldjo, Eldzu, Eldzü, etc.
      /\b[Bb]ild[šsž]?[uüoaə]+\b/g,              // Bildşu, Bildsu, etc.
      /\b[Ii]l[dt]?[jžzs]?[oauüi]+\b/g,          // Ildjo, Iltju, etc.
      /\b[Ee][uü]?d?r[uoü]+\b/g,                 // Eudru, Eüdru, etc.
    ];

    for (const pattern of patterns) {
      result = result.replace(pattern, (match) => {
        if (match[0] === match[0].toUpperCase()) {
          return 'Eldjo';
        }
        return 'eldjo';
      });
    }

    return result;
  }

  /**
   * Simplify exotic characters in names (hard-coded backup for GPT)
   * Converts exotic diacritics to simple Latin letters
   * Examples: Eldžu → Eldjo, Eldzü → Eldjo, Müšteri → Musteri
   */
  simplifyExoticNames(text) {
    if (!text) return '';

    // Character mapping for exotic → simple
    const charMap = {
      // Slavic/Czech/Slovak characters
      'ž': 'j', 'Ž': 'J',  // ž sounds like "zh" but simplify to j for "Eldjo"
      'š': 's', 'Š': 'S',
      'č': 'c', 'Č': 'C',
      'ř': 'r', 'Ř': 'R',
      'ď': 'd', 'Ď': 'D',
      'ť': 't', 'Ť': 'T',
      'ň': 'n', 'Ň': 'N',
      'ě': 'e', 'Ě': 'E',
      'ů': 'u', 'Ů': 'U',
      // German umlauts (when used in names)
      'ü': 'u', 'Ü': 'U',
      'ö': 'o', 'Ö': 'O',
      'ä': 'a', 'Ä': 'A',
      'ß': 'ss',
      // Spanish/Portuguese
      'ñ': 'n', 'Ñ': 'N',
      'ã': 'a', 'Ã': 'A',
      'õ': 'o', 'Õ': 'O',
      // Polish
      'ł': 'l', 'Ł': 'L',
      'ż': 'z', 'Ż': 'Z',
      'ź': 'z', 'Ź': 'Z',
      'ą': 'a', 'Ą': 'A',
      'ę': 'e', 'Ę': 'E',
      'ć': 'c', 'Ć': 'C',
      'ś': 's', 'Ś': 'S',
      // Nordic
      'å': 'a', 'Å': 'A',
      'æ': 'ae', 'Æ': 'AE',
      'ø': 'o', 'Ø': 'O',
      // Romanian
      'ș': 's', 'Ș': 'S',
      'ț': 't', 'Ț': 'T',
      'ă': 'a', 'Ă': 'A',
      'î': 'i', 'Î': 'I',
      // Hungarian
      'ő': 'o', 'Ő': 'O',
      'ű': 'u', 'Ű': 'U'
    };

    // Apply character replacements
    let result = text;
    for (const [exotic, simple] of Object.entries(charMap)) {
      result = result.split(exotic).join(simple);
    }

    // Special patterns for "Eldjo" variations
    // Eldžu, Eldzü, Eldzu, Eldzju → Eldjo
    result = result.replace(/\bEld[zž][uüjü]+\b/gi, (match) => {
      // Preserve case
      if (match[0] === 'E' && match[1] === 'L') return 'ELDJO';
      if (match[0] === 'E') return 'Eldjo';
      return 'eldjo';
    });

    // Also catch "Eldzju", "Eldjü", etc.
    result = result.replace(/\bEldj[uü]+\b/gi, (match) => {
      if (match[0] === 'E' && match[1] === 'L') return 'ELDJO';
      if (match[0] === 'E') return 'Eldjo';
      return 'eldjo';
    });

    return result;
  }

  /**
   * Get language-specific correction prompt
   */
  getLanguagePrompt(language) {
    const prompts = {
      en: `You are a transcription corrector for English speech-to-text output. The user is describing a chatbot they want to create.

Your task:
1. Fix speech recognition errors (similar sounding words mistaken for each other)
2. Fix grammar and spelling mistakes
3. Keep the original meaning and intent
4. The context is: user describing what kind of bot they want
5. CRITICAL: For proper names (bot names, company names, brand names), use SIMPLE LATIN letters only!

Common English errors to fix:
- "otu" / "bought" → "bot"
- "at" / "chat" → "chat" or "chatbot"
- "bought builder" → "bot builder"

Name simplification rules (VERY IMPORTANT):
- Convert exotic characters to simple Latin: ž→j, š→s, č→c, ñ→n, ü→u, ö→o, ä→a
- Examples: "Eldžu" → "Eldjo", "Müşteri" → "Musteri", "Çay" → "Cay"
- If a name sounds like a simple word, use simple spelling
- Bot/company names should be easy to type and remember

IMPORTANT: Return ONLY the corrected English text, nothing else.`,

      ru: `Вы корректор транскрипции для русского речевого ввода. Пользователь описывает чат-бота, которого хочет создать.

Ваша задача:
1. Исправить ошибки распознавания речи (похожие по звучанию слова)
2. Исправить грамматические и орфографические ошибки
3. Сохранить оригинальный смысл
4. Контекст: пользователь описывает бота
5. ВАЖНО: Для имён собственных (названия ботов, компаний) используйте ПРОСТЫЕ буквы!

Частые ошибки в русском:
- "бот" / "бод" / "вот" → "бот"
- "чат" / "чад" → "чат"
- "создать бота" / "создать вода" → "создать бота"

Упрощение названий (ОЧЕНЬ ВАЖНО):
- Экзотические буквы → простые: ž→j, š→s, č→c
- Примеры: "Eldžu" → "Eldjo", "Элджу" → "Элджо"
- Названия ботов должны быть простыми для ввода

ВАЖНО: Верните ТОЛЬКО исправленный русский текст, без пояснений.`,

      tr: `Türkçe konuşma-metin çıktısı için transkripsiyon düzelticisiniz. Kullanıcı oluşturmak istediği bir chatbot'u anlatıyor.

Göreviniz:
1. Konuşma tanıma hatalarını düzeltin (benzer sesli kelimeler)
2. Dilbilgisi ve yazım hatalarını düzeltin
3. Orijinal anlamı koruyun
4. Bağlam: kullanıcı bir bot tanımlıyor
5. KRİTİK: Özel isimler (bot adları, şirket adları) için BASİT Latin harfleri kullanın!

Yaygın Türkçe hatalar:
- "bot" / "bot" / "bod" → "bot"
- "sohbet" / "şohet" → "sohbet"

İsim sadeleştirme kuralları (ÇOK ÖNEMLİ):
- Egzotik harfleri basit Latin'e çevirin: ž→j, š→s, č→c
- Örnekler: "Eldžu" → "Eldjo"
- Bot/şirket adları kolay yazılabilir ve hatırlanabilir olmalı
- Türkçe karakterler (ç, ş, ğ, ü, ö, ı) Türkçe metinde kalabilir

ÖNEMLİ: SADECE düzeltilmiş Türkçe metni döndürün, açıklama eklemeyin.`,

      az: `Azərbaycan dilində nitq-mətn çıxışı üçün transkripsiya düzəldicisisiniz. İstifadəçi yaratmaq istədiyi chatbot-u təsvir edir.

Tapşırığınız:
1. Nitq tanıma səhvlərini düzəldin (oxşar səslənən sözlər)
2. Qrammatika və orfoqrafiya səhvlərini düzəldin
3. Orijinal mənası qorunsun
4. Kontekst: istifadəçi bot təsvir edir
5. KRİTİK: Xüsusi adlar (bot adları, şirkət adları) üçün SADƏLƏŞDİRİLMİŞ yazılış istifadə edin!

Ümumi Azərbaycan dili səhvləri:
- "bot" / "botu" / "otu" → "bot"
- "söhbət" / "sohbet" → "söhbət"
- "yaratmaq" / "yaradmaq" → "yaratmaq"

Ad sadələşdirmə qaydaları (ÇOX VACİB):
- Ekzotik hərfləri sadə hərflərə çevirin: ž→j, š→s, č→c, ñ→n
- Nümunələr: "Eldžu" → "Eldjo", "Müšteri" → "Musteri"
- Bot/şirkət adları asan yazıla bilən olmalıdır
- Azərbaycan hərfləri (ə, ü, ö, ş, ç, ğ) Azərbaycan mətnində qala bilər
- Amma bot adında sadə latın istifadə edin: "Eldžu Köməkçisi" → "Eldjo Köməkçisi"

VACİB: YALNIZ düzəldilmiş Azərbaycan mətnini qaytarın, izahat əlavə etməyin.`
    };

    return prompts[language] || prompts.en;
  }

  /**
   * AI-powered transcription correction
   * Fixes speech recognition errors using GPT-4o-mini with language-specific prompts
   */
  async correctTranscription(text, language = 'en') {
    try {
      if (!this.openaiApiKey || !text || text.trim().length < 5) {
        return { success: true, text, corrected: false };
      }

      const fetch = require('node-fetch');
      const systemPrompt = this.getLanguagePrompt(language);

      log.debug('Correcting transcription', { language, textLength: text.length });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          temperature: 0.1,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        log.warn('Transcription correction failed, using original', { status: response.status });
        return { success: true, text, corrected: false };
      }

      const result = await response.json();
      const correctedText = result.choices?.[0]?.message?.content?.trim();

      if (correctedText && correctedText.length > 0) {
        // Apply hard-coded name simplification as backup (GPT may miss some)
        const finalText = this.simplifyExoticNames(correctedText);

        log.info('Transcription corrected', {
          language,
          original: text.substring(0, 50),
          corrected: finalText.substring(0, 50)
        });
        return { success: true, text: finalText, corrected: true, original: text };
      }

      return { success: true, text: this.simplifyExoticNames(text), corrected: false };
    } catch (error) {
      log.error('Transcription correction error', { error: error.message });
      return { success: true, text, corrected: false };
    }
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
