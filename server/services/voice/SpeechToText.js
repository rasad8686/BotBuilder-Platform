/**
 * Speech-to-Text Service
 * Supports multiple providers: Whisper (OpenAI), Google, Azure, Deepgram
 */

const log = require('../../utils/logger');

class SpeechToText {
  constructor(provider = 'whisper', config = {}) {
    this.provider = provider;
    this.config = config;
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(audioBuffer, options = {}) {
    switch (this.provider) {
      case 'whisper':
        return this.transcribeWithWhisper(audioBuffer, options);
      case 'google':
        return this.transcribeWithGoogle(audioBuffer, options);
      case 'deepgram':
        return this.transcribeWithDeepgram(audioBuffer, options);
      default:
        return { success: false, error: `Unknown provider: ${this.provider}` };
    }
  }

  /**
   * Transcribe using OpenAI Whisper
   */
  async transcribeWithWhisper(audioBuffer, options = {}) {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return { success: false, error: 'OpenAI API key not configured' };
    }

    try {
      const FormData = require('form-data');
      const fetch = require('node-fetch');

      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      formData.append('model', options.model || 'whisper-1');
      formData.append('language', options.language || 'en');

      if (options.prompt) {
        formData.append('prompt', options.prompt);
      }

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();

      return {
        success: true,
        text: result.text,
        confidence: 0.95, // Whisper doesn't return confidence
        provider: 'whisper'
      };
    } catch (error) {
      log.error('Whisper transcription error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Transcribe using Google Speech-to-Text
   */
  async transcribeWithGoogle(audioBuffer, options = {}) {
    const apiKey = this.config.apiKey || process.env.GOOGLE_SPEECH_API_KEY;

    if (!apiKey) {
      return { success: false, error: 'Google Speech API key not configured' };
    }

    try {
      const fetch = require('node-fetch');

      const audioContent = audioBuffer.toString('base64');

      const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              encoding: options.encoding || 'LINEAR16',
              sampleRateHertz: options.sampleRate || 16000,
              languageCode: options.language || 'en-US',
              enableAutomaticPunctuation: true,
              model: options.model || 'phone_call'
            },
            audio: { content: audioContent }
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();
      const transcript = result.results?.[0]?.alternatives?.[0];

      return {
        success: true,
        text: transcript?.transcript || '',
        confidence: transcript?.confidence || 0,
        provider: 'google'
      };
    } catch (error) {
      log.error('Google Speech transcription error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Transcribe using Deepgram
   */
  async transcribeWithDeepgram(audioBuffer, options = {}) {
    const apiKey = this.config.apiKey || process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      return { success: false, error: 'Deepgram API key not configured' };
    }

    try {
      const fetch = require('node-fetch');

      const params = new URLSearchParams({
        model: options.model || 'nova-2',
        language: options.language || 'en',
        punctuate: 'true',
        diarize: options.diarize ? 'true' : 'false'
      });

      const response = await fetch(
        `https://api.deepgram.com/v1/listen?${params}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'audio/wav'
          },
          body: audioBuffer
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();
      const transcript = result.results?.channels?.[0]?.alternatives?.[0];

      return {
        success: true,
        text: transcript?.transcript || '',
        confidence: transcript?.confidence || 0,
        words: transcript?.words || [],
        provider: 'deepgram'
      };
    } catch (error) {
      log.error('Deepgram transcription error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Real-time streaming transcription setup
   */
  createStreamingSession(options = {}) {
    // Returns WebSocket URL and configuration for real-time STT
    switch (this.provider) {
      case 'deepgram':
        return {
          url: 'wss://api.deepgram.com/v1/listen',
          headers: {
            'Authorization': `Token ${this.config.apiKey || process.env.DEEPGRAM_API_KEY}`
          },
          params: {
            model: options.model || 'nova-2',
            language: options.language || 'en',
            punctuate: true,
            interim_results: true,
            endpointing: 300
          }
        };
      default:
        return { error: 'Streaming not supported for this provider' };
    }
  }
}

module.exports = SpeechToText;
