/**
 * ABTestsOverviewPage
 * Overview dashboard for all A/B tests with analytics
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Download,
  Filter,
  Calendar,
  RefreshCw,
  ChevronRight,
  BarChart2,
  TrendingUp,
  Trophy,
  Eye
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useABTestsAnalytics, useAnalyticsExport } from '../../hooks/ab-tests';
import {
  ABTestSummaryCards,
  ABTestTimelineChart,
  ABTestComparisonChart,
  VariantPerformanceTable
} from '../../components/ab-tests/analytics';

// Period options
const PERIOD_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' }
];

// Status options
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Tests' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' }
];

/**
 * Test card component
 */
function TestCard({ test, onClick }) {
  const { t } = useTranslation();

  const status = test.status || 'running';
  const statusColors = {
    running: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    completed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    paused: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    draft: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
  };

  const conversionRate = test.impressions > 0
    ? ((test.conversions / test.impressions) * 100).toFixed(2)
    : '0.00';

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">
            {test.name}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {test.description || t('abTests.noDescription', 'No description')}
          </p>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status]}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('abTests.impressions', 'Impressions')}
          </div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {(test.impressions || 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('abTests.conversions', 'Conversions')}
          </div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {(test.conversions || 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('abTests.convRate', 'Conv. Rate')}
          </div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {conversionRate}%
          </div>
        </div>
      </div>

      {test.winner && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-amber-700 dark:text-amber-400">
            {t('abTests.winnerIs', 'Winner')}: Variant {test.winner}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-slate-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {test.variants?.length || 2} {t('abTests.variants', 'variants')}
        </div>
        <button className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
          {t('abTests.viewDetails', 'View Details')}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * ABTestsOverviewPage Component
 */
export default function ABTestsOverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  // Filters
  const [period, setPeriod] = useState('30d');
  const [status, setStatus] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });

  // Fetch analytics
  const {
    data,
    summary,
    comparison,
    tests,
    timeline,
    loading,
    error,
    refetch
  } = useABTestsAnalytics({
    workspaceId,
    period,
    status,
    startDate: customDateRange.start,
    endDate: customDateRange.end
  });

  // Export
  const { exportToCSV, exportToPDF, exporting } = useAnalyticsExport();

  // Calculate top performers
  const topPerformers = useMemo(() => {
    if (!tests || tests.length === 0) return [];

    return [...tests]
      .filter(t => t.impressions > 0)
      .sort((a, b) => {
        const rateA = a.conversions / a.impressions;
        const rateB = b.conversions / b.impressions;
        return rateB - rateA;
      })
      .slice(0, 5);
  }, [tests]);

  // Handle export
  const handleExport = async (format) => {
    if (format === 'csv') {
      await exportToCSV({ workspaceId, period });
    } else {
      await exportToPDF({ workspaceId, period });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('abTests.analyticsOverview', 'A/B Testing Analytics')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t('abTests.overviewDescription', 'Monitor and analyze your A/B test performance')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refetch}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="relative group">
              <button
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <Download className="w-4 h-4" />
                {t('common.export', 'Export')}
              </button>
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  {t('common.exportCSV', 'Export as CSV')}
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={exporting}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  {t('common.exportPDF', 'Export as PDF')}
                </button>
              </div>
            </div>

            <button
              onClick={() => navigate('/ab-tests/new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              {t('abTests.newTest', 'New Test')}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
            >
              {PERIOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Custom date range */}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customDateRange.start?.toISOString().split('T')[0] || ''}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customDateRange.end?.toISOString().split('T')[0] || ''}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Summary Cards */}
        <ABTestSummaryCards
          runningTests={summary?.runningTests || 0}
          totalImpressions={summary?.totalImpressions || 0}
          avgConversionRate={summary?.avgConversionRate || 0}
          testsWithWinners={summary?.testsWithWinners || 0}
          comparison={comparison}
          loading={loading}
        />

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Timeline Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-500" />
                {t('abTests.performanceOverTime', 'Performance Over Time')}
              </h3>
            </div>
            <ABTestTimelineChart
              data={timeline}
              height={300}
              metric="conversionRate"
            />
          </div>

          {/* Top Performers */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                {t('abTests.topPerformers', 'Top Performing Tests')}
              </h3>
            </div>
            <div className="space-y-4">
              {topPerformers.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {t('abTests.noTestsYet', 'No tests with data yet')}
                </p>
              ) : (
                topPerformers.map((test, index) => {
                  const rate = ((test.conversions / test.impressions) * 100).toFixed(2);
                  return (
                    <div
                      key={test.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
                      onClick={() => navigate(`/ab-tests/${test.id}/results`)}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        index === 0
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {test.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {test.impressions.toLocaleString()} impressions
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600 dark:text-green-400">
                          {rate}%
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          conv. rate
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Tests List */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('abTests.allTests', 'All Tests')}
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {tests.length} {t('abTests.tests', 'tests')}
            </span>
          </div>

          {tests.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('abTests.noTests', 'No A/B tests yet')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {t('abTests.createFirstTest', 'Create your first A/B test to start optimizing')}
              </p>
              <button
                onClick={() => navigate('/ab-tests/new')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                {t('abTests.createTest', 'Create Test')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tests.map(test => (
                <TestCard
                  key={test.id}
                  test={test}
                  onClick={() => navigate(`/ab-tests/${test.id}/results`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
