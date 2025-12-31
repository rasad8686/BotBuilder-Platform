/**
 * Sentiment Analysis Service
 * Analyze sentiment and emotions from call transcriptions and audio
 */

const log = require('../../utils/logger');

class SentimentAnalysis {
  constructor() {
    this.providers = ['openai', 'azure', 'aws', 'local'];
    this.defaultProvider = process.env.SENTIMENT_PROVIDER || 'openai';
    this.apiKeys = {
      openai: process.env.OPENAI_API_KEY,
      azure: process.env.AZURE_TEXT_ANALYTICS_KEY,
      aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      }
    };

    // Local sentiment analysis keywords
    this.sentimentKeywords = {
      positive: [
        'thank', 'thanks', 'great', 'excellent', 'wonderful', 'amazing', 'good',
        'helpful', 'perfect', 'love', 'appreciate', 'happy', 'pleased', 'satisfied',
        'awesome', 'fantastic', 'brilliant', 'resolved', 'fixed', 'solved'
      ],
      negative: [
        'angry', 'frustrated', 'upset', 'terrible', 'horrible', 'bad', 'awful',
        'poor', 'worst', 'hate', 'annoyed', 'disappointed', 'unacceptable',
        'ridiculous', 'useless', 'waste', 'problem', 'issue', 'broken', 'fail'
      ],
      neutral: [
        'okay', 'fine', 'alright', 'understand', 'see', 'know', 'think'
      ]
    };

    // Emotion detection patterns
    this.emotionPatterns = {
      anger: ['angry', 'furious', 'mad', 'outraged', 'livid', 'frustrated'],
      joy: ['happy', 'excited', 'delighted', 'thrilled', 'pleased', 'joyful'],
      sadness: ['sad', 'disappointed', 'upset', 'depressed', 'unhappy', 'down'],
      fear: ['worried', 'anxious', 'scared', 'concerned', 'nervous', 'afraid'],
      surprise: ['surprised', 'shocked', 'amazed', 'astonished', 'wow'],
      disgust: ['disgusted', 'repulsed', 'revolted', 'appalled', 'sickened']
    };
  }

  /**
   * Analyze sentiment from text
   * @param {string} text - Text to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} Sentiment analysis result
   */
  async analyzeSentiment(text, options = {}) {
    const {
      provider = this.defaultProvider,
      detailed = false,
      includeEmotions = true,
      language = 'en'
    } = options;

    if (!text || text.trim().length === 0) {
      return {
        sentiment: 'neutral',
        score: 0,
        confidence: 0,
        error: 'Empty text provided'
      };
    }

    try {
      let result;

      switch (provider) {
        case 'openai':
          result = await this.analyzeWithOpenAI(text, { detailed, includeEmotions });
          break;

        case 'azure':
          result = await this.analyzeWithAzure(text, { language });
          break;

        case 'aws':
          result = await this.analyzeWithAWS(text, { language });
          break;

        case 'local':
        default:
          result = this.analyzeLocal(text, { detailed, includeEmotions });
          break;
      }

      log.debug('Sentiment analysis completed', { provider, sentiment: result.sentiment });

      return result;
    } catch (error) {
      log.error('Sentiment analysis failed', { provider, error: error.message });

      // Fallback to local analysis
      if (provider !== 'local') {
        log.info('Falling back to local sentiment analysis');
        return this.analyzeLocal(text, { detailed, includeEmotions });
      }

      throw error;
    }
  }

  /**
   * Analyze using OpenAI GPT
   */
  async analyzeWithOpenAI(text, options) {
    const { detailed, includeEmotions } = options;
    const fetch = (await import('node-fetch')).default;

    const prompt = `Analyze the sentiment of the following text from a customer service call.
Return a JSON object with:
- sentiment: "positive", "negative", or "neutral"
- score: a number from -1 (most negative) to 1 (most positive)
- confidence: a number from 0 to 1
${detailed ? '- key_phrases: array of important phrases' : ''}
${includeEmotions ? '- emotions: object with emotion names as keys and intensity (0-1) as values' : ''}
- summary: a brief one-sentence summary of the sentiment

Text to analyze:
"${text}"

Return only valid JSON, no markdown or explanation.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKeys.openai}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
      const result = JSON.parse(content);
      result.provider = 'openai';
      return result;
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        result.provider = 'openai';
        return result;
      }
      throw new Error('Failed to parse OpenAI response');
    }
  }

  /**
   * Analyze using Azure Text Analytics
   */
  async analyzeWithAzure(text, options) {
    const { language } = options;
    const fetch = (await import('node-fetch')).default;

    const endpoint = process.env.AZURE_TEXT_ANALYTICS_ENDPOINT;

    const response = await fetch(`${endpoint}/text/analytics/v3.1/sentiment`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKeys.azure,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documents: [
          { id: '1', language, text }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Azure API error: ${response.status}`);
    }

    const data = await response.json();
    const doc = data.documents[0];

    const sentimentScores = doc.confidenceScores;
    let sentiment = 'neutral';
    let score = 0;

    if (sentimentScores.positive > sentimentScores.negative && sentimentScores.positive > sentimentScores.neutral) {
      sentiment = 'positive';
      score = sentimentScores.positive;
    } else if (sentimentScores.negative > sentimentScores.positive && sentimentScores.negative > sentimentScores.neutral) {
      sentiment = 'negative';
      score = -sentimentScores.negative;
    }

    return {
      sentiment,
      score,
      confidence: Math.max(sentimentScores.positive, sentimentScores.negative, sentimentScores.neutral),
      scores: sentimentScores,
      sentences: doc.sentences?.map(s => ({
        text: s.text,
        sentiment: s.sentiment,
        scores: s.confidenceScores
      })),
      provider: 'azure'
    };
  }

  /**
   * Analyze using AWS Comprehend
   */
  async analyzeWithAWS(text, options) {
    const { language } = options;
    const { ComprehendClient, DetectSentimentCommand } = await import('@aws-sdk/client-comprehend');

    const client = new ComprehendClient({
      region: this.apiKeys.aws.region,
      credentials: {
        accessKeyId: this.apiKeys.aws.accessKeyId,
        secretAccessKey: this.apiKeys.aws.secretAccessKey
      }
    });

    const command = new DetectSentimentCommand({
      Text: text,
      LanguageCode: language
    });

    const response = await client.send(command);

    const sentimentMap = {
      'POSITIVE': { sentiment: 'positive', score: response.SentimentScore.Positive },
      'NEGATIVE': { sentiment: 'negative', score: -response.SentimentScore.Negative },
      'NEUTRAL': { sentiment: 'neutral', score: 0 },
      'MIXED': { sentiment: 'mixed', score: 0 }
    };

    const result = sentimentMap[response.Sentiment] || { sentiment: 'neutral', score: 0 };

    return {
      ...result,
      confidence: Math.max(
        response.SentimentScore.Positive,
        response.SentimentScore.Negative,
        response.SentimentScore.Neutral,
        response.SentimentScore.Mixed
      ),
      scores: {
        positive: response.SentimentScore.Positive,
        negative: response.SentimentScore.Negative,
        neutral: response.SentimentScore.Neutral,
        mixed: response.SentimentScore.Mixed
      },
      provider: 'aws'
    };
  }

  /**
   * Local sentiment analysis using keyword matching
   */
  analyzeLocal(text, options) {
    const { detailed, includeEmotions } = options;
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\W+/);

    // Count keyword matches
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    const matchedPhrases = [];

    for (const word of words) {
      if (this.sentimentKeywords.positive.includes(word)) {
        positiveCount++;
        matchedPhrases.push({ word, sentiment: 'positive' });
      } else if (this.sentimentKeywords.negative.includes(word)) {
        negativeCount++;
        matchedPhrases.push({ word, sentiment: 'negative' });
      } else if (this.sentimentKeywords.neutral.includes(word)) {
        neutralCount++;
      }
    }

    // Calculate sentiment
    const total = positiveCount + negativeCount + neutralCount || 1;
    let sentiment = 'neutral';
    let score = 0;

    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      score = positiveCount / total;
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      score = -negativeCount / total;
    }

    const confidence = (positiveCount + negativeCount) / words.length;

    const result = {
      sentiment,
      score: Math.round(score * 100) / 100,
      confidence: Math.min(Math.round(confidence * 100) / 100, 1),
      provider: 'local'
    };

    if (detailed) {
      result.key_phrases = matchedPhrases.slice(0, 10);
      result.wordCount = words.length;
      result.matchCount = positiveCount + negativeCount;
    }

    if (includeEmotions) {
      result.emotions = this.detectEmotions(lowerText);
    }

    return result;
  }

  /**
   * Detect emotions from text
   */
  detectEmotions(text) {
    const words = text.toLowerCase().split(/\W+/);
    const emotions = {};

    for (const [emotion, patterns] of Object.entries(this.emotionPatterns)) {
      const matches = words.filter(w => patterns.some(p => w.includes(p))).length;
      if (matches > 0) {
        emotions[emotion] = Math.min(matches / 5, 1); // Normalize to 0-1
      }
    }

    return emotions;
  }

  /**
   * Analyze sentiment for call segments (transcription with timestamps)
   * @param {Array} segments - Transcription segments
   * @returns {Object} Sentiment analysis over time
   */
  async analyzeCallSentiment(segments, options = {}) {
    if (!segments || segments.length === 0) {
      return {
        overall: { sentiment: 'neutral', score: 0, confidence: 0 },
        timeline: [],
        summary: 'No segments to analyze'
      };
    }

    const timeline = [];
    let totalScore = 0;
    let totalConfidence = 0;

    // Analyze each segment
    for (const segment of segments) {
      const analysis = await this.analyzeSentiment(segment.text, options);

      timeline.push({
        start: segment.start,
        end: segment.end,
        text: segment.text,
        speaker: segment.speaker,
        sentiment: analysis.sentiment,
        score: analysis.score,
        confidence: analysis.confidence,
        emotions: analysis.emotions
      });

      totalScore += analysis.score;
      totalConfidence += analysis.confidence;
    }

    const avgScore = totalScore / segments.length;
    const avgConfidence = totalConfidence / segments.length;

    // Determine overall sentiment
    let overallSentiment = 'neutral';
    if (avgScore > 0.2) overallSentiment = 'positive';
    else if (avgScore < -0.2) overallSentiment = 'negative';

    // Identify sentiment trends
    const trends = this.identifyTrends(timeline);

    // Identify critical moments (high negative sentiment)
    const criticalMoments = timeline.filter(t => t.score < -0.5);

    // Identify positive highlights
    const highlights = timeline.filter(t => t.score > 0.5);

    return {
      overall: {
        sentiment: overallSentiment,
        score: Math.round(avgScore * 100) / 100,
        confidence: Math.round(avgConfidence * 100) / 100
      },
      timeline,
      trends,
      criticalMoments,
      highlights,
      summary: this.generateSummary(overallSentiment, trends, criticalMoments, highlights)
    };
  }

  /**
   * Identify sentiment trends over the call
   */
  identifyTrends(timeline) {
    if (timeline.length < 2) {
      return { direction: 'stable', description: 'Not enough data for trend analysis' };
    }

    const firstHalf = timeline.slice(0, Math.floor(timeline.length / 2));
    const secondHalf = timeline.slice(Math.floor(timeline.length / 2));

    const firstAvg = firstHalf.reduce((sum, t) => sum + t.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, t) => sum + t.score, 0) / secondHalf.length;

    const change = secondAvg - firstAvg;

    if (change > 0.2) {
      return {
        direction: 'improving',
        change: Math.round(change * 100) / 100,
        description: 'Sentiment improved throughout the call'
      };
    } else if (change < -0.2) {
      return {
        direction: 'declining',
        change: Math.round(change * 100) / 100,
        description: 'Sentiment declined throughout the call'
      };
    } else {
      return {
        direction: 'stable',
        change: Math.round(change * 100) / 100,
        description: 'Sentiment remained relatively stable'
      };
    }
  }

  /**
   * Generate human-readable summary
   */
  generateSummary(sentiment, trends, criticalMoments, highlights) {
    let summary = `The call had an overall ${sentiment} sentiment. `;

    if (trends.direction === 'improving') {
      summary += 'Customer sentiment improved throughout the conversation. ';
    } else if (trends.direction === 'declining') {
      summary += 'Customer sentiment declined during the call, which may need attention. ';
    }

    if (criticalMoments.length > 0) {
      summary += `There were ${criticalMoments.length} critical moment(s) of negative sentiment. `;
    }

    if (highlights.length > 0) {
      summary += `${highlights.length} positive highlight(s) were identified.`;
    }

    return summary;
  }

  /**
   * Analyze customer satisfaction from call
   * @param {Object} callData - Call data including transcription
   * @returns {Object} Satisfaction analysis
   */
  async analyzeCustomerSatisfaction(callData) {
    const {
      transcription,
      duration,
      wasTransferred,
      waitTime,
      resolution
    } = callData;

    // Analyze sentiment from transcription
    const sentimentResult = await this.analyzeCallSentiment(
      transcription?.segments || [],
      { includeEmotions: true }
    );

    // Calculate satisfaction indicators
    const indicators = {
      sentimentScore: sentimentResult.overall.score,
      emotionalTone: this.calculateEmotionalTone(sentimentResult.timeline),
      callEfficiency: this.calculateEfficiency(duration, wasTransferred, waitTime),
      resolutionSuccess: resolution === 'resolved' ? 1 : resolution === 'escalated' ? 0.5 : 0
    };

    // Calculate overall CSAT prediction (0-100)
    const csatPrediction = this.predictCSAT(indicators);

    return {
      indicators,
      csatPrediction,
      sentimentAnalysis: sentimentResult,
      recommendations: this.generateRecommendations(indicators, sentimentResult)
    };
  }

  /**
   * Calculate emotional tone from timeline
   */
  calculateEmotionalTone(timeline) {
    if (!timeline || timeline.length === 0) return 0.5;

    const emotions = {};
    let totalWeight = 0;

    for (const segment of timeline) {
      if (segment.emotions) {
        for (const [emotion, intensity] of Object.entries(segment.emotions)) {
          emotions[emotion] = (emotions[emotion] || 0) + intensity;
          totalWeight += intensity;
        }
      }
    }

    if (totalWeight === 0) return 0.5;

    // Positive emotions: joy, surprise
    // Negative emotions: anger, sadness, fear, disgust
    const positiveScore = (emotions.joy || 0) + (emotions.surprise || 0) * 0.5;
    const negativeScore = (emotions.anger || 0) + (emotions.sadness || 0) +
      (emotions.fear || 0) + (emotions.disgust || 0);

    const normalizedPositive = positiveScore / totalWeight;
    const normalizedNegative = negativeScore / totalWeight;

    return Math.max(0, Math.min(1, 0.5 + normalizedPositive - normalizedNegative));
  }

  /**
   * Calculate call efficiency score
   */
  calculateEfficiency(duration, wasTransferred, waitTime) {
    let score = 1;

    // Penalize long calls (over 10 minutes)
    if (duration > 600) {
      score -= Math.min((duration - 600) / 600, 0.3);
    }

    // Penalize transfers
    if (wasTransferred) {
      score -= 0.2;
    }

    // Penalize long wait times (over 2 minutes)
    if (waitTime > 120) {
      score -= Math.min((waitTime - 120) / 300, 0.3);
    }

    return Math.max(0, score);
  }

  /**
   * Predict CSAT score based on indicators
   */
  predictCSAT(indicators) {
    const weights = {
      sentimentScore: 0.35,
      emotionalTone: 0.25,
      callEfficiency: 0.2,
      resolutionSuccess: 0.2
    };

    // Normalize sentiment score from [-1, 1] to [0, 1]
    const normalizedSentiment = (indicators.sentimentScore + 1) / 2;

    const weightedScore =
      normalizedSentiment * weights.sentimentScore +
      indicators.emotionalTone * weights.emotionalTone +
      indicators.callEfficiency * weights.callEfficiency +
      indicators.resolutionSuccess * weights.resolutionSuccess;

    return Math.round(weightedScore * 100);
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(indicators, sentimentResult) {
    const recommendations = [];

    if (indicators.sentimentScore < -0.3) {
      recommendations.push({
        priority: 'high',
        category: 'customer_experience',
        message: 'Customer showed significant negative sentiment. Consider follow-up contact.'
      });
    }

    if (sentimentResult.criticalMoments?.length > 2) {
      recommendations.push({
        priority: 'medium',
        category: 'training',
        message: 'Multiple negative sentiment spikes detected. Review agent handling.'
      });
    }

    if (sentimentResult.trends?.direction === 'declining') {
      recommendations.push({
        priority: 'medium',
        category: 'process',
        message: 'Sentiment declined during call. Review call flow and resolution process.'
      });
    }

    if (indicators.callEfficiency < 0.5) {
      recommendations.push({
        priority: 'low',
        category: 'efficiency',
        message: 'Call had efficiency issues. Consider process improvements.'
      });
    }

    if (indicators.resolutionSuccess < 0.5) {
      recommendations.push({
        priority: 'high',
        category: 'follow_up',
        message: 'Issue may not be fully resolved. Schedule follow-up.'
      });
    }

    return recommendations;
  }

  /**
   * Batch analyze multiple texts
   */
  async batchAnalyze(texts, options = {}) {
    const results = await Promise.all(
      texts.map(text => this.analyzeSentiment(text, options))
    );

    return {
      results,
      summary: this.summarizeBatch(results)
    };
  }

  /**
   * Summarize batch analysis results
   */
  summarizeBatch(results) {
    const counts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    let totalScore = 0;

    for (const result of results) {
      counts[result.sentiment]++;
      totalScore += result.score;
    }

    return {
      total: results.length,
      distribution: counts,
      averageScore: Math.round((totalScore / results.length) * 100) / 100
    };
  }
}

// Export singleton instance
module.exports = new SentimentAnalysis();
