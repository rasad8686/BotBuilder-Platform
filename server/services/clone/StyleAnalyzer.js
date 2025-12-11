/**
 * Style Analyzer Service
 * Analyzes writing style, tone, and patterns from training data
 */

const log = require('../../utils/logger');

class StyleAnalyzer {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Analyze text for writing style characteristics
   */
  async analyzeStyle(text) {
    try {
      const analysis = {
        wordCount: this.countWords(text),
        sentenceCount: this.countSentences(text),
        paragraphCount: this.countParagraphs(text),
        avgWordsPerSentence: 0,
        avgSentencesPerParagraph: 0,
        vocabulary: this.analyzeVocabulary(text),
        punctuation: this.analyzePunctuation(text),
        capitalization: this.analyzeCapitalization(text),
        formality: this.analyzeFormality(text),
        tone: this.analyzeTone(text),
        patterns: this.extractPatterns(text)
      };

      analysis.avgWordsPerSentence = analysis.sentenceCount > 0
        ? Math.round(analysis.wordCount / analysis.sentenceCount * 10) / 10
        : 0;

      analysis.avgSentencesPerParagraph = analysis.paragraphCount > 0
        ? Math.round(analysis.sentenceCount / analysis.paragraphCount * 10) / 10
        : 0;

      return { success: true, analysis };
    } catch (error) {
      log.error('Style analysis error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Count words in text
   */
  countWords(text) {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  /**
   * Count sentences in text
   */
  countSentences(text) {
    const matches = text.match(/[.!?]+/g);
    return matches ? matches.length : 1;
  }

  /**
   * Count paragraphs in text
   */
  countParagraphs(text) {
    return text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length || 1;
  }

  /**
   * Analyze vocabulary usage
   */
  analyzeVocabulary(text) {
    const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
    const uniqueWords = new Set(words);
    const wordFreq = {};

    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    const sortedWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    return {
      totalWords: words.length,
      uniqueWords: uniqueWords.size,
      vocabularyRichness: uniqueWords.size / (words.length || 1),
      topWords: sortedWords.map(([word, count]) => ({ word, count })),
      avgWordLength: words.length > 0
        ? Math.round(words.reduce((sum, w) => sum + w.length, 0) / words.length * 10) / 10
        : 0
    };
  }

  /**
   * Analyze punctuation usage
   */
  analyzePunctuation(text) {
    return {
      periods: (text.match(/\./g) || []).length,
      commas: (text.match(/,/g) || []).length,
      exclamations: (text.match(/!/g) || []).length,
      questions: (text.match(/\?/g) || []).length,
      semicolons: (text.match(/;/g) || []).length,
      colons: (text.match(/:/g) || []).length,
      dashes: (text.match(/[-—–]/g) || []).length,
      ellipses: (text.match(/\.{3}|…/g) || []).length,
      quotations: (text.match(/["""'']/g) || []).length
    };
  }

  /**
   * Analyze capitalization patterns
   */
  analyzeCapitalization(text) {
    const words = text.match(/\b[A-Za-z]+\b/g) || [];
    const capitalizedWords = words.filter(w => w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase());
    const allCapsWords = words.filter(w => w === w.toUpperCase() && w.length > 1);

    return {
      capitalizedRatio: words.length > 0 ? capitalizedWords.length / words.length : 0,
      allCapsCount: allCapsWords.length,
      usesAllCaps: allCapsWords.length > 0
    };
  }

  /**
   * Analyze formality level
   */
  analyzeFormality(text) {
    const lowerText = text.toLowerCase();

    const formalIndicators = [
      'therefore', 'however', 'furthermore', 'moreover', 'consequently',
      'nevertheless', 'accordingly', 'hence', 'thus', 'regarding',
      'concerning', 'pursuant', 'hereby', 'whereas', 'notwithstanding'
    ];

    const informalIndicators = [
      'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'yeah', 'yep', 'nope',
      'ok', 'okay', 'hey', 'hi', 'bye', 'thanks', 'lol', 'btw', 'fyi',
      'asap', 'omg', 'wow', 'cool', 'awesome', 'great', 'nice'
    ];

    const contractions = (lowerText.match(/\b\w+'(t|s|re|ve|ll|d|m)\b/g) || []).length;

    let formalScore = 0;
    let informalScore = 0;

    formalIndicators.forEach(word => {
      if (lowerText.includes(word)) formalScore++;
    });

    informalIndicators.forEach(word => {
      if (lowerText.includes(word)) informalScore++;
    });

    const formalityScore = (formalScore - informalScore - contractions * 0.5) / 10;

    return {
      score: Math.max(-1, Math.min(1, formalityScore)),
      level: formalityScore > 0.3 ? 'formal' : formalityScore < -0.3 ? 'informal' : 'neutral',
      formalWordCount: formalScore,
      informalWordCount: informalScore,
      contractionCount: contractions
    };
  }

  /**
   * Analyze tone of text
   */
  analyzeTone(text) {
    const lowerText = text.toLowerCase();

    const toneIndicators = {
      positive: ['great', 'excellent', 'wonderful', 'fantastic', 'amazing', 'love', 'happy', 'glad', 'pleased', 'excited', 'thank', 'appreciate'],
      negative: ['unfortunately', 'sorry', 'problem', 'issue', 'concern', 'disappointed', 'frustrated', 'difficult', 'fail', 'error', 'wrong'],
      confident: ['certainly', 'definitely', 'absolutely', 'clearly', 'obviously', 'undoubtedly', 'sure', 'confident', 'certain'],
      tentative: ['maybe', 'perhaps', 'possibly', 'might', 'could', 'seem', 'appear', 'think', 'believe', 'suggest'],
      urgent: ['urgent', 'immediately', 'asap', 'critical', 'important', 'priority', 'deadline', 'now', 'quickly'],
      friendly: ['hope', 'please', 'thank', 'appreciate', 'looking forward', 'happy to', 'glad to', 'welcome']
    };

    const scores = {};
    Object.entries(toneIndicators).forEach(([tone, words]) => {
      scores[tone] = words.filter(word => lowerText.includes(word)).length;
    });

    const dominantTone = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

    return {
      scores,
      dominant: dominantTone[1] > 0 ? dominantTone[0] : 'neutral',
      isPositive: scores.positive > scores.negative,
      isConfident: scores.confident > scores.tentative,
      isUrgent: scores.urgent > 1,
      isFriendly: scores.friendly > 1
    };
  }

  /**
   * Extract common patterns from text
   */
  extractPatterns(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    const patterns = {
      greetings: [],
      closings: [],
      transitions: [],
      commonPhrases: []
    };

    const greetingPatterns = /^(hi|hello|hey|dear|good morning|good afternoon|good evening)/i;
    const closingPatterns = /(best|regards|sincerely|thanks|thank you|cheers|best wishes|kind regards|warm regards)[\s,]*$/i;
    const transitionPatterns = /(however|therefore|furthermore|additionally|moreover|on the other hand|in addition|as a result)/gi;

    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (greetingPatterns.test(trimmed)) {
        patterns.greetings.push(trimmed.substring(0, 50));
      }
      if (closingPatterns.test(trimmed)) {
        patterns.closings.push(trimmed.substring(0, 50));
      }
    });

    const transitions = text.match(transitionPatterns) || [];
    patterns.transitions = [...new Set(transitions.map(t => t.toLowerCase()))];

    return patterns;
  }

  /**
   * Generate style profile from multiple samples
   */
  async generateStyleProfile(samples) {
    try {
      const analyses = await Promise.all(
        samples.map(sample => this.analyzeStyle(sample.content))
      );

      const validAnalyses = analyses.filter(a => a.success).map(a => a.analysis);

      if (validAnalyses.length === 0) {
        return { success: false, error: 'No valid samples to analyze' };
      }

      const profile = {
        avgWordsPerSentence: this.average(validAnalyses.map(a => a.avgWordsPerSentence)),
        avgSentencesPerParagraph: this.average(validAnalyses.map(a => a.avgSentencesPerParagraph)),
        vocabularyRichness: this.average(validAnalyses.map(a => a.vocabulary.vocabularyRichness)),
        avgWordLength: this.average(validAnalyses.map(a => a.vocabulary.avgWordLength)),
        formality: {
          score: this.average(validAnalyses.map(a => a.formality.score)),
          level: this.mode(validAnalyses.map(a => a.formality.level))
        },
        tone: {
          dominant: this.mode(validAnalyses.map(a => a.tone.dominant)),
          isPositive: validAnalyses.filter(a => a.tone.isPositive).length > validAnalyses.length / 2,
          isConfident: validAnalyses.filter(a => a.tone.isConfident).length > validAnalyses.length / 2,
          isFriendly: validAnalyses.filter(a => a.tone.isFriendly).length > validAnalyses.length / 2
        },
        punctuationStyle: {
          usesExclamations: this.average(validAnalyses.map(a => a.punctuation.exclamations)) > 0.5,
          usesEllipses: this.average(validAnalyses.map(a => a.punctuation.ellipses)) > 0.2,
          usesDashes: this.average(validAnalyses.map(a => a.punctuation.dashes)) > 0.5
        },
        commonPatterns: this.mergePatterns(validAnalyses.map(a => a.patterns)),
        sampleCount: validAnalyses.length
      };

      return { success: true, profile };
    } catch (error) {
      log.error('Style profile generation error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate average of array
   */
  average(arr) {
    if (arr.length === 0) return 0;
    return Math.round(arr.reduce((sum, val) => sum + val, 0) / arr.length * 100) / 100;
  }

  /**
   * Find mode (most common value) in array
   */
  mode(arr) {
    const counts = {};
    arr.forEach(val => {
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  /**
   * Merge patterns from multiple analyses
   */
  mergePatterns(patternsArray) {
    const merged = {
      greetings: [],
      closings: [],
      transitions: []
    };

    patternsArray.forEach(p => {
      merged.greetings.push(...p.greetings);
      merged.closings.push(...p.closings);
      merged.transitions.push(...p.transitions);
    });

    return {
      greetings: [...new Set(merged.greetings)].slice(0, 5),
      closings: [...new Set(merged.closings)].slice(0, 5),
      transitions: [...new Set(merged.transitions)].slice(0, 10)
    };
  }
}

module.exports = StyleAnalyzer;
