/**
 * @fileoverview TwiML Generator Service
 * @description Generates Twilio Markup Language (TwiML) for IVR flows
 * Supports various node types, voice configurations, and dynamic URL generation
 * @module services/twiml-generator.service
 */

const { twiml: TwiML } = require('twilio');
const log = require('../utils/logger');

// Voice configuration mapping
const VOICE_CONFIG = {
  // Amazon Polly voices
  polly: {
    en: {
      female: 'Polly.Joanna',
      male: 'Polly.Matthew',
      neural_female: 'Polly.Joanna-Neural',
      neural_male: 'Polly.Matthew-Neural'
    },
    tr: {
      female: 'Polly.Filiz',
      male: 'Polly.Filiz' // No male Turkish voice, fallback
    },
    ru: {
      female: 'Polly.Tatyana',
      male: 'Polly.Maxim'
    },
    az: {
      female: 'Polly.Joanna', // No Azerbaijani, fallback to English
      male: 'Polly.Matthew'
    }
  },
  // Google TTS voices
  google: {
    en: {
      female: 'Google.en-US-Wavenet-F',
      male: 'Google.en-US-Wavenet-D'
    },
    tr: {
      female: 'Google.tr-TR-Wavenet-A',
      male: 'Google.tr-TR-Wavenet-B'
    },
    ru: {
      female: 'Google.ru-RU-Wavenet-A',
      male: 'Google.ru-RU-Wavenet-B'
    },
    az: {
      female: 'Google.en-US-Wavenet-F', // No Azerbaijani, fallback
      male: 'Google.en-US-Wavenet-D'
    }
  },
  // Standard Twilio voices
  standard: {
    en: { female: 'alice', male: 'man' },
    tr: { female: 'alice', male: 'man' },
    ru: { female: 'alice', male: 'man' },
    az: { female: 'alice', male: 'man' }
  }
};

// Language to Twilio language code mapping
const LANGUAGE_CODES = {
  en: 'en-US',
  tr: 'tr-TR',
  ru: 'ru-RU',
  az: 'az-AZ',
  'en-US': 'en-US',
  'en-GB': 'en-GB',
  'tr-TR': 'tr-TR',
  'ru-RU': 'ru-RU'
};

// Speech recognition hints by language
const SPEECH_HINTS = {
  en: ['yes', 'no', 'help', 'repeat', 'operator', 'menu', 'back', 'cancel'],
  tr: ['evet', 'hayir', 'yardim', 'tekrar', 'operator', 'menu', 'geri', 'iptal'],
  ru: ['da', 'net', 'pomosch', 'povtorit', 'operator', 'menu', 'nazad', 'otmena'],
  az: ['beli', 'xeyr', 'komek', 'tekrar', 'operator', 'menu', 'geri', 'legv']
};

class TwiMLGeneratorService {
  constructor() {
    this.baseUrl = process.env.APP_URL || process.env.BASE_URL || 'https://api.botbuilder.az';
  }

  /**
   * Generate TwiML response for a node
   * @param {Object} node - IVR node configuration
   * @param {Object} session - Call session data
   * @returns {string} TwiML XML string
   */
  generateResponse(node, session = {}) {
    if (!node) {
      return this.generateError({ default_language: 'en' });
    }

    const flow = session.flow || {};
    const voiceConfig = this.getVoiceConfig(flow);

    try {
      switch (node.type) {
        case 'play':
        case 'say':
        case 'message':
          return this.generatePlayTwiML(node, voiceConfig);

        case 'menu':
        case 'gather_menu':
          return this.generateMenuTwiML(node, voiceConfig, flow);

        case 'input':
        case 'gather':
        case 'collect':
          return this.generateInputTwiML(node, voiceConfig, flow);

        case 'transfer':
        case 'dial':
        case 'forward':
          return this.generateTransferTwiML(node, voiceConfig);

        case 'voicemail':
        case 'record':
          return this.generateVoicemailTwiML(node, voiceConfig, flow);

        case 'hangup':
        case 'end':
          return this.generateHangupTwiML(node, voiceConfig);

        case 'pause':
        case 'wait':
          return this.generatePauseTwiML(node.duration || 1);

        case 'redirect':
        case 'goto':
          return this.generateRedirectTwiML(node.url || node.target);

        case 'conference':
          return this.generateConferenceTwiML(node, voiceConfig);

        case 'queue':
          return this.generateQueueTwiML(node, voiceConfig);

        case 'sms':
          return this.generateSMSTwiML(node);

        case 'condition':
        case 'branch':
          return this.generateConditionTwiML(node, voiceConfig, flow, session);

        default:
          log.warn(`Unknown node type: ${node.type}`);
          return this.generateError(flow);
      }
    } catch (error) {
      log.error('TwiML generation error:', error);
      return this.generateError(flow);
    }
  }

  /**
   * Generate welcome TwiML for a flow
   * @param {Object} flow - IVR flow configuration
   * @returns {string} TwiML XML string
   */
  generateWelcome(flow) {
    const response = new TwiML.VoiceResponse();
    const voiceConfig = this.getVoiceConfig(flow);

    const message = flow.welcome_message || 'Welcome to our service.';

    if (this.isSSML(message)) {
      response.say({ voice: voiceConfig.voice, language: voiceConfig.language })
        .ssmlParagraph(this.extractSSML(message));
    } else {
      response.say({ voice: voiceConfig.voice, language: voiceConfig.language }, message);
    }

    // If there's a start node, redirect to it
    if (flow.start_node_id) {
      response.redirect(this.generateActionUrl(flow.id, flow.start_node_id));
    }

    return response.toString();
  }

  /**
   * Generate goodbye TwiML for a flow
   * @param {Object} flow - IVR flow configuration
   * @returns {string} TwiML XML string
   */
  generateGoodbye(flow) {
    const response = new TwiML.VoiceResponse();
    const voiceConfig = this.getVoiceConfig(flow);

    const message = flow.goodbye_message || 'Thank you for calling. Goodbye.';

    if (this.isSSML(message)) {
      response.say({ voice: voiceConfig.voice, language: voiceConfig.language })
        .ssmlParagraph(this.extractSSML(message));
    } else {
      response.say({ voice: voiceConfig.voice, language: voiceConfig.language }, message);
    }

    response.hangup();

    return response.toString();
  }

  /**
   * Generate error TwiML for a flow
   * @param {Object} flow - IVR flow configuration
   * @param {string} [customMessage] - Custom error message
   * @returns {string} TwiML XML string
   */
  generateError(flow, customMessage) {
    const response = new TwiML.VoiceResponse();
    const voiceConfig = this.getVoiceConfig(flow);

    const message = customMessage || flow.error_message || "Sorry, I didn't understand that. Please try again.";

    response.say({ voice: voiceConfig.voice, language: voiceConfig.language }, message);

    return response.toString();
  }

  // ==================== NODE-SPECIFIC TWIML ====================

  /**
   * Generate Play/Say TwiML
   * @param {Object} node - Node configuration
   * @param {Object} voiceConfig - Voice settings
   * @returns {string} TwiML XML string
   */
  generatePlayTwiML(node, voiceConfig) {
    const response = new TwiML.VoiceResponse();

    // Check if it's an audio file or text
    if (node.audio_url || node.audioUrl) {
      response.play(node.audio_url || node.audioUrl);
    } else {
      const message = node.message || node.text || node.content || '';

      if (this.isSSML(message)) {
        // Handle SSML content
        const sayOptions = {
          voice: node.voice || voiceConfig.voice,
          language: node.language || voiceConfig.language
        };
        response.say(sayOptions).ssmlParagraph(this.extractSSML(message));
      } else {
        // Plain text with optional prosody
        const sayOptions = {
          voice: node.voice || voiceConfig.voice,
          language: node.language || voiceConfig.language
        };

        // Apply prosody if specified
        if (node.rate || node.pitch || node.volume) {
          const prosodyText = this.wrapWithProsody(message, {
            rate: node.rate,
            pitch: node.pitch,
            volume: node.volume
          });
          response.say(sayOptions).ssmlParagraph(prosodyText);
        } else {
          response.say(sayOptions, message);
        }
      }
    }

    // Handle loop
    if (node.loop && node.loop > 1) {
      for (let i = 1; i < node.loop; i++) {
        if (node.audio_url || node.audioUrl) {
          response.play(node.audio_url || node.audioUrl);
        } else {
          response.say({
            voice: node.voice || voiceConfig.voice,
            language: node.language || voiceConfig.language
          }, node.message || node.text || '');
        }
      }
    }

    // Add redirect to next node if specified
    if (node.next_node_id || node.nextNodeId) {
      response.redirect(this.generateActionUrl(node.flow_id, node.next_node_id || node.nextNodeId));
    }

    return response.toString();
  }

  /**
   * Generate Menu TwiML with Gather
   * @param {Object} node - Node configuration
   * @param {Object} voiceConfig - Voice settings
   * @param {Object} flow - Flow configuration
   * @returns {string} TwiML XML string
   */
  generateMenuTwiML(node, voiceConfig, flow) {
    const response = new TwiML.VoiceResponse();

    const gatherOptions = {
      input: node.input_type || 'dtmf speech',
      timeout: node.timeout || flow.input_timeout || 5,
      numDigits: node.num_digits || node.numDigits,
      finishOnKey: node.finish_on_key || node.finishOnKey || '#',
      action: this.generateActionUrl(flow.id, node.id, 'gather'),
      method: 'POST',
      language: node.language || voiceConfig.language
    };

    // Speech recognition options
    if (gatherOptions.input.includes('speech')) {
      gatherOptions.speechTimeout = node.speech_timeout || flow.speech_timeout || 'auto';
      gatherOptions.speechModel = node.speech_model || 'phone_call';

      // Add speech hints
      const hints = node.speech_hints || SPEECH_HINTS[voiceConfig.langCode] || [];
      if (node.options && Array.isArray(node.options)) {
        hints.push(...node.options.map(o => o.label || o.value));
      }
      if (hints.length > 0) {
        gatherOptions.hints = hints.join(', ');
      }

      // Partial results for real-time processing
      if (node.partial_results || node.partialResults) {
        gatherOptions.partialResultCallback = this.generateCallbackUrl('partial-speech', flow.id, node.id);
      }
    }

    // Remove undefined options
    Object.keys(gatherOptions).forEach(key => {
      if (gatherOptions[key] === undefined) delete gatherOptions[key];
    });

    const gather = response.gather(gatherOptions);

    // Add menu prompt
    const prompt = node.prompt || node.message || 'Please make a selection.';
    if (this.isSSML(prompt)) {
      gather.say({ voice: voiceConfig.voice, language: voiceConfig.language })
        .ssmlParagraph(this.extractSSML(prompt));
    } else {
      gather.say({ voice: voiceConfig.voice, language: voiceConfig.language }, prompt);
    }

    // Add menu options as speech
    if (node.options && Array.isArray(node.options)) {
      const optionsText = node.options
        .map((opt, idx) => `Press ${opt.digit || idx + 1} for ${opt.label}`)
        .join('. ');

      if (optionsText) {
        gather.say({ voice: voiceConfig.voice, language: voiceConfig.language }, optionsText);
      }
    }

    // No input fallback
    if (node.no_input_action || node.noInputNodeId) {
      response.redirect(this.generateActionUrl(flow.id, node.no_input_action || node.noInputNodeId));
    } else {
      // Repeat menu on no input
      response.say({ voice: voiceConfig.voice, language: voiceConfig.language },
        node.no_input_message || "I didn't receive any input.");
      response.redirect(this.generateActionUrl(flow.id, node.id));
    }

    return response.toString();
  }

  /**
   * Generate Input TwiML with Gather
   * @param {Object} node - Node configuration
   * @param {Object} voiceConfig - Voice settings
   * @param {Object} flow - Flow configuration
   * @returns {string} TwiML XML string
   */
  generateInputTwiML(node, voiceConfig, flow) {
    const response = new TwiML.VoiceResponse();

    const inputType = node.input_type || node.inputType || 'dtmf';

    const gatherOptions = {
      input: inputType,
      timeout: node.timeout || flow.input_timeout || 5,
      action: this.generateActionUrl(flow.id, node.id, 'input'),
      method: 'POST'
    };

    // DTMF-specific options
    if (inputType.includes('dtmf')) {
      if (node.num_digits || node.numDigits) {
        gatherOptions.numDigits = node.num_digits || node.numDigits;
      }
      if (node.min_digits || node.minDigits) {
        // Twilio doesn't support minDigits, handle in callback
      }
      if (node.max_digits || node.maxDigits) {
        gatherOptions.numDigits = node.max_digits || node.maxDigits;
      }
      gatherOptions.finishOnKey = node.finish_on_key || node.finishOnKey || '#';
    }

    // Speech-specific options
    if (inputType.includes('speech')) {
      gatherOptions.language = node.language || voiceConfig.language;
      gatherOptions.speechTimeout = node.speech_timeout || flow.speech_timeout || 'auto';
      gatherOptions.speechModel = node.speech_model || 'phone_call';
      gatherOptions.profanityFilter = node.profanity_filter !== false;

      // Enhanced speech recognition
      if (node.enhanced) {
        gatherOptions.enhanced = true;
      }

      // Speech hints
      const hints = node.speech_hints || node.hints || [];
      if (hints.length > 0) {
        gatherOptions.hints = Array.isArray(hints) ? hints.join(', ') : hints;
      }

      // Partial results callback
      if (node.partial_results) {
        gatherOptions.partialResultCallback = this.generateCallbackUrl('partial', flow.id, node.id);
        gatherOptions.partialResultCallbackMethod = 'POST';
      }
    }

    // Remove undefined
    Object.keys(gatherOptions).forEach(key => {
      if (gatherOptions[key] === undefined) delete gatherOptions[key];
    });

    const gather = response.gather(gatherOptions);

    // Add prompt
    const prompt = node.prompt || node.message || 'Please provide your input.';
    if (node.audio_url || node.audioUrl) {
      gather.play(node.audio_url || node.audioUrl);
    } else if (this.isSSML(prompt)) {
      gather.say({ voice: voiceConfig.voice, language: voiceConfig.language })
        .ssmlParagraph(this.extractSSML(prompt));
    } else {
      gather.say({ voice: voiceConfig.voice, language: voiceConfig.language }, prompt);
    }

    // No input handling
    const noInputMessage = node.no_input_message || "I didn't hear anything.";
    response.say({ voice: voiceConfig.voice, language: voiceConfig.language }, noInputMessage);

    // Retry or fallback
    if (node.retry_on_no_input !== false) {
      response.redirect(this.generateActionUrl(flow.id, node.id));
    } else if (node.fallback_node_id) {
      response.redirect(this.generateActionUrl(flow.id, node.fallback_node_id));
    }

    return response.toString();
  }

  /**
   * Generate Transfer/Dial TwiML
   * @param {Object} node - Node configuration
   * @param {Object} voiceConfig - Voice settings
   * @returns {string} TwiML XML string
   */
  generateTransferTwiML(node, voiceConfig) {
    const response = new TwiML.VoiceResponse();

    // Pre-transfer message
    if (node.message || node.transfer_message) {
      response.say(
        { voice: voiceConfig.voice, language: voiceConfig.language },
        node.message || node.transfer_message || 'Please hold while we transfer your call.'
      );
    }

    const dialOptions = {
      timeout: node.timeout || 30,
      callerId: node.caller_id || node.callerId,
      record: node.record || 'do-not-record',
      action: node.action_url || this.generateCallbackUrl('dial-complete', node.flow_id, node.id),
      method: 'POST'
    };

    // Add ring tone
    if (node.ring_tone || node.ringTone) {
      dialOptions.ringTone = node.ring_tone || node.ringTone;
    }

    // Time limit
    if (node.time_limit || node.timeLimit) {
      dialOptions.timeLimit = node.time_limit || node.timeLimit;
    }

    // Answering machine detection
    if (node.amd || node.machineDetection) {
      dialOptions.machineDetection = node.amd_mode || 'Enable';
      dialOptions.machineDetectionTimeout = node.amd_timeout || 5;
    }

    // Remove undefined
    Object.keys(dialOptions).forEach(key => {
      if (dialOptions[key] === undefined) delete dialOptions[key];
    });

    const dial = response.dial(dialOptions);

    // Determine target type
    const target = node.target || node.phone_number || node.number;

    if (node.target_type === 'sip' || target?.startsWith('sip:')) {
      dial.sip(target);
    } else if (node.target_type === 'client' || node.is_client) {
      dial.client(target);
    } else if (node.target_type === 'queue') {
      dial.queue({
        url: node.queue_url,
        reservationSid: node.reservation_sid
      }, target);
    } else if (node.target_type === 'conference') {
      dial.conference({
        beep: node.beep !== false,
        startConferenceOnEnter: node.start_on_enter !== false,
        endConferenceOnExit: node.end_on_exit || false,
        muted: node.muted || false,
        waitUrl: node.wait_url || node.hold_music_url
      }, target);
    } else {
      // Regular phone number
      dial.number({
        statusCallback: this.generateCallbackUrl('number-status', node.flow_id, node.id),
        statusCallbackMethod: 'POST'
      }, target);
    }

    // Add multiple targets for simultaneous ring
    if (node.additional_targets && Array.isArray(node.additional_targets)) {
      node.additional_targets.forEach(t => {
        dial.number(t);
      });
    }

    return response.toString();
  }

  /**
   * Generate Voicemail/Record TwiML
   * @param {Object} node - Node configuration
   * @param {Object} voiceConfig - Voice settings
   * @param {Object} flow - Flow configuration
   * @returns {string} TwiML XML string
   */
  generateVoicemailTwiML(node, voiceConfig, flow) {
    const response = new TwiML.VoiceResponse();

    // Voicemail greeting
    const greeting = node.greeting || node.message ||
      'Please leave your message after the beep. Press pound when finished.';

    if (node.greeting_audio_url || node.audioUrl) {
      response.play(node.greeting_audio_url || node.audioUrl);
    } else {
      response.say({ voice: voiceConfig.voice, language: voiceConfig.language }, greeting);
    }

    const recordOptions = {
      maxLength: node.max_length || node.maxLength || 120,
      playBeep: node.play_beep !== false,
      timeout: node.timeout || 10,
      finishOnKey: node.finish_on_key || '#',
      action: this.generateActionUrl(flow.id, node.id, 'recording'),
      method: 'POST',
      recordingStatusCallback: this.generateCallbackUrl('recording-status', flow.id, node.id),
      recordingStatusCallbackMethod: 'POST'
    };

    // Transcription
    if (node.transcribe !== false) {
      recordOptions.transcribe = true;
      recordOptions.transcribeCallback = this.generateCallbackUrl('transcription', flow.id, node.id);
    }

    // Trim silence
    if (node.trim !== false) {
      recordOptions.trim = 'trim-silence';
    }

    // Remove undefined
    Object.keys(recordOptions).forEach(key => {
      if (recordOptions[key] === undefined) delete recordOptions[key];
    });

    response.record(recordOptions);

    // After recording message
    if (node.after_message) {
      response.say({ voice: voiceConfig.voice, language: voiceConfig.language }, node.after_message);
    }

    // Next action after recording
    if (node.next_node_id) {
      response.redirect(this.generateActionUrl(flow.id, node.next_node_id));
    } else {
      response.hangup();
    }

    return response.toString();
  }

  /**
   * Generate Hangup TwiML
   * @param {Object} node - Node configuration
   * @param {Object} voiceConfig - Voice settings
   * @returns {string} TwiML XML string
   */
  generateHangupTwiML(node = {}, voiceConfig = {}) {
    const response = new TwiML.VoiceResponse();

    // Final message before hangup
    if (node.message || node.goodbye_message) {
      response.say(
        { voice: voiceConfig.voice, language: voiceConfig.language },
        node.message || node.goodbye_message
      );
    }

    response.hangup();

    return response.toString();
  }

  /**
   * Generate Pause TwiML
   * @param {number} duration - Pause duration in seconds
   * @returns {string} TwiML XML string
   */
  generatePauseTwiML(duration = 1) {
    const response = new TwiML.VoiceResponse();
    response.pause({ length: Math.min(duration, 60) }); // Max 60 seconds
    return response.toString();
  }

  /**
   * Generate Redirect TwiML
   * @param {string} url - URL to redirect to
   * @returns {string} TwiML XML string
   */
  generateRedirectTwiML(url) {
    const response = new TwiML.VoiceResponse();

    if (url) {
      // Check if it's an internal node reference
      if (url.startsWith('node:')) {
        const [, flowId, nodeId] = url.split(':');
        response.redirect(this.generateActionUrl(flowId, nodeId));
      } else {
        response.redirect(url);
      }
    }

    return response.toString();
  }

  /**
   * Generate Conference TwiML
   * @param {Object} node - Node configuration
   * @param {Object} voiceConfig - Voice settings
   * @returns {string} TwiML XML string
   */
  generateConferenceTwiML(node, voiceConfig) {
    const response = new TwiML.VoiceResponse();

    // Announce joining
    if (node.join_message) {
      response.say({ voice: voiceConfig.voice, language: voiceConfig.language }, node.join_message);
    }

    const dialOptions = {
      action: node.action_url || this.generateCallbackUrl('conference-complete', node.flow_id, node.id),
      method: 'POST'
    };

    const dial = response.dial(dialOptions);

    const conferenceOptions = {
      beep: node.beep !== false,
      startConferenceOnEnter: node.start_on_enter !== false,
      endConferenceOnExit: node.end_on_exit || false,
      muted: node.muted || false,
      maxParticipants: node.max_participants || 250,
      statusCallback: this.generateCallbackUrl('conference-status', node.flow_id, node.id),
      statusCallbackEvent: 'start end join leave mute hold'
    };

    // Hold music
    if (node.wait_url || node.hold_music_url) {
      conferenceOptions.waitUrl = node.wait_url || node.hold_music_url;
    }

    // Recording
    if (node.record) {
      conferenceOptions.record = node.record; // 'record-from-start' or 'do-not-record'
      conferenceOptions.recordingStatusCallback = this.generateCallbackUrl('conference-recording', node.flow_id, node.id);
    }

    // Coach mode
    if (node.coach) {
      conferenceOptions.coach = node.coach_sid;
    }

    dial.conference(conferenceOptions, node.conference_name || node.name || `conference-${node.id}`);

    return response.toString();
  }

  /**
   * Generate Queue TwiML
   * @param {Object} node - Node configuration
   * @param {Object} voiceConfig - Voice settings
   * @returns {string} TwiML XML string
   */
  generateQueueTwiML(node, voiceConfig) {
    const response = new TwiML.VoiceResponse();

    // Queue announcement
    if (node.message) {
      response.say({ voice: voiceConfig.voice, language: voiceConfig.language }, node.message);
    }

    const enqueueOptions = {
      waitUrl: node.wait_url || node.hold_music_url,
      waitUrlMethod: 'POST',
      action: this.generateCallbackUrl('queue-result', node.flow_id, node.id),
      method: 'POST'
    };

    if (node.workflow_sid) {
      enqueueOptions.workflowSid = node.workflow_sid;
    }

    response.enqueue(enqueueOptions, node.queue_name || 'default');

    return response.toString();
  }

  /**
   * Generate SMS TwiML (during call)
   * @param {Object} node - Node configuration
   * @returns {string} TwiML XML string
   */
  generateSMSTwiML(node) {
    const response = new TwiML.VoiceResponse();

    const smsOptions = {
      to: node.to || node.recipient,
      from: node.from || node.sender,
      action: this.generateCallbackUrl('sms-status', node.flow_id, node.id),
      method: 'POST'
    };

    // Status callback
    if (node.status_callback) {
      smsOptions.statusCallback = node.status_callback;
    }

    response.sms(smsOptions, node.message || node.body);

    return response.toString();
  }

  /**
   * Generate Condition/Branch TwiML
   * @param {Object} node - Node configuration
   * @param {Object} voiceConfig - Voice settings
   * @param {Object} flow - Flow configuration
   * @param {Object} session - Session data
   * @returns {string} TwiML XML string
   */
  generateConditionTwiML(node, voiceConfig, flow, session) {
    const response = new TwiML.VoiceResponse();

    // Evaluate condition and redirect to appropriate node
    // This is typically handled server-side, but we provide basic support
    let targetNodeId = node.default_node_id || node.else_node_id;

    if (node.conditions && session.variables) {
      for (const condition of node.conditions) {
        if (this.evaluateCondition(condition, session.variables)) {
          targetNodeId = condition.target_node_id;
          break;
        }
      }
    }

    if (targetNodeId) {
      response.redirect(this.generateActionUrl(flow.id, targetNodeId));
    }

    return response.toString();
  }

  // ==================== VOICE CONFIGURATION ====================

  /**
   * Get voice configuration from flow settings
   * @param {Object} flow - Flow configuration
   * @returns {Object} Voice configuration
   */
  getVoiceConfig(flow = {}) {
    const language = flow.default_language || 'en';
    const langCode = language.split('-')[0]; // Extract base language code
    const provider = flow.voice_provider || 'polly';
    const gender = flow.voice_gender || 'female';

    // Get voice from configuration
    let voice = flow.voice;
    if (!voice) {
      const providerVoices = VOICE_CONFIG[provider] || VOICE_CONFIG.polly;
      const langVoices = providerVoices[langCode] || providerVoices.en;
      voice = langVoices[gender] || langVoices.female;
    }

    return {
      voice,
      language: LANGUAGE_CODES[language] || LANGUAGE_CODES.en,
      langCode,
      provider,
      gender
    };
  }

  /**
   * Get available voices for a language
   * @param {string} language - Language code
   * @param {string} provider - Voice provider
   * @returns {Array} Available voices
   */
  getAvailableVoices(language = 'en', provider = 'polly') {
    const langCode = language.split('-')[0];
    const providerVoices = VOICE_CONFIG[provider] || VOICE_CONFIG.polly;
    const langVoices = providerVoices[langCode] || providerVoices.en;

    return Object.entries(langVoices).map(([gender, voice]) => ({
      voice,
      gender,
      language: langCode,
      provider
    }));
  }

  // ==================== SSML SUPPORT ====================

  /**
   * Check if text contains SSML
   * @param {string} text - Text to check
   * @returns {boolean}
   */
  isSSML(text) {
    if (!text) return false;
    return text.includes('<speak>') || text.includes('<prosody') ||
           text.includes('<break') || text.includes('<emphasis') ||
           text.includes('<say-as') || text.includes('<phoneme');
  }

  /**
   * Extract SSML content from text
   * @param {string} text - Text with SSML
   * @returns {string} Clean SSML
   */
  extractSSML(text) {
    if (!text) return '';
    // If wrapped in <speak>, extract content
    const speakMatch = text.match(/<speak>(.*?)<\/speak>/s);
    if (speakMatch) {
      return speakMatch[1];
    }
    return text;
  }

  /**
   * Wrap text with prosody SSML
   * @param {string} text - Text to wrap
   * @param {Object} options - Prosody options
   * @returns {string} SSML with prosody
   */
  wrapWithProsody(text, options = {}) {
    const { rate, pitch, volume } = options;
    const attrs = [];

    if (rate) attrs.push(`rate="${rate}"`);
    if (pitch) attrs.push(`pitch="${pitch}"`);
    if (volume) attrs.push(`volume="${volume}"`);

    if (attrs.length === 0) return text;

    return `<prosody ${attrs.join(' ')}>${text}</prosody>`;
  }

  /**
   * Create SSML break
   * @param {string|number} time - Break time (e.g., '500ms', '1s', 2)
   * @returns {string} SSML break tag
   */
  createBreak(time) {
    if (typeof time === 'number') {
      return `<break time="${time}s"/>`;
    }
    return `<break time="${time}"/>`;
  }

  /**
   * Create SSML say-as for specific content types
   * @param {string} text - Text to format
   * @param {string} interpretAs - Interpretation type
   * @returns {string} SSML say-as tag
   */
  createSayAs(text, interpretAs) {
    const validTypes = ['characters', 'spell-out', 'cardinal', 'ordinal',
                       'digits', 'fraction', 'unit', 'date', 'time',
                       'telephone', 'address', 'interjection', 'expletive'];

    if (!validTypes.includes(interpretAs)) {
      return text;
    }

    return `<say-as interpret-as="${interpretAs}">${text}</say-as>`;
  }

  // ==================== URL GENERATION ====================

  /**
   * Generate action URL for a node
   * @param {string} flowId - Flow ID
   * @param {string} nodeId - Node ID
   * @param {string} [action] - Optional action type
   * @returns {string} Full URL
   */
  generateActionUrl(flowId, nodeId, action = 'execute') {
    const base = `${this.baseUrl}/api/voice/ivr/${flowId}/node/${nodeId}`;
    return action ? `${base}/${action}` : base;
  }

  /**
   * Generate callback URL
   * @param {string} type - Callback type
   * @param {string} flowId - Flow ID
   * @param {string} nodeId - Node ID
   * @returns {string} Full URL
   */
  generateCallbackUrl(type, flowId, nodeId) {
    return `${this.baseUrl}/api/voice/ivr/callback/${type}/${flowId}/${nodeId}`;
  }

  /**
   * Generate webhook URL
   * @param {string} type - Webhook type
   * @param {string} flowId - Flow ID
   * @returns {string} Full URL
   */
  generateWebhookUrl(type, flowId) {
    return `${this.baseUrl}/api/voice/ivr/${flowId}/webhook/${type}`;
  }

  /**
   * Generate status callback URL
   * @param {string} flowId - Flow ID
   * @returns {string} Full URL
   */
  generateStatusCallbackUrl(flowId) {
    return `${this.baseUrl}/api/voice/ivr/${flowId}/status`;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Evaluate a condition against variables
   * @param {Object} condition - Condition to evaluate
   * @param {Object} variables - Session variables
   * @returns {boolean} Condition result
   */
  evaluateCondition(condition, variables) {
    const { variable, operator, value } = condition;
    const actualValue = variables[variable];

    switch (operator) {
      case 'equals':
      case '==':
      case '=':
        return actualValue == value;
      case 'not_equals':
      case '!=':
        return actualValue != value;
      case 'contains':
        return String(actualValue).includes(value);
      case 'starts_with':
        return String(actualValue).startsWith(value);
      case 'ends_with':
        return String(actualValue).endsWith(value);
      case 'greater_than':
      case '>':
        return Number(actualValue) > Number(value);
      case 'less_than':
      case '<':
        return Number(actualValue) < Number(value);
      case 'greater_or_equal':
      case '>=':
        return Number(actualValue) >= Number(value);
      case 'less_or_equal':
      case '<=':
        return Number(actualValue) <= Number(value);
      case 'is_empty':
        return !actualValue || actualValue === '';
      case 'is_not_empty':
        return actualValue && actualValue !== '';
      case 'matches':
        return new RegExp(value).test(String(actualValue));
      default:
        return false;
    }
  }

  /**
   * Format phone number for Twilio
   * @param {string} number - Phone number
   * @param {string} defaultCountry - Default country code
   * @returns {string} E.164 formatted number
   */
  formatPhoneNumber(number, defaultCountry = '+1') {
    if (!number) return null;

    // Remove all non-numeric characters except +
    let cleaned = number.replace(/[^\d+]/g, '');

    // If doesn't start with +, add default country code
    if (!cleaned.startsWith('+')) {
      cleaned = defaultCountry + cleaned;
    }

    return cleaned;
  }

  /**
   * Validate TwiML string
   * @param {string} twiml - TwiML to validate
   * @returns {Object} Validation result
   */
  validateTwiML(twiml) {
    try {
      // Basic XML validation
      if (!twiml.includes('<?xml') && !twiml.includes('<Response>')) {
        return { valid: false, error: 'Missing Response element' };
      }

      // Check for common issues
      const issues = [];

      if (twiml.includes('<Gather') && !twiml.includes('action=')) {
        issues.push('Gather without action URL');
      }

      if (twiml.includes('<Record') && !twiml.includes('action=')) {
        issues.push('Record without action URL');
      }

      return {
        valid: issues.length === 0,
        issues
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = new TwiMLGeneratorService();
