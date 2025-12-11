/**
 * Voice Services Index
 * Exports all voice-related services
 */

const TwilioService = require('./TwilioService');
const SpeechToText = require('./SpeechToText');
const TextToSpeech = require('./TextToSpeech');

module.exports = {
  TwilioService,
  SpeechToText,
  TextToSpeech
};
