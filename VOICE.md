# Voice Services Documentation

Complete documentation for voice-related features, services, APIs, and configurations in BotBuilder.

## Table of Contents

1. [Overview](#overview)
2. [Voice Features](#voice-features)
3. [Supported Providers](#supported-providers)
4. [Core Services](#core-services)
5. [API Endpoints](#api-endpoints)
6. [Configuration](#configuration)
7. [Usage Examples](#usage-examples)
8. [Language Support](#language-support)

---

## Overview

BotBuilder provides a comprehensive voice services ecosystem supporting:

- **Speech-to-Text (STT)**: Convert audio to text with 99%+ accuracy
- **Text-to-Speech (TTS)**: Generate natural-sounding speech
- **Phone Integration**: Twilio-based incoming/outbound calls
- **Voice Bot Creation**: AI-powered voice bot generation from natural language
- **Real-time Streaming**: WebSocket-based streaming transcription
- **Audio Processing**: Format conversion, noise reduction, normalization
- **Analytics**: Comprehensive voice metrics and statistics

### Key Statistics

- **125+ Supported Languages**: From Tier-1 (best support) to Tier-3 languages
- **3-Stage Pipeline**: Google Cloud STT → Whisper → Gemini for maximum accuracy
- **Real-time Processing**: WebSocket streaming with interim results
- **Rate Limiting**: Intelligent rate limiting with exponential backoff
- **Storage Options**: Local filesystem or AWS S3

---

## Voice Features

### 1. Speech-to-Text (STT)

#### Multi-Provider Support
- **OpenAI Whisper**: Fallback and refinement stage
- **Google Cloud Speech-to-Text**: Primary transcription (Stage 1)
- **Deepgram**: Real-time streaming STT with 99%+ accuracy
- **AssemblyAI**: Alternative streaming provider

#### Capabilities
- Automatic language detection with fallback candidates
- Diarization (speaker identification) support
- Word-level timestamps
- Confidence scores for each transcription
- Interim results for streaming

### 2. Text-to-Speech (TTS)

#### Multi-Provider Support
- **ElevenLabs**: Premium voice quality with emotional control
- **OpenAI TTS**: Fast, natural-sounding voices
- **Google Text-to-Speech**: Neural voices in 30+ languages
- **Azure Cognitive Services**: Enterprise voice options

#### Capabilities
- 500+ pre-trained voices across providers
- Voice parameter control (stability, similarity, style)
- Multiple audio formats (MP3, WAV, OGG, etc.)
- Speaking rate and pitch adjustment
- SSML support for advanced control

### 3. Phone Integration (Twilio)

#### Capabilities
- Incoming/outbound call handling
- Call recording and transcription
- IVR (Interactive Voice Response) with TwiML
- Call status webhooks
- Machine detection
- Phone number management (purchase, release)
- DTMF support

### 4. Streaming Transcription

#### Real-time Processing
- Low-latency streaming (100-200ms)
- Interim results with confidence scores
- Automatic endpointing detection
- Multi-provider support
- Event-based architecture

### 5. Voice Bot Creation

#### Automated Bot Generation from Voice
- AI-powered intent extraction
- Automatic entity detection
- Flow generation (conversation logic)
- Template-based creation
- Customization options
- Preview before generation

### 6. Audio Format Conversion

#### Supported Formats
- WAV, MP3, OGG, WEBM, FLAC, M4A, AAC, OPUS, WMA

#### Presets
- `speech`: 16kHz, mono, 64kbps WAV
- `hq-speech`: 44.1kHz, mono, 128kbps MP3
- `music`: 44.1kHz, stereo, 192kbps MP3
- `telephony`: 8kHz, mono, 32kbps WAV
- `whisper`: 16kHz, mono, WAV (OpenAI recommended)
- `web`: 48kHz, stereo, 128kbps WebM

### 7. Voice Analytics

#### Metrics Tracking
- Total transcriptions and success rate
- Average confidence scores
- Processing time analytics
- Breakdown by provider
- Language distribution
- Error tracking
- Daily/hourly trends

---

## Supported Providers

### Speech-to-Text (STT)

| Provider | Language Coverage | Quality | Speed | Cost | Best For |
|----------|------------------|---------|-------|------|----------|
| OpenAI Whisper | 99+ languages | High | Fast | Low | Fallback, refinement |
| Google Cloud | 125+ languages | Excellent | Fast | Medium | Primary transcription |
| Deepgram | 50+ languages | Excellent | Real-time | Low-Medium | Streaming, real-time |
| AssemblyAI | 50+ languages | High | Fast | Medium | Streaming alternative |

### Text-to-Speech (TTS)

| Provider | Voices | Language Coverage | Quality | Cost | Best For |
|----------|--------|-------------------|---------|------|----------|
| ElevenLabs | 500+ | 30+ languages | Premium | Medium-High | High-quality voices |
| OpenAI | 6 | 50+ via Whisper | Good | Low | Fast, budget-friendly |
| Google | 150+ | 30+ languages | Excellent | Low-Medium | Neural voices |
| Azure | 400+ | 140+ languages | Excellent | Medium | Enterprise |

### Phone Integration

| Provider | Features | Countries | Cost |
|----------|----------|-----------|------|
| Twilio | Calls, SMS, IVR | 190+ | Pay-as-you-go |


### Language Support Tiers

**Tier 1 (Best Support):**
English (US, UK), Turkish, Azerbaijani, Russian, German, French, Spanish, Portuguese, Italian, Dutch, Polish, Ukrainian, Chinese (Simplified/Traditional), Japanese, Korean, Vietnamese, Thai, Indonesian, Malay, Filipino, Arabic (Saudi, Egypt), Persian, Hebrew, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu

**Tier 2 (Good Support):**
Czech, Slovak, Hungarian, Romanian, Bulgarian, Croatian, Serbian, Slovenian, Greek, Finnish, Swedish, Norwegian, Danish, Estonian, Latvian, Lithuanian

**Tier 3 (Basic Support):**
Swahili, Afrikaans, Zulu, Amharic, Georgian, Armenian, Kazakh, Uzbek, Mongolian, Nepali, Sinhala, Burmese, Khmer, Lao

---

## Core Services

### 1. SpeechToText (server/services/voice/SpeechToText.js)

**Key Methods:**

```javascript
class SpeechToText {
  constructor(provider = 'whisper', config = {})
  async transcribe(audioBuffer, options = {})
  async transcribeWithWhisper(audioBuffer, options = {})
  async transcribeWithGoogle(audioBuffer, options = {})
  async transcribeWithDeepgram(audioBuffer, options = {})
  createStreamingSession(options = {})
}
```

**Options:**
- `language`: Language code or 'auto' for auto-detect
- `model`: Provider-specific model
- `sampleRate`: Audio sample rate in Hz
- `confidence`: Minimum confidence threshold
- `prompt`: Context for Whisper
- `diarize`: Speaker identification

### 2. TextToSpeech (server/services/voice/TextToSpeech.js)

**Key Methods:**

```javascript
class TextToSpeech {
  constructor(provider = 'elevenlabs', config = {})
  async synthesize(text, options = {})
  async synthesizeWithElevenLabs(text, options = {})
  async synthesizeWithOpenAI(text, options = {})
  async synthesizeWithGoogle(text, options = {})
  async getVoices()
}
```

**Options:**
- `voiceId`: ElevenLabs specific
- `model`: TTS model (tts-1, tts-1-hd, etc.)
- `voice`: Voice selection (alloy, echo, fable, onyx, nova, shimmer)
- `stability`: Stability control (0-1)
- `similarityBoost`: Similarity boost (0-1)
- `speed`: Speaking speed (0.25-4.0)
- `pitch`: Pitch adjustment (-20 to 20)
- `language`: Language code
- `gender`: Voice gender (MALE, FEMALE, NEUTRAL)

### 3. TwilioService (server/services/voice/TwilioService.js)

**Key Methods:**

```javascript
class TwilioService {
  async searchAvailableNumbers(countryCode = 'US', options = {})
  async purchaseNumber(phoneNumber, webhookUrl)
  async releaseNumber(phoneSid)
  async makeCall(from, to, webhookUrl, options = {})
  async getCall(callSid)
  async endCall(callSid)
  async getRecording(callSid)
  generateTwiML(options = {})
  validateWebhook(signature, url, params)
}
```

### 4. StreamingTranscription (server/services/voice/StreamingTranscription.js)

**Key Methods:**

```javascript
class StreamingTranscription extends EventEmitter {
  createSession(options = {})
  async startSession(sessionId)
  async endSession(sessionId)
  sendAudio(sessionId, audioChunk)
  getSessionStatus(sessionId)
  getActiveSessions()
  async cleanup()
}
```

**Events:**
- `transcript`: New transcript available
- `session:connected`: Session connected
- `session:error`: Session error
- `speech:started`: Speech started

### 5. VoiceStorage (server/services/voice/VoiceStorage.js)

**Key Methods:**

```javascript
class VoiceStorage {
  async store(buffer, options = {})
  async retrieve(filename)
  async delete(filename)
  async list(options = {})
  async getStorageStats()
  async getSignedUrl(filename, expiresIn = 3600)
  async storeLocal(buffer, filename, metadata)
  async storeS3(buffer, filename, metadata)
}
```

### 6. FormatConverter (server/services/voice/FormatConverter.js)

**Key Methods:**

```javascript
class FormatConverter {
  async convert(inputBuffer, options = {})
  async getDuration(buffer, format = 'wav')
  async extractSegment(inputBuffer, options = {})
  async concatenate(buffers, options = {})
  getSupportedFormats()
  getPresets()
  async isAvailable()
}
```

### 7. VoiceQueue (server/services/voice/VoiceQueue.js)

**Key Methods:**

```javascript
class VoiceQueue {
  async addJob(job)
  getJobStatus(jobId)
  waitForJob(jobId, timeout = 60000)
  cancelJob(jobId)
  async processQueue()
  async processJob(job)
  getStats()
  clearOldResults(maxAge = 3600000)
}
```

### 8. VoiceAnalytics (server/services/voice/VoiceAnalytics.js)

**Key Methods:**

```javascript
class VoiceAnalytics {
  async recordTranscription(event)
  async getStats(options = {})
  async getProviderBreakdown(options)
  async getLanguageBreakdown(options)
  async getDailyTrend(options)
  startSession(sessionId)
  endSession(sessionId)
  getRealTimeMetrics()
}
```

### 9. LanguageSupport (server/services/voice/LanguageSupport.js)

**Key Methods:**

```javascript
class LanguageSupport {
  getSupportedLanguages()
  getLanguage(code)
  isSupported(code)
  getSTTCode(langCode, provider)
  getTTSVoices(langCode, provider)
  detectLanguage(text)
  getProviderSupport(langCode)
  getBestProvider(langCode, type = 'stt')
}
```

### 10. VoiceProcessor (server/services/voiceToBot/VoiceProcessor.js)

**3-Stage Pipeline Architecture:**

```javascript
class VoiceProcessor {
  // 3-stage pipeline: Google STT → Whisper → Gemini
  async transcribe(audioData, options = {})
  async _googleTranscribe(audioData, options)   // Stage 1
  async _whisperTranscribe(audioData, options)  // Stage 2
  async _geminiCorrect(text, ...)               // Stage 3
  createStreamingRecognition(options, onResult, onError)
  async preprocessAudio(audioBuffer, options = {})
  cleanTranscription(text)
  extractKeyPhrases(text)
}
```

### 11. IntentExtractor (server/services/voiceToBot/IntentExtractor.js)

**Key Methods:**

```javascript
class IntentExtractor {
  async extractFromText(text, options = {})
  extractFromKeywords(keywords, options = {})
  suggestEntities(intents)
  generateDefaultFlow(intents, entities)
  getMockExtraction(language, startTime)
}
```

### 12. BotGenerator (server/services/voiceToBot/BotGenerator.js)

**Key Methods:**

```javascript
class BotGenerator {
  async generateBot(extractedData, userId, organizationId, options = {})
  async updateBot(botId, extractedData, userId, options = {})
  generateBotSettings(extractedData)
  generateWelcomeMessage(extractedData)
  generateFlowNodes(extractedData)
  previewBot(extractedData)
  async getTemplates()
  async getTemplate(templateId)
}
```


---

## API Endpoints

### Voice Bots CRUD

**GET /api/voice/bots** - Get user's voice bots
- Auth: Required
- Response: `{ success, bots }`

**GET /api/voice/bots/:id** - Get single voice bot
- Auth: Required
- Response: `{ success, bot }`

**POST /api/voice/bots** - Create voice bot
- Auth: Required
- Body: name, description, voice_provider, stt_provider, tts_provider, language, ai_model, greeting_message, max_call_duration

**PUT /api/voice/bots/:id** - Update voice bot
- Auth: Required
- Body: Any bot configuration fields

**DELETE /api/voice/bots/:id** - Delete voice bot
- Auth: Required

### Phone Numbers

**GET /api/voice/phone-numbers** - Get user's phone numbers
- Auth: Required

**GET /api/voice/phone-numbers/available** - Search available numbers
- Auth: Required
- Query: ?country=US&areaCode=415

**POST /api/voice/phone-numbers/purchase** - Purchase phone number
- Auth: Required
- Body: phoneNumber, friendlyName

**DELETE /api/voice/phone-numbers/:id** - Release phone number
- Auth: Required

### Calls

**GET /api/voice/calls** - Get call history
- Auth: Required
- Query: ?botId=...&status=completed&limit=50

**GET /api/voice/calls/:id** - Get call details with segments
- Auth: Required

**POST /api/voice/calls/outbound** - Make outbound call
- Auth: Required
- Body: botId, toNumber

### Webhooks (Twilio)

**POST /api/voice/webhook/:botId** - Handle incoming calls
- No Auth (Twilio signature validation)

**POST /api/voice/webhook/:botId/gather** - Handle speech input
- No Auth (Twilio signature validation)

**POST /api/voice/webhook/:botId/status** - Handle call status
- No Auth (Twilio signature validation)

### Text-to-Speech

**GET /api/voice/voices** - Get available voices
- Auth: Required
- Query: ?provider=elevenlabs

**POST /api/voice/synthesize** - Synthesize text to speech
- Auth: Required
- Body: text, provider, voiceId, options
- Response: Audio buffer

### Language Support

**GET /api/voice/languages** - Get supported languages
- Auth: Required
- Query: ?provider=whisper

**GET /api/voice/languages/:code** - Get language details
- Auth: Required

**POST /api/voice/languages/detect** - Detect language
- Auth: Required
- Body: text

### Voice Analytics

**GET /api/voice/stats** - Get voice statistics
- Auth: Required
- Query: ?startDate=...&endDate=...&provider=whisper

**GET /api/voice/stats/realtime** - Get real-time metrics
- Auth: Required

### Format Conversion

**POST /api/voice/convert** - Convert audio format
- Auth: Required
- Multipart: audio file
- Body: outputFormat, sampleRate, preset, normalize, removeNoise
- Response: Audio buffer

**GET /api/voice/convert/formats** - Get supported formats
- Auth: Required

### Voice File Storage

**POST /api/voice/files** - Upload voice file
- Auth: Required
- Multipart: audio file
- Body: botId, metadata

**GET /api/voice/files** - List voice files
- Auth: Required
- Query: ?limit=100

**GET /api/voice/files/:filename** - Download voice file
- Auth: Required

**DELETE /api/voice/files/:filename** - Delete voice file
- Auth: Required

**GET /api/voice/files/:filename/url** - Get signed URL
- Auth: Required
- Query: ?expiresIn=3600

**GET /api/voice/storage/stats** - Get storage statistics
- Auth: Required

### Transcription Queue

**POST /api/voice/transcribe** - Add transcription job
- Auth: Required
- Multipart: audio file
- Body: provider, language, priority
- Response: Job with status and ID

**GET /api/voice/transcribe/:jobId** - Get job status
- Auth: Required

**GET /api/voice/queue/stats** - Get queue statistics
- Auth: Required

### Streaming Transcription

**POST /api/voice/stream/session** - Create session
- Auth: Required
- Body: provider, language, sampleRate, interimResults

**POST /api/voice/stream/:sessionId/start** - Start session
- Auth: Required

**POST /api/voice/stream/:sessionId/audio** - Send audio chunk
- Auth: Required
- Body: Binary audio data

**POST /api/voice/stream/:sessionId/end** - End session
- Auth: Required

**GET /api/voice/stream/:sessionId/status** - Get session status
- Auth: Required

**GET /api/voice/stream/sessions** - Get all active sessions
- Auth: Required

### Voice-to-Bot API

**POST /api/voice-to-bot/start** - Start session
- Auth: Required
- Body: language

**GET /api/voice-to-bot/sessions** - Get sessions
- Auth: Required
- Query: ?limit=20&offset=0&status=recording

**POST /api/voice-to-bot/transcribe** - Transcribe audio
- Auth: Required
- Multipart: audio file
- Body: sessionId, language

**POST /api/voice-to-bot/extract** - Extract intents
- Auth: Required
- Body: sessionId, text

**POST /api/voice-to-bot/generate** - Generate bot
- Auth: Required
- Body: sessionId, customizations

**POST /api/voice-to-bot/preview** - Preview bot
- Auth: Required
- Body: sessionId

**GET /api/voice-to-bot/templates** - Get templates
- Auth: Required

**DELETE /api/voice-to-bot/sessions/:sessionId** - Delete session
- Auth: Required

**GET /api/voice-to-bot/supported** - Get supported formats
- No Auth Required

---

## Configuration

### Environment Variables

```bash
# OpenAI Whisper
OPENAI_API_KEY=sk_...

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
GOOGLE_SPEECH_API_KEY=...
GOOGLE_TTS_API_KEY=...

# Deepgram
DEEPGRAM_API_KEY=...

# ElevenLabs
ELEVENLABS_API_KEY=...

# Twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# Google Gemini
GEMINI_API_KEY=...

# Voice Storage
VOICE_STORAGE_TYPE=local  # or 's3'
VOICE_STORAGE_PATH=./uploads/voice

# AWS S3 (if using S3 storage)
AWS_S3_VOICE_BUCKET=...
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Base URL for webhooks
BASE_URL=https://your-domain.com
```

### Service Configuration

```javascript
const voiceConfig = {
  // STT Configuration
  stt: {
    defaultProvider: 'whisper',
    whisper: { apiKey: process.env.OPENAI_API_KEY },
    google: { apiKey: process.env.GOOGLE_SPEECH_API_KEY },
    deepgram: { apiKey: process.env.DEEPGRAM_API_KEY }
  },

  // TTS Configuration
  tts: {
    defaultProvider: 'elevenlabs',
    elevenlabs: { apiKey: process.env.ELEVENLABS_API_KEY },
    openai: { apiKey: process.env.OPENAI_API_KEY },
    google: { apiKey: process.env.GOOGLE_TTS_API_KEY }
  },

  // Twilio Configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN
  },

  // Storage Configuration
  storage: {
    type: process.env.VOICE_STORAGE_TYPE || 'local',
    local: { path: process.env.VOICE_STORAGE_PATH || './uploads/voice' },
    s3: {
      bucket: process.env.AWS_S3_VOICE_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1'
    }
  },

  // Queue Configuration
  queue: {
    maxRetries: 3,
    retryDelay: 1000,
    concurrency: 2
  }
};
```


---

## Usage Examples

### Example 1: Complete Voice Bot Setup

```javascript
// Step 1: Create voice bot
const voiceBot = await axios.post('/api/voice/bots', {
  name: 'Customer Support Bot',
  voice_provider: 'elevenlabs',
  stt_provider: 'whisper',
  language: 'en-US',
  greeting_message: 'Hello! How can I help you?'
});

// Step 2: Purchase phone number
const phoneNumber = await axios.post('/api/voice/phone-numbers/purchase', {
  phoneNumber: '+1-555-0100',
  friendlyName: 'Support Hotline'
});

// Step 3: Assign phone to bot
await axios.put(`/api/voice/bots/${voiceBot.data.bot.id}`, {
  phone_number_id: phoneNumber.data.phoneNumber.id
});

// Step 4: Now ready to receive calls!
```

### Example 2: Real-time Streaming Transcription

```javascript
// Frontend code
async function startStreamingTranscription() {
  // Create session
  const session = await axios.post('/api/voice/stream/session', {
    provider: 'deepgram',
    language: 'en',
    sampleRate: 16000
  });

  // Start session
  await axios.post(`/api/voice/stream/${session.data.session.sessionId}/start`);

  // Connect to audio capture
  const mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.addEventListener('dataavailable', async (event) => {
    // Send audio chunk
    await axios.post(`/api/voice/stream/${session.data.session.sessionId}/audio`, 
      event.data, 
      { headers: { 'Content-Type': 'application/octet-stream' } }
    );
  });

  // End session
  mediaRecorder.addEventListener('stop', async () => {
    const result = await axios.post(
      `/api/voice/stream/${session.data.session.sessionId}/end`
    );
    console.log('Final transcript:', result.data.transcript);
  });
}
```

### Example 3: Voice-to-Bot Creation

```javascript
// Step 1: Start session
const session = await axios.post('/api/voice-to-bot/start', {
  language: 'en'
});

// Step 2: Record and transcribe
const recordingBlob = await recordAudio();
const formData = new FormData();
formData.append('audio', recordingBlob);
formData.append('sessionId', session.data.session.session_id);

const transcription = await axios.post('/api/voice-to-bot/transcribe', formData);

// Step 3: Extract intents
const extracted = await axios.post('/api/voice-to-bot/extract', {
  sessionId: session.data.session.session_id,
  text: transcription.data.transcription
});

// Step 4: Generate bot
const bot = await axios.post('/api/voice-to-bot/generate', {
  sessionId: session.data.session.session_id,
  customizations: { name: 'My Custom Bot' }
});

console.log('Bot created:', bot.data.bot);
```

### Example 4: Multi-Language Support

```javascript
// Check language support
const languages = await axios.get('/api/voice/languages');
console.log(languages.data.languages); // 125+ languages

// Auto-detect language
const detected = await axios.post('/api/voice/languages/detect', {
  text: 'Merhaba! Nasılsınız?'
});

console.log(detected.data.detectedLanguage); // 'tr'

// Transcribe in specific language
const result = await axios.post('/api/voice/transcribe', formData, {
  params: { language: 'tr' }
});
```

---

## Architecture

### 3-Stage Transcription Pipeline

```
Audio Input
    ↓
┌─────────────────────────────────────────┐
│ STAGE 1: Google Cloud Speech-to-Text    │
│ - Primary transcription                 │
│ - Language detection                    │
│ - Word-level timestamps                 │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ STAGE 2: OpenAI Whisper                 │
│ - Refinement with Google result context │
│ - Accuracy verification                 │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ STAGE 3: Google Gemini                  │
│ - Contextual correction                 │
│ - Grammar and punctuation               │
│ - Brand name fixes                      │
└────────────┬────────────────────────────┘
             ↓
        Final Output
      (99%+ Accuracy)
```

### Voice Queue System

```
Audio Upload
    ↓
┌─────────────────────────┐
│ Voice Queue             │
│ - Priority queue        │
│ - Rate limiting         │
│ - Retry logic           │
└────────┬────────────────┘
         ↓
   ┌──────────────────────────────────────┐
   │ Job Processing (Configurable)        │
   │ - Concurrency: 2-10 jobs             │
   │ - Max retries: 3                     │
   │ - Exponential backoff                │
   └────────┬─────────────────────────────┘
            ↓
    ┌──────────────┐
    │ STT Pipeline │
    └────────┬─────┘
             ↓
      ┌────────────────┐
      │ Results Cache  │
      └────────────────┘
```

### Real-time Streaming Architecture

```
WebSocket Connection
        ↓
┌──────────────────────────┐
│ Streaming Session        │
│ - Multiple providers     │
│ - Event emission         │
│ - Auto cleanup           │
└────────┬─────────────────┘
         ↓
┌────────────────────────────────────┐
│ Real-time Processing               │
│ - Interim results (200-500ms)      │
│ - Confidence scores                │
│ - Word timestamps                  │
└────────┬────────────────────────────┘
         ↓
    ┌──────────────┐
    │ Final Result │
    └──────────────┘
```

---

## Performance Metrics

### Latency
- **Streaming:** 100-200ms (interim), 500-1000ms (final)
- **Batch:** 2-5s (depending on audio length)
- **TTS:** 1-3s (depending on text length and provider)

### Accuracy
- **STT:** 95-99% (depending on audio quality and language)
- **Language Detection:** 99%+ (with machine learning)
- **TTS:** Native speaker quality

### Throughput
- **Concurrent Streams:** 100+ with Deepgram
- **Queue Processing:** 2-10 jobs concurrently
- **Rate Limits:** Configurable per provider

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| API key not configured | Missing environment variable | Set provider API key |
| Rate limit exceeded | Too many requests | Use exponential backoff |
| Unsupported language | Language not in Tier 1-3 | Check supported languages |
| Audio conversion failed | FFmpeg not available | Install ffmpeg |
| Webhook validation failed | Invalid Twilio signature | Check auth token |

### Retry Logic

```javascript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,      // 1 second
  maxDelay: 10000,      // 10 seconds
  backoffMultiplier: 2  // Double each attempt
};

// Retry delays: 1s → 2s → 4s → Failed
```

---

## Best Practices

1. **Language Specification:**
   - Always specify language when known
   - Use auto-detect as fallback only
   - Use Tier 1 languages for best support

2. **Provider Selection:**
   - Use Whisper as STT fallback
   - Use ElevenLabs for high-quality TTS
   - Use Deepgram for real-time streaming

3. **Error Handling:**
   - Always implement retry logic
   - Log errors with context
   - Monitor rate limits

4. **Storage:**
   - Use S3 for production
   - Implement automatic cleanup
   - Store metadata with files

5. **Analytics:**
   - Track provider performance
   - Monitor language distribution
   - Set up alerts for failures

---

## Support

For issues or questions about voice features:
- Check environment variables are set correctly
- Verify API keys have required permissions
- Review error messages and logs
- Test with sample audio files
- Contact provider support for API issues

---

**Last Updated:** 2024
**Version:** 2.0.0
**Maintained By:** BotBuilder Team

