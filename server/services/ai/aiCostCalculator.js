/**
 * AI Cost Calculator
 * Calculates costs for AI API usage based on token consumption
 */
class AICostCalculator {
  /**
   * Pricing per 1M tokens (in USD)
   * Updated as of January 2025
   */
  static PRICING = {
    openai: {
      'gpt-4o': {
        input: 2.50,
        output: 10.00
      },
      'gpt-4o-mini': {
        input: 0.150,
        output: 0.600
      },
      'gpt-4-turbo': {
        input: 10.00,
        output: 30.00
      },
      'gpt-4': {
        input: 30.00,
        output: 60.00
      },
      'gpt-3.5-turbo': {
        input: 0.50,
        output: 1.50
      }
    },
    claude: {
      'claude-3-5-sonnet-20241022': {
        input: 3.00,
        output: 15.00
      },
      'claude-3-5-haiku-20241022': {
        input: 0.80,
        output: 4.00
      },
      'claude-3-opus-20240229': {
        input: 15.00,
        output: 75.00
      },
      'claude-3-sonnet-20240229': {
        input: 3.00,
        output: 15.00
      },
      'claude-3-haiku-20240307': {
        input: 0.25,
        output: 1.25
      }
    }
  };

  /**
   * Calculate cost for a single API call
   * @param {Object} params - Parameters
   * @param {string} params.provider - Provider name ('openai' or 'claude')
   * @param {string} params.model - Model identifier
   * @param {number} params.promptTokens - Input tokens used
   * @param {number} params.completionTokens - Output tokens used
   * @returns {number} Cost in USD
   */
  static calculateCost(params) {
    const { provider, model, promptTokens, completionTokens } = params;

    if (!provider || !model) {
      console.warn('Provider and model are required for cost calculation');
      return 0;
    }

    const providerPricing = this.PRICING[provider.toLowerCase()];

    if (!providerPricing) {
      console.warn(`Unknown provider: ${provider}`);
      return 0;
    }

    const modelPricing = providerPricing[model];

    if (!modelPricing) {
      console.warn(`Unknown model for ${provider}: ${model}`);
      // Try to find a default/fallback pricing
      return this.estimateCost(provider, promptTokens, completionTokens);
    }

    // Calculate cost: (tokens / 1,000,000) * price_per_million
    const inputCost = (promptTokens / 1000000) * modelPricing.input;
    const outputCost = (completionTokens / 1000000) * modelPricing.output;

    return inputCost + outputCost;
  }

  /**
   * Estimate cost when exact model pricing is unknown
   * Uses average pricing for the provider
   * @param {string} provider - Provider name
   * @param {number} promptTokens - Input tokens
   * @param {number} completionTokens - Output tokens
   * @returns {number} Estimated cost in USD
   */
  static estimateCost(provider, promptTokens, completionTokens) {
    // Default fallback pricing (conservative estimates)
    const fallbackPricing = {
      openai: { input: 5.00, output: 15.00 },
      claude: { input: 5.00, output: 20.00 }
    };

    const pricing = fallbackPricing[provider.toLowerCase()] || fallbackPricing.openai;

    const inputCost = (promptTokens / 1000000) * pricing.input;
    const outputCost = (completionTokens / 1000000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Get pricing information for a model
   * @param {string} provider - Provider name
   * @param {string} model - Model identifier
   * @returns {Object|null} Pricing info or null
   */
  static getPricing(provider, model) {
    const providerPricing = this.PRICING[provider.toLowerCase()];

    if (!providerPricing) return null;

    return providerPricing[model] || null;
  }

  /**
   * Calculate total cost from multiple usage logs
   * @param {Array} usageLogs - Array of usage log objects
   * @returns {Object} Cost breakdown
   */
  static calculateTotalCost(usageLogs) {
    let totalCost = 0;
    let totalTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    const breakdown = {
      openai: 0,
      claude: 0
    };

    for (const log of usageLogs) {
      const cost = parseFloat(log.cost_usd) || 0;
      totalCost += cost;
      totalTokens += log.total_tokens || 0;
      totalPromptTokens += log.prompt_tokens || 0;
      totalCompletionTokens += log.completion_tokens || 0;

      const provider = log.provider.toLowerCase();
      if (breakdown[provider] !== undefined) {
        breakdown[provider] += cost;
      }
    }

    return {
      totalCost: parseFloat(totalCost.toFixed(6)),
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      breakdown,
      averageCostPerRequest: usageLogs.length > 0 ? parseFloat((totalCost / usageLogs.length).toFixed(6)) : 0
    };
  }

  /**
   * Estimate tokens from text (rough approximation)
   * Rule of thumb: 1 token ≈ 4 characters for English text
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  static estimateTokens(text) {
    if (!text) return 0;

    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Format cost for display
   * @param {number} cost - Cost in USD
   * @param {boolean} showCurrency - Include currency symbol
   * @returns {string} Formatted cost
   */
  static formatCost(cost, showCurrency = true) {
    const formatted = cost.toFixed(6);

    if (showCurrency) {
      return `$${formatted}`;
    }

    return formatted;
  }

  /**
   * Calculate cost for estimated usage
   * Useful for displaying costs before making API call
   * @param {Object} params - Parameters
   * @param {string} params.provider - Provider name
   * @param {string} params.model - Model identifier
   * @param {string} params.promptText - Prompt text to estimate
   * @param {number} params.estimatedResponseTokens - Expected response length
   * @returns {Object} Estimated cost breakdown
   */
  static estimateRequestCost(params) {
    const {
      provider,
      model,
      promptText,
      estimatedResponseTokens = 500
    } = params;

    const promptTokens = this.estimateTokens(promptText);
    const completionTokens = estimatedResponseTokens;

    const cost = this.calculateCost({
      provider,
      model,
      promptTokens,
      completionTokens
    });

    return {
      estimatedPromptTokens: promptTokens,
      estimatedCompletionTokens: completionTokens,
      estimatedTotalTokens: promptTokens + completionTokens,
      estimatedCost: parseFloat(cost.toFixed(6)),
      formattedCost: this.formatCost(cost)
    };
  }

  /**
   * Get all available pricing for display
   * @returns {Object} Complete pricing structure
   */
  static getAllPricing() {
    return this.PRICING;
  }

  /**
   * Compare costs between different models
   * @param {Object} params - Parameters
   * @param {string} params.promptText - Prompt text
   * @param {number} params.estimatedResponseTokens - Expected response tokens
   * @returns {Array} Array of cost comparisons
   */
  static compareModelCosts(params) {
    const { promptText, estimatedResponseTokens = 500 } = params;
    const comparisons = [];

    for (const [provider, models] of Object.entries(this.PRICING)) {
      for (const [model, pricing] of Object.entries(models)) {
        const estimate = this.estimateRequestCost({
          provider,
          model,
          promptText,
          estimatedResponseTokens
        });

        comparisons.push({
          provider,
          model,
          ...estimate
        });
      }
    }

    // Sort by cost (cheapest first)
    return comparisons.sort((a, b) => a.estimatedCost - b.estimatedCost);
  }
}

module.exports = AICostCalculator;
