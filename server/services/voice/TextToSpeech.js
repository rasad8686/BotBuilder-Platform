/**
 * Text-to-Speech Service
 * Supports multiple providers: ElevenLabs, OpenAI, Google, Azure
 */

const log = require('../../utils/logger');

class TextToSpeech {
  constructor(provider = 'elevenlabs', config = {}) {
    this.provider = provider;
    this.config = config;
  }

  /**
   * Convert text to speech
   */
  async synthesize(text, options = {}) {
    switch (this.provider) {
      case 'elevenlabs':
        return this.synthesizeWithElevenLabs(text, options);
      case 'openai':
        return this.synthesizeWithOpenAI(text, options);
      case 'google':
        return this.synthesizeWithGoogle(text, options);
      default:
        return { success: false, error: `Unknown provider: ${this.provider}` };
    }
  }

  /**
   * Synthesize using ElevenLabs
   */
  async synthesizeWithElevenLabs(text, options = {}) {
    const apiKey = this.config.apiKey || process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return { success: false, error: 'ElevenLabs API key not configured' };
    }

    try {
      const fetch = require('node-fetch');

      const voiceId = options.voiceId || this.config.voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Sarah

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
          },
          body: JSON.stringify({
            text: text,
            model_id: options.model || 'eleven_monolingual_v1',
            voice_settings: {
              stability: options.stability || 0.5,
              similarity_boost: options.similarityBoost || 0.75,
              style: options.style || 0,
              use_speaker_boost: options.speakerBoost !== false
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const audioBuffer = await response.buffer();

      return {
        success: true,
        audio: audioBuffer,
        contentType: 'audio/mpeg',
        provider: 'elevenlabs'
      };
    } catch (error) {
      log.error('ElevenLabs synthesis error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Synthesize using OpenAI TTS
   */
  async synthesizeWithOpenAI(text, options = {}) {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return { success: false, error: 'OpenAI API key not configured' };
    }

    try {
      const fetch = require('node-fetch');

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || 'tts-1',
          input: text,
          voice: options.voice || 'alloy',
          response_format: options.format || 'mp3',
          speed: options.speed || 1.0
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const audioBuffer = await response.buffer();

      return {
        success: true,
        audio: audioBuffer,
        contentType: 'audio/mpeg',
        provider: 'openai'
      };
    } catch (error) {
      log.error('OpenAI TTS synthesis error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Synthesize using Google Text-to-Speech
   */
  async synthesizeWithGoogle(text, options = {}) {
    const apiKey = this.config.apiKey || process.env.GOOGLE_TTS_API_KEY;

    if (!apiKey) {
      return { success: false, error: 'Google TTS API key not configured' };
    }

    try {
      const fetch = require('node-fetch');

      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: text },
            voice: {
              languageCode: options.language || 'en-US',
              name: options.voice || 'en-US-Neural2-C',
              ssmlGender: options.gender || 'FEMALE'
            },
            audioConfig: {
              audioEncoding: options.encoding || 'MP3',
              speakingRate: options.speed || 1.0,
              pitch: options.pitch || 0
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();
      const audioBuffer = Buffer.from(result.audioContent, 'base64');

      return {
        success: true,
        audio: audioBuffer,
        contentType: 'audio/mpeg',
        provider: 'google'
      };
    } catch (error) {
      log.error('Google TTS synthesis error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get available voices for the provider
   */
  async getVoices() {
    switch (this.provider) {
      case 'elevenlabs':
        return this.getElevenLabsVoices();
      case 'openai':
        return {
          success: true,
          voices: [
            { id: 'alloy', name: 'Alloy', gender: 'neutral' },
            { id: 'echo', name: 'Echo', gender: 'male' },
            { id: 'fable', name: 'Fable', gender: 'neutral' },
            { id: 'onyx', name: 'Onyx', gender: 'male' },
            { id: 'nova', name: 'Nova', gender: 'female' },
            { id: 'shimmer', name: 'Shimmer', gender: 'female' }
          ]
        };
      default:
        return { success: false, error: 'Voice listing not supported' };
    }
  }

  /**
   * Get ElevenLabs voices
   */
  async getElevenLabsVoices() {
    const apiKey = this.config.apiKey || process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return { success: false, error: 'ElevenLabs API key not configured' };
    }

    try {
      const fetch = require('node-fetch');

      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();

      return {
        success: true,
        voices: result.voices.map(v => ({
          id: v.voice_id,
          name: v.name,
          category: v.category,
          labels: v.labels,
          preview_url: v.preview_url
        }))
      };
    } catch (error) {
      log.error('Error getting ElevenLabs voices', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = TextToSpeech;
