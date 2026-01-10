/**
 * TourAnalyticsPage - Comprehensive Analytics Dashboard for Product Tours
 * FAZ 4: Analytics Dashboard implementation
 */

import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  Filter,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Input';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import { useTourQuery, useTourAnalyticsQuery } from '../../hooks/useTours';
import { useTourAnalytics } from '../../hooks/tours/useTourAnalytics';
import { useAnalyticsExport } from '../../hooks/tours/useAnalyticsExport';
import { useRealtimeAnalytics } from '../../hooks/tours/useRealtimeAnalytics';

// Analytics Components
import TourFunnelChart from '../../components/tours/analytics/TourFunnelChart';
import TourCompletionChart from '../../components/tours/analytics/TourCompletionChart';
import TourStepsBreakdown from '../../components/tours/analytics/TourStepsBreakdown';
import TourHeatmap from '../../components/tours/analytics/TourHeatmap';
import ComparisonWidget from '../../components/tours/analytics/ComparisonWidget';

export default function TourAnalyticsPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  // State
  const [dateRange, setDateRange] = useState('30d');
  const [showComparison, setShowComparison] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, steps, heatmap

  // Queries
  const { data: tour, isLoading: tourLoading } = useTourQuery(id);
  const { data: analytics, isLoading: analyticsLoading, refetch } = useTourAnalytics(id, dateRange);

  // Export functionality
  const { exportCSV, exportPDF, isExporting } = useAnalyticsExport();

  // Real-time analytics (optional)
  const { liveData, isConnected, activeTours, resetCounters } = useRealtimeAnalytics({
    tourId: id,
    enabled: true
  });

  const isLoading = tourLoading || analyticsLoading;

  // Date range options
  const dateRangeOptions = [
    { value: '7d', label: t('analytics.last7d', 'Last 7 Days') },
    { value: '30d', label: t('analytics.last30d', 'Last 30 Days') },
    { value: '90d', label: t('analytics.last90d', 'Last 90 Days') }
  ];

  // Calculate date params for export
  const getDateParams = useCallback(() => {
    const end = new Date();
    const start = new Date();
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    start.setDate(start.getDate() - days);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }, [dateRange]);

  // Handle export
  const handleExport = useCallback(async (format) => {
    const { startDate, endDate } = getDateParams();

    if (format === 'csv') {
      await exportCSV({
        tourId: id,
        startDate,
        endDate,
        localData: {
          tours: tour ? [{ ...tour, ...analytics }] : [],
          daily: analytics?.timeline || [],
          steps: analytics?.steps || []
        }
      });
    } else {
      await exportPDF({
        tourId: id,
        startDate,
        endDate,
        localData: {
          summary: analytics,
          topTours: tour ? [tour] : []
        }
      });
    }
  }, [id, analytics, tour, getDateParams, exportCSV, exportPDF]);

  // Previous period data for comparison
  const previousPeriodData = useMemo(() => {
    if (!analytics?.trends) return {};
    return {
      impressions: analytics.impressions / (1 + analytics.trends.impressions / 100) || 0,
      starts: analytics.starts / (1 + analytics.trends.starts / 100) || 0,
      completions: analytics.completions / (1 + analytics.trends.completions / 100) || 0,
      completionRate: analytics.rate / (1 + analytics.trends.rate / 100) || 0,
      avgTime: analytics.avgTimeSeconds || 0
    };
  }, [analytics]);

  if (isLoading) {
    return <LoadingState title={t('analytics.loading', 'Loading analytics...')} fullPage />;
  }

  if (!tour) {
    return (
      <ErrorState
        title={t('tours.notFound', 'Tour not found')}
        description={t('tours.notFoundDesc', 'The tour you are looking for does not exist.')}
        onRetry={() => navigate('/tours')}
        retryText={t('tours.backToList', 'Back to Tours')}
        fullPage
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/tours')}
          >
            {t('common.back', 'Back')}
          </Button>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {tour.name}
              </h1>
              <Badge variant={tour.status === 'active' ? 'success' : tour.status === 'paused' ? 'warning' : 'default'}>
                {tour.status}
              </Badge>
              {/* Real-time indicator */}
              <div className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-gray-400'}`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? t('analytics.live', 'Live') : t('analytics.offline', 'Offline')}
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
              <BarChart3 className="w-4 h-4" />
              {t('tours.analyticsTitle', 'Tour Analytics')}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            options={dateRangeOptions}
            className="w-40"
          />

          <Button
            variant={showComparison ? 'secondary' : 'outline'}
            size="sm"
            icon={Activity}
            onClick={() => setShowComparison(!showComparison)}
          >
            {t('analytics.compare', 'Compare')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={() => {
              refetch();
              resetCounters();
            }}
          >
            {t('common.refresh', 'Refresh')}
          </Button>

          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              loading={isExporting}
              onClick={() => handleExport('csv')}
            >
              {t('analytics.export', 'Export')}
            </Button>
          </div>
        </div>
      </div>

      {/* Live Stats Banner (if connected) */}
      {isConnected && (liveData.impressions > 0 || liveData.starts > 0) && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                {t('analytics.liveUpdates', 'Live Updates')}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-700 dark:text-green-300">
                +{liveData.impressions} {t('analytics.impressions', 'impressions')}
              </span>
              <span className="text-green-700 dark:text-green-300">
                +{liveData.starts} {t('analytics.starts', 'starts')}
              </span>
              <span className="text-green-700 dark:text-green-300">
                +{liveData.completions} {t('analytics.completions', 'completions')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard
          title={t('analytics.impressions', 'Impressions')}
          value={(analytics?.impressions || 0) + liveData.impressions}
          icon={Eye}
          color="blue"
          trend={analytics?.trends?.impressions}
          trendLabel={t('analytics.vsPrevious', 'vs previous period')}
        />
        <SummaryCard
          title={t('analytics.started', 'Tours Started')}
          value={(analytics?.starts || 0) + liveData.starts}
          icon={Users}
          color="purple"
          trend={analytics?.trends?.starts}
          trendLabel={t('analytics.vsPrevious', 'vs previous period')}
        />
        <SummaryCard
          title={t('analytics.completed', 'Completed')}
          value={(analytics?.completions || 0) + liveData.completions}
          icon={CheckCircle}
          color="green"
          trend={analytics?.trends?.completions}
          trendLabel={t('analytics.vsPrevious', 'vs previous period')}
        />
        <SummaryCard
          title={t('analytics.completionRate', 'Completion Rate')}
          value={`${analytics?.rate || 0}%`}
          icon={TrendingUp}
          color="emerald"
          trend={analytics?.trends?.rate}
          trendLabel={t('analytics.vsPrevious', 'vs previous period')}
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="flex gap-4">
          {[
            { key: 'overview', label: t('analytics.overview', 'Overview') },
            { key: 'steps', label: t('analytics.steps', 'Steps Analysis') },
            { key: 'heatmap', label: t('analytics.activity', 'Activity') }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Completion Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.completionTrend', 'Completion Trend')}</CardTitle>
              </CardHeader>
              <CardContent>
                <TourCompletionChart
                  data={analytics?.timeline || []}
                  height={280}
                  chartType="area"
                  metrics={['completions', 'starts']}
                  showComparison={showComparison}
                />
              </CardContent>
            </Card>

            {/* Funnel Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.conversionFunnel', 'Conversion Funnel')}</CardTitle>
              </CardHeader>
              <CardContent>
                <TourFunnelChart
                  impressions={analytics?.funnel?.impressions || analytics?.impressions || 0}
                  started={analytics?.funnel?.started || analytics?.starts || 0}
                  completed={analytics?.funnel?.completed || analytics?.completions || 0}
                  stepViews={analytics?.funnel?.stepViews}
                  height={280}
                />
              </CardContent>
            </Card>
          </div>

          {/* Comparison Widget */}
          {showComparison && (
            <ComparisonWidget
              current={{
                impressions: analytics?.impressions || 0,
                starts: analytics?.starts || 0,
                completions: analytics?.completions || 0,
                completionRate: analytics?.rate || 0,
                avgTime: analytics?.avgTimeSeconds || 0
              }}
              previous={previousPeriodData}
              currentLabel={t('analytics.thisPeriod', 'This Period')}
              previousLabel={t('analytics.previousPeriod', 'Previous Period')}
            />
          )}

          {/* Time Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.timeMetrics', 'Time Metrics')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <Clock className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatDuration(analytics?.avgTimeSeconds || 0)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('analytics.avgTime', 'Avg. Completion Time')}
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {analytics?.starts > 0
                      ? (((analytics.starts - analytics.completions) / analytics.starts) * 100).toFixed(1)
                      : 0}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('analytics.dropoffRate', 'Drop-off Rate')}
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <Eye className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {analytics?.impressions > 0
                      ? ((analytics.starts / analytics.impressions) * 100).toFixed(1)
                      : 0}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('analytics.engagementRate', 'Engagement Rate')}
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <Users className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {activeTours.length}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {t('analytics.activeNow', 'Active Now')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'steps' && (
        <div className="space-y-6">
          {/* Step-by-Step Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.stepBreakdown', 'Step-by-Step Breakdown')}</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.steps && analytics.steps.length > 0 ? (
                <TourStepsBreakdown
                  steps={analytics.steps}
                  height={400}
                  showChart={true}
                  showList={true}
                  highlightDropOffs={true}
                />
              ) : (
                <EmptyState
                  title={t('analytics.noStepsData', 'No step data yet')}
                  description={t('analytics.noStepsDataDesc', 'Step analytics will appear once users interact with your tour.')}
                  size="sm"
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'heatmap' && (
        <div className="space-y-6">
          {/* Activity Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.activityHeatmap', 'Activity Heatmap')}</CardTitle>
            </CardHeader>
            <CardContent>
              <TourHeatmap
                data={analytics?.timeline || []}
                metric="impressions"
                color="purple"
                weeks={dateRange === '7d' ? 4 : dateRange === '30d' ? 12 : 16}
              />
            </CardContent>
          </Card>

          {/* Completions Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.completionsHeatmap', 'Completions Heatmap')}</CardTitle>
            </CardHeader>
            <CardContent>
              <TourHeatmap
                data={analytics?.timeline || []}
                metric="completions"
                color="green"
                weeks={dateRange === '7d' ? 4 : dateRange === '30d' ? 12 : 16}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Summary Card Component
function SummaryCard({ title, value, icon: Icon, color, trend, trendLabel }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
  };

  const trendValue = parseFloat(trend);
  const isPositive = trendValue > 0;
  const isNegative = trendValue < 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`mt-3 flex items-center gap-1 text-sm ${
            isPositive ? 'text-green-600 dark:text-green-400' : isNegative ? 'text-red-600 dark:text-red-400' : 'text-gray-500'
          }`}>
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : isNegative ? (
              <TrendingDown className="w-4 h-4" />
            ) : null}
            <span>
              {isPositive && '+'}{trendValue}% {trendLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '-';
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}
