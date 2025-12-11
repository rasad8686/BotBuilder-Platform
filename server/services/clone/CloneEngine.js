/**
 * Clone Engine Service
 * Main engine for generating responses using work clones
 */

const log = require('../../utils/logger');

class CloneEngine {
  constructor(config = {}) {
    this.config = config;
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    this.anthropicApiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Generate response using clone's style
   */
  async generateResponse(clone, prompt, options = {}) {
    try {
      const startTime = Date.now();

      // Build system prompt from clone settings
      const systemPrompt = this.buildSystemPrompt(clone);

      // Select AI provider
      const provider = this.selectProvider(clone.ai_model);

      // Generate response
      let response;
      if (provider === 'openai') {
        response = await this.generateWithOpenAI(systemPrompt, prompt, clone, options);
      } else if (provider === 'anthropic') {
        response = await this.generateWithAnthropic(systemPrompt, prompt, clone, options);
      } else {
        return { success: false, error: 'Unsupported AI model' };
      }

      if (!response.success) {
        return response;
      }

      const latency = Date.now() - startTime;

      return {
        success: true,
        response: response.text,
        inputTokens: response.inputTokens || 0,
        outputTokens: response.outputTokens || 0,
        latencyMs: latency,
        model: clone.ai_model
      };
    } catch (error) {
      log.error('Clone response generation error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Build system prompt from clone settings
   */
  buildSystemPrompt(clone) {
    let prompt = clone.base_system_prompt || 'You are a helpful writing assistant.';

    if (clone.personality_prompt) {
      prompt += `\n\n## Personality\n${clone.personality_prompt}`;
    }

    if (clone.writing_style_prompt) {
      prompt += `\n\n## Writing Style\n${clone.writing_style_prompt}`;
    }

    if (clone.style_profile && Object.keys(clone.style_profile).length > 0) {
      prompt += `\n\n## Style Profile\n`;
      const sp = clone.style_profile;

      if (sp.formality?.level) {
        prompt += `- Formality: ${sp.formality.level}\n`;
      }
      if (sp.tone?.dominant) {
        prompt += `- Tone: ${sp.tone.dominant}\n`;
      }
      if (sp.avgWordsPerSentence) {
        prompt += `- Target sentence length: ~${sp.avgWordsPerSentence} words\n`;
      }
    }

    if (clone.tone_settings && Object.keys(clone.tone_settings).length > 0) {
      prompt += `\n\n## Tone Settings\n`;
      const ts = clone.tone_settings;
      if (ts.friendliness) prompt += `- Friendliness: ${ts.friendliness}/10\n`;
      if (ts.formality) prompt += `- Formality: ${ts.formality}/10\n`;
      if (ts.enthusiasm) prompt += `- Enthusiasm: ${ts.enthusiasm}/10\n`;
      if (ts.directness) prompt += `- Directness: ${ts.directness}/10\n`;
    }

    if (clone.response_patterns && clone.response_patterns.greetings?.length > 0) {
      prompt += `\n\n## Common Phrases to Use\n`;
      if (clone.response_patterns.greetings) {
        prompt += `Greetings: ${clone.response_patterns.greetings.join(', ')}\n`;
      }
      if (clone.response_patterns.closings) {
        prompt += `Closings: ${clone.response_patterns.closings.join(', ')}\n`;
      }
    }

    return prompt;
  }

  /**
   * Select AI provider based on model name
   */
  selectProvider(model) {
    if (!model) return 'openai';

    const lowerModel = model.toLowerCase();
    if (lowerModel.includes('claude')) {
      return 'anthropic';
    }
    return 'openai';
  }

  /**
   * Generate response using OpenAI
   */
  async generateWithOpenAI(systemPrompt, userPrompt, clone, options = {}) {
    if (!this.openaiApiKey) {
      return { success: false, error: 'OpenAI API key not configured' };
    }

    try {
      const fetch = require('node-fetch');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: clone.ai_model || 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: clone.temperature || 0.7,
          max_tokens: options.maxTokens || clone.max_tokens || 2048
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();
      const choice = result.choices?.[0];

      return {
        success: true,
        text: choice?.message?.content || '',
        inputTokens: result.usage?.prompt_tokens || 0,
        outputTokens: result.usage?.completion_tokens || 0
      };
    } catch (error) {
      log.error('OpenAI generation error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate response using Anthropic
   */
  async generateWithAnthropic(systemPrompt, userPrompt, clone, options = {}) {
    if (!this.anthropicApiKey) {
      return { success: false, error: 'Anthropic API key not configured' };
    }

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
          model: clone.ai_model || 'claude-3-sonnet-20240229',
          max_tokens: options.maxTokens || clone.max_tokens || 2048,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();

      return {
        success: true,
        text: result.content?.[0]?.text || '',
        inputTokens: result.usage?.input_tokens || 0,
        outputTokens: result.usage?.output_tokens || 0
      };
    } catch (error) {
      log.error('Anthropic generation error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate email response
   */
  async generateEmail(clone, context) {
    const prompt = this.buildEmailPrompt(context);
    return this.generateResponse(clone, prompt, { type: 'email' });
  }

  /**
   * Build email generation prompt
   */
  buildEmailPrompt(context) {
    let prompt = '';

    if (context.replyTo) {
      prompt += `Write a reply to this email:\n\n---\n${context.replyTo}\n---\n\n`;
    } else {
      prompt += 'Write an email ';
    }

    if (context.recipient) {
      prompt += `to ${context.recipient} `;
    }

    if (context.subject) {
      prompt += `about "${context.subject}" `;
    }

    if (context.keyPoints?.length > 0) {
      prompt += `\n\nKey points to include:\n`;
      context.keyPoints.forEach((point, i) => {
        prompt += `${i + 1}. ${point}\n`;
      });
    }

    if (context.tone) {
      prompt += `\n\nTone: ${context.tone}`;
    }

    if (context.additionalInstructions) {
      prompt += `\n\nAdditional instructions: ${context.additionalInstructions}`;
    }

    return prompt;
  }

  /**
   * Generate message response
   */
  async generateMessage(clone, context) {
    const prompt = this.buildMessagePrompt(context);
    return this.generateResponse(clone, prompt, { type: 'message' });
  }

  /**
   * Build message generation prompt
   */
  buildMessagePrompt(context) {
    let prompt = '';

    if (context.replyTo) {
      prompt += `Reply to this message: "${context.replyTo}"\n\n`;
    }

    if (context.topic) {
      prompt += `Topic: ${context.topic}\n`;
    }

    if (context.intent) {
      prompt += `Intent: ${context.intent}\n`;
    }

    if (context.maxLength) {
      prompt += `Keep the response under ${context.maxLength} characters.\n`;
    }

    return prompt;
  }

  /**
   * Generate document section
   */
  async generateDocument(clone, context) {
    const prompt = this.buildDocumentPrompt(context);
    return this.generateResponse(clone, prompt, { type: 'document', maxTokens: 4096 });
  }

  /**
   * Build document generation prompt
   */
  buildDocumentPrompt(context) {
    let prompt = `Write a ${context.documentType || 'document'} `;

    if (context.title) {
      prompt += `titled "${context.title}" `;
    }

    if (context.outline?.length > 0) {
      prompt += `\n\nFollow this outline:\n`;
      context.outline.forEach((section, i) => {
        prompt += `${i + 1}. ${section}\n`;
      });
    }

    if (context.targetAudience) {
      prompt += `\n\nTarget audience: ${context.targetAudience}`;
    }

    if (context.length) {
      prompt += `\n\nTarget length: ${context.length}`;
    }

    return prompt;
  }

  /**
   * Refine/edit existing text
   */
  async refineText(clone, originalText, instructions) {
    const prompt = `Edit and improve this text according to the following instructions:\n\n` +
      `Original text:\n---\n${originalText}\n---\n\n` +
      `Instructions: ${instructions}\n\n` +
      `Provide the revised text only, maintaining the original meaning while applying the changes.`;

    return this.generateResponse(clone, prompt, { type: 'edit' });
  }

  /**
   * Calculate similarity between generated text and clone's style
   */
  async calculateSimilarity(clone, generatedText) {
    // Simple similarity calculation based on style profile
    const StyleAnalyzer = require('./StyleAnalyzer');
    const analyzer = new StyleAnalyzer();

    const analysis = await analyzer.analyzeStyle(generatedText);
    if (!analysis.success || !clone.style_profile) {
      return 0.5; // Default similarity
    }

    let similarity = 0;
    let factors = 0;

    // Compare formality
    if (clone.style_profile.formality?.level && analysis.analysis.formality?.level) {
      similarity += clone.style_profile.formality.level === analysis.analysis.formality.level ? 1 : 0.5;
      factors++;
    }

    // Compare tone
    if (clone.style_profile.tone?.dominant && analysis.analysis.tone?.dominant) {
      similarity += clone.style_profile.tone.dominant === analysis.analysis.tone.dominant ? 1 : 0.5;
      factors++;
    }

    // Compare sentence length
    if (clone.style_profile.avgWordsPerSentence && analysis.analysis.avgWordsPerSentence) {
      const diff = Math.abs(clone.style_profile.avgWordsPerSentence - analysis.analysis.avgWordsPerSentence);
      similarity += Math.max(0, 1 - diff / 10);
      factors++;
    }

    return factors > 0 ? Math.round(similarity / factors * 100) / 100 : 0.5;
  }
}

module.exports = CloneEngine;
