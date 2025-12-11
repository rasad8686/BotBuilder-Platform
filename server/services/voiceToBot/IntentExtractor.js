/**
 * Intent Extractor Service
 * Extracts intents, entities, and bot structure from natural language
 */

const log = require('../../utils/logger');

class IntentExtractor {
  constructor(config = {}) {
    this.config = config;
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
  }

  /**
   * Extract bot structure from transcription using AI
   */
  async extractFromText(text, options = {}) {
    try {
      const startTime = Date.now();

      // Demo mode: return mock extraction if no API key or text too short
      if (!this.openaiApiKey || !text || text.trim().length < 10) {
        return this.getMockExtraction(options.language, startTime);
      }

      const fetch = require('node-fetch');

      const systemPrompt = this.buildExtractionPrompt(options.language);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Extract bot structure from this description:\n\n"${text}"` }
          ],
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No response from AI');
      }

      const extracted = JSON.parse(content);
      const processingTime = Date.now() - startTime;

      // Validate and enhance extracted data
      const validated = this.validateExtraction(extracted);

      return {
        success: true,
        ...validated,
        processingTimeMs: processingTime,
        tokensUsed: result.usage?.total_tokens || 0
      };
    } catch (error) {
      log.error('Intent extraction error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Build system prompt for extraction
   */
  buildExtractionPrompt(language = 'en') {
    return `You are a bot structure analyzer. Extract the following from user descriptions:

1. Bot name (suggested name based on purpose)
2. Bot description (clear, concise description)
3. Intents (user intentions the bot should handle)
4. Entities (data types to extract from user messages)
5. Responses (example responses for each intent)
6. Flows (conversation flows and logic)

Output JSON format:
{
  "name": "string - suggested bot name",
  "description": "string - bot description",
  "category": "string - one of: support, sales, faq, booking, custom",
  "intents": [
    {
      "name": "string - intent identifier (snake_case)",
      "displayName": "string - human readable name",
      "description": "string - what this intent handles",
      "examples": ["array of example user messages"],
      "responses": ["array of example bot responses"]
    }
  ],
  "entities": [
    {
      "name": "string - entity identifier",
      "type": "string - one of: text, number, date, email, phone, custom",
      "description": "string - what this entity captures",
      "examples": ["array of example values"]
    }
  ],
  "flows": [
    {
      "name": "string - flow name",
      "trigger": "string - what triggers this flow",
      "steps": ["array of step descriptions"]
    }
  ],
  "suggestedFeatures": ["array of recommended features"],
  "language": "${language}"
}

Rules:
- Always include greeting and fallback intents
- Create at least 3-5 intents based on the description
- Each intent should have 3-5 example phrases
- Entity names should be descriptive
- Flows should represent key user journeys
- Be creative but practical`;
  }

  /**
   * Validate and enhance extracted data
   */
  validateExtraction(extracted) {
    const result = {
      name: extracted.name || 'My Bot',
      description: extracted.description || '',
      category: extracted.category || 'custom',
      intents: [],
      entities: [],
      flows: [],
      suggestedFeatures: extracted.suggestedFeatures || []
    };

    // Ensure greeting intent exists
    const hasGreeting = extracted.intents?.some(i =>
      i.name?.toLowerCase().includes('greeting') ||
      i.name?.toLowerCase().includes('hello')
    );

    if (!hasGreeting) {
      result.intents.push({
        name: 'greeting',
        displayName: 'Greeting',
        description: 'User greets the bot',
        examples: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
        responses: ['Hello! How can I help you today?', 'Hi there! What can I do for you?']
      });
    }

    // Ensure fallback intent exists
    const hasFallback = extracted.intents?.some(i =>
      i.name?.toLowerCase().includes('fallback') ||
      i.name?.toLowerCase().includes('unknown')
    );

    if (!hasFallback) {
      result.intents.push({
        name: 'fallback',
        displayName: 'Fallback',
        description: 'Bot does not understand the user',
        examples: [],
        responses: ["I'm not sure I understand. Could you please rephrase that?", "Sorry, I didn't get that. Can you try again?"]
      });
    }

    // Process and validate intents
    if (extracted.intents && Array.isArray(extracted.intents)) {
      extracted.intents.forEach(intent => {
        if (intent.name) {
          result.intents.push({
            name: this.normalizeIdentifier(intent.name),
            displayName: intent.displayName || this.toDisplayName(intent.name),
            description: intent.description || '',
            examples: Array.isArray(intent.examples) ? intent.examples : [],
            responses: Array.isArray(intent.responses) ? intent.responses : []
          });
        }
      });
    }

    // Process and validate entities
    if (extracted.entities && Array.isArray(extracted.entities)) {
      extracted.entities.forEach(entity => {
        if (entity.name) {
          result.entities.push({
            name: this.normalizeIdentifier(entity.name),
            type: entity.type || 'text',
            description: entity.description || '',
            examples: Array.isArray(entity.examples) ? entity.examples : []
          });
        }
      });
    }

    // Process and validate flows
    if (extracted.flows && Array.isArray(extracted.flows)) {
      extracted.flows.forEach(flow => {
        if (flow.name) {
          result.flows.push({
            name: flow.name,
            trigger: flow.trigger || '',
            steps: Array.isArray(flow.steps) ? flow.steps : []
          });
        }
      });
    }

    return result;
  }

  /**
   * Normalize identifier to snake_case
   */
  normalizeIdentifier(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
  }

  /**
   * Convert identifier to display name
   */
  toDisplayName(str) {
    return str
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Extract intents from simple keywords
   */
  extractFromKeywords(keywords, options = {}) {
    const intents = [];
    const intentPatterns = {
      help: ['help', 'support', 'assist', 'problem', 'issue'],
      purchase: ['buy', 'purchase', 'order', 'price', 'cost'],
      booking: ['book', 'schedule', 'appointment', 'reserve', 'reservation'],
      info: ['info', 'information', 'about', 'what', 'how'],
      cancel: ['cancel', 'refund', 'return', 'stop'],
      contact: ['contact', 'call', 'email', 'reach', 'phone'],
      status: ['status', 'track', 'where', 'check', 'progress']
    };

    const lowerKeywords = keywords.map(k => k.toLowerCase());

    Object.entries(intentPatterns).forEach(([intentName, patterns]) => {
      const matched = patterns.filter(p =>
        lowerKeywords.some(k => k.includes(p))
      );

      if (matched.length > 0) {
        intents.push({
          name: intentName,
          displayName: this.toDisplayName(intentName),
          confidence: matched.length / patterns.length,
          matchedKeywords: matched
        });
      }
    });

    return intents.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Suggest entities based on intents
   */
  suggestEntities(intents) {
    const entityMap = {
      purchase: [
        { name: 'product_name', type: 'text' },
        { name: 'quantity', type: 'number' },
        { name: 'price', type: 'number' }
      ],
      booking: [
        { name: 'date', type: 'date' },
        { name: 'time', type: 'text' },
        { name: 'service', type: 'text' }
      ],
      contact: [
        { name: 'email', type: 'email' },
        { name: 'phone', type: 'phone' },
        { name: 'name', type: 'text' }
      ],
      status: [
        { name: 'order_id', type: 'text' },
        { name: 'tracking_number', type: 'text' }
      ]
    };

    const entities = [];
    const addedNames = new Set();

    intents.forEach(intent => {
      const suggested = entityMap[intent.name] || [];
      suggested.forEach(entity => {
        if (!addedNames.has(entity.name)) {
          entities.push(entity);
          addedNames.add(entity.name);
        }
      });
    });

    return entities;
  }

  /**
   * Generate default flow based on intents
   */
  generateDefaultFlow(intents, entities) {
    const flows = [];

    // Main conversation flow
    flows.push({
      name: 'main_flow',
      trigger: 'conversation_start',
      steps: [
        'Greet user',
        'Ask how can help',
        'Route to appropriate handler based on intent',
        'Collect required information',
        'Process request',
        'Confirm and close'
      ]
    });

    // Intent-specific flows
    intents.forEach(intent => {
      if (!['greeting', 'fallback'].includes(intent.name)) {
        flows.push({
          name: `${intent.name}_flow`,
          trigger: `intent:${intent.name}`,
          steps: [
            `Acknowledge ${intent.displayName} request`,
            'Collect required entities',
            'Validate information',
            'Process request',
            'Provide response',
            'Ask if anything else needed'
          ]
        });
      }
    });

    return flows;
  }

  /**
   * Get mock extraction for demo mode
   */
  getMockExtraction(language, startTime) {
    const processingTime = Date.now() - startTime;

    log.info('Using mock extraction (demo mode)', { language });

    return {
      success: true,
      name: 'Customer Support Bot',
      description: 'A helpful customer support bot that answers FAQs, handles returns, and tracks orders.',
      category: 'support',
      intents: [
        {
          name: 'greeting',
          displayName: 'Greeting',
          description: 'User greets the bot',
          examples: ['hello', 'hi', 'hey', 'good morning'],
          responses: ['Hello! How can I help you today?', 'Hi there! What can I do for you?']
        },
        {
          name: 'faq',
          displayName: 'FAQ',
          description: 'User asks frequently asked questions',
          examples: ['what are your hours?', 'how do I contact support?', 'where are you located?'],
          responses: ['Our support is available 24/7. How can I help?']
        },
        {
          name: 'order_status',
          displayName: 'Order Status',
          description: 'User wants to track their order',
          examples: ['where is my order?', 'track my package', 'order status'],
          responses: ['Please provide your order number and I\'ll check the status for you.']
        },
        {
          name: 'returns',
          displayName: 'Returns & Refunds',
          description: 'User wants to return or get refund',
          examples: ['I want to return', 'how do I get a refund?', 'return policy'],
          responses: ['I can help with returns. What item would you like to return?']
        },
        {
          name: 'fallback',
          displayName: 'Fallback',
          description: 'Bot does not understand',
          examples: [],
          responses: ['I\'m not sure I understand. Could you please rephrase that?']
        }
      ],
      entities: [
        { name: 'order_id', type: 'text', description: 'Order number', examples: ['ORD-12345'] },
        { name: 'product_name', type: 'text', description: 'Product name', examples: ['Blue T-Shirt'] }
      ],
      flows: [
        {
          name: 'main_flow',
          trigger: 'conversation_start',
          steps: ['Greet user', 'Ask how can help', 'Route to handler', 'Process request']
        }
      ],
      suggestedFeatures: ['Live chat handoff', 'Order tracking integration', 'FAQ database'],
      language: language || 'en',
      processingTimeMs: processingTime,
      tokensUsed: 0,
      isDemo: true
    };
  }
}

module.exports = IntentExtractor;
