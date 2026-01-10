import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CostCalculator() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState(null);
  const [currentUsage, setCurrentUsage] = useState(null);

  // Calculator inputs
  const [requests, setRequests] = useState(5000);
  const [tokensPerRequest, setTokensPerRequest] = useState(500);
  const [selectedModel, setSelectedModel] = useState('gpt-3.5');
  const [selectedTier, setSelectedTier] = useState('free');

  // Calculated results
  const [calculation, setCalculation] = useState(null);
  const [recommendation, setRecommendation] = useState(null);

  const token = localStorage.getItem('token');

  // Fetch pricing config
  const fetchPricing = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/billing/pricing`);
      if (res.ok) {
        const data = await res.json();
        setPricing(data.pricing);
      }
    } catch (err) {
      // Use default pricing
      setPricing({
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
      });
    }
  }, []);

  // Fetch current usage
  const fetchCurrentUsage = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/billing/current-period`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUsage(data.currentPeriod);
        if (data.currentPeriod?.tier) {
          setSelectedTier(data.currentPeriod.tier);
        }
      }
    } catch (err) {
      // Use mock data
      setCurrentUsage({
        totalCost: 12.50,
        requestCount: 3500,
        tokenCount: 525000,
        projectedMonthEnd: 25.00,
        tier: 'pro'
      });
    }
  }, [token]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPricing(), fetchCurrentUsage()]);
      setLoading(false);
    };
    loadData();
  }, [fetchPricing, fetchCurrentUsage]);

  // Calculate cost when inputs change
  useEffect(() => {
    if (!pricing) return;

    const totalTokens = requests * tokensPerRequest;
    const tierPricing = pricing.tiers[selectedTier];
    const modelPricing = pricing.aiModels[selectedModel];

    // Request cost
    const billableRequests = Math.max(0, requests - tierPricing.includedRequests);
    const requestCost = billableRequests * tierPricing.requestPrice;

    // Token cost (50% input, 50% output)
    const inputTokens = Math.floor(totalTokens * 0.5);
    const outputTokens = Math.ceil(totalTokens * 0.5);
    const tokenCost = (inputTokens * modelPricing.inputTokenPrice) + (outputTokens * modelPricing.outputTokenPrice);

    const totalCost = requestCost + tokenCost;

    setCalculation({
      totalCost: Math.round(totalCost * 100) / 100,
      requestCost: Math.round(requestCost * 100) / 100,
      tokenCost: Math.round(tokenCost * 100) / 100,
      billableRequests,
      includedRequests: tierPricing.includedRequests,
      totalTokens
    });

    // Generate recommendation
    generateRecommendation(requests, totalCost, pricing);
  }, [requests, tokensPerRequest, selectedModel, selectedTier, pricing]);

  const generateRecommendation = (reqCount, currentCost, pricingConfig) => {
    if (!pricingConfig) return;

    const recommendations = [];

    // Check if upgrading would save money
    Object.entries(pricingConfig.tiers).forEach(([tierName, tierConfig]) => {
      if (tierName === selectedTier) return;

      const billable = Math.max(0, reqCount - tierConfig.includedRequests);
      const tierCost = billable * tierConfig.requestPrice;

      // Add base subscription cost
      const subscriptionCost = tierName === 'pro' ? 29 : tierName === 'enterprise' ? 99 : 0;
      const totalTierCost = tierCost + subscriptionCost;

      const currentSubscription = selectedTier === 'pro' ? 29 : selectedTier === 'enterprise' ? 99 : 0;
      const currentTotal = currentCost + currentSubscription;

      if (totalTierCost < currentTotal) {
        const savings = currentTotal - totalTierCost;
        const savingsPercent = Math.round((savings / currentTotal) * 100);
        recommendations.push({
          tier: tierName,
          savings: Math.round(savings * 100) / 100,
          savingsPercent,
          message: `${tierName.charAt(0).toUpperCase() + tierName.slice(1)}-a keç, ${savingsPercent}% qənaət et`
        });
      }
    });

    // Sort by savings
    recommendations.sort((a, b) => b.savings - a.savings);
    setRecommendation(recommendations[0] || null);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatCurrency = (num) => {
    return `$${num.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('billing.costCalculator', 'Cost Calculator')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('billing.costCalculatorDesc', 'Estimate your monthly costs based on expected usage')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calculator Inputs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              {t('billing.usageEstimate', 'Usage Estimate')}
            </h2>

            {/* Monthly Requests Slider */}
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('billing.monthlyRequests', 'Monthly Requests')}
                </label>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {formatNumber(requests)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="200000"
                step="1000"
                value={requests}
                onChange={(e) => setRequests(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>0</span>
                <span>50K</span>
                <span>100K</span>
                <span>150K</span>
                <span>200K</span>
              </div>
            </div>

            {/* Tokens Per Request Slider */}
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('billing.tokensPerRequest', 'Avg. Tokens per Request')}
                </label>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {formatNumber(tokensPerRequest)}
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="4000"
                step="100"
                value={tokensPerRequest}
                onChange={(e) => setTokensPerRequest(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>100</span>
                <span>1K</span>
                <span>2K</span>
                <span>3K</span>
                <span>4K</span>
              </div>
            </div>

            {/* Model Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('billing.aiModel', 'AI Model')}
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {pricing && Object.keys(pricing.aiModels).map(model => (
                  <option key={model} value={model}>
                    {model.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Tier Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('billing.pricingTier', 'Pricing Tier')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {pricing && Object.keys(pricing.tiers).map(tier => (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      selectedTier === tier
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-6">
            {/* Estimated Cost Card */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
              <h2 className="text-lg font-medium mb-2 opacity-90">
                {t('billing.estimatedMonthlyCost', 'Estimated Monthly Cost')}
              </h2>
              <div className="text-4xl font-bold mb-4">
                {calculation ? formatCurrency(calculation.totalCost) : '$0.00'}
              </div>

              {calculation && (
                <div className="space-y-2 text-sm opacity-80">
                  <div className="flex justify-between">
                    <span>{t('billing.requestCost', 'Request Cost')}</span>
                    <span>{formatCurrency(calculation.requestCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('billing.tokenCost', 'Token Cost')}</span>
                    <span>{formatCurrency(calculation.tokenCost)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/20">
                    <span>{t('billing.includedRequests', 'Included Requests')}</span>
                    <span>{formatNumber(calculation.includedRequests)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('billing.billableRequests', 'Billable Requests')}</span>
                    <span>{formatNumber(calculation.billableRequests)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Current Usage Comparison */}
            {currentUsage && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t('billing.currentUsage', 'Your Current Usage')}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('billing.currentPeriodCost', 'Current Period Cost')}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(currentUsage.totalCost)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('billing.projectedMonthEnd', 'Projected Month-End')}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(currentUsage.projectedMonthEnd)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('billing.requestsThisMonth', 'Requests This Month')}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatNumber(currentUsage.requestCount)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendation */}
            {recommendation && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-800 dark:text-green-200 mb-1">
                      {t('billing.recommendation', 'Recommendation')}
                    </h4>
                    <p className="text-green-700 dark:text-green-300 text-sm mb-3">
                      {recommendation.message}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(recommendation.savings)}/ay
                      </span>
                      <button
                        onClick={() => navigate('/billing')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        {t('billing.upgradePlan', 'Upgrade Plan')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Breakdown Table */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('billing.pricingBreakdown', 'Pricing Breakdown')}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                    {t('billing.tier', 'Tier')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                    {t('billing.includedRequests', 'Included Requests')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                    {t('billing.pricePerRequest', 'Price/Request')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                    {t('billing.basePrice', 'Base Price')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pricing && Object.entries(pricing.tiers).map(([tier, config]) => (
                  <tr key={tier} className={selectedTier === tier ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {tier}
                      {selectedTier === tier && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full">
                          Current
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {formatNumber(config.includedRequests)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      ${config.requestPrice}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {tier === 'free' ? 'Free' : tier === 'pro' ? '$29/mo' : '$99/mo'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
