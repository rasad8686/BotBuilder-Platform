module.exports = {
  tiers: {
    free: { requestPrice: 0, includedRequests: 1000 },
    pro: { requestPrice: 0.001, includedRequests: 10000 },
    enterprise: { requestPrice: 0.0005, includedRequests: 100000 }
  },
  aiModels: {
    'gpt-4': { inputTokenPrice: 0.00003, outputTokenPrice: 0.00006 },
    'gpt-3.5': { inputTokenPrice: 0.000001, outputTokenPrice: 0.000002 },
    'claude-3': { inputTokenPrice: 0.000015, outputTokenPrice: 0.000075 }
  }
};
