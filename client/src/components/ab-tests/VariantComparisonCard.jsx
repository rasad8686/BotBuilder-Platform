import { useTranslation } from 'react-i18next';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Target,
  DollarSign
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export default function VariantComparisonCard({
  variant,
  isLeader,
  isControl,
  control,
  onClick,
  selected
}) {
  const { t } = useTranslation();

  const improvement = control && variant.id !== control.id
    ? ((variant.conversion_rate - control.conversion_rate) / (control.conversion_rate || 1)) * 100
    : 0;

  const isPositive = improvement > 0;
  const isNeutral = Math.abs(improvement) < 1;

  return (
    <Card
      className={`
        cursor-pointer transition-all
        ${selected ? 'ring-2 ring-purple-500' : ''}
        ${isLeader ? 'border-green-300 dark:border-green-700' : ''}
      `}
      onClick={onClick}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {variant.name}
              </h3>
              {isControl && (
                <Badge variant="secondary" size="sm">
                  {t('abTests.control', 'Control')}
                </Badge>
              )}
              {isLeader && (
                <Badge variant="success" size="sm">
                  <Trophy className="w-3 h-3 mr-1" />
                  {t('abTests.leader', 'Leader')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {variant.traffic_percentage}% {t('abTests.traffic', 'traffic')}
            </p>
          </div>

          {!isControl && control && (
            <div className={`
              flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium
              ${isNeutral
                ? 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400'
                : isPositive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }
            `}>
              {isNeutral ? (
                <Minus className="w-4 h-4" />
              ) : isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {isNeutral ? '~0%' : `${isPositive ? '+' : ''}${improvement.toFixed(1)}%`}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs">{t('abTests.visitors', 'Visitors')}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {variant.visitors?.toLocaleString() || 0}
            </p>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs">{t('abTests.conversions', 'Conversions')}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {variant.conversions?.toLocaleString() || 0}
            </p>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">{t('abTests.convRate', 'Conv. Rate')}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {variant.conversion_rate?.toFixed(2) || 0}%
            </p>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs">{t('abTests.revenue', 'Revenue')}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              ${variant.revenue?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>

        {/* Confidence Interval */}
        {variant.confidence_interval && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {t('abTests.confidenceInterval', '95% Confidence Interval')}
            </p>
            <div className="relative h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="absolute h-full bg-purple-500 rounded-full"
                style={{
                  left: `${variant.confidence_interval.low}%`,
                  width: `${variant.confidence_interval.high - variant.confidence_interval.low}%`
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>{variant.confidence_interval.low.toFixed(1)}%</span>
              <span>{variant.confidence_interval.high.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
