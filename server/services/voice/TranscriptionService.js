/**
 * Enhanced Transcription Service
 * Advanced transcription with speaker diarization, timestamps, and multiple providers
 */

const log = require('../../utils/logger');

class TranscriptionService {
  constructor() {
    this.providers = ['whisper', 'google', 'deepgram', 'assemblyai'];
    this.defaultProvider = process.env.TRANSCRIPTION_PROVIDER || 'whisper';
    this.apiKeys = {
      openai: process.env.OPENAI_API_KEY,
      google: process.env.GOOGLE_CLOUD_API_KEY,
      deepgram: process.env.DEEPGRAM_API_KEY,
      assemblyai: process.env.ASSEMBLYAI_API_KEY
    };
    this.cache = new Map();
    this.cacheTimeout = 3600000; // 1 hour
  }

  /**
   * Transcribe audio with advanced features
   * @param {Buffer} audioBuffer - Audio data
   * @param {Object} options - Transcription options
   * @returns {Object} Transcription result
   */
  async transcribe(audioBuffer, options = {}) {
    const {
      provider = this.defaultProvider,
      language = 'en',
      speakerDiarization = false,
      speakerCount = 2,
      timestamps = true,
      punctuation = true,
      profanityFilter = false,
      wordConfidence = false,
      customVocabulary = [],
      model = 'default'
    } = options;

    // Check cache
    const cacheKey = this.getCacheKey(audioBuffer, options);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        log.debug('Returning cached transcription');
        return cached.result;
      }
    }

    let result;

    try {
      switch (provider) {
        case 'whisper':
        case 'openai':
          result = await this.transcribeWithWhisper(audioBuffer, {
            language,
            timestamps,
            model
          });
          break;

        case 'google':
          result = await this.transcribeWithGoogle(audioBuffer, {
            language,
            speakerDiarization,
            speakerCount,
            punctuation,
            profanityFilter,
            wordConfidence
          });
          break;

        case 'deepgram':
          result = await this.transcribeWithDeepgram(audioBuffer, {
            language,
            speakerDiarization,
            punctuation,
            customVocabulary,
            model
          });
          break;

        case 'assemblyai':
          result = await this.transcribeWithAssemblyAI(audioBuffer, {
            language,
            speakerDiarization,
            speakerCount,
            punctuation,
            customVocabulary
          });
          break;

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // Add speaker diarization post-processing if needed
      if (speakerDiarization && !result.speakers) {
        result = await this.addSpeakerLabels(result, speakerCount);
      }

      // Cache result
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      log.info('Transcription completed', { provider, language, duration: result.duration });

      return result;
    } catch (error) {
      log.error('Transcription failed', { provider, error: error.message });
      throw error;
    }
  }

  /**
   * Transcribe using OpenAI Whisper
   */
  async transcribeWithWhisper(audioBuffer, options) {
    const { language, timestamps, model } = options;

    const FormData = (await import('form-data')).default;
    const fetch = (await import('node-fetch')).default;

    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('model', model === 'default' ? 'whisper-1' : model);
    formData.append('language', language);
    formData.append('response_format', timestamps ? 'verbose_json' : 'json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKeys.openai}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper API error: ${error}`);
    }

    const data = await response.json();

    return {
      text: data.text,
      language: data.language || language,
      duration: data.duration,
      segments: data.segments?.map(seg => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
        confidence: seg.confidence || null,
        words: seg.words || null
      })) || [],
      provider: 'whisper'
    };
  }

  /**
   * Transcribe using Google Cloud Speech-to-Text
   */
  async transcribeWithGoogle(audioBuffer, options) {
    const {
      language,
      speakerDiarization,
      speakerCount,
      punctuation,
      profanityFilter,
      wordConfidence
    } = options;

    const fetch = (await import('node-fetch')).default;

    const config = {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: language,
      enableAutomaticPunctuation: punctuation,
      profanityFilter: profanityFilter,
      enableWordTimeOffsets: true,
      enableWordConfidence: wordConfidence
    };

    if (speakerDiarization) {
      config.diarizationConfig = {
        enableSpeakerDiarization: true,
        minSpeakerCount: 1,
        maxSpeakerCount: speakerCount
      };
    }

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${this.apiKeys.google}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          config,
          audio: {
            content: audioBuffer.toString('base64')
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Speech API error: ${error}`);
    }

    const data = await response.json();

    // Parse Google's response format
    const segments = [];
    const speakers = new Map();
    let fullText = '';

    if (data.results) {
      for (const result of data.results) {
        if (result.alternatives && result.alternatives[0]) {
          const alt = result.alternatives[0];
          fullText += alt.transcript + ' ';

          if (alt.words) {
            for (const word of alt.words) {
              const segment = {
                start: parseFloat(word.startTime?.replace('s', '') || 0),
                end: parseFloat(word.endTime?.replace('s', '') || 0),
                text: word.word,
                confidence: word.confidence || null,
                speaker: word.speakerTag || null
              };
              segments.push(segment);

              if (word.speakerTag) {
                speakers.set(word.speakerTag, true);
              }
            }
          }
        }
      }
    }

    return {
      text: fullText.trim(),
      language,
      segments: this.consolidateSegments(segments),
      speakers: speakerDiarization ? Array.from(speakers.keys()) : null,
      provider: 'google'
    };
  }

  /**
   * Transcribe using Deepgram
   */
  async transcribeWithDeepgram(audioBuffer, options) {
    const {
      language,
      speakerDiarization,
      punctuation,
      customVocabulary,
      model
    } = options;

    const fetch = (await import('node-fetch')).default;

    const params = new URLSearchParams({
      language,
      punctuate: punctuation.toString(),
      diarize: speakerDiarization.toString(),
      model: model === 'default' ? 'nova-2' : model,
      smart_format: 'true'
    });

    if (customVocabulary.length > 0) {
      params.append('keywords', customVocabulary.join(','));
    }

    const response = await fetch(
      `https://api.deepgram.com/v1/listen?${params}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKeys.deepgram}`,
          'Content-Type': 'audio/wav'
        },
        body: audioBuffer
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deepgram API error: ${error}`);
    }

    const data = await response.json();

    const channel = data.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];

    if (!alternative) {
      return {
        text: '',
        language,
        segments: [],
        provider: 'deepgram'
      };
    }

    const segments = alternative.words?.map((word, i) => ({
      id: i,
      start: word.start,
      end: word.end,
      text: word.word,
      confidence: word.confidence,
      speaker: word.speaker || null
    })) || [];

    const speakers = [...new Set(segments.filter(s => s.speaker !== null).map(s => s.speaker))];

    return {
      text: alternative.transcript,
      language,
      duration: data.metadata?.duration,
      segments: this.consolidateSegments(segments),
      speakers: speakerDiarization ? speakers : null,
      confidence: alternative.confidence,
      provider: 'deepgram'
    };
  }

  /**
   * Transcribe using AssemblyAI
   */
  async transcribeWithAssemblyAI(audioBuffer, options) {
    const {
      language,
      speakerDiarization,
      speakerCount,
      punctuation,
      customVocabulary
    } = options;

    const fetch = (await import('node-fetch')).default;

    // First, upload the audio
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': this.apiKeys.assemblyai,
        'Content-Type': 'application/octet-stream'
      },
      body: audioBuffer
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload audio to AssemblyAI');
    }

    const { upload_url } = await uploadResponse.json();

    // Create transcription request
    const transcriptRequest = {
      audio_url: upload_url,
      language_code: language,
      punctuate: punctuation,
      format_text: true,
      speaker_labels: speakerDiarization,
      speakers_expected: speakerCount
    };

    if (customVocabulary.length > 0) {
      transcriptRequest.word_boost = customVocabulary;
    }

    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': this.apiKeys.assemblyai,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transcriptRequest)
    });

    const { id: transcriptId } = await transcriptResponse.json();

    // Poll for completion
    let transcript;
    while (true) {
      const pollResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            'Authorization': this.apiKeys.assemblyai
          }
        }
      );

      transcript = await pollResponse.json();

      if (transcript.status === 'completed') {
        break;
      } else if (transcript.status === 'error') {
        throw new Error(`AssemblyAI transcription error: ${transcript.error}`);
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const segments = transcript.words?.map((word, i) => ({
      id: i,
      start: word.start / 1000,
      end: word.end / 1000,
      text: word.text,
      confidence: word.confidence,
      speaker: word.speaker || null
    })) || [];

    const speakers = transcript.utterances
      ? [...new Set(transcript.utterances.map(u => u.speaker))]
      : null;

    return {
      text: transcript.text,
      language,
      duration: transcript.audio_duration,
      segments: this.consolidateSegments(segments),
      speakers,
      confidence: transcript.confidence,
      provider: 'assemblyai'
    };
  }

  /**
   * Consolidate word-level segments into sentence-level
   */
  consolidateSegments(wordSegments) {
    if (!wordSegments || wordSegments.length === 0) {
      return [];
    }

    const consolidated = [];
    let currentSegment = {
      start: wordSegments[0].start,
      end: wordSegments[0].end,
      text: wordSegments[0].text,
      speaker: wordSegments[0].speaker,
      words: [wordSegments[0]]
    };

    for (let i = 1; i < wordSegments.length; i++) {
      const word = wordSegments[i];
      const gap = word.start - currentSegment.end;

      // Start new segment if:
      // - Gap is more than 1 second
      // - Different speaker
      // - End of sentence (ends with . ! ?)
      const shouldSplit = gap > 1 ||
        (word.speaker !== null && word.speaker !== currentSegment.speaker) ||
        /[.!?]$/.test(currentSegment.text);

      if (shouldSplit) {
        consolidated.push({
          id: consolidated.length,
          start: currentSegment.start,
          end: currentSegment.end,
          text: currentSegment.text,
          speaker: currentSegment.speaker,
          confidence: this.avgConfidence(currentSegment.words)
        });

        currentSegment = {
          start: word.start,
          end: word.end,
          text: word.text,
          speaker: word.speaker,
          words: [word]
        };
      } else {
        currentSegment.end = word.end;
        currentSegment.text += ' ' + word.text;
        currentSegment.words.push(word);
      }
    }

    // Add last segment
    consolidated.push({
      id: consolidated.length,
      start: currentSegment.start,
      end: currentSegment.end,
      text: currentSegment.text,
      speaker: currentSegment.speaker,
      confidence: this.avgConfidence(currentSegment.words)
    });

    return consolidated;
  }

  /**
   * Calculate average confidence from words
   */
  avgConfidence(words) {
    const confidences = words.filter(w => w.confidence !== null).map(w => w.confidence);
    if (confidences.length === 0) return null;
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }

  /**
   * Add speaker labels using simple audio analysis
   * (Fallback when provider doesn't support diarization)
   */
  async addSpeakerLabels(transcription, speakerCount) {
    // Simple heuristic: alternate speakers based on pauses
    const segments = transcription.segments;

    if (!segments || segments.length === 0) {
      return transcription;
    }

    let currentSpeaker = 0;

    for (let i = 0; i < segments.length; i++) {
      segments[i].speaker = `Speaker ${currentSpeaker + 1}`;

      // Check if next segment has a long pause
      if (i < segments.length - 1) {
        const gap = segments[i + 1].start - segments[i].end;
        if (gap > 0.5) {
          currentSpeaker = (currentSpeaker + 1) % speakerCount;
        }
      }
    }

    transcription.segments = segments;
    transcription.speakers = Array.from(
      { length: speakerCount },
      (_, i) => `Speaker ${i + 1}`
    );

    return transcription;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(provider = this.defaultProvider) {
    const languages = {
      whisper: [
        'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ko',
        'ar', 'hi', 'tr', 'pl', 'uk', 'vi', 'th', 'id', 'ms'
      ],
      google: [
        'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR',
        'nl-NL', 'ru-RU', 'zh-CN', 'ja-JP', 'ko-KR', 'ar-SA'
      ],
      deepgram: [
        'en', 'en-US', 'en-GB', 'es', 'fr', 'de', 'it', 'pt', 'nl',
        'ru', 'zh', 'ja', 'ko', 'hi', 'id'
      ],
      assemblyai: [
        'en', 'es', 'fr', 'de', 'it', 'pt', 'nl'
      ]
    };

    return languages[provider] || languages.whisper;
  }

  /**
   * Generate cache key
   */
  getCacheKey(audioBuffer, options) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(audioBuffer).digest('hex');
    return `${hash}_${JSON.stringify(options)}`;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return this.providers.filter(p => {
      switch (p) {
        case 'whisper':
          return !!this.apiKeys.openai;
        case 'google':
          return !!this.apiKeys.google;
        case 'deepgram':
          return !!this.apiKeys.deepgram;
        case 'assemblyai':
          return !!this.apiKeys.assemblyai;
        default:
          return false;
      }
    });
  }

  /**
   * Compare transcription providers
   */
  async compareProviders(audioBuffer, options = {}) {
    const availableProviders = this.getAvailableProviders();
    const results = {};

    for (const provider of availableProviders) {
      try {
        const startTime = Date.now();
        const result = await this.transcribe(audioBuffer, { ...options, provider });
        results[provider] = {
          ...result,
          processingTime: Date.now() - startTime
        };
      } catch (error) {
        results[provider] = {
          error: error.message,
          provider
        };
      }
    }

    return results;
  }
}

// Export singleton instance
module.exports = new TranscriptionService();
