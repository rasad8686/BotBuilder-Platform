/**
 * WinnerSummaryCard Component
 * Displays winner announcement with key metrics
 */

import { useTranslation } from 'react-i18next';
import { Trophy, TrendingUp, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

/**
 * WinnerSummaryCard Component
 * @param {Object} props
 * @param {Object} props.winner - Winner variant data
 * @param {Object} props.control - Control variant data
 * @param {number} props.confidence - Statistical confidence
 * @param {boolean} props.isSignificant - Whether result is statistically significant
 * @param {string} props.status - Test status
 */
export default function WinnerSummaryCard({
  winner,
  control,
  confidence = 0,
  isSignificant = false,
  status = 'running'
}) {
  const { t } = useTranslation();

  // Calculate lift
  const controlRate = control?.impressions > 0
    ? (control.conversions / control.impressions) * 100
    : 0;
  const winnerRate = winner?.impressions > 0
    ? (winner.conversions / winner.impressions) * 100
    : 0;
  const lift = controlRate > 0
    ? ((winnerRate - controlRate) / controlRate) * 100
    : 0;

  // No winner yet
  if (!winner || !isSignificant) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-full">
            {status === 'running' ? (
              <Clock className="w-6 h-6 text-gray-500" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {status === 'running'
                ? t('abTests.noWinnerYet', 'No Winner Yet')
                : t('abTests.noSignificantWinner', 'No Significant Winner')
              }
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {status === 'running'
                ? t('abTests.testStillRunning', 'Test is still collecting data')
                : t('abTests.insufficientSignificance', 'Results did not reach statistical significance')
              }
            </p>
          </div>
        </div>

        {/* Current leader */}
        {winner && (
          <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {t('abTests.currentLeader', 'Current Leader')}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  Variant {winner.name || winner.variantName}
                </span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {winnerRate.toFixed(2)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('abTests.conversionRate', 'Conversion Rate')}
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm text-amber-600 dark:text-amber-400">
              {t('abTests.confidenceNeeded', `Need ${(95 - confidence).toFixed(1)}% more confidence for significance`)}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800 p-6">
      {/* Winner badge */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-amber-200 dark:bg-amber-800 rounded-full">
          <Trophy className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            {t('abTests.winnerDeclared', 'Winner Declared')}
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            Variant {winner.name || winner.variantName}
          </h3>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Conversion Rate */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('abTests.conversionRate', 'Conversion Rate')}
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {winnerRate.toFixed(2)}%
          </div>
        </div>

        {/* Lift */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('abTests.liftVsControl', 'Lift vs Control')}
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              +{lift.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Comparison */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-lg mb-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t('abTests.comparison', 'Comparison')}
        </h4>
        <div className="space-y-3">
          {/* Winner */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-gray-900 dark:text-white">
                Variant {winner.name || winner.variantName}
              </span>
            </div>
            <div className="text-right">
              <span className="font-bold text-gray-900 dark:text-white">
                {winnerRate.toFixed(2)}%
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                ({winner.conversions?.toLocaleString()} / {winner.impressions?.toLocaleString()})
              </span>
            </div>
          </div>

          {/* Control */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">
                Variant {control.name || control.variantName} (Control)
              </span>
            </div>
            <div className="text-right">
              <span className="text-gray-600 dark:text-gray-400">
                {controlRate.toFixed(2)}%
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                ({control.conversions?.toLocaleString()} / {control.impressions?.toLocaleString()})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
        <span className="text-sm font-medium text-green-700 dark:text-green-400">
          {t('abTests.statisticallySignificant', `Statistically significant at ${confidence.toFixed(1)}% confidence`)}
        </span>
      </div>

      {/* Recommendation */}
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
          {t('abTests.recommendation', 'Recommendation')}
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          {t('abTests.winnerRecommendation',
            `Based on the results, we recommend implementing Variant ${winner.name || winner.variantName}. ` +
            `This variant shows a ${lift.toFixed(1)}% improvement in conversion rate with ${confidence.toFixed(1)}% statistical confidence.`
          )}
        </p>
      </div>
    </div>
  );
}
