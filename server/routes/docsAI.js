const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');

// Rate limiting store (in-memory, use Redis in production)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // 10 requests per minute

// Load system prompt
let systemPrompt = '';
try {
  systemPrompt = fs.readFileSync(
    path.join(__dirname, '../prompts/docsAI.txt'),
    'utf-8'
  );
} catch (error) {
  log.error('Failed to load docsAI system prompt', { error: error.message });
  systemPrompt = 'You are BotBuilder AI documentation assistant. Help users with questions about the platform.';
}

// Load docs content for context
let docsContext = '';
try {
  const docsPath = path.join(__dirname, '../../docs');
  if (fs.existsSync(docsPath)) {
    const files = fs.readdirSync(docsPath).filter(f => f.endsWith('.md'));
    docsContext = files
      .map(file => {
        try {
          return fs.readFileSync(path.join(docsPath, file), 'utf-8');
        } catch (e) {
          return '';
        }
      })
      .join('\n\n---\n\n');
  }
} catch (error) {
  log.warn('Could not load docs context', { error: error.message });
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Rate limit check
function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitStore.get(ip) || [];

  // Filter requests within the window
  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);

  if (recentRequests.length >= MAX_REQUESTS) {
    return false;
  }

  // Update store
  recentRequests.push(now);
  rateLimitStore.set(ip, recentRequests);

  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, requests] of rateLimitStore.entries()) {
    const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
    if (recentRequests.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, recentRequests);
    }
  }
}, 60 * 1000); // Clean up every minute

// Language detection helper
function detectLanguage(text) {
  // Azerbaijani characters
  if (/[əƏıİöÖüÜçÇşŞğĞ]/.test(text)) {
    // Check if it's more Turkish or Azerbaijani
    if (/nece|yaradilir|haradan|nedir/.test(text.toLowerCase())) {
      return 'az';
    }
    if (/nasil|nereden|nedir/.test(text.toLowerCase())) {
      return 'tr';
    }
    return 'az';
  }

  // Russian characters
  if (/[а-яА-ЯёЁ]/.test(text)) {
    return 'ru';
  }

  // Turkish specific words
  if (/nasil|nereden|nedir|oluştur|entegrasyon/.test(text.toLowerCase())) {
    return 'tr';
  }

  // Default to English
  return 'en';
}

// Generate follow-up suggestions based on language
function generateFollowUps(language, topic) {
  const followUps = {
    az: {
      bot: ['Flow Builder nece istifade olunur?', 'AI parametrlerini nece qururam?'],
      channel: ['Diger kanallari nece elave edirem?', 'Webhook nedir?'],
      api: ['API limit nedir?', 'Token nece yenilenir?'],
      default: ['Daha etrafli izah edin', 'Kod numunesi gosterin']
    },
    tr: {
      bot: ['Flow Builder nasil kullanilir?', 'AI ayarlarini nasil yaparim?'],
      channel: ['Diger kanallari nasil eklerim?', 'Webhook nedir?'],
      api: ['API limiti nedir?', 'Token nasil yenilenir?'],
      default: ['Daha detayli aciklayin', 'Kod ornegi gosterin']
    },
    en: {
      bot: ['How to use Flow Builder?', 'How to configure AI settings?'],
      channel: ['How to add other channels?', 'What is a webhook?'],
      api: ['What are API limits?', 'How to refresh token?'],
      default: ['Explain in more detail', 'Show code example']
    },
    ru: {
      bot: ['Kak ispolzovat Flow Builder?', 'Kak nastroit AI parametry?'],
      channel: ['Kak dobavit drugie kanaly?', 'Chto takoe webhook?'],
      api: ['Kakie ogranicheniya API?', 'Kak obnovit token?'],
      default: ['Obyasnite podrobnee', 'Pokazhite primer koda']
    }
  };

  const langFollowUps = followUps[language] || followUps.en;

  // Detect topic from response
  if (topic.toLowerCase().includes('bot')) {
    return langFollowUps.bot;
  } else if (topic.toLowerCase().includes('channel') || topic.toLowerCase().includes('telegram') || topic.toLowerCase().includes('discord')) {
    return langFollowUps.channel;
  } else if (topic.toLowerCase().includes('api') || topic.toLowerCase().includes('token')) {
    return langFollowUps.api;
  }

  return langFollowUps.default;
}

/**
 * POST /api/docs-ai/chat
 * Chat with the documentation AI assistant
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, language: requestedLanguage, conversationHistory = [] } = req.body;

    // Validate input
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Check rate limit
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    if (!checkRateLimit(clientIp)) {
      log.warn('DocsAI rate limit exceeded', { ip: clientIp });
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Please wait 1 minute.'
      });
    }

    // Detect language if not provided
    const detectedLanguage = detectLanguage(message);
    const language = requestedLanguage || detectedLanguage;

    // Language instruction for system prompt
    const languageInstructions = {
      az: 'CAVAB AZERBAYCAN DILINDE OLMALIDIR. Butun cavablari Azerbaycan dilinde yazin.',
      tr: 'CEVAP TURKCE OLMALIDIR. Tum cevaplari Turkce yazin.',
      en: 'RESPOND IN ENGLISH. Write all responses in English.',
      ru: 'OTVECHAY NA RUSSKOM YAZYKE. Pishi vse otvety na russkom.'
    };

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: `${systemPrompt}\n\n${languageInstructions[language] || languageInstructions.en}\n\nDocumentation Context:\n${docsContext.slice(0, 4000)}`
      }
    ];

    // Add conversation history (limit to last 10 messages)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    log.info('DocsAI chat request', {
      language,
      messageLength: message.length,
      historyLength: recentHistory.length
    });

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective model
      messages,
      max_tokens: 1000,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const reply = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Generate follow-up suggestions
    const suggestedFollowUps = generateFollowUps(language, reply);

    log.info('DocsAI chat response', {
      language,
      replyLength: reply.length,
      tokensUsed: completion.usage?.total_tokens
    });

    res.json({
      success: true,
      reply,
      suggestedFollowUps,
      language,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      }
    });

  } catch (error) {
    log.error('DocsAI chat error', {
      message: error.message,
      code: error.code
    });

    // Handle specific OpenAI errors
    if (error.code === 'insufficient_quota') {
      return res.status(503).json({
        success: false,
        message: 'AI service temporarily unavailable. Please try again later.'
      });
    }

    if (error.code === 'rate_limit_exceeded') {
      return res.status(429).json({
        success: false,
        message: 'AI service is busy. Please try again in a moment.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request.'
    });
  }
});

/**
 * GET /api/docs-ai/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasSystemPrompt: systemPrompt.length > 0,
    hasDocsContext: docsContext.length > 0
  });
});

module.exports = router;
