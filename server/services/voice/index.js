/**
 * Voice Services Index
 * Exports all voice-related services
 */

const TwilioService = require('./TwilioService');
const SpeechToText = require('./SpeechToText');
const TextToSpeech = require('./TextToSpeech');
const VoiceQueue = require('./VoiceQueue');
const LanguageSupport = require('./LanguageSupport');
const VoiceAnalytics = require('./VoiceAnalytics');
const VoiceStorage = require('./VoiceStorage');
const FormatConverter = require('./FormatConverter');
const StreamingTranscription = require('./StreamingTranscription');
const RecordingService = require('./RecordingService');
const TranscriptionService = require('./TranscriptionService');
const SentimentAnalysis = require('./SentimentAnalysis');
const WebRTCService = require('./WebRTCService');

module.exports = {
  // Core services
  TwilioService,
  SpeechToText,
  TextToSpeech,

  // Queue and retry
  VoiceQueue,

  // Language support
  LanguageSupport,

  // Analytics
  VoiceAnalytics,

  // Storage
  VoiceStorage,

  // Format conversion
  FormatConverter,

  // Streaming
  StreamingTranscription,

  // Recording
  RecordingService,

  // Enhanced Transcription
  TranscriptionService,

  // Sentiment Analysis
  SentimentAnalysis,

  // WebRTC
  WebRTCService
};
