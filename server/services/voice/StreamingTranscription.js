/**
 * Streaming Transcription Service
 * Real-time speech-to-text using WebSocket connections
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const log = require('../../utils/logger');
const LanguageSupport = require('./LanguageSupport');

class StreamingTranscription extends EventEmitter {
  constructor(options = {}) {
    super();
    this.provider = options.provider || 'deepgram';
    this.config = options.config || {};
    this.connections = new Map();
  }

  /**
   * Create streaming session
   * @param {Object} options - Session options
   * @returns {Object} Session info
   */
  createSession(options = {}) {
    const sessionId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session = {
      id: sessionId,
      provider: options.provider || this.provider,
      language: options.language || 'en',
      sampleRate: options.sampleRate || 16000,
      encoding: options.encoding || 'linear16',
      interimResults: options.interimResults !== false,
      punctuate: options.punctuate !== false,
      profanityFilter: options.profanityFilter || false,
      model: options.model || 'general',
      status: 'created',
      createdAt: new Date(),
      ws: null,
      buffer: [],
      transcript: '',
      words: []
    };

    this.connections.set(sessionId, session);

    return {
      sessionId,
      provider: session.provider,
      language: session.language,
      sampleRate: session.sampleRate
    };
  }

  /**
   * Start streaming session
   * @param {string} sessionId - Session ID
   * @returns {Promise} Connected session
   */
  async startSession(sessionId) {
    const session = this.connections.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      switch (session.provider) {
        case 'deepgram':
          await this.connectDeepgram(session);
          break;
        case 'google':
          await this.connectGoogle(session);
          break;
        case 'assembly':
          await this.connectAssembly(session);
          break;
        default:
          throw new Error(`Provider not supported for streaming: ${session.provider}`);
      }

      session.status = 'connected';
      this.emit('session:connected', { sessionId });

      return {
        sessionId,
        status: 'connected'
      };

    } catch (error) {
      session.status = 'error';
      log.error('Failed to start streaming session', { sessionId, error: error.message });
      throw error;
    }
  }

  /**
   * Connect to Deepgram
   */
  async connectDeepgram(session) {
    const apiKey = this.config.deepgramApiKey || process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('Deepgram API key not configured');
    }

    const langCode = LanguageSupport.getSTTCode(session.language, 'deepgram') || 'en';

    const params = new URLSearchParams({
      model: session.model === 'general' ? 'nova-2' : session.model,
      language: langCode,
      punctuate: String(session.punctuate),
      interim_results: String(session.interimResults),
      encoding: session.encoding === 'linear16' ? 'linear16' : session.encoding,
      sample_rate: String(session.sampleRate),
      channels: '1',
      endpointing: '300'
    });

    const wsUrl = `wss://api.deepgram.com/v1/listen?${params}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Token ${apiKey}`
        }
      });

      ws.on('open', () => {
        session.ws = ws;
        log.info('Deepgram WebSocket connected', { sessionId: session.id });
        resolve();
      });

      ws.on('message', (data) => {
        try {
          const result = JSON.parse(data);
          this.handleDeepgramMessage(session, result);
        } catch (e) {
          log.error('Failed to parse Deepgram message', { error: e.message });
        }
      });

      ws.on('error', (error) => {
        log.error('Deepgram WebSocket error', { sessionId: session.id, error: error.message });
        this.emit('session:error', { sessionId: session.id, error: error.message });
        reject(error);
      });

      ws.on('close', () => {
        session.status = 'closed';
        this.emit('session:closed', { sessionId: session.id });
      });
    });
  }

  /**
   * Handle Deepgram message
   */
  handleDeepgramMessage(session, result) {
    if (result.type === 'Results') {
      const alternative = result.channel?.alternatives?.[0];

      if (alternative) {
        const isFinal = result.is_final;
        const transcript = alternative.transcript || '';
        const confidence = alternative.confidence || 0;
        const words = alternative.words || [];

        if (isFinal && transcript) {
          session.transcript += (session.transcript ? ' ' : '') + transcript;
          session.words = session.words.concat(words);
        }

        this.emit('transcript', {
          sessionId: session.id,
          transcript,
          isFinal,
          confidence,
          words,
          fullTranscript: session.transcript
        });
      }
    }

    if (result.type === 'Metadata') {
      this.emit('metadata', {
        sessionId: session.id,
        metadata: result
      });
    }

    if (result.type === 'SpeechStarted') {
      this.emit('speech:started', { sessionId: session.id });
    }

    if (result.type === 'UtteranceEnd') {
      this.emit('utterance:end', { sessionId: session.id });
    }
  }

  /**
   * Connect to Google Cloud Speech
   */
  async connectGoogle(session) {
    const credentials = this.config.googleCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentials) {
      throw new Error('Google Cloud credentials not configured');
    }

    try {
      // Dynamic import for Google Cloud Speech
      const speech = require('@google-cloud/speech');
      const client = new speech.SpeechClient();

      const langCode = LanguageSupport.getSTTCode(session.language, 'google') || 'en-US';

      const request = {
        config: {
          encoding: session.encoding === 'linear16' ? 'LINEAR16' : session.encoding.toUpperCase(),
          sampleRateHertz: session.sampleRate,
          languageCode: langCode,
          enableAutomaticPunctuation: session.punctuate,
          model: session.model === 'general' ? 'default' : session.model,
          useEnhanced: true,
          enableWordTimeOffsets: true
        },
        interimResults: session.interimResults
      };

      // Create streaming recognize stream
      const recognizeStream = client.streamingRecognize(request);

      session.googleClient = client;
      session.recognizeStream = recognizeStream;
      session.status = 'connected';

      // Handle responses
      recognizeStream.on('data', (data) => {
        if (data.results && data.results[0]) {
          const result = data.results[0];
          const alternative = result.alternatives[0];
          const isFinal = result.isFinal;
          const transcript = alternative?.transcript || '';
          const confidence = alternative?.confidence || 0;
          const words = alternative?.words || [];

          if (isFinal && transcript) {
            session.transcript += (session.transcript ? ' ' : '') + transcript;
            session.words = session.words.concat(words.map(w => ({
              word: w.word,
              startTime: w.startTime?.seconds || 0,
              endTime: w.endTime?.seconds || 0
            })));
          }

          this.emit('transcript', {
            sessionId: session.id,
            transcript,
            isFinal,
            confidence,
            words,
            fullTranscript: session.transcript
          });
        }
      });

      recognizeStream.on('error', (error) => {
        log.error('Google Speech streaming error', { sessionId: session.id, error: error.message });
        this.emit('session:error', { sessionId: session.id, error: error.message });
      });

      recognizeStream.on('end', () => {
        session.status = 'closed';
        this.emit('session:closed', { sessionId: session.id });
      });

      // Override sendAudio for Google
      session.sendAudio = (chunk) => {
        if (recognizeStream && !recognizeStream.destroyed) {
          recognizeStream.write(chunk);
        }
      };

      session.closeStream = () => {
        if (recognizeStream && !recognizeStream.destroyed) {
          recognizeStream.end();
        }
      };

      log.info('Google Cloud Speech connected', { sessionId: session.id });

    } catch (error) {
      log.error('Google Cloud Speech connection failed', { error: error.message });
      throw new Error(`Google Speech error: ${error.message}`);
    }
  }

  /**
   * Connect to AssemblyAI (placeholder)
   */
  async connectAssembly(session) {
    const apiKey = this.config.assemblyApiKey || process.env.ASSEMBLY_API_KEY;
    if (!apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    // First, get a temporary token
    const fetch = require('node-fetch');
    const tokenResponse = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        expires_in: 3600
      })
    });

    const tokenData = await tokenResponse.json();

    return new Promise((resolve, reject) => {
      const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=${session.sampleRate}&token=${tokenData.token}`;

      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        session.ws = ws;
        log.info('AssemblyAI WebSocket connected', { sessionId: session.id });
        resolve();
      });

      ws.on('message', (data) => {
        try {
          const result = JSON.parse(data);
          this.handleAssemblyMessage(session, result);
        } catch (e) {
          log.error('Failed to parse AssemblyAI message', { error: e.message });
        }
      });

      ws.on('error', (error) => {
        log.error('AssemblyAI WebSocket error', { sessionId: session.id, error: error.message });
        reject(error);
      });

      ws.on('close', () => {
        session.status = 'closed';
        this.emit('session:closed', { sessionId: session.id });
      });
    });
  }

  /**
   * Handle AssemblyAI message
   */
  handleAssemblyMessage(session, result) {
    if (result.message_type === 'PartialTranscript' || result.message_type === 'FinalTranscript') {
      const isFinal = result.message_type === 'FinalTranscript';
      const transcript = result.text || '';
      const confidence = result.confidence || 0;
      const words = result.words || [];

      if (isFinal && transcript) {
        session.transcript += (session.transcript ? ' ' : '') + transcript;
      }

      this.emit('transcript', {
        sessionId: session.id,
        transcript,
        isFinal,
        confidence,
        words,
        fullTranscript: session.transcript
      });
    }

    if (result.message_type === 'SessionBegins') {
      this.emit('session:ready', {
        sessionId: session.id,
        expiresAt: result.expires_at
      });
    }
  }

  /**
   * Send audio chunk to session
   * @param {string} sessionId - Session ID
   * @param {Buffer} audioChunk - Audio data
   */
  sendAudio(sessionId, audioChunk) {
    const session = this.connections.get(sessionId);

    if (!session || !session.ws) {
      throw new Error('Session not connected');
    }

    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(audioChunk);
    } else {
      // Buffer audio if not ready
      session.buffer.push(audioChunk);
    }
  }

  /**
   * End streaming session
   * @param {string} sessionId - Session ID
   * @returns {Object} Session results
   */
  async endSession(sessionId) {
    const session = this.connections.get(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    // Send close signal based on provider
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      if (session.provider === 'deepgram') {
        // Send empty buffer to signal end
        session.ws.send(JSON.stringify({ type: 'CloseStream' }));
      } else if (session.provider === 'assembly') {
        session.ws.send(JSON.stringify({ terminate_session: true }));
      }

      // Wait a bit for final results
      await new Promise(resolve => setTimeout(resolve, 500));

      session.ws.close();
    }

    const result = {
      sessionId,
      transcript: session.transcript,
      words: session.words,
      duration: (Date.now() - session.createdAt.getTime()) / 1000
    };

    this.connections.delete(sessionId);

    return result;
  }

  /**
   * Get session status
   * @param {string} sessionId - Session ID
   * @returns {Object} Session status
   */
  getSessionStatus(sessionId) {
    const session = this.connections.get(sessionId);

    if (!session) {
      return { status: 'not_found' };
    }

    return {
      sessionId,
      status: session.status,
      provider: session.provider,
      language: session.language,
      transcript: session.transcript,
      wordCount: session.words.length,
      createdAt: session.createdAt
    };
  }

  /**
   * Get all active sessions
   * @returns {Array} Active sessions
   */
  getActiveSessions() {
    const sessions = [];

    for (const [id, session] of this.connections) {
      sessions.push({
        sessionId: id,
        status: session.status,
        provider: session.provider,
        language: session.language,
        createdAt: session.createdAt
      });
    }

    return sessions;
  }

  /**
   * Clean up all sessions
   */
  async cleanup() {
    for (const [sessionId] of this.connections) {
      try {
        await this.endSession(sessionId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

// Export singleton instance
module.exports = new StreamingTranscription();
