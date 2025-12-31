/**
 * Personality Clone Engine
 * Handles bot personality cloning, trait analysis, and response generation
 */

const log = require('../../utils/logger');
const crypto = require('crypto');

class PersonalityEngine {
  constructor(config = {}) {
    this.config = config;
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    this.anthropicApiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

    // Default personality traits
    this.traitDefaults = {
      friendliness: 5,
      formality: 5,
      enthusiasm: 5,
      directness: 5,
      empathy: 5,
      humor: 3,
      patience: 5,
      creativity: 5,
      assertiveness: 5,
      warmth: 5
    };
  }

  /**
   * Initialize personality cloning job
   */
  async initializeClone(jobId, config = {}) {
    try {
      log.info('Initializing personality clone', { jobId, config });

      return {
        success: true,
        jobId,
        status: 'initialized',
        availableTraits: Object.keys(this.traitDefaults),
        traitScale: { min: 1, max: 10, default: 5 }
      };
    } catch (error) {
      log.error('Personality clone initialization error', { error: error.message, jobId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze conversation samples for personality traits
   */
  async analyzeConversations(samples) {
    try {
      log.info('Analyzing conversations for personality', { sampleCount: samples.length });

      if (!samples || samples.length === 0) {
        return { success: false, error: 'No samples provided' };
      }

      const analyses = [];

      for (const sample of samples) {
        const content = sample.content || sample.original_content;
        if (!content) continue;

        const analysis = await this.analyzePersonalityInText(content);
        analyses.push(analysis);
      }

      if (analyses.length === 0) {
        return { success: false, error: 'No valid samples to analyze' };
      }

      // Aggregate analyses
      const aggregated = this.aggregatePersonalityAnalyses(analyses);

      return {
        success: true,
        traits: aggregated.traits,
        patterns: aggregated.patterns,
        confidence: aggregated.confidence,
        samplesAnalyzed: analyses.length
      };
    } catch (error) {
      log.error('Conversation analysis error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze personality traits in text
   */
  async analyzePersonalityInText(text) {
    const lowerText = text.toLowerCase();

    // Analyze each trait
    const traits = {};

    // Friendliness analysis
    traits.friendliness = this.analyzeFriendliness(lowerText);

    // Formality analysis
    traits.formality = this.analyzeFormality(lowerText);

    // Enthusiasm analysis
    traits.enthusiasm = this.analyzeEnthusiasm(lowerText);

    // Directness analysis
    traits.directness = this.analyzeDirectness(lowerText);

    // Empathy analysis
    traits.empathy = this.analyzeEmpathy(lowerText);

    // Humor analysis
    traits.humor = this.analyzeHumor(lowerText);

    // Patience analysis
    traits.patience = this.analyzePatience(lowerText);

    // Creativity analysis
    traits.creativity = this.analyzeCreativity(lowerText);

    // Extract response patterns
    const patterns = this.extractResponsePatterns(text);

    return {
      traits,
      patterns,
      textLength: text.length
    };
  }

  /**
   * Analyze friendliness level
   */
  analyzeFriendliness(text) {
    const friendlyWords = ['happy', 'glad', 'wonderful', 'great', 'awesome', 'love', 'thank', 'please', 'welcome', 'enjoy', 'pleasure', 'delight', 'lovely'];
    const unfriendlyWords = ['unfortunately', 'sorry', 'cannot', 'refuse', 'impossible', 'wrong', 'bad', 'terrible'];

    const friendlyCount = friendlyWords.filter(w => text.includes(w)).length;
    const unfriendlyCount = unfriendlyWords.filter(w => text.includes(w)).length;

    const score = 5 + (friendlyCount * 0.5) - (unfriendlyCount * 0.3);
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Analyze formality level
   */
  analyzeFormality(text) {
    const formalIndicators = ['regards', 'sincerely', 'respectfully', 'therefore', 'furthermore', 'however', 'consequently'];
    const informalIndicators = ['hey', 'hi', 'yeah', 'gonna', 'wanna', 'kinda', 'lol', 'btw', 'omg'];
    const contractions = (text.match(/\b\w+'\w+\b/g) || []).length;

    const formalCount = formalIndicators.filter(w => text.includes(w)).length;
    const informalCount = informalIndicators.filter(w => text.includes(w)).length;

    const score = 5 + (formalCount * 1.5) - (informalCount * 1) - (contractions * 0.1);
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Analyze enthusiasm level
   */
  analyzeEnthusiasm(text) {
    const exclamations = (text.match(/!/g) || []).length;
    const enthusiasticWords = ['excited', 'amazing', 'fantastic', 'incredible', 'awesome', 'wonderful', 'love', 'thrilled', 'absolutely'];
    const capsWords = (text.match(/\b[A-Z]{2,}\b/g) || []).length;

    const wordCount = enthusiasticWords.filter(w => text.includes(w)).length;
    const score = 5 + (exclamations * 0.3) + (wordCount * 0.5) + (capsWords * 0.2);
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Analyze directness level
   */
  analyzeDirectness(text) {
    const directIndicators = ['must', 'should', 'need to', 'have to', 'immediately', 'directly', 'simply', 'just'];
    const indirectIndicators = ['perhaps', 'maybe', 'possibly', 'might', 'could', 'would you mind', 'if you don\'t mind'];

    const directCount = directIndicators.filter(w => text.includes(w)).length;
    const indirectCount = indirectIndicators.filter(w => text.includes(w)).length;

    const score = 5 + (directCount * 0.8) - (indirectCount * 0.6);
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Analyze empathy level
   */
  analyzeEmpathy(text) {
    const empathyIndicators = ['understand', 'feel', 'sorry to hear', 'that must be', 'i can imagine', 'appreciate', 'concerned', 'care about', 'here for you'];
    const count = empathyIndicators.filter(w => text.includes(w)).length;

    const score = 5 + (count * 1.2);
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Analyze humor level
   */
  analyzeHumor(text) {
    const humorIndicators = ['haha', 'lol', 'funny', 'joke', 'kidding', 'laugh', 'hilarious', 'amusing', ':)', '😄', '😂'];
    const count = humorIndicators.filter(w => text.includes(w)).length;

    const score = 3 + (count * 1.5);
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Analyze patience level
   */
  analyzePatience(text) {
    const patientIndicators = ['take your time', 'no rush', 'whenever you\'re ready', 'let me explain', 'step by step', 'no worries', 'that\'s okay'];
    const impatientIndicators = ['hurry', 'quickly', 'asap', 'immediately', 'right now', 'urgent'];

    const patientCount = patientIndicators.filter(w => text.includes(w)).length;
    const impatientCount = impatientIndicators.filter(w => text.includes(w)).length;

    const score = 5 + (patientCount * 1.2) - (impatientCount * 0.8);
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Analyze creativity level
   */
  analyzeCreativity(text) {
    const creativeIndicators = ['imagine', 'creative', 'unique', 'innovative', 'interesting', 'different', 'original', 'idea'];
    const repetitivePatterns = this.countRepetitivePatterns(text);

    const creativeCount = creativeIndicators.filter(w => text.includes(w)).length;
    const score = 5 + (creativeCount * 0.8) - (repetitivePatterns * 0.3);
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Count repetitive patterns in text
   */
  countRepetitivePatterns(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const starts = sentences.map(s => s.trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase());

    const counts = {};
    starts.forEach(s => {
      counts[s] = (counts[s] || 0) + 1;
    });

    return Object.values(counts).filter(c => c > 1).length;
  }

  /**
   * Extract response patterns from text
   */
  extractResponsePatterns(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    return {
      greetings: this.extractGreetings(sentences),
      farewells: this.extractFarewells(sentences),
      acknowledgments: this.extractAcknowledgments(text),
      fillerWords: this.extractFillerWords(text),
      emphasisPatterns: this.extractEmphasisPatterns(text)
    };
  }

  /**
   * Extract greeting patterns
   */
  extractGreetings(sentences) {
    const greetingPatterns = [/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)/i];
    const greetings = [];

    for (const sentence of sentences.slice(0, 10)) {
      for (const pattern of greetingPatterns) {
        if (pattern.test(sentence.trim())) {
          greetings.push(sentence.trim());
          break;
        }
      }
    }

    return [...new Set(greetings)].slice(0, 5);
  }

  /**
   * Extract farewell patterns
   */
  extractFarewells(sentences) {
    const farewellPatterns = [/\b(bye|goodbye|farewell|take care|see you|cheers|regards|sincerely|best)\b/i];
    const farewells = [];

    for (const sentence of sentences.slice(-10)) {
      for (const pattern of farewellPatterns) {
        if (pattern.test(sentence.trim())) {
          farewells.push(sentence.trim());
          break;
        }
      }
    }

    return [...new Set(farewells)].slice(0, 5);
  }

  /**
   * Extract acknowledgment patterns
   */
  extractAcknowledgments(text) {
    const patterns = [
      'I understand',
      'I see',
      'Got it',
      'Understood',
      'Of course',
      'Certainly',
      'Absolutely',
      'Sure thing',
      'No problem',
      'Right'
    ];

    const found = patterns.filter(p => text.toLowerCase().includes(p.toLowerCase()));
    return found;
  }

  /**
   * Extract filler words
   */
  extractFillerWords(text) {
    const fillers = ['well', 'so', 'actually', 'basically', 'honestly', 'literally', 'like', 'you know'];
    const lowerText = text.toLowerCase();
    return fillers.filter(f => lowerText.includes(f));
  }

  /**
   * Extract emphasis patterns
   */
  extractEmphasisPatterns(text) {
    const patterns = {
      usesCapitalization: /\b[A-Z]{2,}\b/.test(text),
      usesExclamations: /!/.test(text),
      usesEmphasisWords: /\b(very|really|extremely|absolutely|definitely|totally)\b/i.test(text),
      usesBoldText: /\*\*[^*]+\*\*/.test(text)
    };
    return patterns;
  }

  /**
   * Aggregate personality analyses from multiple samples
   */
  aggregatePersonalityAnalyses(analyses) {
    const traits = {};

    // Average each trait
    for (const trait of Object.keys(this.traitDefaults)) {
      const values = analyses.map(a => a.traits[trait]).filter(v => typeof v === 'number');
      if (values.length > 0) {
        traits[trait] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      } else {
        traits[trait] = this.traitDefaults[trait];
      }
    }

    // Aggregate patterns
    const allPatterns = analyses.map(a => a.patterns);
    const patterns = this.aggregatePatterns(allPatterns);

    // Calculate confidence based on sample count and consistency
    const confidence = this.calculateConfidence(analyses);

    return {
      traits,
      patterns,
      confidence
    };
  }

  /**
   * Aggregate patterns from multiple analyses
   */
  aggregatePatterns(patterns) {
    const allGreetings = patterns.flatMap(p => p.greetings || []);
    const allFarewells = patterns.flatMap(p => p.farewells || []);
    const allAcknowledgments = patterns.flatMap(p => p.acknowledgments || []);
    const allFillers = patterns.flatMap(p => p.fillerWords || []);

    return {
      greetings: [...new Set(allGreetings)].slice(0, 5),
      farewells: [...new Set(allFarewells)].slice(0, 5),
      acknowledgments: this.getMostFrequent(allAcknowledgments, 5),
      fillerWords: this.getMostFrequent(allFillers, 5),
      emphasisPatterns: this.aggregateEmphasisPatterns(patterns.map(p => p.emphasisPatterns))
    };
  }

  /**
   * Get most frequent items in array
   */
  getMostFrequent(arr, limit) {
    const counts = {};
    arr.forEach(v => {
      counts[v] = (counts[v] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([v]) => v);
  }

  /**
   * Aggregate emphasis patterns
   */
  aggregateEmphasisPatterns(patterns) {
    if (patterns.length === 0) return {};

    const result = {};
    const keys = ['usesCapitalization', 'usesExclamations', 'usesEmphasisWords', 'usesBoldText'];

    for (const key of keys) {
      const trueCount = patterns.filter(p => p && p[key]).length;
      result[key] = trueCount > patterns.length / 2;
    }

    return result;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(analyses) {
    if (analyses.length < 3) return 50;
    if (analyses.length < 5) return 65;
    if (analyses.length < 10) return 80;
    return 90;
  }

  /**
   * Create personality profile
   */
  createPersonalityProfile(config) {
    const profile = {
      id: crypto.randomBytes(8).toString('hex'),
      name: config.name || 'Custom Personality',
      description: config.description || '',
      traits: {},
      toneSettings: {},
      responsePatterns: {},
      systemPrompt: '',
      createdAt: new Date().toISOString()
    };

    // Set traits with defaults
    for (const [trait, defaultValue] of Object.entries(this.traitDefaults)) {
      profile.traits[trait] = config.traits?.[trait] ?? defaultValue;
    }

    // Set tone settings
    profile.toneSettings = {
      primaryTone: config.primaryTone || 'professional',
      secondaryTone: config.secondaryTone || 'friendly',
      avoidTones: config.avoidTones || []
    };

    // Set response patterns
    profile.responsePatterns = {
      greetings: config.greetings || ['Hello!', 'Hi there!'],
      farewells: config.farewells || ['Goodbye!', 'Take care!'],
      acknowledgments: config.acknowledgments || ['I understand', 'Got it'],
      errorResponses: config.errorResponses || ['I apologize, but I couldn\'t process that.'],
      fallbackResponses: config.fallbackResponses || ['Could you please clarify?']
    };

    // Generate system prompt
    profile.systemPrompt = this.generateSystemPrompt(profile);

    return profile;
  }

  /**
   * Generate system prompt from personality profile
   */
  generateSystemPrompt(profile) {
    let prompt = 'You are an AI assistant with the following personality:\n\n';

    // Add trait descriptions
    prompt += '## Personality Traits\n';
    for (const [trait, value] of Object.entries(profile.traits)) {
      const level = this.getTraitLevel(value);
      prompt += `- ${this.capitalizeFirst(trait)}: ${level}\n`;
    }

    // Add tone settings
    prompt += `\n## Communication Style\n`;
    prompt += `- Primary tone: ${profile.toneSettings.primaryTone}\n`;
    if (profile.toneSettings.secondaryTone) {
      prompt += `- Secondary tone: ${profile.toneSettings.secondaryTone}\n`;
    }
    if (profile.toneSettings.avoidTones?.length > 0) {
      prompt += `- Avoid: ${profile.toneSettings.avoidTones.join(', ')}\n`;
    }

    // Add response patterns
    prompt += `\n## Response Patterns\n`;
    if (profile.responsePatterns.greetings?.length > 0) {
      prompt += `- Greetings: ${profile.responsePatterns.greetings.join(', ')}\n`;
    }
    if (profile.responsePatterns.acknowledgments?.length > 0) {
      prompt += `- Acknowledgments: ${profile.responsePatterns.acknowledgments.join(', ')}\n`;
    }

    // Add specific instructions based on traits
    prompt += '\n## Behavioral Guidelines\n';
    if (profile.traits.friendliness >= 7) {
      prompt += '- Be warm and welcoming in all interactions\n';
    }
    if (profile.traits.humor >= 6) {
      prompt += '- Include light humor when appropriate\n';
    }
    if (profile.traits.empathy >= 7) {
      prompt += '- Show understanding and acknowledge emotions\n';
    }
    if (profile.traits.directness >= 7) {
      prompt += '- Be clear and straightforward in responses\n';
    }
    if (profile.traits.formality <= 3) {
      prompt += '- Use casual, conversational language\n';
    } else if (profile.traits.formality >= 7) {
      prompt += '- Maintain professional language throughout\n';
    }

    return prompt;
  }

  /**
   * Get trait level description
   */
  getTraitLevel(value) {
    if (value <= 2) return 'Very Low';
    if (value <= 4) return 'Low';
    if (value <= 6) return 'Moderate';
    if (value <= 8) return 'High';
    return 'Very High';
  }

  /**
   * Capitalize first letter
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Apply personality to bot
   */
  async applyToBot(botId, personalityProfile, db) {
    try {
      log.info('Applying personality to bot', { botId, profileId: personalityProfile.id });

      // Update bot with personality settings
      await db.query(
        `UPDATE bots SET
          system_prompt = COALESCE($1, system_prompt),
          personality_config = $2,
          updated_at = NOW()
        WHERE id = $3`,
        [
          personalityProfile.systemPrompt,
          JSON.stringify({
            traits: personalityProfile.traits,
            toneSettings: personalityProfile.toneSettings,
            responsePatterns: personalityProfile.responsePatterns
          }),
          botId
        ]
      );

      return {
        success: true,
        botId,
        profileId: personalityProfile.id,
        appliedAt: new Date().toISOString()
      };
    } catch (error) {
      log.error('Apply personality error', { error: error.message, botId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate response using personality
   */
  async generateResponse(profile, userMessage, context = {}) {
    try {
      log.info('Generating personality response', { profileId: profile.id });

      const systemPrompt = profile.systemPrompt || this.generateSystemPrompt(profile);

      // Build conversation context
      let contextPrompt = '';
      if (context.conversationHistory?.length > 0) {
        contextPrompt = '\n\nPrevious conversation:\n';
        for (const msg of context.conversationHistory.slice(-5)) {
          contextPrompt += `${msg.role}: ${msg.content}\n`;
        }
      }

      const fullPrompt = `${systemPrompt}${contextPrompt}\n\nUser: ${userMessage}\n\nRespond as the AI assistant with the personality described above:`;

      // Use AI to generate response
      let result;
      if (this.openaiApiKey) {
        result = await this.generateWithOpenAI(fullPrompt, profile);
      } else if (this.anthropicApiKey) {
        result = await this.generateWithAnthropic(fullPrompt, profile);
      } else {
        return { success: false, error: 'No AI provider configured' };
      }

      if (!result.success) {
        return result;
      }

      // Score consistency with personality
      const consistencyScore = this.scoreConsistency(result.text, profile);

      return {
        success: true,
        response: result.text,
        tokens: result.tokens,
        consistencyScore
      };
    } catch (error) {
      log.error('Personality response error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate with OpenAI
   */
  async generateWithOpenAI(prompt, profile) {
    try {
      const fetch = require('node-fetch');

      const temperature = this.calculateTemperature(profile);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: profile.model || 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: profile.maxTokens || 1024
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      return {
        success: true,
        text: result.choices?.[0]?.message?.content || '',
        tokens: result.usage
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate with Anthropic
   */
  async generateWithAnthropic(prompt, profile) {
    try {
      const fetch = require('node-fetch');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: profile.model || 'claude-3-sonnet-20240229',
          max_tokens: profile.maxTokens || 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      return {
        success: true,
        text: result.content?.[0]?.text || '',
        tokens: result.usage
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate temperature based on personality
   */
  calculateTemperature(profile) {
    let temp = 0.7;

    // More creative personality = higher temperature
    if (profile.traits?.creativity >= 7) temp += 0.1;
    if (profile.traits?.creativity <= 3) temp -= 0.1;

    // More humor = slightly higher temperature
    if (profile.traits?.humor >= 7) temp += 0.05;

    // More formal = lower temperature
    if (profile.traits?.formality >= 7) temp -= 0.1;

    return Math.max(0.3, Math.min(1.0, temp));
  }

  /**
   * Score response consistency with personality
   */
  scoreConsistency(response, profile) {
    let score = 70;
    const lowerResponse = response.toLowerCase();

    // Check formality match
    const isResponseFormal = /\b(therefore|furthermore|however|regards)\b/.test(lowerResponse);
    const isResponseInformal = /\b(hey|yeah|gonna|wanna)\b/.test(lowerResponse);

    if (profile.traits.formality >= 7 && isResponseFormal) score += 10;
    if (profile.traits.formality <= 3 && isResponseInformal) score += 10;
    if (profile.traits.formality >= 7 && isResponseInformal) score -= 15;
    if (profile.traits.formality <= 3 && isResponseFormal) score -= 10;

    // Check enthusiasm match
    const hasExclamations = (response.match(/!/g) || []).length;
    if (profile.traits.enthusiasm >= 7 && hasExclamations > 0) score += 5;
    if (profile.traits.enthusiasm <= 3 && hasExclamations > 2) score -= 10;

    // Check empathy presence
    const hasEmpathy = /\b(understand|feel|sorry|appreciate)\b/.test(lowerResponse);
    if (profile.traits.empathy >= 7 && hasEmpathy) score += 10;
    if (profile.traits.empathy >= 7 && !hasEmpathy) score -= 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Compare two personalities
   */
  comparePersonalities(profile1, profile2) {
    const differences = {};
    let totalDiff = 0;

    for (const trait of Object.keys(this.traitDefaults)) {
      const val1 = profile1.traits?.[trait] || 5;
      const val2 = profile2.traits?.[trait] || 5;
      const diff = Math.abs(val1 - val2);
      differences[trait] = {
        profile1: val1,
        profile2: val2,
        difference: diff
      };
      totalDiff += diff;
    }

    const traitCount = Object.keys(this.traitDefaults).length;
    const similarity = Math.round((1 - totalDiff / (traitCount * 9)) * 100);

    return {
      differences,
      similarity,
      mostDifferent: Object.entries(differences)
        .sort((a, b) => b[1].difference - a[1].difference)
        .slice(0, 3)
        .map(([trait, data]) => ({ trait, ...data }))
    };
  }
}

module.exports = PersonalityEngine;
