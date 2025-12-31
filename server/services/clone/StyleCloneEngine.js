/**
 * Style Clone Engine
 * Handles writing style analysis, pattern recognition, and style replication
 */

const log = require('../../utils/logger');
const crypto = require('crypto');

class StyleCloneEngine {
  constructor(config = {}) {
    this.config = config;
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    this.anthropicApiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    this.minSamplesRequired = 5;
    this.minWordsPerSample = 50;
    this.maxSamplesAllowed = 100;
  }

  /**
   * Initialize style cloning job
   */
  async initializeClone(jobId, config = {}) {
    try {
      log.info('Initializing style clone', { jobId, config });

      return {
        success: true,
        jobId,
        status: 'initialized',
        requirements: {
          minSamples: this.minSamplesRequired,
          maxSamples: this.maxSamplesAllowed,
          minWordsPerSample: this.minWordsPerSample,
          supportedTypes: ['text', 'email', 'chat_history', 'document']
        }
      };
    } catch (error) {
      log.error('Style clone initialization error', { error: error.message, jobId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Process text sample
   */
  async processTextSample(sampleId, content, options = {}) {
    try {
      log.info('Processing text sample', { sampleId, contentLength: content.length });

      if (!content || content.trim().length === 0) {
        return { success: false, error: 'Content is empty' };
      }

      const words = content.split(/\s+/).filter(w => w.length > 0);
      if (words.length < this.minWordsPerSample) {
        return {
          success: false,
          error: `Sample too short. Minimum ${this.minWordsPerSample} words required.`
        };
      }

      // Analyze text
      const analysis = await this.analyzeText(content);

      // Extract style markers
      const styleMarkers = this.extractStyleMarkers(content, analysis);

      // Calculate quality score
      const qualityScore = this.calculateQualityScore(content, analysis);

      return {
        success: true,
        sampleId,
        analysis,
        styleMarkers,
        qualityScore,
        wordCount: words.length,
        processed: true
      };
    } catch (error) {
      log.error('Text processing error', { error: error.message, sampleId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze text for style characteristics
   */
  async analyzeText(text) {
    const sentences = this.splitIntoSentences(text);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

    // Basic metrics
    const avgSentenceLength = words.length / Math.max(sentences.length, 1);
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1);
    const avgParagraphLength = sentences.length / Math.max(paragraphs.length, 1);

    // Formality analysis
    const formality = this.analyzeFormality(text, words);

    // Tone analysis
    const tone = this.analyzeTone(text);

    // Vocabulary analysis
    const vocabulary = this.analyzeVocabulary(words);

    // Punctuation analysis
    const punctuation = this.analyzePunctuation(text);

    // Emoji analysis
    const emoji = this.analyzeEmoji(text);

    // Sentence structure analysis
    const structure = this.analyzeSentenceStructure(sentences);

    return {
      metrics: {
        totalWords: words.length,
        totalSentences: sentences.length,
        totalParagraphs: paragraphs.length,
        avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
        avgWordLength: Math.round(avgWordLength * 10) / 10,
        avgParagraphLength: Math.round(avgParagraphLength * 10) / 10
      },
      formality,
      tone,
      vocabulary,
      punctuation,
      emoji,
      structure
    };
  }

  /**
   * Split text into sentences
   */
  splitIntoSentences(text) {
    return text
      .replace(/([.!?])\s*(?=[A-Z])/g, '$1|')
      .split('|')
      .filter(s => s.trim().length > 0);
  }

  /**
   * Analyze text formality level
   */
  analyzeFormality(text, words) {
    const lowerText = text.toLowerCase();
    const contractions = (text.match(/\b\w+'\w+\b/g) || []).length;
    const formalWords = ['therefore', 'however', 'furthermore', 'moreover', 'thus', 'hence', 'consequently', 'regarding', 'concerning'];
    const informalWords = ['gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'yeah', 'yep', 'nope', 'hey', 'cool', 'awesome'];

    const formalCount = formalWords.filter(w => lowerText.includes(w)).length;
    const informalCount = informalWords.filter(w => lowerText.includes(w)).length;
    const contractionRatio = contractions / Math.max(words.length, 1);

    let level = 'neutral';
    let score = 50;

    if (formalCount > informalCount && contractionRatio < 0.02) {
      level = 'formal';
      score = 75 + formalCount * 5;
    } else if (informalCount > formalCount || contractionRatio > 0.05) {
      level = 'informal';
      score = 25 - informalCount * 5;
    }

    return {
      level,
      score: Math.max(0, Math.min(100, score)),
      contractionRatio: Math.round(contractionRatio * 1000) / 1000,
      formalWordsFound: formalCount,
      informalWordsFound: informalCount
    };
  }

  /**
   * Analyze text tone
   */
  analyzeTone(text) {
    const lowerText = text.toLowerCase();

    const toneIndicators = {
      professional: ['please', 'thank you', 'regards', 'sincerely', 'appreciate', 'opportunity'],
      friendly: ['great', 'awesome', 'love', 'excited', 'happy', 'wonderful', 'fantastic'],
      neutral: ['the', 'is', 'are', 'was', 'were', 'have', 'has'],
      serious: ['important', 'critical', 'urgent', 'essential', 'necessary', 'required'],
      casual: ['hey', 'hi', 'yeah', 'cool', 'nice', 'okay', 'sure', 'yep']
    };

    const scores = {};
    for (const [tone, words] of Object.entries(toneIndicators)) {
      scores[tone] = words.filter(w => lowerText.includes(w)).length;
    }

    const dominant = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

    return {
      dominant: dominant[0],
      scores,
      confidence: dominant[1] > 0 ? Math.min(dominant[1] * 20, 100) : 50
    };
  }

  /**
   * Analyze vocabulary complexity
   */
  analyzeVocabulary(words) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const lexicalDiversity = uniqueWords.size / Math.max(words.length, 1);

    const longWords = words.filter(w => w.length > 8).length;
    const shortWords = words.filter(w => w.length <= 4).length;
    const avgLength = words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1);

    let complexity = 'medium';
    if (avgLength > 6 && longWords / words.length > 0.15) {
      complexity = 'complex';
    } else if (avgLength < 4.5 && shortWords / words.length > 0.6) {
      complexity = 'simple';
    }

    return {
      complexity,
      lexicalDiversity: Math.round(lexicalDiversity * 100) / 100,
      avgWordLength: Math.round(avgLength * 10) / 10,
      uniqueWordCount: uniqueWords.size,
      longWordRatio: Math.round((longWords / Math.max(words.length, 1)) * 100) / 100,
      shortWordRatio: Math.round((shortWords / Math.max(words.length, 1)) * 100) / 100
    };
  }

  /**
   * Analyze punctuation usage
   */
  analyzePunctuation(text) {
    const exclamations = (text.match(/!/g) || []).length;
    const questions = (text.match(/\?/g) || []).length;
    const ellipsis = (text.match(/\.{3}/g) || []).length;
    const dashes = (text.match(/[-–—]/g) || []).length;
    const commas = (text.match(/,/g) || []).length;
    const semicolons = (text.match(/;/g) || []).length;

    const sentences = this.splitIntoSentences(text).length;

    return {
      exclamationRate: Math.round((exclamations / Math.max(sentences, 1)) * 100) / 100,
      questionRate: Math.round((questions / Math.max(sentences, 1)) * 100) / 100,
      ellipsisCount: ellipsis,
      dashCount: dashes,
      commaRate: Math.round((commas / Math.max(sentences, 1)) * 100) / 100,
      semicolonCount: semicolons,
      style: exclamations > questions ? 'expressive' : questions > exclamations ? 'inquisitive' : 'balanced'
    };
  }

  /**
   * Analyze emoji usage
   */
  analyzeEmoji(text) {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojis = text.match(emojiRegex) || [];
    const words = text.split(/\s+/).length;

    return {
      count: emojis.length,
      types: [...new Set(emojis)],
      frequency: emojis.length > 0 ?
        (emojis.length / words > 0.05 ? 'frequent' : 'occasional') : 'never',
      ratio: Math.round((emojis.length / Math.max(words, 1)) * 1000) / 1000
    };
  }

  /**
   * Analyze sentence structure patterns
   */
  analyzeSentenceStructure(sentences) {
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const startsWithI = sentences.filter(s => /^I\s/i.test(s.trim())).length;
    const startsWithQuestion = sentences.filter(s => /^(what|why|how|when|where|who|which|is|are|do|does|can|could|would|will)/i.test(s.trim())).length;

    const variance = this.calculateVariance(lengths);

    return {
      sentenceLengths: {
        min: Math.min(...lengths),
        max: Math.max(...lengths),
        avg: Math.round(lengths.reduce((a, b) => a + b, 0) / Math.max(lengths.length, 1) * 10) / 10,
        variance: Math.round(variance * 10) / 10
      },
      firstPersonRatio: Math.round((startsWithI / Math.max(sentences.length, 1)) * 100) / 100,
      questionStartRatio: Math.round((startsWithQuestion / Math.max(sentences.length, 1)) * 100) / 100,
      consistency: variance < 50 ? 'consistent' : variance < 100 ? 'varied' : 'highly_varied'
    };
  }

  /**
   * Calculate variance of array
   */
  calculateVariance(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  }

  /**
   * Extract style markers for replication
   */
  extractStyleMarkers(text, analysis) {
    const markers = {
      openingPhrases: this.extractOpeningPhrases(text),
      closingPhrases: this.extractClosingPhrases(text),
      transitionPhrases: this.extractTransitionPhrases(text),
      commonPhrases: this.extractCommonPhrases(text),
      signaturePatterns: this.extractSignaturePatterns(text, analysis)
    };

    return markers;
  }

  /**
   * Extract common opening phrases
   */
  extractOpeningPhrases(text) {
    const sentences = this.splitIntoSentences(text);
    const openings = sentences.slice(0, Math.min(10, sentences.length))
      .map(s => {
        const words = s.trim().split(/\s+/);
        return words.slice(0, Math.min(3, words.length)).join(' ');
      })
      .filter((phrase, index, self) => self.indexOf(phrase) === index);

    return openings.slice(0, 5);
  }

  /**
   * Extract common closing phrases
   */
  extractClosingPhrases(text) {
    const sentences = this.splitIntoSentences(text);
    const closings = sentences.slice(-Math.min(10, sentences.length))
      .map(s => {
        const words = s.trim().split(/\s+/);
        return words.slice(-Math.min(3, words.length)).join(' ');
      })
      .filter((phrase, index, self) => self.indexOf(phrase) === index);

    return closings.slice(0, 5);
  }

  /**
   * Extract transition phrases
   */
  extractTransitionPhrases(text) {
    const transitionPatterns = [
      /however,?\s/gi,
      /therefore,?\s/gi,
      /furthermore,?\s/gi,
      /moreover,?\s/gi,
      /in addition,?\s/gi,
      /on the other hand,?\s/gi,
      /as a result,?\s/gi,
      /for example,?\s/gi,
      /in fact,?\s/gi,
      /basically,?\s/gi,
      /actually,?\s/gi,
      /anyway,?\s/gi
    ];

    const found = [];
    for (const pattern of transitionPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        found.push(matches[0].trim().toLowerCase());
      }
    }

    return [...new Set(found)];
  }

  /**
   * Extract commonly repeated phrases
   */
  extractCommonPhrases(text) {
    const words = text.toLowerCase().split(/\s+/);
    const phrases = {};

    // Extract 2-3 word phrases
    for (let len = 2; len <= 3; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (!/^\W+$/.test(phrase)) {
          phrases[phrase] = (phrases[phrase] || 0) + 1;
        }
      }
    }

    return Object.entries(phrases)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([phrase]) => phrase);
  }

  /**
   * Extract signature patterns
   */
  extractSignaturePatterns(text, analysis) {
    return {
      useContractions: analysis.formality.contractionRatio > 0.02,
      useEmoji: analysis.emoji.count > 0,
      useExclamations: analysis.punctuation.exclamationRate > 0.1,
      averageSentenceLength: analysis.metrics.avgSentenceLength,
      preferredTone: analysis.tone.dominant,
      formalityLevel: analysis.formality.level
    };
  }

  /**
   * Calculate sample quality score
   */
  calculateQualityScore(text, analysis) {
    let score = 70;

    // Bonus for length
    if (analysis.metrics.totalWords > 200) score += 10;
    if (analysis.metrics.totalWords > 500) score += 10;

    // Bonus for diversity
    if (analysis.vocabulary.lexicalDiversity > 0.5) score += 5;

    // Bonus for proper structure
    if (analysis.metrics.totalParagraphs > 1) score += 5;

    // Penalty for too short
    if (analysis.metrics.totalWords < 100) score -= 20;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Train style clone
   */
  async trainStyleClone(jobId, samples, config = {}) {
    try {
      log.info('Training style clone', { jobId, sampleCount: samples.length });

      if (samples.length < this.minSamplesRequired) {
        return {
          success: false,
          error: `At least ${this.minSamplesRequired} samples required.`
        };
      }

      // Aggregate analysis from all samples
      const aggregatedAnalysis = await this.aggregateStyleAnalysis(samples);

      // Generate style profile
      const styleProfile = this.generateStyleProfile(aggregatedAnalysis);

      // Generate style replication prompt
      const stylePrompt = this.generateStylePrompt(styleProfile);

      // Calculate training metrics
      const metrics = {
        samplesUsed: samples.length,
        totalWords: samples.reduce((sum, s) => sum + (s.wordCount || 0), 0),
        avgQuality: samples.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / samples.length,
        consistency: this.calculateStyleConsistency(samples),
        trainingTime: Date.now()
      };

      return {
        success: true,
        styleProfile,
        stylePrompt,
        aggregatedAnalysis,
        metrics
      };
    } catch (error) {
      log.error('Style clone training error', { error: error.message, jobId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Aggregate style analysis from multiple samples
   */
  async aggregateStyleAnalysis(samples) {
    const analyses = samples.map(s => s.analysis).filter(a => a);

    if (analyses.length === 0) {
      return null;
    }

    // Average metrics
    const avgMetrics = {
      avgSentenceLength: this.averageProperty(analyses, 'metrics.avgSentenceLength'),
      avgWordLength: this.averageProperty(analyses, 'metrics.avgWordLength'),
      avgParagraphLength: this.averageProperty(analyses, 'metrics.avgParagraphLength')
    };

    // Most common formality level
    const formalityLevels = analyses.map(a => a.formality?.level);
    const dominantFormality = this.getMostCommon(formalityLevels);

    // Most common tone
    const tones = analyses.map(a => a.tone?.dominant);
    const dominantTone = this.getMostCommon(tones);

    // Average vocabulary metrics
    const avgVocabulary = {
      complexity: this.getMostCommon(analyses.map(a => a.vocabulary?.complexity)),
      avgLexicalDiversity: this.averageProperty(analyses, 'vocabulary.lexicalDiversity')
    };

    // Aggregate style markers
    const allMarkers = samples.map(s => s.styleMarkers).filter(m => m);
    const aggregatedMarkers = this.aggregateStyleMarkers(allMarkers);

    return {
      metrics: avgMetrics,
      formality: { level: dominantFormality, avgScore: this.averageProperty(analyses, 'formality.score') },
      tone: { dominant: dominantTone },
      vocabulary: avgVocabulary,
      punctuation: {
        avgExclamationRate: this.averageProperty(analyses, 'punctuation.exclamationRate'),
        avgQuestionRate: this.averageProperty(analyses, 'punctuation.questionRate')
      },
      emoji: {
        frequency: this.getMostCommon(analyses.map(a => a.emoji?.frequency))
      },
      markers: aggregatedMarkers
    };
  }

  /**
   * Get average of nested property
   */
  averageProperty(arr, path) {
    const values = arr.map(obj => {
      const parts = path.split('.');
      let val = obj;
      for (const part of parts) {
        val = val?.[part];
      }
      return val;
    }).filter(v => typeof v === 'number');

    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100;
  }

  /**
   * Get most common value in array
   */
  getMostCommon(arr) {
    const counts = {};
    arr.forEach(v => {
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || 'neutral';
  }

  /**
   * Aggregate style markers from multiple samples
   */
  aggregateStyleMarkers(markers) {
    const allOpenings = markers.flatMap(m => m.openingPhrases || []);
    const allClosings = markers.flatMap(m => m.closingPhrases || []);
    const allTransitions = markers.flatMap(m => m.transitionPhrases || []);
    const allCommon = markers.flatMap(m => m.commonPhrases || []);

    return {
      openingPhrases: [...new Set(allOpenings)].slice(0, 10),
      closingPhrases: [...new Set(allClosings)].slice(0, 10),
      transitionPhrases: [...new Set(allTransitions)].slice(0, 10),
      commonPhrases: this.getMostFrequent(allCommon, 10)
    };
  }

  /**
   * Get most frequent items
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
   * Generate style profile from aggregated analysis
   */
  generateStyleProfile(analysis) {
    if (!analysis) {
      return { error: 'No analysis data' };
    }

    return {
      formality: {
        level: analysis.formality.level,
        score: analysis.formality.avgScore
      },
      tone: analysis.tone.dominant,
      vocabulary: {
        complexity: analysis.vocabulary.complexity,
        diversity: analysis.vocabulary.avgLexicalDiversity
      },
      structure: {
        avgSentenceLength: analysis.metrics.avgSentenceLength,
        avgWordLength: analysis.metrics.avgWordLength
      },
      punctuation: {
        exclamationRate: analysis.punctuation.avgExclamationRate,
        questionRate: analysis.punctuation.avgQuestionRate
      },
      emoji: analysis.emoji.frequency,
      signaturePhrases: {
        openings: analysis.markers?.openingPhrases || [],
        closings: analysis.markers?.closingPhrases || [],
        transitions: analysis.markers?.transitionPhrases || [],
        common: analysis.markers?.commonPhrases || []
      }
    };
  }

  /**
   * Generate style replication prompt
   */
  generateStylePrompt(profile) {
    if (!profile || profile.error) {
      return 'Write in a clear, natural style.';
    }

    let prompt = 'Write in the following style:\n\n';

    // Formality
    prompt += `- Formality: ${profile.formality?.level || 'neutral'}\n`;

    // Tone
    prompt += `- Tone: ${profile.tone || 'professional'}\n`;

    // Vocabulary
    prompt += `- Vocabulary complexity: ${profile.vocabulary?.complexity || 'medium'}\n`;

    // Structure
    if (profile.structure?.avgSentenceLength) {
      prompt += `- Average sentence length: ~${Math.round(profile.structure.avgSentenceLength)} words\n`;
    }

    // Punctuation style
    if (profile.punctuation?.exclamationRate > 0.1) {
      prompt += `- Use exclamation marks occasionally for emphasis\n`;
    }

    // Emoji
    if (profile.emoji === 'frequent') {
      prompt += `- Include relevant emojis\n`;
    } else if (profile.emoji === 'occasional') {
      prompt += `- Use emojis sparingly\n`;
    } else {
      prompt += `- Avoid using emojis\n`;
    }

    // Signature phrases
    if (profile.signaturePhrases?.common?.length > 0) {
      prompt += `\nCommon phrases to incorporate: ${profile.signaturePhrases.common.slice(0, 5).join(', ')}\n`;
    }

    return prompt;
  }

  /**
   * Calculate style consistency across samples
   */
  calculateStyleConsistency(samples) {
    if (samples.length < 2) return 100;

    const formalityLevels = samples.map(s => s.analysis?.formality?.level);
    const tones = samples.map(s => s.analysis?.tone?.dominant);

    const formalityConsistency = this.calculateConsistencyScore(formalityLevels);
    const toneConsistency = this.calculateConsistencyScore(tones);

    return Math.round((formalityConsistency + toneConsistency) / 2);
  }

  /**
   * Calculate consistency score for array of values
   */
  calculateConsistencyScore(values) {
    if (values.length === 0) return 100;
    const counts = {};
    values.forEach(v => {
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(counts));
    return Math.round((maxCount / values.length) * 100);
  }

  /**
   * Generate text in learned style
   */
  async generateInStyle(profile, prompt, options = {}) {
    try {
      log.info('Generating text in style', { promptLength: prompt.length });

      const stylePrompt = this.generateStylePrompt(profile);
      const fullPrompt = `${stylePrompt}\n\nNow write: ${prompt}`;

      // Use AI to generate
      if (this.openaiApiKey) {
        return await this.generateWithOpenAI(fullPrompt, options);
      } else if (this.anthropicApiKey) {
        return await this.generateWithAnthropic(fullPrompt, options);
      }

      return {
        success: false,
        error: 'No AI provider configured'
      };
    } catch (error) {
      log.error('Style generation error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate with OpenAI
   */
  async generateWithOpenAI(prompt, options) {
    try {
      const fetch = require('node-fetch');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1024
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
  async generateWithAnthropic(prompt, options) {
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
          model: options.model || 'claude-3-sonnet-20240229',
          max_tokens: options.maxTokens || 1024,
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
}

module.exports = StyleCloneEngine;
