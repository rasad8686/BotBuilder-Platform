import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Trophy,
  TrendingUp,
  Users,
  Target,
  Calendar,
  Clock,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Download,
  RefreshCw,
  CheckCircle,
  Play,
  Pause,
  StopCircle,
  Settings
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingState, ErrorState } from '../../components/ui/States';
import ABTestStatusBadge from '../../components/ab-tests/ABTestStatusBadge';
import ConversionChart from '../../components/ab-tests/analytics/ConversionChart';
import VariantFunnelChart from '../../components/ab-tests/analytics/VariantFunnelChart';
import TestMetricsCards from '../../components/ab-tests/analytics/TestMetricsCards';
import ConversionTable from '../../components/ab-tests/analytics/ConversionTable';
import StatisticalSignificance from '../../components/ab-tests/StatisticalSignificance';
import WinnerDeclaration from '../../components/ab-tests/WinnerDeclaration';
import VariantComparisonCard from '../../components/ab-tests/VariantComparisonCard';
// New analytics components
import {
  ABTestComparisonChart,
  ABTestTimelineChart,
  ABTestFunnelChart,
  ConfidenceIndicator,
  LiftIndicator,
  SampleSizeIndicator,
  VariantPerformanceTable,
  ConversionTrendChart,
  HourlyHeatmap,
  TestDurationCard,
  WinnerSummaryCard
} from '../../components/ab-tests/analytics';
import {
  useABTestQuery,
  useABTestResultsQuery,
  useCompleteTestMutation,
  useDeclareWinnerMutation
} from '../../hooks/ab-tests/useABTests';
import { useAnalyticsExport } from '../../hooks/ab-tests';

export default function ABTestResultsPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  // State
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [dateRange, setDateRange] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');

  // Export hook
  const { exportVariantsToCSV, exportTimelineToCSV, exporting } = useAnalyticsExport();

  // Queries & Mutations
  const { data: test, isLoading: testLoading, error: testError } = useABTestQuery(id);
  const { data: results, isLoading: resultsLoading, error: resultsError, refetch } = useABTestResultsQuery(id);
  const completeMutation = useCompleteTestMutation();
  const declareWinnerMutation = useDeclareWinnerMutation();

  const isLoading = testLoading || resultsLoading;
  const error = testError || resultsError;

  // Calculate winner and statistical significance
  const analysis = useMemo(() => {
    if (!results?.variants) return null;

    const variants = results.variants;
    const sorted = [...variants].sort((a, b) => b.conversion_rate - a.conversion_rate);
    const leader = sorted[0];
    const control = variants.find(v => v.is_control);

    // Simple statistical significance calculation
    const sampleSize = variants.reduce((sum, v) => sum + v.visitors, 0);
    const hasEnoughData = sampleSize >= 100;

    let significance = 0;
    if (control && leader && leader.id !== control.id) {
      const diff = leader.conversion_rate - control.conversion_rate;
      const pooledRate = (leader.conversions + control.conversions) / (leader.visitors + control.visitors);
      const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1/leader.visitors + 1/control.visitors));
      const zScore = diff / (se || 1);
      significance = Math.min(99.9, Math.abs(zScore) * 20); // Simplified
    }

    return {
      leader,
      control,
      sorted,
      significance: hasEnoughData ? significance : 0,
      hasEnoughData,
      improvementRate: control ? ((leader.conversion_rate - control.conversion_rate) / (control.conversion_rate || 1)) * 100 : 0
    };
  }, [results]);

  // Handlers
  const handleCompleteTest = async () => {
    await completeMutation.mutateAsync(id);
  };

  const handleDeclareWinner = async (variantId) => {
    await declareWinnerMutation.mutateAsync({ testId: id, variantId });
  };

  const handleExportResults = () => {
    // Create CSV export
    const headers = ['Variant', 'Visitors', 'Conversions', 'Conversion Rate', 'Revenue'];
    const rows = results.variants.map(v => [
      v.name,
      v.visitors,
      v.conversions,
      `${v.conversion_rate.toFixed(2)}%`,
      `$${v.revenue?.toFixed(2) || '0.00'}`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ab-test-${test.name}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <LoadingState title={t('abTests.loadingResults', 'Loading results...')} fullPage />;
  }

  if (error) {
    return (
      <ErrorState
        title={t('abTests.resultsError', 'Failed to load results')}
        description={error.message}
        onRetry={refetch}
        fullPage
      />
    );
  }

  const isRunning = test?.status === 'running';
  const isCompleted = test?.status === 'completed';
  const hasWinner = test?.winner_variant_id;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/ab-tests')}
            className="mb-2"
          >
            {t('common.back', 'Back')}
          </Button>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {test?.name}
            </h1>
            <ABTestStatusBadge status={test?.status} />
          </div>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('abTests.resultsFor', 'Results and analytics for this A/B test')}
          </p>

          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(test?.created_at).toLocaleDateString()}
            </span>
            {results?.duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {results.duration}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            icon={RefreshCw}
            onClick={refetch}
          >
            {t('common.refresh', 'Refresh')}
          </Button>

          <Button
            variant="outline"
            icon={Download}
            onClick={handleExportResults}
          >
            {t('abTests.export', 'Export')}
          </Button>

          {isRunning && (
            <Button
              variant="primary"
              icon={CheckCircle}
              onClick={handleCompleteTest}
              loading={completeMutation.isPending}
            >
              {t('abTests.completeTest', 'Complete Test')}
            </Button>
          )}
        </div>
      </div>

      {/* Winner Declaration */}
      {analysis && (analysis.significance >= 95 || isCompleted) && (
        <WinnerDeclaration
          leader={analysis.leader}
          control={analysis.control}
          significance={analysis.significance}
          improvementRate={analysis.improvementRate}
          hasWinner={hasWinner}
          winnerVariantId={test?.winner_variant_id}
          onDeclareWinner={handleDeclareWinner}
          loading={declareWinnerMutation.isPending}
          disabled={isCompleted && hasWinner}
        />
      )}

      {/* Metrics Overview */}
      <TestMetricsCards
        totalVisitors={results?.total_visitors || 0}
        totalConversions={results?.total_conversions || 0}
        avgConversionRate={results?.avg_conversion_rate || 0}
        totalRevenue={results?.total_revenue || 0}
        uplift={analysis?.improvementRate || 0}
      />

      {/* Statistical Significance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            {t('abTests.statisticalAnalysis', 'Statistical Analysis')}
          </CardTitle>
        </CardHeader>
        <div className="p-6">
          <StatisticalSignificance
            significance={analysis?.significance || 0}
            hasEnoughData={analysis?.hasEnoughData}
            sampleSize={results?.total_visitors || 0}
            recommendedSize={1000}
          />
        </div>
      </Card>

      {/* Variant Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {results?.variants?.map((variant, index) => (
          <VariantComparisonCard
            key={variant.id}
            variant={variant}
            isLeader={analysis?.leader?.id === variant.id}
            isControl={variant.is_control}
            control={analysis?.control}
            onClick={() => setSelectedVariant(variant.id)}
            selected={selectedVariant === variant.id}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              {t('abTests.conversionOverTime', 'Conversion Over Time')}
            </CardTitle>
          </CardHeader>
          <div className="p-6">
            <ConversionChart
              data={results?.time_series || []}
              variants={results?.variants || []}
            />
          </div>
        </Card>

        {/* Funnel Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              {t('abTests.conversionFunnel', 'Conversion Funnel')}
            </CardTitle>
          </CardHeader>
          <div className="p-6">
            <VariantFunnelChart
              variants={results?.variants || []}
            />
          </div>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            {t('abTests.detailedBreakdown', 'Detailed Breakdown')}
          </CardTitle>
        </CardHeader>
        <div className="p-6">
          <ConversionTable
            variants={results?.variants || []}
            goalMetric={test?.goal_metric}
          />
        </div>
      </Card>

      {/* Enhanced Analytics Section */}
      <div className="border-t border-gray-200 dark:border-slate-700 pt-6 mt-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {t('abTests.advancedAnalytics', 'Advanced Analytics')}
        </h2>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-slate-700 mb-6">
          <nav className="flex gap-4">
            {[
              { id: 'overview', label: t('abTests.overview', 'Overview') },
              { id: 'timeline', label: t('abTests.timeline', 'Timeline') },
              { id: 'funnel', label: t('abTests.funnel', 'Funnel') },
              { id: 'heatmap', label: t('abTests.heatmap', 'Heatmap') }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
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
            {/* Winner Summary + Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <WinnerSummaryCard
                  winner={analysis?.leader}
                  control={analysis?.control}
                  confidence={analysis?.significance || 0}
                  isSignificant={(analysis?.significance || 0) >= 95}
                  status={test?.status}
                />
              </div>
              <div className="space-y-4">
                <ConfidenceIndicator
                  confidence={analysis?.significance || 0}
                  threshold={95}
                  size="md"
                />
                <SampleSizeIndicator
                  current={results?.total_visitors || 0}
                  recommended={1000}
                  dailyRate={results?.daily_rate || 0}
                />
              </div>
            </div>

            {/* Comparison Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t('abTests.variantComparison', 'Variant Comparison')}</CardTitle>
              </CardHeader>
              <div className="p-6">
                <ABTestComparisonChart
                  variants={results?.variants?.map(v => ({
                    name: v.name,
                    impressions: v.visitors,
                    conversions: v.conversions,
                    conversionRate: v.conversion_rate,
                    isControl: v.is_control
                  })) || []}
                  height={300}
                  showConfidenceIntervals={true}
                />
              </div>
            </Card>

            {/* Variant Performance Table */}
            <VariantPerformanceTable
              variants={results?.variants?.map(v => ({
                name: v.name,
                impressions: v.visitors,
                conversions: v.conversions,
                conversionRate: v.conversion_rate,
                confidence: analysis?.significance || 0,
                isControl: v.is_control
              })) || []}
              winnerVariant={analysis?.leader?.name}
              onExport={(data) => exportVariantsToCSV(data, test?.name)}
            />

            {/* Lift Indicators */}
            {analysis?.control && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {results?.variants?.filter(v => !v.is_control).map(variant => {
                  const lift = analysis.control.conversion_rate > 0
                    ? ((variant.conversion_rate - analysis.control.conversion_rate) / analysis.control.conversion_rate) * 100
                    : 0;
                  return (
                    <LiftIndicator
                      key={variant.id}
                      lift={lift}
                      baseline={`vs ${analysis.control.name}`}
                      size="md"
                    />
                  );
                })}
              </div>
            )}

            {/* Test Duration */}
            <TestDurationCard
              startDate={test?.created_at}
              endDate={test?.completed_at}
              targetEndDate={test?.end_date}
              status={test?.status}
              minDuration={7}
            />
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('abTests.conversionTrend', 'Conversion Rate Trend')}</CardTitle>
              </CardHeader>
              <div className="p-6">
                <ConversionTrendChart
                  data={results?.time_series?.map(d => ({
                    date: d.date,
                    variantName: d.variant_name,
                    conversionRate: d.conversion_rate
                  })) || []}
                  height={400}
                  showComparison={true}
                />
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('abTests.dailyPerformance', 'Daily Performance')}</CardTitle>
              </CardHeader>
              <div className="p-6">
                <ABTestTimelineChart
                  data={results?.time_series?.map(d => ({
                    date: d.date,
                    variantName: d.variant_name,
                    conversionRate: d.conversion_rate,
                    conversions: d.conversions
                  })) || []}
                  height={350}
                  metric="conversions"
                />
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'funnel' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('abTests.conversionFunnel', 'Conversion Funnel')}</CardTitle>
              </CardHeader>
              <div className="p-6">
                <ABTestFunnelChart
                  variants={results?.variants?.map(v => ({
                    name: v.name,
                    impressions: v.visitors,
                    engagements: v.visitors,
                    conversions: v.conversions,
                    isControl: v.is_control
                  })) || []}
                  winnerVariant={analysis?.leader?.name}
                />
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'heatmap' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {results?.variants?.slice(0, 2).map(variant => (
                <HourlyHeatmap
                  key={variant.id}
                  data={results?.hourly_data?.filter(d => d.variant_name === variant.name).map(d => ({
                    dayOfWeek: d.day_of_week,
                    hour: d.hour,
                    conversionRate: d.conversion_rate,
                    variantName: d.variant_name
                  })) || []}
                  variant={variant.name}
                  title={`Variant ${variant.name} - Hourly Performance`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
