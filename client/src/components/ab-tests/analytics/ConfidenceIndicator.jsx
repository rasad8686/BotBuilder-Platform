/**
 * ConfidenceIndicator Component
 * Visual confidence meter for statistical significance
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';

/**
 * Get color based on confidence level
 */
const getConfidenceColor = (confidence, threshold = 95) => {
  if (confidence >= threshold) {
    return {
      ring: 'stroke-green-500',
      fill: 'fill-green-500',
      text: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
      label: 'Significant'
    };
  }
  if (confidence >= 90) {
    return {
      ring: 'stroke-amber-500',
      fill: 'fill-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      label: 'Close'
    };
  }
  return {
    ring: 'stroke-red-500',
    fill: 'fill-red-500',
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    label: 'Not Significant'
  };
};

/**
 * Circular progress ring
 */
function CircularProgress({ value, size = 120, strokeWidth = 10, colors }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-gray-200 dark:text-slate-700"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={`${colors.ring} transition-all duration-500`}
      />
    </svg>
  );
}

/**
 * ConfidenceIndicator Component
 * @param {Object} props
 * @param {number} props.confidence - Confidence percentage (0-100)
 * @param {number} props.threshold - Significance threshold (default: 95)
 * @param {string} props.size - Size variant ('sm', 'md', 'lg')
 * @param {boolean} props.showLabel - Show label below
 * @param {boolean} props.showTooltip - Show info tooltip
 */
export default function ConfidenceIndicator({
  confidence = 0,
  threshold = 95,
  size = 'md',
  showLabel = true,
  showTooltip = true
}) {
  const { t } = useTranslation();

  const colors = useMemo(() => getConfidenceColor(confidence, threshold), [confidence, threshold]);

  const sizeConfig = {
    sm: { ring: 80, stroke: 6, text: 'text-lg' },
    md: { ring: 120, stroke: 10, text: 'text-2xl' },
    lg: { ring: 160, stroke: 12, text: 'text-3xl' }
  };

  const config = sizeConfig[size] || sizeConfig.md;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <CircularProgress
          value={Math.min(confidence, 100)}
          size={config.ring}
          strokeWidth={config.stroke}
          colors={colors}
        />

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${config.text} ${colors.text}`}>
            {confidence.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Label */}
      {showLabel && (
        <div className="mt-3 text-center">
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
            {colors.label}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('abTests.statisticalConfidence', 'Statistical Confidence')}
          </p>
        </div>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div className="mt-2 group relative">
          <Info className="w-4 h-4 text-gray-400 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            {confidence >= threshold ? (
              <p>
                {t('abTests.confidenceExplanationHigh',
                  `There is a ${confidence.toFixed(1)}% probability that the observed difference is real and not due to chance. This exceeds the ${threshold}% threshold needed to declare a winner.`
                )}
              </p>
            ) : (
              <p>
                {t('abTests.confidenceExplanationLow',
                  `The confidence level of ${confidence.toFixed(1)}% is below the ${threshold}% threshold. More data is needed to determine a statistically significant winner.`
                )}
              </p>
            )}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}

      {/* Threshold indicator */}
      <div className="mt-2 text-xs text-gray-400">
        {t('abTests.thresholdNeeded', 'Threshold needed')}: {threshold}%
      </div>
    </div>
  );
}
