import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Trophy,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Award
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export default function WinnerDeclaration({
  leader,
  control,
  significance,
  improvementRate,
  hasWinner,
  winnerVariantId,
  onDeclareWinner,
  loading,
  disabled
}) {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);

  const isStatisticallySignificant = significance >= 95;
  const isLeaderControl = leader?.id === control?.id;

  const handleDeclare = () => {
    if (showConfirm) {
      onDeclareWinner(leader.id);
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
    }
  };

  if (hasWinner) {
    return (
      <Card className="border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/40 rounded-full">
              <Trophy className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">
                {t('abTests.winnerDeclared', 'Winner Declared')}
              </h3>
              <p className="text-sm text-green-700 dark:text-green-400">
                {leader?.name || 'Variant'} {t('abTests.wonTheTest', 'won this A/B test')}
              </p>
            </div>
            <Badge variant="success" size="lg">
              <Award className="w-4 h-4 mr-1" />
              {t('abTests.winner', 'Winner')}
            </Badge>
          </div>

          <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                {improvementRate > 0 ? '+' : ''}{improvementRate.toFixed(1)}%
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                {t('abTests.improvement', 'Improvement')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                {leader?.conversion_rate?.toFixed(2)}%
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                {t('abTests.conversionRate', 'Conversion Rate')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                {significance.toFixed(1)}%
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                {t('abTests.confidence', 'Confidence')}
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (isLeaderControl) {
    return (
      <Card className="border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20">
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/40 rounded-full">
              <AlertTriangle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">
                {t('abTests.controlLeading', 'Control Variant is Leading')}
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                {t('abTests.controlLeadingDesc', 'The original version is performing better than the variations.')}
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={isStatisticallySignificant ? 'border-green-300 dark:border-green-700' : ''}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${
            isStatisticallySignificant
              ? 'bg-green-100 dark:bg-green-900/40'
              : 'bg-purple-100 dark:bg-purple-900/40'
          }`}>
            <Trophy className={`w-8 h-8 ${
              isStatisticallySignificant
                ? 'text-green-600 dark:text-green-400'
                : 'text-purple-600 dark:text-purple-400'
            }`} />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {isStatisticallySignificant
                ? t('abTests.readyToDeclare', 'Ready to Declare a Winner')
                : t('abTests.currentLeader', 'Current Leader')
              }
            </h3>

            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {leader?.name}
              </span>
              <Badge variant={isStatisticallySignificant ? 'success' : 'secondary'}>
                <TrendingUp className="w-3 h-3 mr-1" />
                {improvementRate > 0 ? '+' : ''}{improvementRate.toFixed(1)}% {t('abTests.vsControl', 'vs Control')}
              </Badge>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isStatisticallySignificant
                ? t('abTests.readyToDeclareDesc', 'With {{confidence}}% statistical confidence, you can declare {{name}} as the winner.', {
                    confidence: significance.toFixed(1),
                    name: leader?.name
                  })
                : t('abTests.notReadyDesc', 'Continue testing to reach statistical significance (95% confidence).')
              }
            </p>
          </div>

          {isStatisticallySignificant && (
            <div className="shrink-0">
              {showConfirm ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfirm(false)}
                  >
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button
                    variant="success"
                    icon={CheckCircle}
                    onClick={handleDeclare}
                    loading={loading}
                    disabled={disabled}
                  >
                    {t('abTests.confirm', 'Confirm')}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="success"
                  icon={Trophy}
                  onClick={handleDeclare}
                  disabled={disabled}
                >
                  {t('abTests.declareWinner', 'Declare Winner')}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {leader?.visitors?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('abTests.visitors', 'Visitors')}
            </p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {leader?.conversions?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('abTests.conversions', 'Conversions')}
            </p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {leader?.conversion_rate?.toFixed(2) || 0}%
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('abTests.convRate', 'Conv. Rate')}
            </p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${
              isStatisticallySignificant
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-900 dark:text-white'
            }`}>
              {significance.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('abTests.confidence', 'Confidence')}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
