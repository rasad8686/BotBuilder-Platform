import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

const ABTestResults = ({ testId, onClose, onRefresh }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchResults();
    // Auto-refresh every 30 seconds for running tests
    const interval = setInterval(() => {
      if (results?.test?.status === 'running') {
        fetchResults();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [testId]);

  const fetchResults = async () => {
    try {
      const response = await api.get(`/api/email/ab-tests/${testId}/results`);
      setResults(response.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/email/ab-tests/${testId}/start`);
      await fetchResults();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopTest = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/email/ab-tests/${testId}/stop`);
      await fetchResults();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectWinner = async (variantId) => {
    if (!confirm(t('email.abTest.confirmSelectWinner', 'Are you sure you want to select this variant as the winner?'))) {
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/api/email/ab-tests/${testId}/select-winner`, { variantId });
      await fetchResults();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDetermineWinner = async () => {
    setActionLoading(true);
    try {
      await api.post(`/api/email/ab-tests/${testId}/determine-winner`);
      await fetchResults();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendWinner = async () => {
    if (!confirm(t('email.abTest.confirmSendWinner', 'Send the winning variant to the remaining audience?'))) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await api.post(`/api/email/ab-tests/${testId}/send-winner`);
      alert(t('email.abTest.winnerSent', `Winner sent to ${response.data.data.sent_count} contacts`));
      await fetchResults();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: t('email.abTest.status.draft', 'Draft') },
      running: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: t('email.abTest.status.running', 'Running') },
      paused: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: t('email.abTest.status.paused', 'Paused') },
      completed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: t('email.abTest.status.completed', 'Completed') },
      cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: t('email.abTest.status.cancelled', 'Cancelled') }
    };

    const config = statusConfig[status] || statusConfig.draft;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getMetricColor = (variant, metric, allVariants) => {
    const values = allVariants.map(v => parseFloat(v.metrics[metric]) || 0);
    const maxValue = Math.max(...values);
    const variantValue = parseFloat(variant.metrics[metric]) || 0;

    if (variantValue === maxValue && maxValue > 0) {
      return 'text-green-600 dark:text-green-400 font-semibold';
    }
    return 'text-gray-900 dark:text-white';
  };

  const renderComparisonChart = () => {
    if (!results?.variants) return null;

    const metrics = [
      { key: 'open_rate', label: t('email.metrics.openRate', 'Open Rate'), color: 'bg-blue-500' },
      { key: 'click_rate', label: t('email.metrics.clickRate', 'Click Rate'), color: 'bg-purple-500' },
      { key: 'conversion_rate', label: t('email.metrics.conversionRate', 'Conversion Rate'), color: 'bg-green-500' }
    ];

    return (
      <div className="grid grid-cols-3 gap-6">
        {metrics.map(metric => {
          const maxValue = Math.max(...results.variants.map(v => parseFloat(v.metrics[metric.key]) || 0), 1);

          return (
            <div key={metric.key} className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                {metric.label}
              </h4>
              <div className="space-y-2">
                {results.variants.map(variant => {
                  const value = parseFloat(variant.metrics[metric.key]) || 0;
                  const width = (value / maxValue) * 100;

                  return (
                    <div key={variant.id} className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        variant.is_control ? 'bg-blue-500' : 'bg-purple-500'
                      }`}>
                        {variant.name}
                      </span>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-full ${metric.color} transition-all duration-500`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-14 text-right">
                        {value}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderConfidenceIndicator = (variant) => {
    const confidence = variant.confidence_score || 0;
    let color, label;

    if (confidence >= 95) {
      color = 'text-green-500';
      label = t('email.abTest.confidence.high', 'High Confidence');
    } else if (confidence >= 80) {
      color = 'text-yellow-500';
      label = t('email.abTest.confidence.medium', 'Medium Confidence');
    } else {
      color = 'text-gray-400';
      label = t('email.abTest.confidence.low', 'Low Confidence');
    }

    return (
      <div className="flex items-center gap-2">
        <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              confidence >= 95 ? 'bg-green-500' :
              confidence >= 80 ? 'bg-yellow-500' : 'bg-gray-400'
            }`}
            style={{ width: `${confidence}%` }}
          />
        </div>
        <span className={`text-xs ${color}`}>{confidence.toFixed(0)}%</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="text-center text-red-500">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>{error}</p>
          <button
            onClick={fetchResults}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {results?.test?.name || t('email.abTest.results', 'A/B Test Results')}
            </h2>
            {getStatusBadge(results?.test?.status)}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('email.abTest.winnerBy', 'Winner determined by')}: {results?.test?.winner_criteria?.replace('_', ' ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchResults}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title={t('common.refresh', 'Refresh')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('email.metrics.sent', 'Total Sent')}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{results?.summary?.total_sent?.toLocaleString()}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('email.metrics.delivered', 'Delivered')}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{results?.summary?.total_delivered?.toLocaleString()}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('email.metrics.avgOpenRate', 'Avg Open Rate')}</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{results?.summary?.avg_open_rate}%</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('email.metrics.avgClickRate', 'Avg Click Rate')}</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{results?.summary?.avg_click_rate}%</div>
          </div>
        </div>

        {/* Winner Banner */}
        {results?.winner && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-green-800 dark:text-green-300">
                    {t('email.abTest.winnerIs', 'Winner')}: {t('email.abTest.variant', 'Variant')} {results.winner.name}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">
                    {results.winner.uplift > 0 ? '+' : ''}{results.winner.uplift}% {t('email.abTest.uplift', 'uplift')} |
                    {results.winner.confidence}% {t('email.abTest.confidence', 'confidence')}
                    {results.winner.statistically_significant && (
                      <span className="ml-2 text-green-700 dark:text-green-300 font-medium">
                        ({t('email.abTest.statisticallySignificant', 'Statistically Significant')})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {results.test.status === 'completed' && (
                <button
                  onClick={handleSendWinner}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  {t('email.abTest.sendToRest', 'Send to Rest')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {results?.recommendation && !results?.winner && (
          <div className={`border rounded-lg p-4 ${
            results.recommendation.action === 'SELECT_WINNER'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          }`}>
            <div className="flex items-center gap-3">
              <svg className={`w-5 h-5 ${
                results.recommendation.action === 'SELECT_WINNER'
                  ? 'text-blue-500'
                  : 'text-yellow-500'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {results.recommendation.message}
              </span>
            </div>
          </div>
        )}

        {/* Comparison Chart */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {t('email.abTest.variantComparison', 'Variant Comparison')}
          </h3>
          {renderComparisonChart()}
        </div>

        {/* Detailed Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('email.abTest.variant', 'Variant')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('email.metrics.sent', 'Sent')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('email.metrics.openRate', 'Open Rate')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('email.metrics.clickRate', 'Click Rate')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('email.metrics.ctr', 'CTR')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('email.metrics.conversions', 'Conversions')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('email.abTest.confidence', 'Confidence')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {results?.variants?.map(variant => (
                <tr key={variant.id} className={variant.is_winner ? 'bg-green-50 dark:bg-green-900/10' : ''}>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        variant.is_control ? 'bg-blue-500' : 'bg-purple-500'
                      }`}>
                        {variant.name}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{variant.label}</div>
                        {variant.is_control && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            {t('email.abTest.control', 'Control')}
                          </span>
                        )}
                        {variant.is_winner && (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {t('email.abTest.winner', 'Winner')}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-gray-900 dark:text-white">
                    {variant.metrics.sent.toLocaleString()}
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-right ${getMetricColor(variant, 'open_rate', results.variants)}`}>
                    {variant.metrics.open_rate}%
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-right ${getMetricColor(variant, 'click_rate', results.variants)}`}>
                    {variant.metrics.click_rate}%
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-right ${getMetricColor(variant, 'ctr', results.variants)}`}>
                    {variant.metrics.ctr}%
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-gray-900 dark:text-white">
                    {variant.metrics.conversions}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {renderConfidenceIndicator(variant)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    {!results.winner && results.test.status !== 'draft' && (
                      <button
                        onClick={() => handleSelectWinner(variant.id)}
                        disabled={actionLoading}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {t('email.abTest.selectAsWinner', 'Select Winner')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-gray-700">
          {results?.test?.status === 'draft' && (
            <button
              onClick={handleStartTest}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('email.abTest.startTest', 'Start Test')}
            </button>
          )}

          {results?.test?.status === 'running' && (
            <>
              <button
                onClick={handleStopTest}
                disabled={actionLoading}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('email.abTest.stopTest', 'Stop Test')}
              </button>
              <button
                onClick={handleDetermineWinner}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('email.abTest.determineWinner', 'Determine Winner Now')}
              </button>
            </>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              {t('common.close', 'Close')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ABTestResults;
