/**
 * LiftIndicator Component
 * Displays lift percentage with visual indicator
 */

import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * LiftIndicator Component
 * @param {Object} props
 * @param {number} props.lift - Lift percentage
 * @param {string} props.baseline - Baseline label (e.g., "vs Control")
 * @param {string} props.size - Size variant ('sm', 'md', 'lg')
 * @param {boolean} props.showIcon - Show trend icon
 */
export default function LiftIndicator({
  lift = 0,
  baseline = 'vs Control',
  size = 'md',
  showIcon = true
}) {
  const { t } = useTranslation();

  const liftValue = parseFloat(lift) || 0;
  const isPositive = liftValue > 0;
  const isNegative = liftValue < 0;
  const isNeutral = liftValue === 0;

  const sizeConfig = {
    sm: {
      text: 'text-lg',
      icon: 'w-4 h-4',
      label: 'text-xs'
    },
    md: {
      text: 'text-2xl',
      icon: 'w-5 h-5',
      label: 'text-sm'
    },
    lg: {
      text: 'text-4xl',
      icon: 'w-6 h-6',
      label: 'text-base'
    }
  };

  const config = sizeConfig[size] || sizeConfig.md;

  const colorClasses = isPositive
    ? 'text-green-600 dark:text-green-400'
    : isNegative
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-500 dark:text-gray-400';

  const bgClasses = isPositive
    ? 'bg-green-50 dark:bg-green-900/20'
    : isNegative
      ? 'bg-red-50 dark:bg-red-900/20'
      : 'bg-gray-50 dark:bg-gray-900/20';

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div className={`inline-flex flex-col items-center p-3 rounded-lg ${bgClasses}`}>
      <div className={`flex items-center gap-2 ${colorClasses}`}>
        {showIcon && <Icon className={config.icon} />}
        <span className={`font-bold ${config.text}`}>
          {isPositive && '+'}
          {liftValue.toFixed(1)}%
        </span>
      </div>

      <span className={`mt-1 text-gray-500 dark:text-gray-400 ${config.label}`}>
        {baseline}
      </span>

      {/* Status label */}
      {!isNeutral && (
        <span className={`mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
          isPositive
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          {isPositive
            ? t('abTests.outperforming', 'Outperforming')
            : t('abTests.underperforming', 'Underperforming')
          }
        </span>
      )}
    </div>
  );
}
