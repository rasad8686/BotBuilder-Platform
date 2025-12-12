/**
 * Voice Processor Service
 * Handles audio processing and transcription for voice-to-bot feature
 */

const log = require('../../utils/logger');

class VoiceProcessor {
  constructor(config = {}) {
    this.config = config;
    // Note: API keys are read lazily in getOpenAIKey/getGeminiKey to ensure dotenv is loaded
    this._openaiApiKey = config.openaiApiKey || null;
    this._geminiApiKey = config.geminiApiKey || null;
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

  /**
   * Transcribe audio - Whisper first with custom vocabulary, then Gemini fallback
   * Post-processing fixes "Eldjo" misrecognitions
   */
  async transcribe(audioData, options = {}) {
    try {
      const startTime = Date.now();
      let result = null;

      // Try Whisper FIRST (more reliable with prompt)
      if (this.openaiApiKey) {
        // Add custom vocabulary prompt for better recognition
        // Include the exact word "Eldjo" multiple times to reinforce it
        const customPrompt = 'Eldjo. The company name is Eldjo. Eldjo BotBuilder. Eldjo chatbot platform. Customer support bot for Eldjo. Azerbaijani company Eldjo.';

        // Force Azerbaijani language detection for az/tr
        const lang = options.language;
        const whisperLang = (lang === 'az' || lang === 'tr') ? 'az' : lang;

        result = await this.transcribeWithWhisper(audioData, {
          ...options,
          language: whisperLang,
          prompt: customPrompt
        }, startTime);

        if (result.success) {
          // Apply post-processing to fix brand names
          result.text = this.fixBrandNames(result.text);
          log.info('Whisper transcription successful', { text: result.text.substring(0, 50) });
          return result;
        }
        log.warn('Whisper transcription failed, trying Gemini', { error: result.error });
      }

      // Fallback to Gemini
      if (this.geminiApiKey) {
        result = await this.transcribeWithGemini(audioData, options, startTime);
        if (result.success) {
          // Apply post-processing to fix brand names
          result.text = this.fixBrandNames(result.text);
          return result;
        }
      }

      // Demo mode: return mock transcription if no API key
      return this.getMockTranscription(options.language, startTime);
    } catch (error) {
      log.error('Transcription error', { error: error.message });
      return { success: false, error: error.message };
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
      const languagePrompts = {
        en: 'Transcribe this audio accurately. Pay special attention to proper names and brand names like "Eldjo". Return only the transcribed text.',
        az: 'Bu audionu dəqiq transkripsiya edin. "Eldjo" kimi xüsusi adlara diqqət yetirin. Yalnız transkripsiya edilmiş mətni qaytarın.',
        ru: 'Точно транскрибируйте это аудио. Обратите особое внимание на имена собственные вроде "Eldjo". Верните только транскрибированный текст.',
        tr: 'Bu sesi doğru bir şekilde yazıya dökün. "Eldjo" gibi özel isimlere dikkat edin. Sadece yazıya dökülmüş metni döndürün.'
      };

      const prompt = languagePrompts[language] || languagePrompts.en;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-exp-1206:generateContent?key=${this.geminiApiKey}`,
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
      // Azerbaijani/Turkish misrecognitions
      'əl çoğu', 'əl çogu', 'əl coğu', 'əl cogu', 'el çoğu', 'el çogu',
      'el coğu', 'el cogu', 'əlçoğu', 'əlçogu', 'elçoğu', 'elçogu',
      'al chogu', 'al çogu', 'al cogu', 'alchogu',
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
      // Close variations (eldju -> Eldjo)
      'eltju', 'el-dju', 'el-djo', 'elcjo', 'elcju', 'eld-ju',
      // Other variations
      'eljo', 'elljo', 'eltjo', 'eltjo', 'eldyo', 'elidjo',
      'el jo', 'eld jo', 'el-jo', 'eld-jo',
      // More edge cases
      'elgeo', 'elgio', 'elgyo', 'eljio', 'elzho', 'eljou',
      'eldio', 'eltio', 'elchio', 'elcio', 'elsio'
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
