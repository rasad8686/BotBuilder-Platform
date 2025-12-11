/**
 * AI Cost Calculator Tests
 * Tests for server/services/ai/aiCostCalculator.js
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const AICostCalculator = require('../../../services/ai/aiCostCalculator');

describe('AICostCalculator', () => {
  describe('calculateCost', () => {
    it('should calculate cost for OpenAI gpt-4o', () => {
      const cost = AICostCalculator.calculateCost({
        provider: 'openai',
        model: 'gpt-4o',
        promptTokens: 1000,
        completionTokens: 500
      });

      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    it('should calculate cost for Claude claude-3-5-sonnet', () => {
      const cost = AICostCalculator.calculateCost({
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        promptTokens: 1000,
        completionTokens: 500
      });

      expect(cost).toBeGreaterThan(0);
    });

    it('should return 0 for missing provider', () => {
      const cost = AICostCalculator.calculateCost({
        model: 'gpt-4',
        promptTokens: 1000,
        completionTokens: 500
      });

      expect(cost).toBe(0);
    });

    it('should return 0 for missing model', () => {
      const cost = AICostCalculator.calculateCost({
        provider: 'openai',
        promptTokens: 1000,
        completionTokens: 500
      });

      expect(cost).toBe(0);
    });

    it('should return 0 for unknown provider', () => {
      const cost = AICostCalculator.calculateCost({
        provider: 'unknown',
        model: 'gpt-4',
        promptTokens: 1000,
        completionTokens: 500
      });

      expect(cost).toBe(0);
    });

    it('should use fallback pricing for unknown model', () => {
      const cost = AICostCalculator.calculateCost({
        provider: 'openai',
        model: 'unknown-model',
        promptTokens: 1000,
        completionTokens: 500
      });

      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for openai', () => {
      const cost = AICostCalculator.estimateCost('openai', 1000, 500);
      expect(cost).toBeGreaterThan(0);
    });

    it('should estimate cost for claude', () => {
      const cost = AICostCalculator.estimateCost('claude', 1000, 500);
      expect(cost).toBeGreaterThan(0);
    });

    it('should use default pricing for unknown provider', () => {
      const cost = AICostCalculator.estimateCost('unknown', 1000, 500);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('getPricing', () => {
    it('should return pricing for known model', () => {
      const pricing = AICostCalculator.getPricing('openai', 'gpt-4o');
      expect(pricing).not.toBeNull();
      expect(pricing.input).toBeDefined();
      expect(pricing.output).toBeDefined();
    });

    it('should return null for unknown provider', () => {
      const pricing = AICostCalculator.getPricing('unknown', 'gpt-4');
      expect(pricing).toBeNull();
    });

    it('should return null for unknown model', () => {
      const pricing = AICostCalculator.getPricing('openai', 'unknown-model');
      expect(pricing).toBeNull();
    });
  });

  describe('calculateTotalCost', () => {
    it('should calculate total cost from usage logs', () => {
      const usageLogs = [
        { provider: 'openai', cost_usd: 0.01, total_tokens: 1000, prompt_tokens: 800, completion_tokens: 200 },
        { provider: 'claude', cost_usd: 0.02, total_tokens: 1500, prompt_tokens: 1000, completion_tokens: 500 }
      ];

      const result = AICostCalculator.calculateTotalCost(usageLogs);

      expect(result.totalCost).toBe(0.03);
      expect(result.totalTokens).toBe(2500);
      expect(result.breakdown.openai).toBe(0.01);
      expect(result.breakdown.claude).toBe(0.02);
      expect(result.averageCostPerRequest).toBe(0.015);
    });

    it('should handle empty usage logs', () => {
      const result = AICostCalculator.calculateTotalCost([]);

      expect(result.totalCost).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.averageCostPerRequest).toBe(0);
    });

    it('should handle missing cost values', () => {
      const usageLogs = [
        { provider: 'openai', total_tokens: 1000, prompt_tokens: 800, completion_tokens: 200 }
      ];

      const result = AICostCalculator.calculateTotalCost(usageLogs);

      expect(result.totalCost).toBe(0);
      expect(result.totalTokens).toBe(1000);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens from text', () => {
      const text = 'Hello, this is a test message with some words.';
      const tokens = AICostCalculator.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('should return 0 for empty text', () => {
      expect(AICostCalculator.estimateTokens('')).toBe(0);
      expect(AICostCalculator.estimateTokens(null)).toBe(0);
      expect(AICostCalculator.estimateTokens(undefined)).toBe(0);
    });
  });

  describe('formatCost', () => {
    it('should format cost with currency', () => {
      const formatted = AICostCalculator.formatCost(0.00123);
      expect(formatted).toBe('$0.001230');
    });

    it('should format cost without currency', () => {
      const formatted = AICostCalculator.formatCost(0.00123, false);
      expect(formatted).toBe('0.001230');
    });
  });

  describe('estimateRequestCost', () => {
    it('should estimate request cost', () => {
      const estimate = AICostCalculator.estimateRequestCost({
        provider: 'openai',
        model: 'gpt-4o',
        promptText: 'Hello, how are you?',
        estimatedResponseTokens: 100
      });

      expect(estimate.estimatedPromptTokens).toBeGreaterThan(0);
      expect(estimate.estimatedCompletionTokens).toBe(100);
      expect(estimate.estimatedCost).toBeGreaterThanOrEqual(0);
      expect(estimate.formattedCost).toMatch(/^\$/);
    });

    it('should use default response tokens', () => {
      const estimate = AICostCalculator.estimateRequestCost({
        provider: 'openai',
        model: 'gpt-4o',
        promptText: 'Hello'
      });

      expect(estimate.estimatedCompletionTokens).toBe(500);
    });
  });

  describe('getAllPricing', () => {
    it('should return all pricing', () => {
      const pricing = AICostCalculator.getAllPricing();

      expect(pricing).toBeDefined();
      expect(pricing.openai).toBeDefined();
      expect(pricing.claude).toBeDefined();
    });
  });

  describe('compareModelCosts', () => {
    it('should compare costs between models', () => {
      const comparisons = AICostCalculator.compareModelCosts({
        promptText: 'Hello, how are you?',
        estimatedResponseTokens: 100
      });

      expect(Array.isArray(comparisons)).toBe(true);
      expect(comparisons.length).toBeGreaterThan(0);

      // Should be sorted by cost (cheapest first)
      for (let i = 1; i < comparisons.length; i++) {
        expect(comparisons[i].estimatedCost).toBeGreaterThanOrEqual(comparisons[i - 1].estimatedCost);
      }
    });

    it('should use default response tokens', () => {
      const comparisons = AICostCalculator.compareModelCosts({
        promptText: 'Hello'
      });

      expect(comparisons[0].estimatedCompletionTokens).toBe(500);
    });
  });
});
