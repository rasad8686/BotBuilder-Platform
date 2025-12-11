/**
 * Training Service
 * Handles training data processing and model fine-tuning for work clones
 */

const log = require('../../utils/logger');
const StyleAnalyzer = require('./StyleAnalyzer');

class TrainingService {
  constructor(config = {}) {
    this.config = config;
    this.styleAnalyzer = new StyleAnalyzer();
  }

  /**
   * Process training data for a clone
   */
  async processTrainingData(trainingData) {
    try {
      const processed = [];

      for (const data of trainingData) {
        const result = await this.processItem(data);
        if (result.success) {
          processed.push(result.data);
        }
      }

      return {
        success: true,
        processed,
        count: processed.length,
        skipped: trainingData.length - processed.length
      };
    } catch (error) {
      log.error('Training data processing error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Process a single training item
   */
  async processItem(item) {
    try {
      // Clean and normalize content
      const cleanedContent = this.cleanContent(item.original_content);

      // Analyze style
      const styleResult = await this.styleAnalyzer.analyzeStyle(cleanedContent);

      // Extract features
      const features = this.extractFeatures(cleanedContent, item.data_type);

      // Calculate quality score
      const qualityScore = this.calculateQualityScore(cleanedContent, styleResult.analysis);

      return {
        success: true,
        data: {
          ...item,
          processed_content: cleanedContent,
          extracted_features: features,
          style_markers: styleResult.success ? styleResult.analysis : {},
          quality_score: qualityScore,
          is_processed: true,
          processed_at: new Date()
        }
      };
    } catch (error) {
      log.error('Item processing error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean and normalize content
   */
  cleanContent(content) {
    if (!content) return '';

    return content
      // Normalize whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/ +/g, ' ')
      // Remove excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Trim each line
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // Final trim
      .trim();
  }

  /**
   * Extract features based on content type
   */
  extractFeatures(content, dataType) {
    const baseFeatures = {
      length: content.length,
      wordCount: content.split(/\s+/).length,
      lineCount: content.split('\n').length,
      hasGreeting: /^(hi|hello|hey|dear|good\s+(morning|afternoon|evening))/i.test(content),
      hasClosing: /(best|regards|sincerely|thanks|thank you|cheers)[\s,]*$/im.test(content),
      hasSignature: /^[\s]*[-—–][\s]*[A-Z]/m.test(content)
    };

    const typeFeatures = {};

    switch (dataType) {
      case 'email':
        typeFeatures.hasSubject = /^subject:/im.test(content);
        typeFeatures.hasSalutation = /^dear|^hi|^hello/im.test(content);
        typeFeatures.hasAttachmentRef = /attach(ed|ment)/i.test(content);
        typeFeatures.isReply = /^(re:|fw:|fwd:)/im.test(content);
        break;

      case 'document':
        typeFeatures.hasTitle = /^#|^[A-Z][^.!?]*\n\n/.test(content);
        typeFeatures.hasSections = (content.match(/^#+\s|^\d+\.\s/gm) || []).length;
        typeFeatures.hasBulletPoints = (content.match(/^[-*•]\s/gm) || []).length;
        typeFeatures.hasCodeBlocks = /```[\s\S]*```/.test(content);
        break;

      case 'chat':
        typeFeatures.isShortMessage = content.length < 100;
        typeFeatures.hasEmoji = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/u.test(content);
        typeFeatures.hasUrl = /https?:\/\/\S+/i.test(content);
        typeFeatures.isQuestion = /\?$/.test(content.trim());
        break;

      case 'social':
        typeFeatures.hasHashtag = /#\w+/.test(content);
        typeFeatures.hasMention = /@\w+/.test(content);
        typeFeatures.characterCount = content.length;
        typeFeatures.hasEmoji = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/u.test(content);
        break;

      default:
        break;
    }

    return { ...baseFeatures, ...typeFeatures };
  }

  /**
   * Calculate quality score for training data
   */
  calculateQualityScore(content, styleAnalysis) {
    let score = 50; // Base score

    // Length quality (10-500 words is ideal)
    const wordCount = content.split(/\s+/).length;
    if (wordCount >= 10 && wordCount <= 500) {
      score += 15;
    } else if (wordCount >= 5 && wordCount <= 1000) {
      score += 8;
    } else if (wordCount < 5) {
      score -= 20;
    }

    // Vocabulary richness
    if (styleAnalysis?.vocabulary?.vocabularyRichness > 0.5) {
      score += 10;
    }

    // Proper sentence structure
    if (styleAnalysis?.avgWordsPerSentence > 5 && styleAnalysis?.avgWordsPerSentence < 25) {
      score += 10;
    }

    // Not too many exclamations (spam indicator)
    if (styleAnalysis?.punctuation?.exclamations > 5) {
      score -= 10;
    }

    // Has proper ending
    if (/[.!?]$/.test(content.trim())) {
      score += 5;
    }

    // No excessive caps
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.5) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate training prompt from processed data
   */
  generateTrainingPrompt(styleProfile, samples) {
    let prompt = `You are a writing assistant that mimics a specific person's writing style. Here is the style profile:\n\n`;

    prompt += `## Writing Style Profile\n`;
    prompt += `- Average words per sentence: ${styleProfile.avgWordsPerSentence}\n`;
    prompt += `- Formality level: ${styleProfile.formality?.level || 'neutral'}\n`;
    prompt += `- Dominant tone: ${styleProfile.tone?.dominant || 'neutral'}\n`;
    prompt += `- Vocabulary richness: ${Math.round((styleProfile.vocabularyRichness || 0.5) * 100)}%\n`;

    if (styleProfile.tone?.isPositive) {
      prompt += `- Generally positive and optimistic\n`;
    }
    if (styleProfile.tone?.isFriendly) {
      prompt += `- Uses friendly, warm language\n`;
    }
    if (styleProfile.tone?.isConfident) {
      prompt += `- Writes with confidence and certainty\n`;
    }

    if (styleProfile.punctuationStyle?.usesExclamations) {
      prompt += `- Frequently uses exclamation marks\n`;
    }
    if (styleProfile.punctuationStyle?.usesEllipses) {
      prompt += `- Uses ellipses for effect\n`;
    }

    if (styleProfile.commonPatterns?.greetings?.length > 0) {
      prompt += `\n## Common Greetings\n`;
      styleProfile.commonPatterns.greetings.forEach(g => {
        prompt += `- "${g}"\n`;
      });
    }

    if (styleProfile.commonPatterns?.closings?.length > 0) {
      prompt += `\n## Common Closings\n`;
      styleProfile.commonPatterns.closings.forEach(c => {
        prompt += `- "${c}"\n`;
      });
    }

    prompt += `\n## Example Writing Samples\n`;
    const exampleSamples = samples.slice(0, 5);
    exampleSamples.forEach((sample, i) => {
      prompt += `\n### Example ${i + 1}\n`;
      prompt += `${sample.processed_content || sample.original_content}\n`;
    });

    prompt += `\n## Instructions\n`;
    prompt += `When generating text, match the style, tone, vocabulary, and patterns shown above. `;
    prompt += `Maintain consistency with the formality level and personality traits observed in the samples.`;

    return prompt;
  }

  /**
   * Train clone model with processed data
   */
  async trainClone(clone, processedData) {
    try {
      // Generate style profile
      const profileResult = await this.styleAnalyzer.generateStyleProfile(
        processedData.map(d => ({ content: d.processed_content || d.original_content }))
      );

      if (!profileResult.success) {
        return { success: false, error: 'Failed to generate style profile' };
      }

      // Generate training prompt
      const trainingPrompt = this.generateTrainingPrompt(profileResult.profile, processedData);

      // Calculate training score
      const avgQuality = processedData.reduce((sum, d) => sum + (d.quality_score || 0), 0) / processedData.length;
      const trainingScore = Math.round(avgQuality * (profileResult.profile.sampleCount / 10));

      return {
        success: true,
        styleProfile: profileResult.profile,
        trainingPrompt,
        trainingScore: Math.min(100, trainingScore),
        samplesUsed: processedData.length
      };
    } catch (error) {
      log.error('Clone training error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate training data before processing
   */
  validateTrainingData(data) {
    const errors = [];

    if (!data.original_content || data.original_content.trim().length < 10) {
      errors.push('Content too short (minimum 10 characters)');
    }

    if (data.original_content && data.original_content.length > 50000) {
      errors.push('Content too long (maximum 50000 characters)');
    }

    if (!data.data_type) {
      errors.push('Data type is required');
    }

    const validTypes = ['email', 'document', 'chat', 'social', 'custom'];
    if (data.data_type && !validTypes.includes(data.data_type)) {
      errors.push(`Invalid data type. Must be one of: ${validTypes.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = TrainingService;
