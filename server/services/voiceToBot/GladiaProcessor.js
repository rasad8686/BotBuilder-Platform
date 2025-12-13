/**
 * Gladia Real-time Speech-to-Text Processor
 * WebSocket streaming for Voice-to-Bot feature
 * Supports: az, tr, ru, en with code-switching
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const log = require('../../utils/logger');

class GladiaProcessor {
  constructor(config = {}) {
    this.config = config;
    this._apiKey = config.apiKey || null;
    this.supportedLanguages = ['az', 'tr', 'ru', 'en', 'de', 'fr', 'es'];

    // Debug: Check API key on init
    const key = this._apiKey || process.env.GLADIA_API_KEY;
    console.log('[GladiaProcessor] API Key loaded:', key ? `${key.substring(0, 8)}...` : 'NOT FOUND');
  }

  // Lazy getter for API key
  get apiKey() {
    return this._apiKey || process.env.GLADIA_API_KEY;
  }

  /**
   * Initialize a Gladia live transcription session
   * @param {Object} options - { language, sampleRate }
   * @returns {Promise<Object>} - { id, url }
   */
  async initSession(options = {}) {
    const fetch = require('node-fetch');

    if (!this.apiKey) {
      throw new Error('GLADIA_API_KEY not configured');
    }

    // Use ONLY the selected language - no mixing
    const selectedLang = options.language || 'az';
    log.info('[Gladia] Using single language mode:', { language: selectedLang });

    const requestBody = {
      encoding: 'wav/pcm',
      sample_rate: 16000,
      bit_depth: 16,
      channels: 1,
      language_config: {
        languages: [selectedLang],  // ONLY user's selected language
        code_switching: false       // NO language mixing
      },
      pre_processing: {
        audio_enhancer: true  // Gladia's built-in audio enhancement
      },
      realtime_processing: {
        words_accurate_timestamps: true,
        custom_vocabulary: true,
        custom_vocabulary_config: {
          // High intensity for better recognition (0.8 = 80% boost)
          default_intensity: 0.8,
          vocabulary: [
            // Brand name with multiple pronunciations for better recognition
            {
              value: 'Eldjo',
              pronunciations: ['eldjo', 'elco', 'elço', 'elju', 'elcu', 'elçu', 'əlco', 'elyo', 'eldo', 'ello'],
              intensity: 1.0  // Maximum boost for brand name
            },
            {
              value: 'Raci',
              pronunciations: ['raci', 'razı', 'razi', 'racı'],
              intensity: 0.9
            },
            // Common bot-related terms
            { value: 'BotBuilder', intensity: 0.8 },
            { value: 'chatbot', pronunciations: ['chatbot', 'çatbot', 'şatbot'], intensity: 0.7 },
            { value: 'WhatsApp', intensity: 0.7 },
            { value: 'Telegram', intensity: 0.7 },
            // Azerbaijani/Turkish common phrases
            { value: 'botu', intensity: 0.6 },
            { value: 'yarat', intensity: 0.6 },
            { value: 'müştəri', pronunciations: ['müşteri', 'musteri', 'müştəri'], intensity: 0.6 },
            { value: 'satış', pronunciations: ['satiş', 'satış', 'satis'], intensity: 0.6 },
            { value: 'dəstək', pronunciations: ['destek', 'dəstək', 'destak'], intensity: 0.6 }
          ]
        }
      },
      messages_config: {
        receive_partial_transcripts: true
      }
    };

    log.info('[Gladia] Initiating session', { autoDetect: true });

    try {
      const response = await fetch('https://api.gladia.io/v2/live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gladia-Key': this.apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gladia API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      log.info('[Gladia] Session initiated', { id: data.id });

      return {
        id: data.id,
        url: data.url
      };
    } catch (error) {
      log.error('[Gladia] Session init error', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a streaming recognition session for real-time transcription
   * Compatible interface with VoiceProcessor
   * @param {Object} options - { language }
   * @param {Function} onResult - Callback for transcription results
   * @param {Function} onError - Callback for errors
   * @returns {Object} - { write, end, isEnded }
   */
  createStreamingRecognition(options = {}, onResult, onError) {
    if (!this.apiKey) {
      log.warn('[Gladia] API key not configured');
      return null;
    }

    let ws = null;
    let isEnded = false;
    let isConnected = false;
    let sessionId = null;
    let audioBuffer = [];
    let lastTranscript = '';
    let ffmpeg = null;

    // Spawn FFmpeg to convert WebM/Opus to PCM with AUDIO ENHANCEMENT for higher accuracy
    // Filters: noise reduction, voice frequency optimization, normalization
    try {
      ffmpeg = spawn(ffmpegPath, [
        '-i', 'pipe:0',           // Input from stdin
        '-af', [
          // 1. High-pass filter: Remove low frequency noise (below 80Hz - rumble, hum)
          'highpass=f=80',
          // 2. Low-pass filter: Remove high frequency noise (above 8kHz - hiss)
          'lowpass=f=8000',
          // 3. Noise reduction: FFmpeg's audio denoiser (moderate settings)
          'afftdn=nf=-20:nt=w',
          // 4. Compressor: Normalize volume levels for consistent audio
          'acompressor=threshold=-20dB:ratio=4:attack=5:release=50',
          // 5. Loudness normalization: Target -16 LUFS for clear speech
          'loudnorm=I=-16:LRA=11:TP=-1.5'
        ].join(','),
        '-f', 's16le',            // Output format: signed 16-bit little-endian
        '-ar', '16000',           // Sample rate: 16kHz (optimal for speech recognition)
        '-ac', '1',               // Mono (single channel)
        '-acodec', 'pcm_s16le',   // PCM codec
        'pipe:1'                  // Output to stdout
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      ffmpeg.stderr.on('data', (data) => {
        // FFmpeg logs to stderr, ignore unless error
        const msg = data.toString();
        if (msg.includes('Error') || msg.includes('error')) {
          log.warn('[Gladia] FFmpeg error', { message: msg.substring(0, 100) });
        }
      });

      ffmpeg.on('error', (err) => {
        log.error('[Gladia] FFmpeg spawn error', { error: err.message });
        if (onError) onError(new Error('FFmpeg not available. Install FFmpeg to use Gladia.'));
      });

      // Handle pipe errors (EPIPE when process closes)
      ffmpeg.stdin.on('error', (err) => {
        if (err.code !== 'EPIPE' && err.code !== 'ERR_STREAM_DESTROYED') {
          log.warn('[Gladia] FFmpeg stdin error', { error: err.message });
        }
      });

      ffmpeg.stdout.on('error', (err) => {
        if (err.code !== 'EPIPE' && err.code !== 'ERR_STREAM_DESTROYED') {
          log.warn('[Gladia] FFmpeg stdout error', { error: err.message });
        }
      });

      log.info('[Gladia] FFmpeg converter started');
    } catch (err) {
      log.error('[Gladia] FFmpeg not available', { error: err.message });
      if (onError) onError(new Error('FFmpeg not available'));
      return null;
    }

    // Initialize session with user's selected language (NO auto detection)
    this.initSession({ language: options.language })
      .then(session => {
        if (isEnded) return;

        sessionId = session.id;
        log.info('[Gladia] Connecting to WebSocket', { url: session.url.substring(0, 50) + '...' });

        ws = new WebSocket(session.url);

        ws.on('open', () => {
          isConnected = true;
          log.info('[Gladia] WebSocket connected, ready to receive audio');

          // Connect FFmpeg PCM output to Gladia WebSocket
          if (ffmpeg && ffmpeg.stdout) {
            ffmpeg.stdout.on('data', (pcmData) => {
              if (ws.readyState === WebSocket.OPEN && !isEnded) {
                const base64Pcm = pcmData.toString('base64');
                ws.send(JSON.stringify({
                  type: 'audio_chunk',
                  data: { chunk: base64Pcm }
                }));
              }
            });
          }

          // Send any buffered WebM audio to FFmpeg
          if (audioBuffer.length > 0 && ffmpeg && ffmpeg.stdin) {
            log.info('[Gladia] Sending buffered audio to FFmpeg', { count: audioBuffer.length });
            audioBuffer.forEach(chunk => {
              try {
                ffmpeg.stdin.write(Buffer.from(chunk, 'base64'));
              } catch (e) {}
            });
            audioBuffer = [];
          }
        });

        ws.on('message', (data) => {
          if (isEnded) return;

          try {
            const message = JSON.parse(data.toString());

            // Handle different message types (skip audio_chunk acknowledgements)
            if (message.type === 'transcript') {
              const transcriptData = message.data;

              if (transcriptData && transcriptData.utterance) {
                const transcript = transcriptData.utterance.text || '';
                const isFinal = transcriptData.is_final === true;
                const confidence = transcriptData.utterance.confidence || 0.9;

                // Skip empty or duplicate transcripts
                if (!transcript || transcript.trim() === '') return;
                if (!isFinal && transcript === lastTranscript) return;

                // CONFIDENCE FILTER: Skip low-confidence results for higher accuracy
                // Only show results with confidence >= 70% (0.7)
                const MIN_CONFIDENCE = 0.70;
                if (!isFinal && confidence < MIN_CONFIDENCE) {
                  log.debug('[Gladia] Skipping low confidence', {
                    transcript: transcript.substring(0, 30),
                    confidence,
                    threshold: MIN_CONFIDENCE
                  });
                  return;
                }

                lastTranscript = transcript;

                // Apply brand name fixes
                const correctedTranscript = this.fixBrandNames(transcript);

                log.info('[Gladia] Transcript', {
                  type: isFinal ? 'FINAL' : 'PARTIAL',
                  raw: transcript,
                  corrected: correctedTranscript,
                  confidence: (confidence * 100).toFixed(1) + '%'
                });

                if (onResult) {
                  onResult({
                    transcript: correctedTranscript,
                    isFinal,
                    confidence,
                    raw: transcript
                  });
                }
              }
            } else if (message.type === 'error') {
              log.error('[Gladia] Error message', { error: message });
              if (onError) {
                onError(new Error(message.data?.message || 'Unknown Gladia error'));
              }
            }
          } catch (parseError) {
            log.warn('[Gladia] Message parse error', { error: parseError.message, raw: data.toString().substring(0, 200) });
          }
        });

        ws.on('error', (error) => {
          log.error('[Gladia] WebSocket error', { error: error.message });
          if (onError && !isEnded) {
            onError(error);
          }
        });

        ws.on('close', (code, reason) => {
          log.info('[Gladia] WebSocket closed', { code, reason: reason?.toString() });
          isConnected = false;
        });
      })
      .catch(error => {
        log.error('[Gladia] Session init failed', { error: error.message });
        if (onError) {
          onError(error);
        }
      });

    // Track chunks for debugging
    let chunkCount = 0;

    return {
      write: (audioData) => {
        if (isEnded) return;

        try {
          // Convert to Buffer
          const buffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData);
          chunkCount++;

          // Log every 100 chunks (reduced logging)
          if (chunkCount % 100 === 0) {
            log.debug('[Gladia] Audio chunks processed', { count: chunkCount });
          }

          // Send WebM audio to FFmpeg for conversion to PCM
          if (ffmpeg && ffmpeg.stdin && !ffmpeg.stdin.destroyed) {
            try {
              ffmpeg.stdin.write(buffer);
            } catch (e) {
              log.warn('[Gladia] FFmpeg write error', { error: e.message });
            }
          } else if (!isConnected) {
            // Buffer if not yet connected
            audioBuffer.push(buffer.toString('base64'));
            if (audioBuffer.length > 100) {
              audioBuffer = audioBuffer.slice(-50);
            }
          }
        } catch (error) {
          log.warn('[Gladia] Write error', { error: error.message });
        }
      },
      end: () => {
        if (isEnded) return;
        isEnded = true;

        log.info('[Gladia] Ending stream');

        // Close FFmpeg
        if (ffmpeg) {
          try {
            if (ffmpeg.stdin && !ffmpeg.stdin.destroyed) {
              ffmpeg.stdin.end();
            }
            ffmpeg.kill('SIGTERM');
          } catch (e) {}
        }

        // Close WebSocket
        if (ws) {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'stop_recording' }));
            }
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close(1000, 'Session ended');
              }
            }, 500);
          } catch (e) {
            log.warn('[Gladia] End stream error', { error: e.message });
          }
        }
      },
      isEnded: () => isEnded
    };
  }

  /**
   * Fix common misrecognitions of brand names
   * Comprehensive list for Gladia STT corrections
   */
  fixBrandNames(text) {
    if (!text) return '';

    let result = text;

    // COMPREHENSIVE Eldjo variants - covering all possible Gladia misrecognitions
    const eldjoVariants = [
      // Basic variations
      'Eljo', 'eljo', 'El Jo', 'el jo', 'EL JO',
      'Eldju', 'eldju', 'El-djo', 'el-djo', 'Eld-jo',
      'Elcio', 'elcio', 'Eljio', 'eljio',
      'Eldo', 'eldo', 'Ello', 'ello', 'Elyo', 'elyo',
      // Turkish/Azerbaijani sounds
      'elçin', 'Elçin', 'elçi', 'Elçi', 'Elci', 'elci',
      'elçu', 'Elçu', 'elcu', 'Elcu', 'Elçö', 'elçö',
      'Elce', 'elce', 'Elço', 'elço', 'Elco', 'elco',
      // Space-separated variants (common in STT)
      'əl çoğu', 'əl çogu', 'el çoğu', 'el çogu',
      'əl co', 'el co', 'əl jo', 'el jo',
      'eld jo', 'Eld Jo', 'eld co', 'Eld Co',
      // Azerbaijani specific
      'əlco', 'Əlco', 'əlço', 'Əlço', 'əlyo', 'Əlyo',
      'elcə', 'Elcə', 'elcö', 'Elcö',
      // German/Slavic sounds
      'Bildru', 'bildru', 'Elzur', 'elzur', 'Elzür', 'elzür',
      'Ildur', 'ildur', 'İldur', 'Eldur', 'eldur',
      'eldzü', 'eldzu', 'eldzju', 'eldžu', 'eldjü', 'eldju',
      'ildzü', 'ildzu', 'ildzju', 'ildžu', 'ildjü', 'ildju',
      // English/Generic sounds
      'el-dru', 'el dru', 'eldru', 'ildru',
      'eudru', 'eu-dru', 'eu dru', 'edru',
      'elgio', 'elgyo', 'eljou', 'eldio',
      // Common STT errors
      'yılsu', 'Yılsu', 'yilsu', 'Yilsu',
      'Ebru', 'ebru', 'EBRU',
      'vallahi el jo', 'vallahi elco'
    ];

    for (const variant of eldjoVariants) {
      // Word boundary regex for accurate replacement
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      result = result.replace(regex, (match) => {
        return match[0] === match[0].toUpperCase() ? 'Eldjo' : 'eldjo';
      });
    }

    // Raci variants
    const raciVariants = [
      'razı', 'Razı', 'razi', 'Razi', 'RAZI',
      'racı', 'Racı', 'raçi', 'Raçi',
      'rası', 'Rası', 'rasi', 'Rasi',
      'raçı', 'Raçı', 'raci', 'Racı'
    ];

    for (const variant of raciVariants) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      result = result.replace(regex, 'Raci');
    }

    // Pattern-based catch-all for edge cases
    // Matches: el(d)?[consonant][vowel] patterns
    result = result.replace(/\b[Ee]l[dt]?[jžzscç][oauüiə]+\b/g, (match) => {
      return match[0] === 'E' ? 'Eldjo' : 'eldjo';
    });

    // Fix "Beden" -> "Bana" (common Turkish misrecognition)
    result = result.replace(/\bBeden\b/g, 'Bana');
    result = result.replace(/\bbeden\b/g, 'bana');

    return result;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return [...this.supportedLanguages];
  }
}

module.exports = GladiaProcessor;
